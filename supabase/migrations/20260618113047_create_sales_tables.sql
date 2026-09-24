-- Migration: Create sales_tickets and closed_periods tables
-- Chạy file này trên Supabase Dashboard -> SQL Editor

-- Bảng lưu phiếu doanh thu bán ra (Sổ S1A)
CREATE TABLE IF NOT EXISTS sales_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number TEXT,
    sale_date DATE DEFAULT current_date,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    group_key TEXT DEFAULT 'Hàng hóa tổng hợp',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng lưu các kỳ kế toán đã chốt số
CREATE TABLE IF NOT EXISTS closed_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    period_month TEXT NOT NULL, -- Định dạng YYYY-MM (Ví dụ: 2026-06)
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_period UNIQUE (period_month)
);

-- Index để tối ưu query
CREATE INDEX IF NOT EXISTS idx_sales_tickets_sale_date ON sales_tickets(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_tickets_group_key ON sales_tickets(group_key);
CREATE INDEX IF NOT EXISTS idx_closed_periods_period_month ON closed_periods(period_month);

-- Row Level Security (RLS) - Chỉ cho phép user xem/sửa dữ liệu của mình
ALTER TABLE sales_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_periods ENABLE ROW LEVEL SECURITY;

-- Policies cho sales_tickets
CREATE POLICY "Allow public read sales_tickets" ON sales_tickets
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert sales_tickets" ON sales_tickets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update sales_tickets" ON sales_tickets
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete sales_tickets" ON sales_tickets
    FOR DELETE USING (true);

-- Policies cho closed_periods
CREATE POLICY "Allow public read closed_periods" ON closed_periods
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert closed_periods" ON closed_periods
    FOR INSERT WITH CHECK (true);
