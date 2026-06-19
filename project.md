# Bản thiết kế kỹ thuật - Phần mềm Quản lý Sổ sách & Doanh thu Hộ Kinh Doanh

> Tài liệu này là **kim chỉ nam chính** để thiết kế cơ sở dữ liệu, phát triển chức năng và triển khai các dịch vụ backend (Supabase / Edge Functions) cho hệ thống.

> **Nguyên tắc kiến trúc:** "English Backend / Vietnamese UI" - Database, API, code logic dùng 100% tiếng Anh. Giao diện người dùng hiển thị tiếng Việt.

---

## 1. Tổng quan hệ thống

- **Tên hệ thống:** Phần mềm Quản lý Sổ sách & Doanh thu Hộ Kinh Doanh
- **Phạm vi chức năng:** Hỗ trợ quản lý sổ sách kế toán S1a / S2a và nhập liệu hóa đơn VAT qua OCR.
- **Đối tượng sử dụng:** Hộ kinh doanh cá thể, tạp hóa, cửa hàng kinh doanh tại Việt Nam.
- **Mục tiêu cốt lõi:**
  - Tối ưu nhập liệu hóa đơn đầu vào bằng AI (Gemini OCR).
  - Tự động hóa tính toán giá vốn, giá bán lẻ gợi ý.
  - Theo dõi biến động giá, xu hướng và lịch sử mua theo thời gian.
  - Giao diện Mobile-first, dễ sử dụng, không cần đào tạo phức tạp.

---

## 2. Kiến trúc tính năng & điều hướng

### 2.1 Cấu trúc Sidebar (Responsive)

| Nhóm | Chức năng | Mô tả |
|------|-----------|-------|
| **1. Quản lý Sổ sách** | Tồn kho đầu năm | Khai báo số lượng & giá trị hàng tồn ban đầu năm |
| | Hồ sơ S1a | Quản lý thông tin hộ kinh doanh đăng ký S1a |
| | Bảng kê mua vào | Bảng kê hàng hóa nhập theo kỳ / tháng |
| **2. Chứng từ đầu vào** | Nhập hóa đơn VAT (OCR) | Chụp/upload hóa đơn, Gemini OCR trích xuất JSON |
| | Nhật ký hóa đơn | Lịch sử các hóa đơn đã nhập |
| **3. Danh mục & Tra cứu** | Tra cứu giá sản phẩm | Xem & chỉnh sửa Price Book, Card List View trên Mobile |
| **4. Báo cáo thống kê** | Báo cáo biến động | Thống kê tăng/giảm giá theo sản phẩm |
| | Tổng hợp mua vào theo tháng | Báo cáo tổng hợp theo tháng |

### 2.2 Responsive Behavior

- **Desktop (>= 768px):** Sidebar mở rộng, bảng dữ liệu hiển thị dạng bảng ngang.
- **Mobile (< 768px):** Sidebar thu gọn (menu overlay), dữ liệu hiển thị dạng Card dọc (Card List View).
- **Nguyên tắc chung:** Mọi trang dữ liệu đều chia 2 lớp render: `hidden md:block` (Desktop) và `block md:hidden` (Mobile).

---

## 3. Database Schema (100% English Convention)

> **Chuẩn hóa theo Supabase / PostgreSQL.** Tất cả bảng đều có `created_at` và `updated_at` để theo dõi thời gian.

### 3.1 Bảng `business_profiles`

Lưu thông tin đăng ký của hộ kinh doanh.

| Column | Type | Constraint | Mô tả |
|--------|------|------------|-------|
| `id` | `uuid` | PK | ID hộ kinh doanh |
| `owner_name` | `text` | NOT NULL | Tên chủ hộ / người đại diện |
| `business_name` | `text` | NOT NULL | Tên cửa hàng / đơn vị |
| `tax_code` | `text` | UNIQUE | Mã số thuế |
| `address` | `text` | NULL | Địa chỉ kinh doanh |
| `phone_number` | `text` | NULL | Số điện thoại liên hệ |
| `business_start_date` | `date` | NULL | Ngày bắt đầu hoạt động |
| `business_type` | `text` | NULL | Loại hình S1a, S2a,... |
| `created_at` | `timestamp` | DEFAULT now() | Ngày tạo |
| `updated_at` | `timestamp` | DEFAULT now() | Ngày cập nhật |

### 3.2 Bảng `suppliers`

Danh mục nhà cung cấp (đối tác mua hàng).

| Column | Type | Constraint | Mô tả |
|--------|------|------------|-------|
| `id` | `uuid` | PK | ID nhà cung cấp |
| `company_name` | `text` | NOT NULL | Tên công ty / cửa hàng |
| `tax_code` | `text` | UNIQUE | Mã số thuế |
| `address` | `text` | NULL | Địa chỉ |
| `phone_number` | `text` | NULL | Số điện thoại |
| `notes` | `text` | NULL | Ghi chú nội bộ |
| `created_at` | `timestamp` | DEFAULT now() | Ngày tạo |
| `updated_at` | `timestamp` | DEFAULT now() | Ngày cập nhật |

> **Quy tắc tự động tạo:** Khi nhập hóa đơn, nếu MST nhà cung cấp chưa có trong bảng `suppliers`, hệ thống sẽ tự động tạo mới.

### 3.3 Bảng `invoices`

Lưu nhật ký hóa đơn VAT đầu vào.

| Column | Type | Constraint | Mô tả |
|--------|------|------------|-------|
| `id` | `uuid` | PK | ID hóa đơn |
| `serial_number` | `text` | NOT NULL | Ký hiệu hóa đơn |
| `invoice_number` | `text` | NOT NULL | Số hóa đơn |
| `issue_date` | `date` | NOT NULL | Ngày xuất hóa đơn (YYYY-MM-DD) |
| `invoice_type` | `varchar` | NOT NULL | VAT / RETAIL |
| `total_amount` | `numeric` | NOT NULL | Tổng tiền thanh toán |
| `subtotal_amount` | `numeric` | NULL | Tổng tiền trước VAT |
| `vat_amount` | `numeric` | NULL | Tổng VAT |
| `notes` | `text` | NULL | Ghi chú |
| `supplier_id` | `uuid` | FK | Nhà cung cấp |
| `created_by` | `uuid` | NULL | Người nhập liệu |
| `created_at` | `timestamp` | DEFAULT now() | Ngày tạo |
| `updated_at` | `timestamp` | DEFAULT now() | Ngày cập nhật |

### 3.4 Bảng `products`

Danh mục sản phẩm chuẩn hóa (đã được AI xử lý).

| Column | Type | Constraint | Mô tả |
|--------|------|------------|-------|
| `id` | `uuid` | PK | ID sản phẩm |
| `product_name` | `text` | NOT NULL | Tên sản phẩm chuẩn hóa |
| `unit` | `text` | NOT NULL | Đơn vị tính |
| `status` | `text` | DEFAULT 'ACTIVE' | ACTIVE / INACTIVE |
| `first_seen_date` | `date` | DEFAULT current_date | Ngày xuất hiện đầu tiên |
| `created_at` | `timestamp` | DEFAULT now() | Ngày tạo |
| `updated_at` | `timestamp` | DEFAULT now() | Ngày cập nhật |

> **Lưu ý:** Tên sản phẩm được AI chuẩn hóa (không dùng raw từ OCR), đồng nhất về chính tả và cách gọi.

### 3.5 Bảng `price_history`

Lịch sử biến động giá nhập của từng sản phẩm (giải quyết bài toán **nhiều giá, khác ngày**).

| Column | Type | Constraint | Mô tả |
|--------|------|------------|-------|
| `id` | `uuid` | PK | ID lịch sử giá |
| `product_id` | `uuid` | FK | Sản phẩm |
| `invoice_id` | `uuid` | FK | Hóa đơn |
| `import_date` | `date` | NOT NULL | Ngày nhập |
| `unit_price_after_vat` | `numeric` | NOT NULL | Giá nhập sau VAT |
| `quantity` | `numeric` | NOT NULL | Số lượng |
| `row_type` | `text` | CHECK (PURCHASE, PROMOTION) | PURCHASE = mua hàng, PROMOTION = khuyến mãi |
| `suggested_retail_price` | `numeric` | NULL | Giá bán lẻ đề xuất |
| `is_active_price` | `boolean` | DEFAULT TRUE | Giá hiện hành |
| `created_at` | `timestamp` | DEFAULT now() | Ngày tạo |

### 3.6 Bảng `sales_tickets`

Lưu phiếu doanh thu bán ra của Sổ S1A (Sổ Doanh thu bán hàng hoá, dịch vụ).

| Column | Type | Constraint | Mô tả |
|--------|------|------------|-------|
| `id` | `uuid` | PK | ID phiếu doanh thu |
| `ticket_number` | `text` | NULL | Số phiếu (tùy chọn) |
| `sale_date` | `date` | DEFAULT current_date | Ngày bán (YYYY-MM-DD) |
| `total_amount` | `numeric` | NOT NULL DEFAULT 0 | Tổng tiền doanh thu |
| `group_key` | `text` | DEFAULT 'Hàng hóa tổng hợp' | Nhóm hàng hóa/dịch vụ |
| `notes` | `text` | NULL | Ghi chú thêm |
| `created_at` | `timestamp` | DEFAULT now() | Ngày tạo bản ghi |

> **Nghiệp vụ:** Đây là bảng chính thức lưu doanh thu bán lẻ hàng ngày của hộ kinh doanh, dùng để xuất Sổ S1a-HKD theo Thông tư 152/2025/TT-BTC.

### 3.7 Bảng `closed_periods`

Lưu các kỳ kế toán đã chốt sổ.

| Column | Type | Constraint | Mô tả |
|--------|------|------------|-------|
| `id` | `uuid` | PK | ID bản ghi |
| `period_month` | `text` | NOT NULL UNIQUE | Kỳ đã chốt (YYYY-MM) |
| `closed_at` | `timestamp` | DEFAULT now() | Thời gian chốt sổ |

> **Nghiệp vụ:** Khi một kỳ đã chốt sổ, hệ thống sẽ khóa các chức năng thêm/sửa/xóa phiếu của tháng đó, đảm bảo minh bạch với cơ quan thuế.

### 3.8 ERD (Entity Relationship Diagram)

```
business_profiles (1) ──── (n) invoices (n) ──── (1) suppliers
                               |
                               |
                           (n) price_history (n) ──── (1) products

sales_tickets (1) ──── (n) closed_periods (1) ──── (1) business_profiles
```

- Một `invoice` thuộc về 1 `supplier`.
- Một `invoice` có thể có nhiều `price_history` (nhiều dòng hàng).
- Một `product` có thể xuất hiện nhiều lần trong `price_history` (theo thời gian).
- Một `business_profile` có thể có nhiều `sales_tickets` và nhiều `closed_periods`.

---

## 4. Gemini API OCR Schema

### 4.1 Response Schema

```json
{
  "invoice_type": "VAT" | "RETAIL",
  "invoice_info": {
    "serial_number": "string | null",
    "invoice_number": "string | null",
    "issue_date": "DD/MM/YYYY"
  },
  "seller": {
    "company_name": "string | null",
    "tax_code": "string | null"
  },
  "products": [
    {
      "item_name": "string",
      "unit": "string",
      "quantity": 0,
      "unit_price_after_vat": 0,
      "row_type": "PURCHASE" | "PROMOTION"
    }
  ],
  "summary": {
    "total_amount": 0
  }
}
```

### 4.2 AI Prompt

```
Translate raw abbreviated product names to clear, readable standard Vietnamese. 
Clean and filter out rows that are purely discounts. 
For row_type, strictly use uppercase 'PURCHASE' or 'PROMOTION'.
```

---

## 5. Quy tắc nghiệp vụ & AI

### 5.1 Quy trình OCR Gemini

- **Input:** Ảnh hóa đơn (JPG/PNG/PDF) → gửi lên Gemini API.
- **Schema ép buộc:** Gemini trả về JSON theo cấu trúc bắt buộc (không tự do nội dung).
- **Chuẩn hóa tên hàng:** AI được hướng dẫn chuyển tên viết tắt / teencode → tiếng Việt chuẩn.
- **Lưu trữ:** Kết quả OCR được lưu tạm, người dùng có thể xem lại và sửa trước khi ghi vào DB chính thức.

### 5.2 Bộ lọc dữ liệu sạch

- **Loại bỏ dòng PROMOTION:** Các dòng Khuyến mãi / Chiết khấu có `row_type = 'PROMOTION'` và `unit_price_after_vat = 0` **không** được thêm vào bảng `products` (không hiển thị trên Price Book chính).
- **Vết quà tặng:** Tuy nhiên, số lượng quà tặng vẫn được lưu vào `price_history` để thống kê.
- **Giá trị 0 không hợp lệ:** Nếu `unit_price_after_vat = 0` mà không phải PROMOTION → cảnh báo / yêu cầu xác nhận.
- **Validation Guards:** Input refs cho auto-focus, smooth scroll đến vùng lỗi, kiểm tra bắt buộc các trường MST, serial_number, invoice_number cho hóa đơn VAT.

### 5.3 Thuật toán định giá thông minh

Mục tiêu: Tự động đề xuất giá bán lẻ gợi ý dựa trên giá nhập.

**Công thức cơ bản:**
```
gia_ban_le_goi_y = gia_nhap_sau_vat * 1.15
```

**Quy tắc làm tròn:**

| Điều kiện | Cách làm tròn |
|-----------|---------------|
| Giá nhập >= 2.000đ (hàng sỉ / giá trị cao) | Làm tròn **LÊN** hàng nghìn (ví dụ: 12.400 → 13.000đ) |
| Giá nhập < 2.000đ (hàng lẻ / giá trị nhỏ) | Làm tròn **LÊN** hàng trăm (ví dụ: 1.250 → 1.300đ) |

> **Mục đích:** Giá bán phải là số "đẹp", dễ nhớ, dễ đọc cho khách hàng và người bán.

### 5.4 Xử lý lỗi & Retry Logic (Gemini API)

- **Lỗi 503 (Service Unavailable) / 429 (Too Many Requests):**
  - Thực hiện retry với **Exponential Backoff**:
    - Lần 1: chờ 1s
    - Lần 2: chờ 2s
    - Lần 3: chờ 4s
    - Tối đa 3 lần retry
  - Nếu vẫn lỗi: hiển thị thông báo thân thiện, cho phép người dùng thử lại hoặc nhập thủ công.
- **Rate Limit:** Giới hạn số request/ngày dựa trên quota Gemini của người dùng.
- **Fallback:** Cho phép nhập thủ công hoàn toàn nếu OCR thất bại.

---

## 6. Luồng dữ liệu chính (End-to-End)

### 6.1 Luồng nhập hóa đơn VAT

```
1. Người dùng chụp/upload ảnh hóa đơn
   ↓
2. Frontend gửi ảnh → Gemini OCR (gemini-1.5-flash)
   ↓
3. Nhận JSON kết quả → Hiển thị preview cho người dùng kiểm tra
   ↓
4. Người dùng xác nhận → Lưu vào Supabase:
   - suppliers (nếu MST chưa tồn tại)
   - invoices
   - products (chuẩn hóa tên)
   - price_history (từng dòng hàng)
   ↓
5. Cập nhật Price Book hiển thị trên Tra cứu giá
```

### 6.2 Luồng tra cứu & chỉnh sửa giá

```
1. User mở trang "Tra cứu giá sản phẩm"
   ↓
2. Hệ thống load Price Book từ price_history (giá mới nhất + trend)
   ↓
3. Mobile: hiển thị Card List View
   Desktop: hiển thị Bảng ngang
   ↓
4. User bấm "Sửa" → mở Modal → nhập giá mới
   ↓
5. Live Preview: hiển thị giá bán lẻ gợi ý mới (real-time)
   ↓
6. User bấm "Lưu thay đổi" → cập nhật localStorage + price_history
   ↓
7. Toast thông báo thành công → danh sách tự động refresh
```

---

## 7. Tiêu chuẩn phát triển

- **Frontend:** React + Tailwind CSS, Mobile-first, tối ưu cho điện thoại.
- **Backend:** Supabase (PostgreSQL), Edge Functions (Deno runtime).
- **AI/OCR:** Google Gemini API (Vision model - gemini-1.5-flash).
- **Triển khai:** Vercel / Netlify (Frontend), Supabase Cloud (Backend + DB).
- **Bảo mật:** Row Level Security (RLS) trên Supabase, chỉ cho phép user xem/sửa dữ liệu của chính mình.

---

## 8. TYPOGRAPHY & NAVIGATION DESIGN SYSTEM

### 8.1 Hệ thống Tiêu đề các Trang con (Sub-pages Header)

Mọi trang con (Danh sách phiếu, Thêm phiếu, Thêm doanh thu tháng, Khóa sổ) **bắt buộc** áp dụng cấu trúc Header sau:

| Thành phần | Quy chuẩn |
|------------|-----------|
| **Tiêu đề chính (Title)** | `text-xl font-bold text-gray-800` (1.25rem / 20px, font-weight 700) |
| **Nút Quay lại** | Icon `ChevronLeft` (size=18), text "Quay lại" (`text-sm text-gray-500 font-medium`) |

### 8.2 Cấu trúc Layout Header chuẩn

```jsx
<div className="bg-white border-b border-gray-100 px-4 py-3">
  <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium mb-2">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
    <span>Quay lại</span>
  </button>
  <h1 className="text-xl font-bold text-gray-800">TÊN TIÊU ĐỀ TRANG</h1>
  <p className="text-xs text-gray-400 mt-0.5">Mô tả ngắn</p>
</div>
```

### 8.3 CSS Sub-page Header (index.css)

```css
.sub-page-title h2 {
  font-size: 1.25rem;   /* = text-xl */
  font-weight: 700;    /* = font-bold */
  color: #1F2937;       /* = text-gray-800 */
  margin: 0 0 4px;
}
```

---

## 9. Lộ trình phát triển

| Giai đoạn | Nội dung | Trạng thái |
|-----------|----------|------------|
| 1 | Giao diện cơ bản + Sidebar + Responsive | ✅ Hoàn thành |
| 2 | Quản lý Sổ sách (S1a, Bảng kê mua vào) | ✅ Hoàn thành |
| 3 | OCR Gemini + Nhập hóa đơn | ✅ Hoàn thành |
| 4 | Database Schema + Migration | ✅ Hoàn thành |
| 5 | Đồng bộ Frontend với Schema 100% English | ✅ Hoàn thành |
| 6 | Báo cáo + Xuất báo cáo PDF/Excel | ⏳ Chưa bắt đầu |

---

> **Lưu ý:** Tài liệu này sẽ được cập nhật liên tục khi có thay đổi nghiệp vụ hoặc yêu cầu mới từ phía Hộ Kinh Doanh. Mọi thay đổi cần được thống nhất trước khi cập nhật Database Schema.
