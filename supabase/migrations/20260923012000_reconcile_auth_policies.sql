-- Reconcile policy drift left by manual/out-of-order execution of the legacy
-- sales and auth migrations. No application data is changed.
DROP POLICY IF EXISTS "Allow public delete sales_tickets" ON public.sales_tickets;
DROP POLICY IF EXISTS "Allow public insert sales_tickets" ON public.sales_tickets;
DROP POLICY IF EXISTS "Allow public read sales_tickets" ON public.sales_tickets;
DROP POLICY IF EXISTS "Allow public update sales_tickets" ON public.sales_tickets;
DROP POLICY IF EXISTS "Allow public insert closed_periods" ON public.closed_periods;
DROP POLICY IF EXISTS "Allow public read closed_periods" ON public.closed_periods;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_insert_authenticated'
  ) THEN
    CREATE POLICY profiles_insert_authenticated
      ON public.profiles
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END;
$$;
