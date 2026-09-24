-- ============================================================
-- RENAME TABLE: profiles_hkd → business_profiles
-- ============================================================
ALTER TABLE profiles_hkd RENAME TO business_profiles;

-- ============================================================
-- RENAME COLUMNS: business_profiles
-- ============================================================
ALTER TABLE business_profiles RENAME COLUMN ho_ten TO owner_name;
ALTER TABLE business_profiles RENAME COLUMN so_dien_thoai TO phone_number;
ALTER TABLE business_profiles RENAME COLUMN ngay_bat_dau_kinh_doanh TO business_start_date;
ALTER TABLE business_profiles RENAME COLUMN loai_ho_kinh_doanh TO business_type;

-- ============================================================
-- RENAME COLUMNS: suppliers
-- ============================================================
ALTER TABLE suppliers RENAME COLUMN ghi_chu TO notes;

-- ============================================================
-- RENAME COLUMNS: invoices
-- ============================================================
ALTER TABLE invoices RENAME COLUMN tong_tien_thanh_toan TO total_amount;
ALTER TABLE invoices RENAME COLUMN tong_tien_chua_vat TO subtotal_amount;
ALTER TABLE invoices RENAME COLUMN tong_vat TO vat_amount;
ALTER TABLE invoices RENAME COLUMN nguoi_nhap_id TO created_by;

-- ============================================================
-- RENAME COLUMNS: products
-- ============================================================
ALTER TABLE products RENAME COLUMN trang_thai TO status;
ALTER TABLE products RENAME COLUMN ngay_tao TO first_seen_date;

-- ============================================================
-- UPDATE CHECK CONSTRAINT for row_type (PURCHASE/PROMOTION)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_history_row_type_check') THEN
    ALTER TABLE price_history DROP CONSTRAINT price_history_row_type_check;
  END IF;
END $$;

ALTER TABLE price_history ADD CONSTRAINT price_history_row_type_check CHECK (row_type IN ('PURCHASE', 'PROMOTION'));

-- ============================================================
-- DONE
-- ============================================================;
