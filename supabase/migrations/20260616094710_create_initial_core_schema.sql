-- ============================================
-- INITIAL CORE SCHEMA FOR GroceryStoreManagement
-- Project: ceirscuxoztpqugioero
-- ============================================

-- Drop in safe order if exists (idempotent rerun)
DROP TABLE IF EXISTS public.price_history CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.profiles_hkd CASCADE;

-- 1) PROFILES_HKD
CREATE TABLE public.profiles_hkd (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ho_ten text NOT NULL,
  ten_hkd text NOT NULL,
  ma_so_thue text UNIQUE,
  dia_chi text,
  so_dien_thoai text,
  ngay_bat_dau_kinh_doanh date,
  loai_ho_kinh_doanh text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2) SUPPLIERS
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ten_cong_ty text NOT NULL,
  ma_so_thue text UNIQUE,
  dia_chi text,
  so_dien_thoai text,
  ghi_chu text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3) INVOICES
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ky_hieu text NOT NULL,
  so_hoa_don text NOT NULL,
  ngay_xuat date NOT NULL,
  tong_tien_thanh_toan numeric NOT NULL DEFAULT 0,
  tong_tien_chua_vat numeric,
  tong_vat numeric,
  ghi_chu text,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  nguoi_nhap_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4) PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  don_vi_tinh text NOT NULL,
  trang_thai text NOT NULL DEFAULT 'ACTIVE',
  ngay_tao date NOT NULL DEFAULT current_date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5) PRICE_HISTORY
CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  ngay_nhap date NOT NULL,
  don_gia_nhap_sau_vat numeric NOT NULL CHECK (don_gia_nhap_sau_vat >= 0),
  so_luong numeric NOT NULL DEFAULT 0,
  loai_dong text NOT NULL CHECK (loai_dong IN ('MUA','KM')),
  don_gia_ban_le_goi_y numeric,
  is_active_price boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz DEFAULT now()
);

-- Helper indexes (tăng tốc tra cứu)
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON public.invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_ngay_xuat ON public.invoices(ngay_xuat);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON public.price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_ngay_nhap ON public.price_history(ngay_nhap);
CREATE INDEX IF NOT EXISTS idx_price_history_loai_dong ON public.price_history(loai_dong);

COMMENT ON TABLE public.profiles_hkd IS 'Thông tin đăng ký của Hộ Kinh Doanh';
COMMENT ON TABLE public.suppliers IS 'Danh mục nhà cung cấp';
COMMENT ON TABLE public.invoices IS 'Nhật ký hóa đơn VAT đầu vào';
COMMENT ON TABLE public.products IS 'Danh mục sản phẩm chuẩn hóa';
COMMENT ON TABLE public.price_history IS 'Lịch sử biến động giá nhập theo sản phẩm';
;
