#!/usr/bin/env node
const path = require("path");
const { createServiceClient, readArgValue } = require("./utils/fwm-ops-utils");

async function provisionHomologAccount() {
  const args = process.argv.slice(2);
  const projectRoot = path.resolve(__dirname, "..");
  
  if (args.includes("--help")) {
    console.log("Usage: node provision-homolog-account.js [--email email@domain.com] [--password securepassword]");
    console.log("Provisions a test/homologation account safely bypassing the email verification loops via Supabase Service Role.");
    console.log("If left blank, attempts to securely read HOMOLOG_EMAIL and HOMOLOG_PASSWORD from .env.local.");
    return;
  }

  const { client, env } = createServiceClient(projectRoot);
  
  const targetEmail = readArgValue(args, "--email") || env.HOMOLOG_EMAIL;
  const targetPassword = readArgValue(args, "--password") || env.HOMOLOG_PASSWORD || 'local-homolog-test-123!';

  if (!targetEmail) {
    throw new Error('No target email provided via --email flag or HOMOLOG_EMAIL inside .env.local');
  }

  console.log(`[Provision] Target detected: ${targetEmail}`);

  // Fetch using standard RPC auth list if possible, or just raw select
  // For safety and idempotence, if auth insertion fails due to unique constraint, we are safe.
  const { data: userCreated, error: createError } = await client.auth.admin.createUser({
    email: targetEmail,
    password: targetPassword,
    email_confirm: true,
  });

  if (createError) {
    if (createError.message.includes("already registered") || createError.status === 422) {
      console.log(`[Provision] SUCCESS: Homologation account is already provisioned and exists in the system.`);
      process.exit(0);
    }
    console.error(`[Provision] Failed to create homologation account: ${createError.message}`);
    process.exit(1);
  }

  console.log(`[Provision] SUCCESS: Homologation account strictly created and verified (ID: ${userCreated.user.id}).`);
}

provisionHomologAccount().catch((err) => {
  console.error(`[Provision] Error: ${err.message}`);
  process.exit(1);
});
