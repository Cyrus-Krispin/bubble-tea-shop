import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export async function bootstrapLocalAccounts(config, dependencies = {}) {
  const fetchImpl = dependencies.fetch ?? fetch;
  const existingUsers = await listAuthUsers(config, fetchImpl);
  const subjects = new Map();

  for (const user of config.users) {
    const existing = existingUsers.find((candidate) =>
      normalizeEmail(candidate.email) === normalizeEmail(user.email));
    await reconcileAuthUser(config, user, existing, fetchImpl);
    const session = await signIn(config, user, fetchImpl);
    await provisionApplicationAccount(config, session.accessToken, fetchImpl);
    subjects.set(user.role, session.userId);
  }

  const ownerSubject = subjects.get("OWNER");
  if (!ownerSubject) throw new Error("Local owner account configuration is missing.");
  await dependencies.writeOwnerSubject(ownerSubject);
}

export async function bootstrapLocalAccess(config, dependencies = {}) {
  const fetchImpl = dependencies.fetch ?? fetch;
  const owner = userWithRole(config, "OWNER");
  const manager = userWithRole(config, "MANAGER");
  const session = await signIn(config, owner, fetchImpl);
  const locations = await requestJson(
    fetchImpl,
    `${config.applicationApiUrl}/api/v1/guest/locations`,
  );
  const locationIds = locations.map((location) => location.id);
  if (locationIds.length === 0 || new Set(locationIds).size !== locationIds.length) {
    throw new Error("Local manager bootstrap requires distinct active locations.");
  }

  const managersUrl = `${config.applicationApiUrl}/api/v1/staff/organizations/`
    + `${config.organizationId}/managers`;
  const response = await fetchImpl(managersUrl, {
    body: JSON.stringify({ email: manager.email, locationIds }),
    headers: bearerJsonHeaders(session.accessToken),
    method: "POST",
  });
  if (response.ok) return;
  if (response.status !== 409) await throwRequestError(response, "grant local manager access");

  const page = await requestJson(fetchImpl, `${managersUrl}?page=0&size=100`, {
    headers: bearerJsonHeaders(session.accessToken),
  });
  const membership = page.items.find((candidate) =>
    normalizeEmail(candidate.email) === normalizeEmail(manager.email));
  if (!membership?.active) {
    throw new Error("Existing local manager membership is unavailable.");
  }

  const assigned = membership.locations.map((location) => location.id).sort();
  const expected = [...locationIds].sort();
  if (assigned.length === expected.length
      && assigned.every((locationId, index) => locationId === expected[index])) return;

  await requestJson(fetchImpl, `${managersUrl}/${membership.id}/assignments`, {
    body: JSON.stringify({ locationIds, version: membership.version }),
    headers: bearerJsonHeaders(session.accessToken),
    method: "PUT",
  });
}

async function listAuthUsers(config, fetchImpl) {
  const response = await requestJson(fetchImpl, `${config.authUrl}/admin/users?page=1&per_page=1000`, {
    headers: adminHeaders(config.serviceRoleKey),
  });
  if (!Array.isArray(response.users)) {
    throw new Error("Supabase Auth returned an invalid user list.");
  }
  return response.users;
}

async function reconcileAuthUser(config, user, existing, fetchImpl) {
  const body = JSON.stringify({
    email: normalizeEmail(user.email),
    email_confirm: true,
    password: user.password,
  });
  if (existing) {
    await requestJson(fetchImpl, `${config.authUrl}/admin/users/${existing.id}`, {
      body,
      headers: adminHeaders(config.serviceRoleKey),
      method: "PUT",
    });
    return;
  }
  await requestJson(fetchImpl, `${config.authUrl}/admin/users`, {
    body,
    headers: adminHeaders(config.serviceRoleKey),
    method: "POST",
  });
}

async function signIn(config, user, fetchImpl) {
  const response = await requestJson(
    fetchImpl,
    `${config.authUrl}/token?grant_type=password`,
    {
      body: JSON.stringify({ email: normalizeEmail(user.email), password: user.password }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );
  if (!response.access_token || !response.user?.id) {
    throw new Error(`Supabase Auth returned an invalid session for ${user.role}.`);
  }
  return { accessToken: response.access_token, userId: response.user.id };
}

async function provisionApplicationAccount(config, accessToken, fetchImpl) {
  await requestJson(fetchImpl, `${config.applicationApiUrl}/api/v1/customer/account`, {
    headers: bearerJsonHeaders(accessToken),
    method: "POST",
  });
}

async function requestJson(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, options);
  if (!response.ok) await throwRequestError(response, `${options.method ?? "GET"} ${url}`);
  if (response.status === 204) return undefined;
  return response.json();
}

async function throwRequestError(response, operation) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body.code ?? body.error_code ?? body.message ?? body.error ?? "";
  } catch {
    // Keep bootstrap errors generic when a dependency does not return JSON.
  }
  throw new Error(`${operation} failed with HTTP ${response.status}${detail ? ` (${detail})` : ""}.`);
}

function adminHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

function bearerJsonHeaders(accessToken) {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  };
}

function userWithRole(config, role) {
  const user = config.users.find((candidate) => candidate.role === role);
  if (!user) throw new Error(`Local ${role.toLowerCase()} account configuration is missing.`);
  return user;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function configFromEnvironment(environment) {
  return {
    applicationApiUrl: required(environment, "APPLICATION_API_URL"),
    authUrl: required(environment, "SUPABASE_AUTH_URL"),
    organizationId: required(environment, "LOCAL_BOOTSTRAP_ORGANIZATION_ID"),
    serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
    users: [
      localUser(environment, "CUSTOMER", "LOCAL_CUSTOMER_EMAIL", "LOCAL_CUSTOMER_PASSWORD"),
      localUser(environment, "MANAGER", "LOCAL_MANAGER_EMAIL", "LOCAL_MANAGER_PASSWORD"),
      localUser(environment, "OWNER", "LOCAL_OWNER_EMAIL", "LOCAL_OWNER_PASSWORD"),
    ],
  };
}

function localUser(environment, role, emailName, passwordName) {
  return {
    email: required(environment, emailName),
    password: required(environment, passwordName),
    role,
  };
}

function required(environment, name) {
  const value = environment[name];
  if (!value?.trim()) throw new Error(`${name} is required for local user bootstrap.`);
  return value;
}

async function main(environment) {
  const config = configFromEnvironment(environment);
  if (environment.LOCAL_USER_BOOTSTRAP_PHASE === "accounts") {
    config.serviceRoleKey = required(environment, "SUPABASE_SERVICE_ROLE_KEY");
    const ownerSubjectFile = required(environment, "LOCAL_OWNER_SUBJECT_FILE");
    await bootstrapLocalAccounts(config, {
      writeOwnerSubject: async (subject) => {
        await mkdir(dirname(ownerSubjectFile), { recursive: true });
        // The next one-shot runs as the unprivileged Spring image user. The file
        // contains only the public Auth subject UUID, so make it readable there.
        await writeFile(ownerSubjectFile, `${subject}\n`, { mode: 0o644 });
        await chmod(ownerSubjectFile, 0o644);
      },
    });
    console.log("local_user_bootstrap_accounts_completed count=3");
    return;
  }
  if (environment.LOCAL_USER_BOOTSTRAP_PHASE === "access") {
    await bootstrapLocalAccess(config);
    console.log("local_user_bootstrap_access_completed owner=1 manager=1 customer=1");
    return;
  }
  throw new Error("LOCAL_USER_BOOTSTRAP_PHASE must be accounts or access.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.env);
}
