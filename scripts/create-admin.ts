import { getServiceClient } from "../lib/supabase";
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
  const supabase = getServiceClient();
  const email = requireEnv("ADMIN_EMAIL");
  const password = requireEnv("ADMIN_PASSWORD");

  const {
    data: { users },
    error: listError,
  } = await supabase.auth.admin.listUsers();

  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const existing = users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
      }
    );

    if (updateError) {
      throw new Error(`Failed to update admin user: ${updateError.message}`);
    }

    console.log(`[admin] Updated existing admin user ${email}.`);
    return;
  }

  const { error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    throw new Error(`Failed to create admin user: ${createError.message}`);
  }

  console.log(`[admin] Created admin user ${email}.`);
}

main().catch((error) => {
  console.error("[admin] Fatal error", error);
  process.exit(1);
});
