-- Record the real post-core business constraint used by the application.
-- This replaces the relevant part of the archived placeholder migration 001.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.price_history
    WHERE row_type NOT IN ('MUA', 'KM')
  ) THEN
    RAISE EXCEPTION 'Cannot align row_type constraint: unsupported values exist';
  END IF;

  ALTER TABLE public.price_history
    DROP CONSTRAINT IF EXISTS price_history_row_type_check;

  ALTER TABLE public.price_history
    ADD CONSTRAINT price_history_row_type_check
    CHECK (row_type IN ('MUA', 'KM'));
END;
$$;
