-- Preserve invoice product codes independently from human-readable names.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_code text;

CREATE INDEX IF NOT EXISTS idx_products_product_code
  ON public.products (product_code);

-- Evidence-backed correction from invoice INO23637 (2026-07-11).
-- These rows are intentionally exact matches; no generic prefix regex is used.
UPDATE public.products
SET product_code = '01SB10',
    product_name = 'Creamer đặc có đường NSPN XANH biển 1284G.'
WHERE id = '59a9ff7b-b791-4a95-ba73-f4668b6b933a'
  AND product_name = '01sb10-creamer đặc có đường NSPN XANH biển 1284G.';

UPDATE public.products
SET product_code = '01SX11',
    product_name = 'Creamer đặc có đường NSPN XANH lá 1284G.'
WHERE id = '8bf09740-635a-4f3f-a1a0-a21da7909ee5'
  AND product_name = '01sx11-creamer đặc có đường NSPN XANH lá 1284G.';

UPDATE public.products
SET product_code = '01TL10',
    product_name = 'Creamer đặc có đường VINAMILK tài lộc 1284G.'
WHERE id = 'e5ba885e-2d26-4228-94cc-838d6cb95153'
  AND product_name = '01tl10-creamer đặc có đường VINAMILK tài lộc 1284G.';
