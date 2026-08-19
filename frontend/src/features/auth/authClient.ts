import { createClient } from "@supabase/supabase-js";

import type { Credentials } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "http://localhost:8000";
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "local-public-anon-key";

const authClient = createClient(supabaseUrl, publicAnonKey);

export async function signInWithEmailAndPassword(credentials: Credentials): Promise<void> {
  const { error } = await authClient.auth.signInWithPassword(credentials);

  if (error) {
    throw error;
  }
}
