-- BẢNG 1: profiles_hkd
ALTER TABLE profiles_hkd RENAME COLUMN ten_hkd TO business_name;
ALTER TABLE profiles_hkd RENAME COLUMN ma_so_thue TO tax_code;
ALTER TABLE profiles_hkd RENAME COLUMN dia_chi TO address;

-- BẢNG 2: suppliers
ALTER TABLE suppliers RENAME COLUMN ten_cong_ty TO company_name;
ALTER TABLE suppliers RENAME COLUMN ma_so_thue TO tax_code;
ALTER TABLE suppliers RENAME COLUMN dia_chi TO address;
ALTER TABLE suppliers RENAME COLUMN so_dien_thoai TO phone_number;

-- BẢNG 3: invoices
ALTER TABLE invoices RENAME COLUMN ky_hieu TO serial_number;
ALTER TABLE invoices RENAME COLUMN so_hoa_don TO invoice_number;
ALTER TABLE invoices RENAME COLUMN ngay_xuat TO issue_date;
ALTER TABLE invoices RENAME COLUMN ghi_chu TO notes;

-- BẢNG 4: products
ALTER TABLE products RENAME COLUMN don_vi_tinh TO unit;

-- BẢNG 5: price_history
ALTER TABLE price_history RENAME COLUMN ngay_nhap TO import_date;
ALTER TABLE price_history RENAME COLUMN don_gia_nhap_sau_vat TO unit_price_after_vat;
ALTER TABLE price_history RENAME COLUMN so_luong TO quantity;
ALTER TABLE price_history RENAME COLUMN loai_dong TO row_type;
ALTER TABLE price_history RENAME COLUMN don_gia_ban_le_goi_y TO suggested_retail_price;

-- CHECK CONSTRAINT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_history_loai_dong_check') THEN
    ALTER TABLE price_history DROP CONSTRAINT price_history_loai_dong_check;
  END IF;
END $$;

ALTER TABLE price_history ADD CONSTRAINT price_history_row_type_check CHECK (row_type IN ('MUA', 'KM'));;
