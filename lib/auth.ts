import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "./firebase";

export interface Session {
  user: {
    email: string | null;
  };
  access_token: string | null;
}

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
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    const session: Session = {
      user: {
        email: userCredential.user.email,
      },
      access_token: token,
    };
    return { session, error: null };
  } catch (error) {
    return { session: null, error: error instanceof Error ? error.message : "Sign in failed." };
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Sign out failed." };
  }
}

export async function getSession(): Promise<{ session: Session | null; error: string | null }> {
  const user = auth.currentUser;
  if (!user) {
    return { session: null, error: null };
  }
  try {
    const token = await user.getIdToken();
    const session: Session = {
      user: {
        email: user.email,
      },
      access_token: token,
    };
    return { session, error: null };
  } catch (error) {
    return { session: null, error: error instanceof Error ? error.message : "Failed to get token." };
  }
}

export async function getAccessToken(): Promise<string | null> {
  const { session } = await getSession();
  return session?.access_token ?? null;
}

export function isAdmin(session: Session | null): boolean {
  return isAdminEmail(session?.user?.email);
}
