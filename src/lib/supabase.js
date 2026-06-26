// src/lib/supabase.js
// =====================================================================
// Supabase client — singleton
// =====================================================================
// CÁCH DÙNG:
//   import { supabase } from '@/lib/supabase';
//   const { data, error } = await supabase.from('s2a').select('*');
//
// BIẾN MÔI TRƯỜNG (xem .env.example):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
// =====================================================================

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    '[supabase] Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.\n' +
    'Sao chép .env.example → .env.local và điền giá trị.\n' +
    'App vẫn chạy bằng localStorage cho đến khi có config.'
  );
}

export const supabase = createClient(url || 'http://localhost', key || 'public-anon', {
  auth: {
    persistSession: true,        // lưu session vào localStorage
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 5 },
  },
});

// Helper: kiểm tra online
export const isSupabaseConfigured = () => Boolean(url && key);

// =====================================================================
// Authentication helpers
// =====================================================================

/**
 * getCurrentUser()
 *
 * Returns the currently authenticated user with their full profile.
 *
 * Returns:
 *   { id, email, full_name, role, is_active }  on success
 *   null                                          if not authenticated or profile missing
 *   { error: {...} }                              on failure
 */
export async function getCurrentUser() {
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) return { error: sessionError };
    const session = sessionData?.session;
    if (!session?.user) return null;

    const userId = session.user.id;

    // Fetch profile (RLS: profiles_select_own allows self, profiles_select_admin allows ADMIN)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at')
      .eq('id', userId)
      .single();

    if (profileError) return { error: profileError };
    if (!profile) return null;

    // Deny login if account is deactivated
    if (profile.is_active === false) {
      return { error: { message: 'Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.' } };
    }

    return profile;
  } catch (err) {
    return { error: err };
  }
}

/**
 * signIn(email, password)
 *
 * Authenticates a user via email + password.
 *
 * Returns:
 *   { data: { user, session } }  on success
 *   { error: { message } }        on failure
 */
export async function signIn(email, password) {
  if (!email || !password) {
    return { error: { message: 'Email và mật khẩu là bắt buộc.' } };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) return { error: { message: error.message } };

  // After sign-in, fetch the full profile
  const profile = await getCurrentUser();
  if (profile?.error) return profile;
  if (!profile) return { error: { message: 'Không tìm thấy hồ sơ người dùng.' } };

  return { data: { user: profile, session: data.session } };
}

/**
 * signOut()
 *
 * Ends the current session and clears local session storage.
 *
 * Returns:
 *   { error: null }  on success
 *   { error: {...} } on failure
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * createEmployee({ email, password, fullName, role })
 *
 * ADMIN only. Creates a new auth.users account and a matching
 * profile row (the DB trigger handles the profile automatically).
 *
 * This function calls the Supabase Edge Function
 * `create-employee` which uses the service role key internally.
 * The frontend never has access to any service role key.
 *
 * Returns:
 *   { data: { userId } }   on success
 *   { error: { message } } on validation / auth / server failure
 */
export async function createEmployee({ email, password, fullName, role }) {
  // --- Client-side validation (defense-in-depth) ---
  if (!email || !password || !fullName || !role) {
    return { error: { message: 'Tất cả các trường đều bắt buộc.' } };
  }

  const emailTrimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrimmed)) {
    return { error: { message: 'Địa chỉ email không hợp lệ.' } };
  }

  if (password.length < 6) {
    return { error: { message: 'Mật khẩu phải có ít nhất 6 ký tự.' } };
  }

  if (role !== 'ADMIN' && role !== 'STAFF') {
    return { error: { message: 'Vai trò phải là ADMIN hoặc STAFF.' } };
  }

  if (fullName.trim().length < 2) {
    return { error: { message: 'Họ tên phải có ít nhất 2 ký tự.' } };
  }

  // --- Get the current access token to authenticate the call ---
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) return { error: { message: sessionError.message } };
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    return { error: { message: 'Chưa đăng nhập. Không thể tạo nhân viên.' } };
  }

  // --- Call the Edge Function with the user's JWT ---
  // The Edge Function validates the JWT, checks ADMIN role,
  // then uses the service role key to create auth.users.
  // URL pattern: https://<ref>.supabase.co/functions/v1/<name>
  const edgeFnUrl = `${url}/functions/v1/create-employee`;

  let response;
  try {
    response = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': key,
      },
      body: JSON.stringify({
        email: emailTrimmed,
        password,
        full_name: fullName.trim(),
        role,
      }),
    });
  } catch (fetchErr) {
    return { error: { message: `Không thể kết nối máy chủ: ${fetchErr.message}` } };
  }

  const result = await response.json();

  if (!response.ok) {
    return {
      error: { message: result.error ?? `Lỗi máy chủ: HTTP ${response.status}` },
    };
  }

  return { data: { userId: result.userId, email: result.email, role: result.role } };
}

/**
 * updateProfile(updates)
 *
 * Updates the current authenticated user's own profile.
 * Only allowed fields can be modified.
 *
 * Allowed fields: full_name
 * Role and is_active can ONLY be changed by ADMIN via updateProfileAsAdmin.
 *
 * Returns:
 *   { data: { ...updatedProfile } }  on success
 *   { error: { message } }           on failure
 */
export async function updateProfile(updates) {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) return { error: { message: sessionError.message } };
  const userId = sessionData?.session?.user?.id;
  if (!userId) return { error: { message: 'Chưa đăng nhập.' } };

  // Only allow updating full_name for non-admin users
  // (role and is_active changes must go through updateProfileAsAdmin)
  const allowedFields = ['full_name'];
  const sanitized = {};
  for (const key of allowedFields) {
    if (key in updates) sanitized[key] = updates[key];
  }

  if (Object.keys(sanitized).length === 0) {
    return { error: { message: 'Không có trường hợp lệ để cập nhật.' } };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(sanitized)
    .eq('id', userId)
    .select()
    .single();

  if (error) return { error: { message: error.message } };
  return { data };
}

/**
 * updateProfileAsAdmin(userId, updates)
 *
 * ADMIN only. Updates any user's profile including role and is_active.
 * Calls the SECURITY DEFINER database function.
 *
 * Returns:
 *   { data: { ...updatedProfile } }  on success
 *   { error: { message } }           on failure / not ADMIN
 */
export async function updateProfileAsAdmin(userId, updates) {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) return { error: { message: sessionError.message } };
  if (!sessionData?.session?.user) {
    return { error: { message: 'Chưa đăng nhập.' } };
  }

  // Validate role value
  const newRole = updates.role;
  if (newRole !== undefined && newRole !== 'ADMIN' && newRole !== 'STAFF') {
    return { error: { message: 'Vai trò phải là ADMIN hoặc STAFF.' } };
  }

  const { data, error } = await supabase.rpc('update_profile_as_admin', {
    p_user_id:   userId,
    p_full_name: updates.full_name ?? null,
    p_role:      newRole ?? null,
    p_is_active: updates.is_active ?? null,
  });

  if (error) return { error: { message: error.message } };
  return { data };
}

/**
 * getAllProfiles()
 *
 * ADMIN only. Returns all user profiles.
 *
 * Returns:
 *   { data: [...profiles] }  on success
 *   { error: { message } }   on failure
 */
export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) return { error: { message: error.message } };
  return { data };
}
