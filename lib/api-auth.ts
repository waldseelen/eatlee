import { getFirebaseAuth } from "./firebase-admin";

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

  try {
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(token);

    if (!decodedToken.email || !isServerAdminEmail(decodedToken.email)) {
      return null;
    }

    return {
      email: decodedToken.email,
      uid: decodedToken.uid,
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
