-- ============================================================
-- MIGRATION: Rename columns to English (Tiếng Anh làm Khung xương)
-- Database: Supabase PostgreSQL
-- Description: Đồng bộ hóa schema theo triết lý "English Backend / Vietnamese UI"
-- ============================================================

-- ============================================================
-- BẢNG 1: profiles_hkd
-- ============================================================
ALTER TABLE profiles_hkd 
  RENAME COLUMN ten_hkd TO business_name;

ALTER TABLE profiles_hkd 
  RENAME COLUMN ma_so_thue TO tax_code;

ALTER TABLE profiles_hkd 
  RENAME COLUMN dia_chi TO address;

ALTER TABLE profiles_hkd 
  RENAME COLUMN nguoi_dai_dien TO representative;

-- ============================================================
-- BẢNG 2: suppliers
-- ============================================================
ALTER TABLE suppliers 
  RENAME COLUMN ten_cong_ty TO company_name;

ALTER TABLE suppliers 
  RENAME COLUMN ma_so_thue TO tax_code;

ALTER TABLE suppliers 
  RENAME COLUMN dia_chi TO address;

ALTER TABLE suppliers 
  RENAME COLUMN so_dien_thoai TO phone_number;

-- ============================================================
-- BẢNG 3: invoices
-- ============================================================
ALTER TABLE invoices 
  RENAME COLUMN ky_hieu TO serial_number;

ALTER TABLE invoices 
  RENAME COLUMN so_hoa_don TO invoice_number;

ALTER TABLE invoices 
  RENAME COLUMN ngay_xuat TO issue_date;

ALTER TABLE invoices 
  RENAME COLUMN loai_hoa_don TO invoice_type;

ALTER TABLE invoices 
  RENAME COLUMN ghi_chu TO notes;

-- ============================================================
-- BẢNG 4: products
-- ============================================================
ALTER TABLE products 
  RENAME COLUMN ten_hang TO product_name;

ALTER TABLE products 
  RENAME COLUMN don_vi_tinh TO unit;

-- ============================================================
-- BẢNG 5: price_history
-- ============================================================
ALTER TABLE price_history 
  RENAME COLUMN don_gia_nhap_sau_vat TO unit_price_after_vat;

ALTER TABLE price_history 
  RENAME COLUMN so_luong TO quantity;

ALTER TABLE price_history 
  RENAME COLUMN loai_dong TO row_type;

ALTER TABLE price_history 
  RENAME COLUMN don_gia_ban_le_goi_y TO suggested_retail_price;

-- ============================================================
-- CẬP NHẬT CHECK CONSTRAINT cho row_type
-- ============================================================
-- Xóa constraint cũ nếu tồn tại
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'price_history_loai_dong_check'
  ) THEN
    ALTER TABLE price_history DROP CONSTRAINT price_history_loai_dong_check;
  END IF;
END $$;

-- Tạo constraint mới với tên mới
ALTER TABLE price_history 
  ADD CONSTRAINT price_history_row_type_check 
  CHECK (row_type IN ('MUA', 'KM'));

-- ============================================================
-- THÔNG BÁO HOÀN THÀNH
-- ============================================================
-- Migration thành công! Tất cả các trường đã được đổi sang tiếng Anh.
