import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getPublicUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

function getPublicAnonKey(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
}

function getServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

function requirePublicUrl(): string {
  const value = getPublicUrl();

  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  return value;
}

function requirePublicAnonKey(): string {
  const value = getPublicAnonKey();

  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.");
  }

  return value;
}

function requireServiceRoleKey(): string {
  const value = getServiceRoleKey();

  if (!value) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return value;
}

export function hasPublicSupabaseEnv(): boolean {
  return Boolean(getPublicUrl() && getPublicAnonKey());
}

export function hasServiceSupabaseEnv(): boolean {
  return Boolean(getPublicUrl() && getServiceRoleKey());
}

export function getBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(requirePublicUrl(), requirePublicAnonKey());
  }

  return browserClient;
}

export function getPublicClient(): SupabaseClient {
  return createClient(requirePublicUrl(), requirePublicAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getServiceClient(): SupabaseClient {
  return createClient(requirePublicUrl(), requireServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
