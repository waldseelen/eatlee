import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "./supabase";

export function getConfiguredAdminEmail(): string | null {
  return process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = getConfiguredAdminEmail();

  if (!adminEmail || !email) {
    return false;
  }

  return email.toLowerCase() === adminEmail.toLowerCase();
}

export async function signIn(email: string, password: string) {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { session: null, error: error.message };
  }

  return { session: data.session, error: null };
}

export async function signOut() {
  const supabase = getBrowserClient();
  const { error } = await supabase.auth.signOut();

  return { error: error?.message ?? null };
}

export async function getSession() {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return { session: null, error: error.message };
  }

  return { session: data.session, error: null };
}

export async function getAccessToken(): Promise<string | null> {
  const { session } = await getSession();
  return session?.access_token ?? null;
}

export function isAdmin(session: Session | null): boolean {
  return isAdminEmail(session?.user?.email);
}
