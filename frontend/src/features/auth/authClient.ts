import { createClient, type Session } from "@supabase/supabase-js";
import createOpenApiClient from "openapi-fetch";

import type { paths } from "../../api/generated";
import type { AuthSession, Credentials } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "http://localhost:8000";
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "local-public-anon-key";

const authClient = createClient(supabaseUrl, publicAnonKey);
let customerAccessGate: Promise<boolean> | null = null;

export type RegistrationResult = {
  verificationRequired: boolean;
};

export async function signInWithEmailAndPassword(credentials: Credentials): Promise<void> {
  const { error } = await authClient.auth.signInWithPassword(credentials);

  if (error) {
    throw error;
  }
}

export async function signInCustomer(credentials: Credentials): Promise<void> {
  return withCustomerProvisioning(async () => {
    const { data, error } = await authClient.auth.signInWithPassword(credentials);

    if (error || data.session === null) {
      throw error ?? new Error("Customer sign-in did not return a session.");
    }

    await provisionAuthenticatedCustomer(data.session.access_token);
  });
}

export async function signUpCustomer(credentials: Credentials): Promise<RegistrationResult> {
  return withCustomerProvisioning(async () => {
    const { data, error } = await authClient.auth.signUp(credentials);

    if (error) {
      throw error;
    }

    if (data.session === null) {
      return { verificationRequired: true };
    }

    await provisionAuthenticatedCustomer(data.session.access_token);
    return { verificationRequired: false };
  });
}

async function withCustomerProvisioning<T>(operation: () => Promise<T>): Promise<T> {
  if (customerAccessGate !== null) {
    throw new Error("Customer authentication is already in progress.");
  }

  let finishGate: (provisioned: boolean) => void = () => undefined;
  const gate = new Promise<boolean>((resolve) => {
    finishGate = resolve;
  });
  customerAccessGate = gate;
  let provisioned = false;
  try {
    const result = await operation();
    provisioned = true;
    return result;
  } finally {
    finishGate(provisioned);
    if (customerAccessGate === gate) customerAccessGate = null;
  }
}

async function provisionAuthenticatedCustomer(accessToken: string): Promise<void> {
  try {
    await provisionCustomerAccount(accessToken);
  } catch (error) {
    await authClient.auth.signOut({ scope: "local" });
    throw error;
  }
}

async function provisionCustomerAccount(accessToken: string): Promise<void> {
  const client = createOpenApiClient<paths>({ baseUrl: window.location.origin });
  const { data } = await client.POST("/api/v1/customer/account", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (data === undefined) {
    throw new Error("Customer account provisioning failed.");
  }
}

export async function getCurrentAuthSession(): Promise<AuthSession | null> {
  const { data, error } = await authClient.auth.getSession();
  if (error) {
    throw error;
  }
  return summarizeSession(data.session);
}

export function subscribeToAuthState(listener: (session: AuthSession | null) => void): () => void {
  let active = true;
  let sequence = 0;
  const { data } = authClient.auth.onAuthStateChange((_event, session) => {
    const eventSequence = ++sequence;
    const gate = customerAccessGate;
    if (!active) return;
    if (gate === null || session === null) {
      listener(summarizeSession(session));
      return;
    }
    void gate.then((provisioned) => {
      if (active && sequence === eventSequence) listener(provisioned ? summarizeSession(session) : null);
    });
  });
  return () => { active = false; data.subscription.unsubscribe(); };
}

export async function signOut(): Promise<void> {
  const { error } = await authClient.auth.signOut({ scope: "local" });
  if (error) {
    throw error;
  }
}

function summarizeSession(session: Session | null): AuthSession | null {
  const userId = session?.user.id;
  const email = session?.user.email;
  const expiresAt = session?.expires_at;
  return !userId || email === undefined || session === null || expiresAt === undefined || !Number.isFinite(expiresAt)
    || expiresAt * 1000 <= Date.now()
    ? null
    : { accessToken: session.access_token, userId, email, expiresAt };
}
