-- =====================================================================
-- Schema Supabase cho Hộ Kinh Doanh Tạp hoá Hải Kiều
-- =====================================================================
-- Chạy file này trong Supabase SQL Editor:
--   https://app.supabase.com/project/<project-id>/sql
--
-- Tạo: 8 bảng + index + RLS policy
-- Lưu ý: KHÔNG tạo user/role ở đây — dùng Supabase Auth (email/password)
-- =====================================================================

-- 0. Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. Bảng inventory (Tồn kho đầu năm)
-- =====================================================================
create table if not exists public.inventory (
  id          text primary key,           -- 'hmpt', 'ddgd', 'tpdg', 'tpts'
  name        text not null,
  unit        text not null,
  quantity    numeric(15, 3) not null default 0,
  unit_price  numeric(15, 0) not null default 0,  -- VND, làm tròn nghìn
  note        text,
  vat_rate    numeric(5, 2) not null default 0,    -- 0 / 5 / 8 / 10
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =====================================================================
-- 2. Bảng s2a (Phiếu bán hàng S2A-HKD)
-- =====================================================================
create table if not exists public.s2a (
  id          uuid primary key default uuid_generate_v4(),
  so_hieu     text not null,              -- '01/BL'
  date        date not null,              -- yyyy-mm-dd
  group_key   text not null references public.inventory(id) on update cascade,
  dien_giai   text not null,
  amount      numeric(15, 0) not null,    -- VND
  version     int  not null default 1,    -- optimistic locking
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_s2a_date     on public.s2a (date);
create index if not exists idx_s2a_group    on public.s2a (group_key);
create index if not exists idx_s2a_date_grp on public.s2a (date, group_key);

-- =====================================================================
-- 3. Bảng vat_invoices (Hóa đơn VAT đầu vào)
-- =====================================================================
create table if not exists public.vat_invoices (
  id              uuid primary key default uuid_generate_v4(),
  company_name    text not null,
  company_mst     text,
  date            date not null,
  invoice_symbol  text,
  invoice_number  text,
  group_key       text not null references public.inventory(id) on update cascade,
  group_name      text not null,          -- snapshot tên nhóm
  note            text,
  amount          numeric(15, 0) not null,
  image_url       text,                   -- Supabase Storage URL
  version         int not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_vat_date  on public.vat_invoices (date);
create index if not exists idx_vat_group on public.vat_invoices (group_key);

-- =====================================================================
-- 4. Bảng companies (Danh sách công ty NCC)
-- =====================================================================
create table if not exists public.companies (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  mst        text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, mst)
);

-- =====================================================================
-- 5. Bảng s2a_settings (Cài đặt in sổ S2A)
-- =====================================================================
create table if not exists public.s2a_settings (
  id            int primary key default 1,    -- chỉ có 1 dòng duy nhất
  business_name text not null default 'Hộ Kinh Doanh Tạp hoá Hải Kiều',
  address       text not null default 'Thôn 10, Xã Quảng Tín, Tỉnh Lâm Đồng',
  mst           text not null default '051179002157',
  updated_at    timestamptz not null default now(),
  check (id = 1)
);

-- =====================================================================
-- 6. Bảng s2a_closed_periods (Các kỳ đã chốt sổ)
-- =====================================================================
create table if not exists public.s2a_closed_periods (
  period     text primary key,           -- 'yyyy-mm'
  closed_at  timestamptz not null default now()
);

-- =====================================================================
-- 7. Bảng fresh_food_purchases (Mua tươi sống theo tháng)
-- =====================================================================
create table if not exists public.fresh_food_purchases (
  month   text primary key,              -- 'yyyy-mm'
  amount  numeric(15, 0) not null,
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 8. Bảng fresh_food_daily (Mua tươi sống theo ngày)
-- =====================================================================
create table if not exists public.fresh_food_daily (
  date    date primary key,              -- yyyy-mm-dd
  amount  numeric(15, 0) not null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_ffd_date on public.fresh_food_daily (date);

-- =====================================================================
-- 9. Trigger cập nhật updated_at
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'inventory', 's2a', 'vat_invoices', 'companies',
      's2a_settings', 'fresh_food_purchases', 'fresh_food_daily'
    ])
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at
         before update on public.%1$s
         for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- =====================================================================
-- 10. Row Level Security (RLS)
-- =====================================================================
-- Cho MVP: 1 user duy nhất (chủ HKD) — policy "cho phép tất cả" với auth.
-- Sau này nếu có nhiều user → sửa policy theo user_id.

alter table public.inventory             enable row level security;
alter table public.s2a                   enable row level security;
alter table public.vat_invoices          enable row level security;
alter table public.companies             enable row level security;
alter table public.s2a_settings          enable row level security;
alter table public.s2a_closed_periods    enable row level security;
alter table public.fresh_food_purchases  enable row level security;
alter table public.fresh_food_daily      enable row level security;

-- Policy: user đã đăng nhập thì có full quyền trên tất cả bảng
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'inventory', 's2a', 'vat_invoices', 'companies',
      's2a_settings', 's2a_closed_periods',
      'fresh_food_purchases', 'fresh_food_daily'
    ])
  loop
    execute format(
      'drop policy if exists "auth_full_access" on public.%1$s;
       create policy "auth_full_access" on public.%1$s
         for all to authenticated
         using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- =====================================================================
-- 11. Seed data (chạy 1 lần khi tạo project mới)
-- =====================================================================
insert into public.inventory (id, name, unit, quantity, unit_price, vat_rate) values
  ('hmpt', 'Nhóm Hóa mỹ phẩm & Tẩy rửa',       'Cái/Chai',  600, 100000, 0),
  ('ddgd', 'Nhóm Đồ dùng gia đình & Tiện ích',  'Cái/Bộ',    400,  65000, 0),
  ('tpdg', 'Nhóm Thực phẩm đóng gói & Đồ uống', 'Thùng/Gói', 700, 100000, 0),
  ('tpts', 'Nhóm hàng hóa tươi sống',           'Kg/Cân',      0,      0, 0)
on conflict (id) do nothing;

insert into public.s2a_settings (id) values (1) on conflict (id) do nothing;

-- =====================================================================
-- 12. Realtime (bật qua SQL thay vì click trong Dashboard)
-- =====================================================================
alter publication supabase_realtime add table public.inventory;
alter publication supabase_realtime add table public.s2a;
alter publication supabase_realtime add table public.vat_invoices;
alter publication supabase_realtime add table public.companies;
alter publication supabase_realtime add table public.s2a_closed_periods;
alter publication supabase_realtime add table public.fresh_food_purchases;
alter publication supabase_realtime add table public.fresh_food_daily;

-- =====================================================================
-- HẾT. Kiểm tra:
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
-- =====================================================================
