// supabase/functions/create-employee/index.ts
// =====================================================================
// create-employee — Supabase Edge Function
// =====================================================================
// Access:  secret API key only (service role key equivalent)
// Auth:    requires a valid JWT; caller must be an ADMIN
//
// This function is the ONLY place the service role is used.
// The frontend never has access to any service role key.
//
// Flow:
//   1. Validate JWT from Authorization header
//   2. Look up caller's role in public.profiles (uses auth.jwt() in RLS)
//   3. Reject if not ADMIN
//   4. Validate input fields
//   5. Create auth.users account via supabaseAdmin (service role, bypasses RLS)
//      — the DB trigger `on_auth_user_created` auto-creates public.profiles
//   6. Return new user id
//
// DEPLOY NOTE:
//   When deploying via `supabase functions deploy`, set the
//   SUPABASE_SERVICE_ROLE_KEY environment variable in the Supabase
//   project dashboard (Settings > Edge Functions > Secrets).
//   The function uses ctx.supabaseAdmin which reads this key internally.
//
//   Do NOT add SUPABASE_SERVICE_ROLE_KEY to .env.local or any client-side
//   configuration. It lives only in the Supabase cloud secrets.
// =====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid role values enforced at DB level too
const VALID_ROLES = new Set(["ADMIN", "STAFF"]);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // ── Step 1: Authenticate caller via JWT ──────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        { error: "Missing or invalid Authorization header." },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");

    // Decode JWT to get caller's user id (no verification needed —
    // Supabase Gateway already verified the signature)
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    const callerId = payload.sub;
    if (!callerId) {
      return Response.json(
        { error: "Invalid token payload." },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // ── Step 2: Create a service-role client to query caller's profile ───
    // SUPABASE_SERVICE_ROLE_KEY is injected by the Supabase runtime —
    // it is NOT available to the frontend.
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      console.error("[create-employee] SUPABASE_SERVICE_ROLE_KEY not set.");
      return Response.json(
        { error: "Server configuration error." },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      return Response.json(
        { error: "Server configuration error: missing SUPABASE_URL." },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // ── Step 3: Verify caller is ADMIN ─────────────────────────────────
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", callerId)
      .single();

    if (profileError || !callerProfile) {
      return Response.json(
        { error: "Không tìm thấy hồ sơ người dùng." },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (callerProfile.is_active === false) {
      return Response.json(
        { error: "Tài khoản đã bị vô hiệu hóa." },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    if (callerProfile.role !== "ADMIN") {
      return Response.json(
        { error: "Forbidden: chỉ ADMIN mới có quyền thực hiện thao tác này." },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // ── Step 4: Parse and validate input ────────────────────────────────
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON body." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { email, password, full_name, role } = body ?? {};

    if (!email || !password || !full_name || !role) {
      return Response.json(
        { error: "Tất cả các trường đều bắt buộc." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const emailTrimmed = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return Response.json(
        { error: "Địa chỉ email không hợp lệ." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (String(password).length < 6) {
      return Response.json(
        { error: "Mật khẩu phải có ít nhất 6 ký tự." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!VALID_ROLES.has(role)) {
      return Response.json(
        { error: "Vai trò phải là ADMIN hoặc STAFF." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (String(full_name).trim().length < 2) {
      return Response.json(
        { error: "Họ tên phải có ít nhất 2 ký tự." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ── Step 5: Create auth.users account via service role ─────────────
    // supabaseAdmin bypasses RLS — this is the only place service role
    // is used in the entire codebase.
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email: emailTrimmed,
        password: String(password),
        email_confirm: true,
        user_metadata: {
          full_name: String(full_name).trim(),
          role: String(role),
        },
      });

    if (createError) {
      return Response.json(
        { error: createError.message },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!newUser?.user) {
      return Response.json(
        { error: "Không nhận được phản hồi từ máy chủ." },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // The DB trigger `on_auth_user_created` automatically creates the
    // matching row in public.profiles. No manual insert needed.

    // ── Step 6: Return new user id ─────────────────────────────────────
    return Response.json(
      {
        userId: newUser.user.id,
        email: newUser.user.email,
        role: String(role),
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[create-employee] Unhandled error:", err);
    return Response.json(
      { error: "Lỗi máy chủ nội bộ." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
