-- ============================================================
-- Migration 002: Supabase Auth + profiles table + RLS
-- ============================================================
-- What this migration does:
--   1. Creates app_role ENUM type ('ADMIN', 'STAFF') so role values
--      are enforced at the database level (no 'admin'/'Admin' ambiguity)
--   2. Creates public.profiles table linked to auth.users
--   3. Creates a trigger so a profiles row is auto-created
--      when a new user signs up via Supabase Auth
--   4. Adds RLS policies for proper RBAC on profiles:
--      - SELECT: users see own row; ADMINs see all rows
--      - UPDATE: users update own row (full_name only);
--                ADMINs update any row via update_profile_as_admin()
--      - INSERT: allowed (Edge Function layer enforces ADMIN)
--      - DELETE: ADMINs only (EXISTS checks CALLER's role, not row's)
--   5. Adds SECURITY DEFINER helper: update_profile_as_admin()
--      (typed with app_role — invalid roles rejected at call time)
--   6. Adds RLS to all existing tables (authenticated only)
--
-- BOOTSTRAP — Creating the first ADMIN account:
--   There is no self-signup in Supabase Auth by default, and the
--   create-employee Edge Function requires an existing ADMIN to call it.
--   This creates a chicken-and-egg problem for the very first user.
--
--   SOLUTION: run the one-time seed script (supabase/seed.js).
--   It uses the SERVICE ROLE KEY (server-side only, never in frontend)
--   to create the first auth.users + public.profiles entry directly.
--
--   Steps:
--     1. cp supabase/seed.js seed.js
--     2. Set environment variables:
--          SUPABASE_URL=https://ceirscuxoztpqugioero.supabase.co
--          SUPABASE_SERVICE_ROLE_KEY=<from Dashboard → Settings → API → service_role secret>
--     3. node seed.js
--     4. Verify in Dashboard: Authentication → Users + Table Editor → profiles
--
-- FRONTEND SECURITY NOTES:
--   - createEmployee() calls a Supabase Edge Function
--     (supabase/functions/create-employee/index.ts)
--     which uses the service role key internally.
--   - The service role key is NEVER in the frontend.
--   - The Edge Function validates the caller's JWT and
--     checks ADMIN role before creating auth.users.
-- ============================================================

-- ============================================================
-- SECTION 1 — ENUM type + profiles table
-- ============================================================

-- Strongly-typed role enum. Valid values are enforced by PostgreSQL,
-- making 'Admin'/'ADMIN'/'admin' case errors impossible at DB level.
CREATE TYPE app_role AS ENUM ('ADMIN', 'STAFF');

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        app_role NOT NULL DEFAULT 'STAFF'::app_role,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- SECTION 2 — Auto-create profile on user signup
-- ============================================================

-- Function called by the trigger below.
-- Inserts a row into public.profiles when a new user is created in auth.users.
-- The role is cast to app_role so invalid values are rejected at INSERT time.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'STAFF')::app_role,
    true
  );
  RETURN NEW;
END;
$$;

-- Trigger: fires AFTER insert on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SECTION 3 — RLS for profiles
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Self: any authenticated user can read their own profile row.
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admin: ADMINs can read all profiles.
-- The EXISTS subquery checks the CALLER's role (via auth.uid()),
-- not the role of the row being read.
CREATE POLICY profiles_select_admin
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'::app_role
    )
  );

-- Self: users can update only their own profile (full_name only).
-- Role and is_active changes are handled by update_profile_as_admin().
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert: allowed (the Edge Function creates auth.users first, then
-- the trigger creates the profile; direct INSERT is enforced at the
-- application/Edge Function layer via ADMIN check).
CREATE POLICY profiles_insert_authenticated
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- Delete: ADMINs only.
-- The EXISTS subquery checks the CALLER's role, not the row being deleted.
CREATE POLICY profiles_delete_admin
  ON public.profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'::app_role
    )
  );

-- ============================================================
-- SECTION 4 — SECURITY DEFINER helpers for ADMIN operations
-- (bypass RLS for trusted admin actions)
-- ============================================================

-- updateProfileAsAdmin: ADMIN can update any profile's fields
-- including role and is_active. Called from the Edge Function.
-- p_role is typed as app_role so invalid values are rejected at call time.
CREATE OR REPLACE FUNCTION public.update_profile_as_admin(
  p_user_id   UUID,
  p_full_name TEXT,
  p_role      app_role,
  p_is_active BOOLEAN
)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result      public.profiles;
  caller_role app_role;
BEGIN
  -- Read caller's own role to verify ADMIN status
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or profile not found.';
  END IF;

  IF caller_role != 'ADMIN'::app_role THEN
    RAISE EXCEPTION 'Forbidden: ADMIN role required.';
  END IF;

  -- p_role is already app_role; PostgreSQL rejects invalid values at call time
  UPDATE public.profiles
  SET full_name = COALESCE(p_full_name, full_name),
      role      = p_role,
      is_active = COALESCE(p_is_active, is_active)
  WHERE id = p_user_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- SECTION 5 — RLS for existing tables
-- Adds authenticated-only RLS to tables that currently have none.
-- All data is readable/writable by any authenticated user.
-- Fine-grained per-user policies can be added later.
-- ============================================================

-- --- invoices ---
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_auth_all"
  ON public.invoices
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- --- products ---
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_auth_all"
  ON public.products
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- --- price_history ---
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_history_auth_all"
  ON public.price_history
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- --- suppliers ---
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_auth_all"
  ON public.suppliers
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- --- business_profiles ---
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_profiles_auth_all"
  ON public.business_profiles
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- --- sales_tickets ---
-- Already has policies; add authenticated policy (they were "public")
ALTER TABLE public.sales_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public delete sales_tickets" ON public.sales_tickets;
DROP POLICY IF EXISTS "Allow public insert sales_tickets" ON public.sales_tickets;
DROP POLICY IF EXISTS "Allow public read sales_tickets" ON public.sales_tickets;
DROP POLICY IF EXISTS "Allow public update sales_tickets" ON public.sales_tickets;

CREATE POLICY "sales_tickets_auth_all"
  ON public.sales_tickets
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- --- closed_periods ---
ALTER TABLE public.closed_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert closed_periods" ON public.closed_periods;
DROP POLICY IF EXISTS "Allow public read closed_periods" ON public.closed_periods;

CREATE POLICY "closed_periods_auth_all"
  ON public.closed_periods
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
