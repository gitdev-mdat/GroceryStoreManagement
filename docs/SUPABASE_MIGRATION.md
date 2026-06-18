# Kế hoạch tích hợp Supabase cho Hộ Kinh Doanh Hải Kiều

> **Trạng thái**: BẢN NHÁP — chưa tạo project Supabase, chỉ là code mẫu + kế hoạch triển khai.
> Đọc kỹ mục 1 để quyết định có nên triển khai hay không.

---

## 1. Tổng quan & quyết định

### 1.1. Vấn đề hiện tại

Toàn bộ dữ liệu đang nằm trong `localStorage` của trình duyệt:

- Mất khi xoá cache, đổi máy, đổi trình duyệt.
- Không đồng bộ giữa nhiều thiết bị.
- Không có audit log, không có phân quyền, không có backup tự động.

### 1.2. Giải pháp đề xuất: **Supabase (PostgreSQL cloud)**

| Tiêu chí | Đáp ứng? |
|---|---|
| Tốc độ triển khai (ưu tiên #1) | ✅ ~3 giờ là chạy được |
| Luôn có mạng (ràng buộc đã chọn) | ✅ Supabase cloud = cần mạng |
| Thỉnh thoảng mất mạng (ràng buộc đã chọn) | ⚠️ Cần hybrid: Supabase + localStorage fallback |
| Biết SQL + Spring Boot (nền tảng) | ✅ Supabase dùng PostgreSQL, cú pháp SQL chuẩn |
| Chi phí thấp | ✅ Free tier 500MB DB + 1GB storage |
| Dùng được nhiều thiết bị | ✅ REST API + Realtime |
| Tự lưu ảnh hóa đơn VAT | ✅ Supabase Storage (giống S3) |

### 1.3. Vì sao KHÔNG chọn MySQL Workbench / Spring Boot

- Phải viết backend, tự host server, tự backup, tự lo HTTPS.
- 1–3 ngày mới chạy được (so với 3 giờ).
- Không tận dụng được lợi thế "gọi thẳng từ React" của Supabase.

> **Lưu ý**: Nếu sau này cần MySQL đặc thù (vd. tích hợp phần mềm kế toán chỉ hỗ trợ MySQL), có thể export CSV từ Supabase rồi import vào MySQL.

---

## 2. Kiến trúc mục tiêu

```
┌─────────────────────────────────────────────────────┐
│ Browser (React + Vite)                              │
│                                                     │
│  AppContext (useReducer)                            │
│       │                                             │
│       ▼                                             │
│  src/lib/db.js  ◄──── đọc/ghi duy nhất              │
│       │                                             │
│       ├─► Supabase (online)  ◄── primary            │
│       │     • Load khi mở app                      │
│       │     • Write realtime qua websocket          │
│       │                                             │
│       └─► localStorage (offline fallback)           │
│             • Cache bản mới nhất                    │
│             • Queue các write khi mất mạng          │
│             • Sync lại khi có mạng                  │
└─────────────────────────────────────────────────────┘
                │
                ▼ HTTPS + JWT
┌─────────────────────────────────────────────────────┐
│ Supabase (PostgreSQL 15)                            │
│  • 8 bảng (xem docs/schema.sql)                    │
│  • Row Level Security (RLS) — 1 user / 1 dòng      │
│  • Realtime channels cho từng bảng                  │
│  • Storage bucket cho ảnh hóa đơn VAT              │
└─────────────────────────────────────────────────────┘
```

---

## 3. Lộ trình triển khai (ước tính tổng ~3 giờ)

| Bước | Công việc | Thời gian | Trạng thái |
|---|---|---:|---|
| 1 | Tạo project Supabase (free tier) | 5' | ⏳ Chưa làm |
| 2 | Chạy `docs/schema.sql` trong SQL Editor | 5' | ⏳ Chưa làm |
| 3 | Bật Row Level Security + viết policy | 15' | ⏳ Chưa làm |
| 4 | Bật Realtime cho 8 bảng | 5' | ⏳ Chưa làm |
| 5 | Tạo Storage bucket `vat-images` | 5' | ⏳ Chưa làm |
| 6 | Cài `@supabase/supabase-js` + `.env` | 5' | ⏳ Chưa làm |
| 7 | Viết `src/lib/supabase.js` (client wrapper) | 15' | ✅ Code mẫu có sẵn |
| 8 | Viết `src/lib/db.js` (hybrid layer) | 45' | ✅ Code mẫu có sẵn |
| 9 | Refactor `AppContext.jsx` gọi `db.js` thay vì localStorage | 45' | ⏳ Chưa làm |
| 10 | Thêm nút "Đồng bộ" + chỉ báo online/offline | 15' | ⏳ Chưa làm |
| 11 | Test trên 2 trình duyệt / 2 tab | 15' | ⏳ Chưa làm |

**Tổng khi triển khai thật: ~3 giờ** (bước 1–5 = 35' thao tác tay, bước 6–11 = ~2h25' code).

---

## 4. Các file đã chuẩn bị sẵn (chưa tích hợp)

| File | Mô tả |
|---|---|
| `docs/schema.sql` | DDL 8 bảng + index + RLS policy |
| `src/lib/supabase.js` | Khởi tạo Supabase client (1 file) |
| `src/lib/db.js` | Lớp CRUD hybrid (Supabase + localStorage) |
| `.env.example` | Template biến môi trường |
| `docs/SETUP.md` | Hướng dẫn tạo project Supabase từ A–Z |

> Tất cả file trên **chưa được tích hợp vào code hiện tại** — bạn có thể đọc trước, chạy thử logic, rồi tự quyết khi nào apply.

---

## 5. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Mất mạng giữa chừng → ghi dở | localStorage queue + retry khi online |
| Conflict 2 người cùng sửa | `updated_at` + version column (optimistic locking) |
| Ảnh VAT > 1MB gây chậm | Resize client-side trước khi upload (giữ ngưỡng 500KB) |
| Free tier hết quota (500MB) | Sau 1 năm dữ liệu có thể > 500MB → có nút export toàn bộ sang CSV/JSON |
| Supabase ngừng free tier | Code hybrid → chỉ cần đổi URL/key, không phụ thuộc vendor |
| Quên password Supabase | Lưu URL + key vào 1Password / Bitwarden, không commit `.env` lên git |

---

## 6. Đề xuất quyết định

Tôi khuyến nghị:

1. **Đọc code mẫu** trong `src/lib/db.js` để hiểu luồng.
2. **Tạo project Supabase free** (bước 1–5 trong mục 3) để xem dashboard thật.
3. **Chạy `docs/schema.sql`** trong SQL Editor → kiểm tra 8 bảng + RLS hoạt động.
4. **Sau đó** mới quyết định có refactor `AppContext.jsx` hay không.

Nếu cần, tôi sẽ tạo Pull Request riêng để dễ review.
