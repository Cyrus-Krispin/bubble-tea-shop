import { createClient, type Session } from "@supabase/supabase-js";

import type { AuthSession, Credentials } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "http://localhost:8000";
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "local-public-anon-key";

const authClient = createClient(supabaseUrl, publicAnonKey);

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
  const { data, error } = await authClient.auth.signInWithPassword(credentials);

  if (error || data.session === null) {
    throw error ?? new Error("Customer sign-in did not return a session.");
  }

  await provisionAuthenticatedCustomer(data.session.access_token);
}

export async function signUpCustomer(credentials: Credentials): Promise<RegistrationResult> {
  const { data, error } = await authClient.auth.signUp(credentials);

  if (error) {
    throw error;
  }

  if (data.session === null) {
    return { verificationRequired: true };
  }

  await provisionAuthenticatedCustomer(data.session.access_token);
  return { verificationRequired: false };
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
  const response = await fetch(new URL("/api/v1/customer/account", window.location.origin), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
  });

  if (!response.ok) {
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
  const { data } = authClient.auth.onAuthStateChange((_event, session) => {
    listener(summarizeSession(session));
  });
  return () => data.subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  const { error } = await authClient.auth.signOut({ scope: "local" });
  if (error) {
    throw error;
  }
}

function summarizeSession(session: Session | null): AuthSession | null {
  const email = session?.user.email;
  return email === undefined || session === null
    ? null
    : { accessToken: session.access_token, email };
}
