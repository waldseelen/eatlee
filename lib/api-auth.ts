import { createClient } from "@supabase/supabase-js";

function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return { url, anonKey };
}

export function getServerAdminEmail(): string | null {
  return process.env.ADMIN_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? null;
}

export function isServerAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = getServerAdminEmail();

  if (!adminEmail || !email) {
    return false;
  }

  return email.toLowerCase() === adminEmail.toLowerCase();
}

export async function requireAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return null;
  }

  const { url, anonKey } = getPublicEnv();
  const authClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user || !isServerAdminEmail(user.email)) {
    return null;
  }

  return user;
}
