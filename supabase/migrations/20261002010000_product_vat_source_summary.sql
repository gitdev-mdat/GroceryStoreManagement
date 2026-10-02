-- Lightweight, stable-ID VAT traceability summary for the product price book.
-- Detailed source rows remain an on-demand price_history query by product_id.
CREATE OR REPLACE FUNCTION public.get_product_vat_source_summaries(p_status text DEFAULT 'ACTIVE')
RETURNS TABLE (
  product_id uuid,
  vat_source_count bigint,
  current_invoice_id uuid,
  current_invoice_number text,
  current_invoice_date date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.id AS product_id,
    count(DISTINCT ph.invoice_id) FILTER (WHERE i.invoice_type = 'VAT') AS vat_source_count,
    current_source.invoice_id AS current_invoice_id,
    current_source.invoice_number AS current_invoice_number,
    current_source.invoice_date AS current_invoice_date
  FROM public.products p
  LEFT JOIN public.price_history ph ON ph.product_id = p.id
  LEFT JOIN public.invoices i ON i.id = ph.invoice_id
  LEFT JOIN LATERAL (
    SELECT
      active_invoice.id AS invoice_id,
      coalesce(active_invoice.invoice_number, active_invoice.serial_number) AS invoice_number,
      active_invoice.issue_date AS invoice_date
    FROM public.price_history active_history
    JOIN public.invoices active_invoice ON active_invoice.id = active_history.invoice_id
    WHERE active_history.product_id = p.id
      AND active_history.is_active_price = true
      AND active_invoice.invoice_type = 'VAT'
    ORDER BY active_history.import_date DESC, active_history.id DESC
    LIMIT 1
  ) current_source ON true
  WHERE p.status = p_status
  GROUP BY p.id, current_source.invoice_id, current_source.invoice_number, current_source.invoice_date;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_vat_source_summaries(text) TO authenticated;
