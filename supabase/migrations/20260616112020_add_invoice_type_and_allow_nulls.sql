ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) NOT NULL DEFAULT 'VAT';

ALTER TABLE public.invoices ALTER COLUMN ky_hieu DROP NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN so_hoa_don DROP NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN supplier_id DROP NOT NULL;

COMMENT ON COLUMN public.invoices.invoice_type IS 'Loại hóa đơn: VAT (hóa đơn VAT) hoặc RETAIL (hóa đơn bán hàng lẻ)';;
