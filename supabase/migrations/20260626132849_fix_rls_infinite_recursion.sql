-- ============================================================
-- Migration 003: Fix infinite recursion in RLS policies
-- ============================================================
-- PROBLEM:
--   profiles_select_admin and profiles_delete_admin used:
--     USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'))
--   When RLS evaluates this subquery on the same 'profiles' table, it re-applies
--   all SELECT policies, including profiles_select_admin itself → infinite recursion
--   → PostgreSQL throws "infinite recursion detected in policy" → HTTP 500.
--
-- SOLUTION:
--   Create a SECURITY DEFINER function is_admin() that bypasses RLS.
--   Replace the self-referential EXISTS subquery with is_admin().
--   SECURITY DEFINER runs as the function owner (postgres), bypassing RLS.
--   The check inside still uses auth.uid() so it is auth-aware.
--
-- USAGE:
--   supabase db push  (or: supabase migration new fix_rls_infinite_recursion
--   then paste this file into that migration)
-- ============================================================

-- ── SECURITY DEFINER helper: is_admin ──────────────────────────────────────
-- Bypasses RLS. Runs as the function owner (postgres), not the caller.
-- Still uses auth.uid() so it correctly identifies the authenticated user.
-- Returns true if the current auth user has role = ADMIN.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'::public.app_role
  );
END;
$$;

-- ── Fix profiles_select_admin ────────────────────────────────────────────────
-- OLD (causes recursion):
--   USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN'))
-- NEW (no recursion):
--   USING (public.is_admin())
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

-- ── Fix profiles_delete_admin ────────────────────────────────────────────────
-- Same fix — replace self-referential subquery with is_admin()
DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin
  ON public.profiles
  FOR DELETE
  USING (public.is_admin());
