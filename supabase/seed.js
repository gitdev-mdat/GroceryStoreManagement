#!/usr/bin/env node
// =============================================================================
// supabase/seed.js — One-time bootstrap seed
// =============================================================================
// Creates the first ADMIN account using the Supabase Service Role key.
//
// This is the ONLY way to create the first user because:
//   - Supabase Auth does not support self-signup by default
//   - The create-employee Edge Function requires an existing ADMIN to call it
//   - No admin dashboard exists in this project to create users
//
// USAGE:
//   1. Copy this file to the project root:
//        cp supabase/seed.js seed.js
//   2. Set required environment variables:
//        SUPABASE_URL=https://ceirscuxoztpqugioero.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
//   3. Run:
//        node seed.js
//
// GET THE SERVICE ROLE KEY:
//   Supabase Dashboard → Settings → API → Project API keys → service_role secret
//
// VERIFY AFTER RUNNING:
//   Supabase Dashboard → Authentication → Users → you should see admin@gmail.com
//   Supabase Dashboard → Table Editor → profiles → one row with role = ADMIN
// =============================================================================

import { createClient } from '@supabase/supabase-js';

// ── Validate environment variables ────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables.');
  console.error('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  console.error('');
  console.error('   Example:');
  console.error('   SUPABASE_URL=https://ceirscuxoztpqugioero.supabase.co \\');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=<your-key> \\');
  console.error('   node seed.js');
  process.exit(1);
}

// ── Bootstrap account details ─────────────────────────────────────────────────
const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = '123456';
const ADMIN_FULL_NAME = 'Quản trị viên';
const ADMIN_ROLE = 'ADMIN'; // must match the app_role ENUM values

// ── Create a service-role Supabase client ────────────────────────────────────
// This client bypasses RLS. It is safe here because this is a one-time
// server-side script, NOT part of the frontend application.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log('');
  console.log('🔧 Supabase Bootstrap Seed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Check if the account already exists
  console.log(`\n📡 Checking if ${ADMIN_EMAIL} already exists...`);
  const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
  const alreadyExists = existingUser?.users?.some(u => u.email === ADMIN_EMAIL);

  if (alreadyExists) {
    console.log(`\n✅ ${ADMIN_EMAIL} already exists in Authentication → Users.`);
    console.log('   Nothing to do. Exiting.');
    process.exit(0);
  }

  // 2. Create the auth.users account
  console.log(`\n📝 Creating auth.users account for ${ADMIN_EMAIL}...`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Full name: ${ADMIN_FULL_NAME}`);
  console.log(`   Role: ${ADMIN_ROLE}`);

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,      // skip email confirmation — this is a bootstrap account
    user_metadata: {
      full_name: ADMIN_FULL_NAME,
      role: ADMIN_ROLE,
    },
  });

  if (createError) {
    console.error(`\n❌ Failed to create user: ${createError.message}`);
    process.exit(1);
  }

  if (!newUser?.user) {
    console.error('\n❌ No user returned from Supabase. Unexpected response.');
    process.exit(1);
  }

  console.log(`\n✅ auth.users created successfully!`);
  console.log(`   User ID: ${newUser.user.id}`);
  console.log(`   Email: ${newUser.user.email}`);

  // 3. Wait for the DB trigger to fire (it should be nearly instant, but
  //    RLS might block immediate reads so we add a small retry loop)
  console.log(`\n📡 Waiting for public.profiles trigger to fire...`);
  let profile = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    await new Promise(r => setTimeout(r, 500 * attempt));
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', newUser.user.id)
      .single();
    if (profileData) {
      profile = profileData;
      break;
    }
    console.log(`   Attempt ${attempt}/5: profile not found yet, retrying...`);
  }

  if (!profile) {
    console.error('\n⚠️  auth.users was created BUT public.profiles row was NOT found.');
    console.error('   The DB trigger on_auth_user_created may not have fired.');
    console.error('   Please check in Supabase Dashboard → Table Editor → profiles.');
    process.exit(1);
  }

  // 4. Verify the profile is correct
  console.log(`\n✅ public.profiles created automatically by DB trigger!`);
  console.log(`   Profile ID: ${profile.id}`);
  console.log(`   Email:      ${profile.email}`);
  console.log(`   Full name:  ${profile.full_name}`);
  console.log(`   Role:       ${profile.role}`);
  console.log(`   is_active:  ${profile.is_active}`);

  // 5. Validation
  const errors = [];
  if (profile.role !== 'ADMIN') errors.push(`Expected role=ADMIN, got role=${profile.role}`);
  if (profile.is_active !== true) errors.push(`Expected is_active=true, got is_active=${profile.is_active}`);
  if (profile.full_name !== ADMIN_FULL_NAME) errors.push(`Expected full_name="${ADMIN_FULL_NAME}", got "${profile.full_name}"`);

  if (errors.length > 0) {
    console.error('\n❌ Profile validation failed:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Bootstrap complete! You can now log in with:');
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Supabase Dashboard → Authentication → Users: verify the user is listed');
  console.log('  2. Supabase Dashboard → Table Editor → profiles: verify the ADMIN row');
  console.log('  3. Start the frontend: npm run dev');
  console.log('  4. Log in at http://localhost:5173 with the credentials above');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message || err);
  process.exit(1);
});
