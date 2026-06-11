import { getFirebaseAuth } from "../lib/firebase-admin";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

async function main() {
  const auth = getFirebaseAuth();
  const email = requireEnv("ADMIN_EMAIL");
  const password = requireEnv("ADMIN_PASSWORD");

  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, {
      password,
      emailVerified: true,
    });
    console.log(`[admin] Updated existing admin user ${email}.`);
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      await auth.createUser({
        email,
        password,
        emailVerified: true,
      });
      console.log(`[admin] Created admin user ${email}.`);
    } else {
      throw error;
    }
  }
}

main().catch((error) => {
  console.error("[admin] Fatal error", error);
  process.exit(1);
});
