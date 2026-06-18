# SETUP — Tạo project Supabase từ A–Z

> Thời gian ước tính: **30 phút** (gồm 5 phút ngồi đợi email xác nhận).

## 1. Tạo tài khoản & project

1. Vào https://supabase.com → **Start your project** → đăng ký bằng GitHub (khuyên) hoặc email.
2. **New project**:
   - **Name**: `haikieu` (hoặc tùy thích)
   - **Database password**: tạo password mạnh, **LƯU LẠI** vào 1Password/Bitwarden
   - **Region**: `Singapore` (gần VN nhất)
   - **Plan**: `Free` (500MB DB, 1GB storage, 50k MAU)
3. Đợi ~2 phút để Supabase khởi tạo.

## 2. Chạy schema SQL

1. Trong Dashboard Supabase → **SQL Editor** (icon database bên trái).
2. **New query** → copy toàn bộ nội dung `docs/schema.sql` → **Run**.
3. Kiểm tra: cuộn xuống dưới, không có lỗi đỏ là OK.

## 3. Bật Authentication

1. **Authentication** → **Providers** → bật **Email** (mặc định đã bật).
2. **Authentication** → **Users** → **Add user** → **Create new user**:
   - Email: ví dụ `kieupham@haikieu.local`
   - Password: mạnh, lưu vào 1Password
   - **Auto Confirm User**: ✅ bật (để không phải xác nhận email)
3. Sau khi tạo xong, **copy User UID** — sẽ cần nếu muốn phân quyền chi tiết.

## 4. Tạo Storage bucket (cho ảnh hóa đơn VAT)

1. **Storage** → **New bucket**:
   - Name: `vat-images`
   - **Public bucket**: ❌ tắt (riêng tư, chỉ user đăng nhập mới xem được)
2. **Policies** → **New policy** → **For full customization**:
   ```sql
   -- Cho phép user đã đăng nhập upload/xem/xóa
   create policy "auth_vat_images" on storage.objects
     for all to authenticated
     using (bucket_id = 'vat-images')
     with check (bucket_id = 'vat-images');
   ```

## 5. Lấy URL & Anon Key

1. **Settings** (⚙️) → **API**:
   - **Project URL**: copy vào `VITE_SUPABASE_URL`
   - **Project API keys** → **anon / public**: copy vào `VITE_SUPABASE_ANON_KEY`
2. Tạo file `.env.local` ở thư mục gốc dự án (sao chép từ `.env.example`):
   ```bash
   cp .env.example .env.local
   ```
3. Dán 2 giá trị vào.

## 6. Cài package & chạy thử

```bash
npm install @supabase/supabase-js
npm run dev
```

Mở `http://localhost:5173` → mở **Console** (F12) → chạy:

```js
import('/src/lib/db.js').then(async ({ db }) => {
  const list = await db.s2a.list();
  console.log('S2A:', list);
});
```

Nếu thấy `[]` → OK, DB rỗng. Nếu thấy lỗi `Invalid API key` → check lại URL/key.

## 7. Đăng nhập từ UI (sẽ làm ở bước sau)

Code mẫu đăng nhập:

```js
import { supabase } from '@/lib/supabase';

await supabase.auth.signInWithPassword({
  email: 'kieupham@haikieu.local',
  password: 'YOUR_PASSWORD',
});
```

Session được lưu tự động vào localStorage → lần sau không cần đăng nhập lại.

## 8. Kiểm tra bảng đã tạo

Vào **Table Editor** (bên trái) → bạn sẽ thấy 8 bảng:
- `inventory`
- `s2a`
- `vat_invoices`
- `companies`
- `s2a_settings`
- `s2a_closed_periods`
- `fresh_food_purchases`
- `fresh_food_daily`

Mở `inventory` → sẽ thấy 4 dòng seed (`hmpt`, `ddgd`, `tpdg`, `tpts`).

---

## XONG!

Giờ app đã kết nối Supabase. Bước tiếp theo (chưa làm) là refactor `AppContext.jsx` để gọi `db.js` thay vì đọc/ghi `localStorage` trực tiếp.

Nếu gặp lỗi, gửi message kèm screenshot Console — tôi sẽ debug.
