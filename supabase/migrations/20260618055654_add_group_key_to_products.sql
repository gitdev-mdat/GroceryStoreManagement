ALTER TABLE public.products ADD COLUMN IF NOT EXISTS group_key text DEFAULT 'Hàng hóa tổng hợp'::text;;
