import assert from "node:assert/strict";
import test from "node:test";

import {
  bootstrapLocalAccess,
  bootstrapLocalAccounts,
} from "./bootstrap-local-users.mjs";

const organizationId = "10000000-0000-0000-0000-000000000001";
const ownerId = "a0000000-0000-0000-0000-000000000001";
const managerId = "a0000000-0000-0000-0000-000000000002";
const userId = "a0000000-0000-0000-0000-000000000003";

const users = [
  { email: "user@user.com", password: "User@1234", role: "CUSTOMER" },
  { email: "manager@manager.com", password: "Manager@1234", role: "MANAGER" },
  { email: "owner@owner.com", password: "Owner@1234", role: "OWNER" },
];

const config = {
  applicationApiUrl: "http://backend:8080",
  authUrl: "http://auth:9999",
  organizationId,
  serviceRoleKey: "local-service-role-key",
  users,
};

test("creates missing Auth users and provisions every application account", async () => {
  const calls = [];
  let ownerSubject;
  const idsByEmail = new Map([
    ["user@user.com", userId],
    ["manager@manager.com", managerId],
    ["owner@owner.com", ownerId],
  ]);

  await bootstrapLocalAccounts(config, {
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ body, method: options.method ?? "GET", url });
      if (url.includes("/admin/users?")) {
        assert.equal(url.endsWith("?page=1&per_page=1000"), true);
        return json({ users: [] });
      }
      if (url.endsWith("/admin/users")) {
        return json({ id: idsByEmail.get(body.email), email: body.email });
      }
      if (url.includes("/token?grant_type=password")) {
        return json({
          access_token: `token-for-${body.email}`,
          user: { id: idsByEmail.get(body.email), email: body.email },
        });
      }
      if (url.endsWith("/api/v1/customer/account")) return json({}, 201);
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    },
    writeOwnerSubject: async (subject) => {
      ownerSubject = subject;
    },
  });

  assert.equal(ownerSubject, ownerId);
  assert.equal(calls.filter((call) =>
    call.method === "POST" && call.url.endsWith("/admin/users")).length, 3);
  assert.equal(calls.filter((call) =>
    call.method === "POST" && call.url.endsWith("/api/v1/customer/account")).length, 3);
  assert.equal(calls.some((call) => call.body?.password === "User@1234"), true);
});

test("reconciles existing local users without creating duplicates", async () => {
  const calls = [];
  const existing = users.map((user, index) => ({
    id: [userId, managerId, ownerId][index],
    email: user.email,
  }));

  await bootstrapLocalAccounts(config, {
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ body, method: options.method ?? "GET", url });
      if (url.includes("/admin/users?")) return json({ users: existing });
      if (url.includes("/admin/users/")) return json({ id: url.split("/").at(-1) });
      if (url.includes("/token?grant_type=password")) {
        const found = existing.find((candidate) => candidate.email === body.email);
        return json({ access_token: `token-for-${body.email}`, user: found });
      }
      if (url.endsWith("/api/v1/customer/account")) return json({});
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    },
    writeOwnerSubject: async () => {},
  });

  assert.equal(calls.filter((call) => call.method === "POST"
    && call.url.endsWith("/admin/users")).length, 0);
  assert.equal(calls.filter((call) => call.method === "PUT"
    && call.url.includes("/admin/users/")).length, 3);
});

test("grants the manager every active location through the owner API", async () => {
  const calls = [];
  const locationIds = [
    "20000000-0000-0000-0000-000000000001",
    "20000000-0000-0000-0000-000000000002",
  ];

  await bootstrapLocalAccess(config, {
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ body, method: options.method ?? "GET", url });
      if (url.includes("/token?grant_type=password")) {
        return json({ access_token: "owner-access-token", user: { id: ownerId } });
      }
      if (url.endsWith("/api/v1/guest/locations")) {
        return json(locationIds.map((id) => ({ id })));
      }
      if (url.endsWith(`/api/v1/staff/organizations/${organizationId}/managers`)) {
        return json({ email: "manager@manager.com" }, 201);
      }
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    },
  });

  const grant = calls.find((call) => call.method === "POST"
    && call.url.endsWith(`/api/v1/staff/organizations/${organizationId}/managers`));
  assert.deepEqual(grant.body, {
    email: "manager@manager.com",
    locationIds,
  });
});

test("repairs existing manager assignments through the versioned owner API", async () => {
  const calls = [];
  const firstLocation = "20000000-0000-0000-0000-000000000001";
  const secondLocation = "20000000-0000-0000-0000-000000000002";
  const membershipId = "b0000000-0000-0000-0000-000000000001";

  await bootstrapLocalAccess(config, {
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ body, method: options.method ?? "GET", url });
      if (url.includes("/token?grant_type=password")) {
        return json({ access_token: "owner-access-token", user: { id: ownerId } });
      }
      if (url.endsWith("/api/v1/guest/locations")) {
        return json([{ id: firstLocation }, { id: secondLocation }]);
      }
      if ((options.method ?? "GET") === "POST" && url.endsWith("/managers")) {
        return json({ code: "MANAGER_CONFLICT" }, 409);
      }
      if ((options.method ?? "GET") === "GET" && url.includes("/managers?")) {
        return json({
          items: [{
            active: true,
            email: "manager@manager.com",
            id: membershipId,
            locations: [{ id: firstLocation }],
            version: 4,
          }],
        });
      }
      if ((options.method ?? "GET") === "PUT"
          && url.endsWith(`/managers/${membershipId}/assignments`)) return json({});
      throw new Error(`Unexpected request: ${options.method ?? "GET"} ${url}`);
    },
  });

  const repair = calls.find((call) => call.method === "PUT");
  assert.deepEqual(repair.body, {
    locationIds: [firstLocation, secondLocation],
    version: 4,
  });
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}
