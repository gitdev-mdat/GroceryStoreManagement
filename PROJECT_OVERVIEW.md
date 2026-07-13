# PROJECT_OVERVIEW.md

> **Mục đích**: Tài liệu này giúp developer mới hoặc AI agent hiểu toàn bộ dự án chỉ qua một file duy nhất (~10 phút đọc), trước khi đọc source code.

---

# 1. Tổng quan dự án

## 1.1. Dự án là gì?

**Hải Kiều** là phần mềm quản lý sổ sách và doanh thu dành cho **Hộ Kinh Doanh Tạp hoá**, được xây dựng để đáp ứng Thông tư 152/2025/TT-BTC của Bộ Tài chính Việt Nam.

- **Chủ HKD**: Phạm Thị Thuý Kiều
- **Mã số thuế**: 051179002157
- **Địa chỉ**: Thôn 10, Xã Quảng Tín, Tỉnh Lâm Đồng

## 1.2. Vấn đề dự án giải quyết?

Trước đây, HKD tạp hoá quản lý sổ sách thủ công bằng giấy bút. Các vấn đề cụ thể:

- **Nhập liệu hóa đơn đầu vào mất thời gian**: Mỗi hóa đơn VAT phải gõ tay hàng chục dòng sản phẩm → giải quyết bằng **OCR AI tự động**.
- **Tính giá bán lẻ thủ công**: Phải tự tính giá bán dựa trên giá nhập → giải quyết bằng **thuật toán định giá tự động**.
- **Quản lý Sổ S1A và Sổ S2A theo quy định thuế**: Cần lưu phiếu doanh thu, chốt sổ hàng tháng → giải quyết bằng **hệ thống quản lý S1A/S2A**.
- **Theo dõi biến động giá nhập**: Nhiều nhà cung cấp, nhiều giá khác nhau → giải quyết bằng **bảng giá + lịch sử giá**.
- **Dữ liệu nằm rời rạc**: localStorage không đồng bộ, mất khi xóa cache → giải quyết bằng **Supabase (cloud database)**.

## 1.3. Đối tượng sử dụng

| Vai trò | Mô tả | Quyền |
|---------|--------|--------|
| **ADMIN** | Chủ HKD (quản trị viên) | Toàn quyền: quản lý sổ sách, nhập hóa đơn, báo cáo, quản lý nhân viên |
| **STAFF** | Nhân viên | Chỉ nhập hóa đơn, xem báo cáo, tra cứu giá |

## 1.4. Hướng đi hiện tại (Current Direction)

> **Tóm tắt**: S1A là sản phẩm chính. S2A là module legacy.

Sản phẩm này khởi đầu là app quản lý S2A / tồn kho / hóa đơn VAT. Tuy nhiên, **hướng sản phẩm đã thay đổi**:

| Module | Phân loại | Trạng thái |
|--------|-----------|-----------|
| **S1A — Sổ Doanh thu bán hàng** | ⭐ **Primary Module** | Đang hoạt động, ưu tiên phát triển |
| **Tồn kho, VAT, Price Book, OCR, Báo cáo, User Management** | 🔧 **Supporting Module** | Vẫn đang dùng, hỗ trợ S1A |
| **S2A — Sổ Mua vào** | ⚠️ **Legacy Module** | Không phải ưu tiên, không mở rộng trừ khi được yêu cầu |
| **db.js (localStorage → Supabase)** | Công cụ hạ tầng | Đang chuyển đổi, cần đánh giá theo hướng S1A-first |

**Nguyên tắc ưu tiên**:
- Mọi tính năng mới phải phục vụ S1A trước.
- Supporting modules vẫn được bảo trì — không bỏ, nhưng không mở rộng trừ khi phục vụ S1A.
- Không mở rộng S2A trừ khi có yêu cầu rõ ràng từ chủ HKD.
- Khi đánh giá migration localStorage → Supabase, ưu tiên dữ liệu dùng cho S1A.

## 1.5. Mô hình nghiệp vụ S1A — Core Business Rules

> **Nguồn sự thật**: Sau khi xác nhận với chủ HKD, các quy tắc sau đây phản ánh đúng thực tế hoạt động của HKD tạp hóa.

### 1.5.1. Mô hình nghiệp vụ vs. Technical Implementation

| Khía cạnh | Business Model (Nghiệp vụ) | Technical Implementation (Kỹ thuật) |
|-----------|---------------------------|-------------------------------------|
| Entity | **Daily Revenue** — Doanh thu hàng ngày | Bảng `sales_tickets` (Supabase) |
| Primary key | `date` (ngày là khóa tự nhiên) | `id` (UUID, technical PK) |
| Ngữ nghĩa | "Ghi nhận doanh thu ngày" | "Thêm phiếu bán hàng" |
| Số dòng/ngày | **Đúng 1 dòng** (1 ngày = 1 dòng duy nhất) | Cho phép nhiều dòng |

**Nguyên tắc**: Business Model luôn là nguồn sự thật. Tên bảng `sales_tickets` là detail implementation — không nên dùng làm ngôn ngữ nghiệp vụ.

### 1.5.2. Các quy tắc nghiệp vụ cốt lõi S1A

1. **Mỗi ngày dương lịch chỉ có đúng 1 dòng doanh thu.** Không có nhiều dòng cùng ngày. Đây là business rule bắt buộc.
2. **Người dùng chỉ nhập 2 thông tin: ngày và số tiền doanh thu.** Không hỏi nhóm hàng, không hỏi loại phiếu.
3. **Mô tả kế toán (Diễn giải) được hệ thống tự động tạo theo mẫu cố định.** Người dùng không gõ tay mỗi ngày. Ví dụ: *"Doanh thu bán lẻ tạp hóa ngày 09/07/2026 theo bảng kê ngày 09/07/2026"*.
4. **Nhóm hàng (group_key) không còn thuộc workflow chuẩn của S1A.** Trường này được giữ lại ở database level để tương thích ngược với dữ liệu cũ, nhưng **ẩn hoàn toàn khỏi UI**.
5. **Số phiếu (ticket_number) không còn bắt buộc trong workflow chuẩn.** Date là unique identifier tự nhiên — không cần ticket number để phân biệt các dòng.
6. **Kỳ kế toán đã chốt sổ (closed_periods) không được sửa hoặc xóa.** Khóa hoàn toàn ở cấp tháng.

### 1.5.3. Luồng ghi nhận doanh thu hàng ngày

```
Người dùng chọn ngày (mặc định: hôm nay)
        ↓
Hệ thống kiểm tra: ngày này đã có dữ liệu chưa?
        ↓
[Chưa có] → Form trống, user nhập số tiền
[Đã có]  → Form pre-filled → chế độ chỉnh sửa tự động
        ↓
Hệ thống tự động tạo Diễn giải (theo mẫu cố định)
        ↓
User nhấn Lưu
        ↓
Success → Refresh danh sách
```

---

# 2. Tính năng chính

## 2.1. Quản lý Sổ S1A (Doanh thu bán hàng) ← Primary Module

- **Danh sách doanh thu**: Xem, ghi nhận, điều chỉnh doanh thu theo ngày.
- **Ghi nhận doanh thu hàng ngày**: Chỉ nhập ngày và số tiền doanh thu. Mô tả kế toán (Diễn giải) được hệ thống tự động tạo theo mẫu cố định. Không hỏi nhóm hàng.
- **Doanh thu theo tháng**: Nhập tổng doanh thu cả tháng cùng lúc (thay vì từng ngày).
- **Mẫu in S1A-HKD**: Xuất báo cáo Sổ Doanh thu bán hàng hóa, dịch vụ theo mẫu quy định, hỗ trợ **in A4**.
- **Chốt sổ (Close Period)**: Khóa dữ liệu kỳ kế toán đã chốt sổ, đảm bảo tính minh bạch với cơ quan thuế. Kỳ đã chốt không cho thêm/sửa/xóa.

## 2.2. Nhập hóa đơn bằng OCR (AI) — Supporting Module

> 🔧 **Supporting Module**: Vẫn đang dùng, hỗ trợ nhập hóa đơn đầu vào phục vụ S1A. Cẩn thận khi chỉnh sửa.

- **Chụp/upload ảnh hóa đơn** (JPG, PNG, PDF) từ điện thoại hoặc máy tính.
- **Gemini Vision AI** tự động bóc tách: tên công ty, MST, ký hiệu, số hóa đơn, ngày xuất, danh sách sản phẩm, đơn giá, tổng tiền.
- **Người dùng xem trước và sửa** dữ liệu trước khi lưu.
- Hỗ trợ **2 loại hóa đơn**:
  - **VAT**: Hóa đơn có MST, bắt buộc điền đầy đủ thông tin thuế.
  - **RETAIL**: Hóa đơn bán lẻ, không có MST.
- **Retry logic** với Exponential Backoff (503/429 → tự động thử lại 3 lần).
- **Nén ảnh tự động** về < 500KB trước khi upload để tiết kiệm lưu trữ.
- **Phát hiện trùng lặp**: Cảnh báo nếu số hóa đơn + tổng tiền đã tồn tại.
- Ảnh hóa đơn được **upload lên Supabase Storage** và có thể xem lại trong Nhật ký hóa đơn.

## 2.3. Định giá thông minh — Supporting Module

> 🔧 **Supporting Module**: Thuật toán định giá vẫn được dùng cho Price Book và báo cáo.

- Mỗi sản phẩm sau khi nhập → hệ thống tự động đề xuất **giá bán lẻ = giá nhập × 1.15**.
- **Quy tắc làm tròn**:
  - Giá nhập ≥ 2.000đ: làm tròn **lên** hàng nghìn (VD: 12.400 → 13.000đ).
  - Giá nhập < 2.000đ: làm tròn **lên** hàng trăm (VD: 1.250 → 1.300đ).
- Giá bán gợi ý hiển thị **real-time** khi chỉnh sửa.

## 2.4. Bảng kê mua vào (Thực phẩm tươi sống) — Legacy Module

> ⚠️ **Legacy Module**: Dùng cho S2A (sổ mua vào). Không mở rộng trừ khi có yêu cầu rõ ràng.

- Hàng tươi sống (rau, thịt, cá, trứng) **không có hóa đơn VAT** → nhập tay vào bảng kê.
- Hỗ trợ 2 chế độ: **theo tháng** (tổng tháng) và **theo ngày** (chi tiết từng ngày).

## 2.5. Tra cứu giá sản phẩm — Supporting Module

> 🔧 **Supporting Module**: Vẫn đang dùng, phục vụ tra cứu giá nhập. Dữ liệu nằm trong localStorage.

- **Price Book** hiển thị toàn bộ sản phẩm đã nhập từ hóa đơn.
- **Xu hướng giá**: Biểu thị tăng/giảm/ổn định so với lần nhập trước (%).
- Chỉnh sửa tên sản phẩm, đơn vị tính, giá nhập → giá bán tự động recalculate.
- Ẩn sản phẩm (soft delete) thay vì xóa hẳn.

## 2.6. Báo cáo biến động — Supporting Module

> 🔧 **Supporting Module**: Vẫn đang dùng. Công thức tồn kho phụ thuộc vào dữ liệu VAT đầu vào.

5 tab báo cáo:
1. **Biến động tồn kho**: Tồn đầu kỳ + Nhập trong năm − Đã bán = Tồn hiện tại.
2. **Doanh thu theo ngày**: Tổng doanh thu, số ngày có dữ liệu, trung bình/ngày.
3. **Doanh thu theo tháng**: Tổng doanh thu, trung bình/tháng.
4. **Doanh thu theo nhóm**: ⚠️ Không còn dữ liệu. Tab được giữ lại nhưng không hiển thị kết quả. Chủ HKD không phân loại doanh thu theo nhóm trong thực tế.
5. **Hóa đơn VAT đầu vào**: Tổng hợp theo nhóm hàng và theo tháng.

## 2.7. Tổng hợp mua vào — Legacy Module

> ⚠️ **Legacy Module**: Bảng tổng hợp chi phí nhập hàng theo tháng. Thuộc module S2A — không mở rộng.

- Bảng tổng hợp chi phí nhập hàng theo từng tháng (từ danh sách hóa đơn VAT).

## 2.8. Quản lý người dùng (Admin) — Supporting Module

- **Tạo tài khoản nhân viên** (chỉ ADMIN).
- **Phân quyền** ADMIN / STAFF.
- **Khóa/mở khóa** tài khoản (không thể tự khóa chính mình).
- **Sửa họ tên, vai trò, trạng thái**.

## 2.9. Tồn kho đầu năm — Supporting Module

> 🔧 **Supporting Module**: Vẫn đang dùng, dùng làm base calculation cho báo cáo S1A.

- Khai báo **biên bản kiểm kê** hàng tồn kho đầu năm (4 nhóm hàng).
- Xuất file Excel (XLSX).
- Dữ liệu tồn kho làm **cơ sở tính toán biến động** trong báo cáo.

---

# 3. Luồng nghiệp vụ chính

## 3.1. Luồng nhập hóa đơn VAT hoàn chỉnh

```
Người dùng chụp/upload ảnh hóa đơn
        ↓
Frontend nén ảnh (Canvas, <500KB) → base64
        ↓
Gửi ảnh + prompt → Gemini Vision API (gemini-2.5-flash)
        ↓
Nhận JSON → tự động điền vào form
        ↓
Người dùng kiểm tra, chỉnh sửa (nếu cần)
        ↓
Nhấn "Xác nhận lưu"
        ↓
[1] Kiểm tra trùng lặp (số HĐ + tổng tiền)
        ↓
[2] Upload ảnh lên Supabase Storage
        ↓
[3] Lưu / lấy nhà cung cấp (theo MST)
        ↓
[4] Lưu hóa đơn (invoices)
        ↓
[5] Với mỗi dòng sản phẩm:
        - Tìm hoặc tạo sản phẩm mới (products)
        - Lưu lịch sử giá (price_history)
        - Tính giá bán lẻ gợi ý (×1.15, làm tròn)
        ↓
[6] Lưu localStorage Price Book (backup)
        ↓
Thông báo thành công + Reset form
```

## 3.2. Luồng quản lý S1A

```
Người dùng mở "Hồ sơ S1A"
        ↓
Hub: Chọn 1 trong 5 mục
        ↓
[Danh sách]        → Xem theo ngày/tháng
[Ghi nhận doanh thu] → Nhập ngày + số tiền → hệ thống tự tạo Diễn giải → Lưu
[Doanh thu tháng]    → Nhập tổng tháng 1 lần
[Sổ S1A-HKD]         → Xem mẫu in, chọn kỳ, In A4
[Chốt sổ]           → Khóa kỳ kế toán
```

## 3.3. Luồng chốt sổ kỳ kế toán

```
Admin chọn tháng cần chốt
        ↓
Hệ thống kiểm tra: kỳ đã chốt chưa?
        ↓
Nếu chưa → INSERT vào bảng closed_periods (Supabase)
        ↓
Kỳ đã chốt → mọi thao tác thêm/sửa/xóa phiếu trong tháng bị VÔ HIỆU HÓA
        ↓
Toast: "�ã chốt sổ tháng XX/YYYY"
```

---

# 4. Tech Stack

## Frontend

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|-----------|
| **React** | 18.3.1 | UI framework |
| **Vite** | 5.4.10 | Build tool, dev server |
| **Tailwind CSS** | 3.4.13 | Styling (utility-first) |
| **React Router** | 6.28.0 | Client-side routing |
| **Lucide React** | 1.21.0 | Icon library |
| **PWA Plugin** | 1.3.0 | Offline support |

## Backend (Cloud)

| Công nghệ | Mục đích |
|-----------|-----------|
| **Supabase** (PostgreSQL) | Database, Authentication, Storage, Realtime |
| **Supabase Edge Function** (Deno) | Tạo tài khoản nhân viên (service role, không expose key) |
| **Google Gemini API** | OCR hóa đơn bằng Vision model |

## Công cụ phát triển

| Công cụ | Mục đích |
|---------|-----------|
| **Vercel / Netlify** | Deploy frontend |
| **Supabase Cloud** | Backend-as-a-Service |
| **localStorage** | Offline fallback (cache + queue) |

---

# 5. Cấu trúc thư mục

```
src/
├── App.jsx                    # Root component: auth state machine
├── main.jsx                    # Entry point
├── lib/
│   ├── supabase.js            # Supabase client singleton + auth helpers
│   └── db.js                  # Lớp CRUD hybrid (Supabase + localStorage)
├── context/
│   ├── AppContext.jsx         # Global state: inventory, invoices, companies, fresh food
│   └── AuthContext.jsx         # Authentication state + user profile
├── pages/                      # Route-level pages (10 trang)
│   ├── LoginPage.jsx           # Trang đăng nhập
│   ├── TonKhoDauNam.jsx        # Tồn kho đầu năm (Admin)
│   ├── HoSoS1A.jsx             # Hub S1A → 5 sub-views
│   ├── HoaDonVAT.jsx           # Nhập hóa đơn OCR
│   ├── NhatKyHoaDon.jsx        # Danh sách hóa đơn đã nhập
│   ├── BangKeMuaVao.jsx        # Bảng kê mua vào (tươi sống)
│   ├── TraCuuGia.jsx           # Tra cứu giá sản phẩm
│   ├── BaoCao.jsx              # Báo cáo biến động (5 tab)
│   ├── TongHopThang.jsx        # Tổng hợp mua vào theo tháng
│   └── AdminUsers.jsx          # Quản lý người dùng (Admin)
├── components/
│   ├── RoleGuard.jsx            # RBAC: ẩn route không được phép
│   ├── Toast.jsx                # Hệ thống thông báo (toast notification)
│   ├── ConfirmDialog.jsx       # Modal xác nhận hành động
│   ├── FormatNumber.jsx         # Format số tiền VND
│   ├── FormatDate.jsx          # Format ngày tháng
│   ├── VndInput.jsx            # Input tiền VND (auto-format)
│   ├── DatePicker.jsx          # Date picker component
│   └── s1a/                    # Các component con của S1A
│       ├── SoS1aHKD.jsx        # Mẫu in S1A-HKD (A4 print)
│       ├── S1AList.jsx         # Danh sách doanh thu
│       ├── AddTicketForm.jsx   # Form ghi nhận doanh thu (legacy tên file, giữ nguyên)
│       ├── AddMonthlyRevenueForm.jsx  # Form nhập doanh thu tháng
│       └── CloseBookForm.jsx   # Form chốt sổ kỳ kế toán
├── utils/
│   ├── priceHelper.js           # Price Book CRUD (localStorage)
│   ├── dateHelper.js           # Helper xử lý ngày tháng
│   ├── imageHelper.js          # Helper xử lý ảnh (resize, compress)
│   └── abbreviationDictionary.js  # Từ điển viết tắt → tiếng Việt chuẩn
└── data/
    └── constants.js             # Dữ liệu tĩnh: nhóm hàng, thuế suất, localStorage keys

supabase/
├── migrations/
│   ├── 001_english_column_names.sql   # Schema v1: 8 bảng (inventory, s2a, vat_invoices...)
│   ├── 002_auth_and_profiles.sql     # Auth: profiles, RLS, ENUM app_role, Edge Function bootstrap
│   └── 003_fix_rls_infinite_recursion.sql  # Fix lỗi RLS
└── functions/
    └── create-employee/             # Edge Function Deno: tạo auth.users (chỉ ADMIN gọi)

docs/
├── SETUP.md                   # Hướng dẫn setup Supabase từ A-Z
├── SUPABASE_MIGRATION.md      # Kế hoạch tích hợp Supabase
├── schema.sql                 # Schema đầy đủ (bản mới nhất)
└── (các tài liệu khác)
```

---

# 6. Kiến trúc hệ thống

## 6.1. Luồng dữ liệu chính (Modern Supabase Path)

```
React Component (pages/)
        ↓ (gọi Supabase client trực tiếp)
Supabase REST API / RPC
        ↓
PostgreSQL Database (Supabase Cloud)
        ↓
Row Level Security (RLS) — kiểm tra JWT token
```

## 6.2. Luồng xác thực (Authentication Flow)

```
Người dùng nhập email + password
        ↓
supabase.auth.signInWithPassword()
        ↓
Supabase Auth (email/password, JWT)
        ↓
Session JWT lưu vào localStorage (auto-refresh)
        ↓
AuthContext khởi tộc: getCurrentUser() → lấy profile + role
        ↓
AppContext: nếu Supabase chưa config → dùng localStorage
AppContext: nếu Supabase đã config → gọi Supabase cho closed_periods
```

## 6.3. Kiến trúc hybrid data layer (db.js — chưa áp dụng rộng rãi)

```
AppContext gọi db.js
        ↓
db.js:
  ├── Online (Supabase configured)? → Gọi Supabase + cache localStorage
  └── Offline? → Ghi localStorage + enqueue vào pending queue
        ↓
Khi online trở lại → flushQueue() sync pending writes
```

> **Lưu ý**: db.js đã được viết nhưng **chưa được tích hợp** vào toàn bộ AppContext. Hiện tại AppContext vẫn đọc/ghi trực tiếp localStorage cho phần lớn dữ liệu.

## 6.4. Sơ đồ luồng OCR

```
Upload ảnh (Canvas resize <500KB)
        ↓
fileToGenerativePart() → base64 inlineData
        ↓
Gemini: generateContent() với schema ép buộc
        ↓
applyOcrResult() → sanitizeOcrData()
        ↓
cleanAndNormalizeItems() → expandAbbreviations()
        ↓
handleProductFieldChange() → calculateSmartRetailPrice()
        ↓
handleSaveAll() → Lưu Supabase + Price Book localStorage
```

---

# 7. Tổng quan Database

## 7.1. Các bảng chính

### `profiles` — Hồ sơ người dùng

| Trường | Kiểu | Mô tả |
|---------|------|--------|
| `id` | UUID | PK, liên kết với `auth.users` |
| `email` | TEXT | Email đăng nhập |
| `full_name` | TEXT | Họ tên |
| `role` | app_role | `ADMIN` hoặc `STAFF` |
| `is_active` | BOOLEAN | Tài khoản có đang hoạt động không |
| `created_at`, `updated_at` | TIMESTAMPTZ | Thời gian |

**Quan hệ**: 1-1 với `auth.users`. Trigger tự động tạo dòng mới khi user đăng ký.

---

### `inventory` — Nhóm hàng tồn kho đầu năm

| Trường | Kiểu | Mô tả |
|---------|------|--------|
| `id` | TEXT | PK, viết tắt: `hmpt`, `ddgd`, `tpdg`, `tpts` |
| `name` | TEXT | Tên đầy đủ nhóm hàng |
| `unit` | TEXT | Đơn vị tính mặc định |
| `quantity` | NUMERIC | Số lượng tồn kê ban đầu |
| `unit_price` | NUMERIC | Đơn giá bình quân |
| `vat_rate` | NUMERIC | Thuế suất (0, 5, 8, 10%) |
| `note` | TEXT | Ghi chú |

**Quan hệ**: `s2a.group_key` và `vat_invoices.group_key` FK vào `inventory.id`.

---

### `invoices` — Hóa đơn đầu vào (VAT + RETAIL)

| Trường | Kiểu | Mô tả |
|---------|------|--------|
| `id` | UUID | PK |
| `invoice_type` | VARCHAR | `VAT` hoặc `RETAIL` |
| `serial_number` | TEXT | Ký hiệu hóa đơn |
| `invoice_number` | TEXT | Số hóa đơn |
| `issue_date` | DATE | Ngày xuất hóa đơn |
| `total_amount` | NUMERIC | Tổng tiền thanh toán |
| `supplier_id` | UUID | FK → `suppliers.id` |
| `image_url` | TEXT | URL ảnh hóa đơn (Supabase Storage) |
| `created_by` | UUID | Người nhập liệu |

---

### `suppliers` — Danh sách nhà cung cấp

| Trường | Kiểu | Mô tả |
|---------|------|--------|
| `id` | UUID | PK |
| `company_name` | TEXT | Tên công ty |
| `tax_code` | TEXT | MST (UNIQUE) |

**Quan hệ**: 1 invoice thuộc về 1 supplier. Tự động tạo mới supplier khi nhập hóa đơn có MST chưa có trong hệ thống.

---

### `products` — Danh mục sản phẩm (đã chuẩn hóa)

| Trường | Kiểu | Mô tả |
|---------|------|--------|
| `id` | UUID | PK |
| `product_name` | TEXT | Tên chuẩn hóa (sau OCR + expand abbreviations) |
| `unit` | TEXT | Đơn vị tính |
| `status` | TEXT | `ACTIVE` hoặc `INACTIVE` |
| `first_seen_date` | DATE | Ngày xuất hiện lần đầu |

**Quan hệ**: 1 product có nhiều `price_history`.

---

### `price_history` — Lịch sử giá nhập

| Trường | Kiểu | Mô tả |
|---------|------|--------|
| `id` | UUID | PK |
| `product_id` | UUID | FK → `products.id` |
| `invoice_id` | UUID | FK → `invoices.id` |
| `import_date` | DATE | Ngày nhập hàng |
| `unit_price_after_vat` | NUMERIC | Giá nhập sau VAT |
| `quantity` | NUMERIC | Số lượng mua |
| `row_type` | TEXT | `MUA` (mua) hoặc `KM` (khuyến mãi) |
| `suggested_retail_price` | NUMERIC | Giá bán lẻ gợi ý |
| `is_active_price` | BOOLEAN | Đây có phải giá hiện hành không |

**Quan hệ**: Nhiều `price_history` cho 1 `product`. Nhiều `price_history` cho 1 `invoice`.

---

### `sales_tickets` — Doanh thu hàng ngày S1A

| Trường | Kiểu | Mô tả |
|---------|------|--------|
| `id` | UUID | PK |
| `ticket_number` | TEXT | Số phiếu (legacy, không còn dùng trong workflow chuẩn) |
| `sale_date` | DATE | Ngày doanh thu |
| `total_amount` | NUMERIC | Tổng doanh thu |
| `group_key` | TEXT | Nhóm hàng (legacy, ẩn khỏi UI, chỉ dùng cho migration) |

> **Business Model vs Technical Implementation**: `sales_tickets` là technical implementation name. Business entity là **Daily Revenue (Doanh thu hàng ngày)**. Business rule: **1 ngày = 1 dòng doanh thu duy nhất**. Nhóm hàng (`group_key`) không còn thuộc workflow chuẩn của S1A — giữ lại để tương thích ngược với dữ liệu cũ.

---

### `closed_periods` — Các kỳ kế toán đã chốt sổ

| Trường | Kiểu | Mô tả |
|---------|------|--------|
| `period_month` | TEXT | Kỳ đã chốt (định dạng `YYYY-MM`) |
| `closed_at` | TIMESTAMPTZ | Thời gian chốt sổ |

**Quan hệ**: Kỳ đã chốt → không cho thêm/sửa/xóa phiếu trong tháng đó.

---

### `business_profiles` — Thông tin Hộ Kinh Doanh

| Trường | Kiểu | Mô tả |
|---------|------|--------|
| `id` | UUID | PK |
| `owner_name` | TEXT | Tên chủ HKD |
| `business_name` | TEXT | Tên cửa hàng |
| `tax_code` | TEXT | MST |
| `address` | TEXT | Địa chỉ |
| `business_type` | TEXT | Loại hình (S1A, S2A...) |

---

### `s2a_settings` — Cài đặt in sổ S2A

Chỉ có **1 dòng duy nhất** (id = 1): tên HKD, địa chỉ, MST dùng khi in sổ.

---

## 7.2. Từ điển viết tắt trong database

```
hmpt = Nhóm Hóa mỹ phẩm & Tẩy rửa
ddgd = Nhóm Đồ dùng gia đình & Tiện ích
tpdg = Nhóm Thực phẩm đóng gói & Đồ uống
tpts = Nhóm hàng hóa tươi sống
hhk  = Nhóm Hàng hóa khác (đã gộp vào ddgd — KHÔNG còn dùng)
```

---

# 8. Các quy tắc nghiệp vụ quan trọng

1. **Thuế suất S2A-HKD**: Phân phối hàng hóa → 1% GTGT + 0.5% TNCN (Thông tư 152/2025/TT-BTC).
2. **Tồn kho thực = Tồn đầu kỳ + Nhập trong năm (VAT) − Đã bán (S1A)**.
3. **Giá bán lẻ gợi ý = Giá nhập × 1.15**, làm tròn:
   - ≥ 2.000đ → hàng nghìn
   - < 2.000đ → hàng trăm
4. **Dòng KM (Khuyến mãi)**: `row_type = 'KM'` + giá = 0 → vẫn lưu vào `price_history` nhưng KHÔNG hiển thị trên Price Book chính.
5. **Dòng PROMOTION** có `unit_price_after_vat = 0` → bị lọc bỏ khỏi danh sách sản phẩm.
6. **Kỳ đã chốt sổ** (`closed_periods`): Không cho thêm/sửa/xóa bất kỳ dữ liệu doanh thu nào trong tháng đã khóa.
7. **Trùng lặp hóa đơn**: Kiểm tra theo `invoice_number + total_amount`. Nếu trùng → cảnh báo người dùng xác nhận.
8. **Hóa đơn RETAIL** → `supplier_id = NULL`, không lưu MST.
9. **Người dùng không thể tự khóa** tài khoản của chính mình.
10. **Mật khẩu tối thiểu 6 ký tự**. Email phải hợp lệ (regex validation).
11. **MST nhà cung cấp**: Nếu chưa có → tự động tạo mới. Nếu có rồi → tái sử dụng.
12. **S1A — 1 ngày = 1 dòng doanh thu duy nhất**. Không có nhiều dòng cùng ngày. Date là natural unique key.
13. **S1A — Diễn giải tự động**: Mô tả kế toán được hệ thống tự tạo theo mẫu cố định. Người dùng không gõ tay.
14. **S1A — Nhóm hàng (group_key) không hiển thị trong UI**. Đây là legacy field từ S2A, giữ lại cho migration.

---

# 9. Các màn hình quan trọng

| Trang | Route | Trách nhiệm |
|-------|-------|------------|
| **Đăng nhập** | `/` (chưa auth) | Xác thực user, hiển thị branding panel |
| **Tồn kho đầu năm** | `/` | Khai báo biên bản kiểm kê, xuất Excel |
| **Hồ sơ S1A** | `/s1a` | ⭐ Hub điều hướng 5 chức năng S1A — Primary Module |
| **Nhập hóa đơn** | `/hoa-don` | OCR upload, preview, lưu hóa đơn — 🔧 Supporting Module |
| **Nhật ký hóa đơn** | `/nhat-ky-hoa-don` | Danh sách, tìm kiếm, xóa, xem chi tiết — 🔧 Supporting Module |
| **Bảng kê mua vào** | `/bang-ke-mua-vao` | Nhập chi phí tươi sống (S2A) — ⚠️ Legacy Module, không mở rộng |
| **Tra cứu giá** | `/tra-cuu-gia` | Price Book, xu hướng giá, chỉnh sửa — 🔧 Supporting Module |
| **Báo cáo biến động** | `/bao-cao` | 5 tab báo cáo — 🔧 Supporting Module |
| **Tổng hợp tháng** | `/tong-hop-thang` | Tổng hợp chi phí nhập hàng — ⚠️ Legacy Module, không mở rộng |
| **Quản lý user** | `/admin/users` | CRUD tài khoản nhân viên |

---

# 10. Trạng thái dự án hiện tại

## 10.1. Primary Module

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Quản lý S1A (doanh thu, in sổ) | ✅ Primary Module | Ưu tiên cao nhất |
| Chốt sổ kỳ kế toán | ✅ Hoàn thành | Ràng buộc thuế, không được sửa |

## 10.2. Supporting Modules

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Giao diện React + Tailwind + Responsive | ✅ Hoàn thành | |
| Supabase Auth + RBAC (ADMIN/STAFF) | ✅ Hoàn thành | |
| Quản lý người dùng (Admin) | ✅ Hoàn thành | |
| Nhập hóa đơn VAT + OCR Gemini | ✅ Hoạt động | Vẫn bảo trì |
| Thuật toán định giá thông minh | ✅ Hoạt động | Vẫn bảo trì |
| Tra cứu giá + xu hướng giá | ✅ Hoạt động | localStorage |
| Báo cáo biến động (5 tab) | ✅ Hoạt động | Vẫn bảo trì |
| Tồn kho đầu năm + xuất Excel | ✅ Hoạt động | Dùng cho base calculation S1A |

## 10.3. Legacy Modules

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Bảng kê mua vào tươi sống | ✅ Hoạt động | ⚠️ S2A — không mở rộng |
| Tổng hợp mua vào | ✅ Hoạt động | ⚠️ S2A — không mở rộng |

## 10.4. Hạ tầng / Chưa bắt đầu

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Lớp hybrid db.js (Supabase + localStorage) | ✅ Viết xong | ⚠️ Chưa tích hợp — đánh giá theo hướng S1A-first |
| Hoàn tất tích hợp db.js vào AppContext | ⏳ Chưa bắt đầu | Ưu tiên theo nhu cầu S1A |
| Xuất báo cáo PDF/Excel (báo cáo chuyên sâu) | ⏳ Chưa bắt đầu | Phục vụ S1A |

---

# 11. Quy ước phát triển

## 11.1. Quy tắc đặt tên

| Loại | Quy tắc | Ví dụ |
|------|---------|--------|
| File/Component | PascalCase | `TraCuuGia.jsx`, `AddTicketForm.jsx` |
| Biến (JSX) | camelCase | `vatInvoices`, `editingId`, `fetchPriceBook` |
| Hàm | camelCase, động từ | `handleSaveAll()`, `fetchInvoices()`, `isPeriodClosed()` |
| CSS class | Tailwind utility classes | `text-xl`, `bg-[#1e3a5f]`, `flex items-center gap-3` |
| Bảng database | snake_case (số nhiều) | `invoices`, `price_history`, `closed_periods` |
| Cột database | snake_case | `invoice_number`, `total_amount`, `group_key` |
| localStorage key | `haikieu-` prefix | `haikieu-inventory`, `haikieu-s2a` |
| Role | UPPERCASE ENUM | `ADMIN`, `STAFF` |

## 11.2. Component organization

- Mỗi page là một file trong `src/pages/`.
- Component dùng chung đặt trong `src/components/`.
- Component S1A đặt trong `src/components/s1a/`.
- Component có state phức tạp → tách thành file riêng. Ít state → có thể inline trong page.

## 11.3. State management

```
AuthContext     → user, loading, signIn, signOut, refreshProfile
AppContext      → inventory, vatInvoices, companies, freshFood, closedPeriods
Local state     → useState/useReducer trong từng page
```

## 11.4. API pattern

- **Đọc dữ liệu**: Gọi `supabase.from('table').select(...)` trực tiếp trong page/component.
- **Ghi dữ liệu**: Xử lý trong `handleSave...()` callback, gọi Supabase rồi update state.
- **db.js**: Lớp trung gian (đang chuyển đổi dần).

## 11.5. Responsive Design

- **Desktop (≥ 768px)**: Sidebar mở rộng, bảng ngang.
- **Mobile (< 768px)**: Sidebar overlay, Card List View dọc.
- Pattern: `hidden md:block` (Desktop) + `block md:hidden` (Mobile).

## 11.6. MUI/Tailwind

Dự án **không dùng MUI**. Toàn bộ style là **Tailwind CSS utility classes**. Không viết CSS tùy chỉnh trừ một số trường hợp print style (SoS1aHKD).

---

# 12. Những điều developer mới cần biết

## 12.1. Nguyên tắc S1A-first

**Quy tắc quan trọng nhất khi phát triển dự án này:**

- **S1A là Primary Module.** Mọi tính năng mới phải phục vụ S1A trước.
- **Business Model S1A**: Mỗi ngày chỉ có 1 dòng doanh thu. Người dùng chỉ nhập ngày + số tiền. Mô tả kế toán tự động. Không hỏi nhóm hàng.
- **Supporting modules** (OCR, Price Book, Tồn kho, VAT, Báo cáo, User Management) vẫn được bảo trì — không bỏ.
- **Legacy modules** (S2A, Bảng kê mua vào, Tổng hợp mua vào) — không mở rộng trừ khi có yêu cầu rõ ràng từ chủ HKD.
- Khi đánh giá migration localStorage → Supabase: ưu tiên dữ liệu dùng cho S1A (`sales_tickets`, `closed_periods`).

## 12.2. Hai hệ thống dữ liệu song song

Dự án đang trong quá trình **chuyển đổi từ localStorage sang Supabase**:

- **Phần S1A** (sản phẩm chính): Đã dùng Supabase (`sales_tickets`, `closed_periods`).
- **Phần còn lại** (inventory, invoices, companies, fresh food, Price Book): Vẫn dùng **localStorage** qua `AppContext` + `data/constants.js`.
- **`db.js`** là lớp hybrid đã viết xong nhưng **chưa được gắn** vào AppContext.

> **Tác vụ ưu tiên**: Ưu tiên chuyển dữ liệu phục vụ S1A sang Supabase trước. Không mở rộng phạm vi localStorage → Supabase cho các module legacy (S2A, Price Book) trừ khi phục vụ S1A.

## 12.3. Hai từ điển viết tắt song song

| Từ viết tắt | Dùng ở đâu |
|-------------|-------------|
| `hmpt`, `ddgd`, `tpdg`, `tpts` | Database (Supabase): `inventory.id`, `sales_tickets.group_key` |
| `hoa-my-pham-gia-dung`, `do-uong-thuc-pham`... | localStorage (legacy S2A) |

> ⚠️ **Legacy Module**: Khi đọc dữ liệu S2A cũ từ localStorage → cần map qua `LEGACY_GROUP_TO_INVENTORY_ID` trong `constants.js`.

## 12.4. MST nhà cung cấp được hard-code

MST `051179002157` (HKD Hải Kiều) được hard-code trong:
- Sidebar footer (`App.jsx`)
- Login branding (`LoginPage.jsx`)
- Tồn kho đầu năm (`TonKhoDauNam.jsx`)
- S2A settings default (`schema.sql`)

## 12.5. Edge Function `create-employee`

- **Chỉ ADMIN** mới được gọi.
- Dùng **service role key** (SERVER-SIDE ONLY, không bao giờ để trong frontend).
- Bootstrapping: Lần đầu không có user nào → chạy script `seed.js` thủ công với service role key.

## 12.6. OCR prompt rất dài và chi tiết

> 🔧 **Supporting Module**: Cẩn thận khi chỉnh sửa vì chứa logic phức tạp.

`HoaDonVAT.jsx` chứa prompt Gemini dài ~60 dòng. Prompt này:
- Ép buộc schema JSON response.
- Yêu cầu tính toán đơn giá từ cột "Tổng cộng" (không phải cột "Đơn giá").
- Ngày tháng phải format `DD/MM/YYYY`, không chứa chữ.
- Số tiền phải là integer liên tục, không có dấu chấm/phẩy.

## 12.7. Ảnh hóa đơn lưu ở đâu?

- **Supabase Storage bucket**: `invoice-images` (private, chỉ user đăng nhập xem được).
- URL lưu trong `invoices.image_url`.

## 12.8. Các lỗi thường gặp

| Lỗi | Nguyên nhân | Xử lý |
|------|------------|--------|
| `Invalid API key` | `.env.local` chưa có VITE_SUPABASE_URL | Copy `.env.example` → `.env.local` |
| OCR trả về `null` cho số hóa đơn | Hóa đơn không có số in sẵn | Xử lý: trường bắt buộc chỉ áp dụng cho VAT |
| Doanh thu không lưu được | Kỳ đã chốt sổ | Thông báo "Kỳ đã khóa" |
| Price Book trống | Chưa nhập hóa đơn nào | Nhập hóa đơn đầu tiên |

---

# 13. Hướng phát triển tương lai

> ⚠️ **Ưu tiên S1A-first**: Mọi hướng phát triển phải phục vụ S1A trước. Không mở rộng S2A trừ khi có yêu cầu rõ ràng.

1. **Xuất báo cáo PDF/Excel cho S1A** → Báo cáo doanh thu hàng tháng tự động theo mẫu quy định.
2. **Tích hợp hoàn chỉnh db.js vào AppContext** → Ưu tiên dữ liệu S1A. Bỏ localStorage cho `sales_tickets`, `closed_periods`.
3. **Export dữ liệu S1A** → CSV/JSON cho kế toán hoặc phần mềm khác.
4. **Đồng bộ đa thiết bị** → Realtime Supabase cho phép nhiều nhân viên cùng làm việc trên S1A.
5. **Thông báo đẩy PWA** → Nhắc kỳ sắp chốt sổ, cảnh báo trùng hóa đơn.
6. **Admin Dashboard cho S1A** → Tổng quan doanh thu, số ngày có dữ liệu, tình trạng chốt sổ.
7. **Hỗ trợ đa HKD** → Nhiều cửa hàng cùng quản lý trên 1 tài khoản.
8. ~~Nâng cấp định giá~~ → Bỏ qua, không phục vụ S1A.
9. ~~Mở rộng / hoàn thiện S2A~~ → Không khuyến khích trừ khi có yêu cầu từ chủ HKD.

---

> **Cập nhật lần cuối**: Dựa trên codebase tại thời điểm hiện tại.
