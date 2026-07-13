# S1A_DAILY_REVENUE_SPEC.md

> **Mục đích**: Định nghĩa specification chi tiết cho workflow S1A Daily Revenue (Doanh thu hàng ngày).
> **Nguồn sự thật**: `PROJECT_OVERVIEW.md` — Section 1.5 Core Business Rules.
> **Phạm vi**: Chỉ mô tả specification. Không viết code, không đổi schema, không refactor file hiện có.
>
> **Cập nhật lần cuối**: Đã đối chiếu với schema thực tế từ migration `20240101_create_sales_tables.sql`. Mô tả cột phản ánh trạng thái database hiện tại. Đã sửa: `description` → `notes` (Section 5.1, 5.3, 6), loại bỏ `updated_at`/`created_by` (không tồn tại), sửa `group_key` default, bổ sung uniqueness enforcement (Section 6), cập nhật AddMonthlyRevenueForm status (Section 11.3).

---

## 1. Mục tiêu (Goal)

### 1.1. Business Entity

| Khía cạnh | Chi tiết |
|-----------|----------|
| Entity chính | **Daily Revenue** — Doanh thu hàng ngày |
| Technical name (DB) | `sales_tickets` (không đổi tên bảng) |
| Quy tắc bắt buộc | **1 ngày dương lịch = 1 dòng doanh thu duy nhất** |
| Mục tiêu UX | Giảm số field user phải nhập từ 4 xuống 2 (chỉ ngày + số tiền) |

### 1.2. Điều không được làm

- Không hỏi user chọn nhóm hàng (group_key) trong workflow S1A chuẩn
- Không bắt user gõ Diễn giải bằng tay
- Không cho phép nhiều dòng cùng một ngày
- Không đổi tên bảng `sales_tickets`
- Không xóa các cột hiện có trong database
- **Không được sinh ticket_number mới.** Ticket_number không được tạo tự động. Việc sinh ticket_number hoàn toàn bị cấm trong S1A.
- **Không cho phép user chỉnh sửa Diễn giải.** Diễn giải là read-only. Nếu user có thể sửa, mỗi người sẽ gõ một kiểu ("doanh thu hôm nay", "bán tạp hóa", "abc") → mất chuẩn hóa. Đây là business invariant.

### 1.3. Điều được giữ lại (Internal only)

| Trường | Mục đích | Ghi chú |
|--------|----------|---------|
| `group_key` | Legacy S2A | Ẩn hoàn toàn khỏi UI S1A |
| `ticket_number` | Legacy | Ẩn hoàn toàn khỏi UI S1A. Không được sinh mới. |
| `id` (UUID) | Technical PK | Giữ nguyên, dùng cho FK reference |

---

## 2. User Flow

### 2.1. Luồng chính — Ghi nhận doanh thu

```
Người dùng mở "Hồ sơ S1A" (/s1a)
        ↓
Chọn "Ghi nhận doanh thu"
        ↓
┌─────────────────────────────────────────────────────────┐
│ Form Ghi nhận Doanh thu                               │
│                                                         │
│ Ngày:      [Date picker — mặc định HÔM NAY]          │
│                                                         │
│ Doanh thu:  [___________] VND                          │
│                                                         │
│ ─── Diễn giải (tự động, không sửa được) ───         │
│ Doanh thu bán lẻ tạp hóa ngày 11/07/2026            │
│ theo bảng kê ngày 11/07/2026                          │
│                                                         │
│                          [Hủy]  [Lưu doanh thu]        │
└─────────────────────────────────────────────────────────┘
        ↓
Nhấn "Lưu doanh thu"
        ↓
┌─────────────────────────────────────────────────────────┐
│ Hệ thống kiểm tra:                                      │
│                                                         │
│ [1] Ngày này đã ghi nhận doanh thu chưa?            │
│     → Chưa: hệ thống tạo dòng mới                    │
│     → Rồi:  hệ thống cập nhật dòng đã có             │
│     (User không cần biết INSERT hay UPDATE)            │
│                                                         │
│ [2] Kỳ của ngày đó đã chốt sổ chưa?                  │
│     → Đã chốt: Cảnh báo "Kỳ đã khóa. Không thể lưu" │
│     → Chưa chốt: Lưu thành công                       │
│                                                         │
│ [3] Validation: date và revenue hợp lệ?                │
│                                                         │
│ Success → Toast: "Đã ghi nhận doanh thu ngày XX/XX/XXXX"│
│           Form reset → quay về danh sách                │
└─────────────────────────────────────────────────────────┘
```

### 2.2. Luồng chi tiết theo trạng thái

#### Trường hợp A — Ngày chưa ghi nhận doanh thu

```
User chọn ngày (hoặc giữ mặc định hôm nay)
        ↓
[READ-ONLY] Hệ thống truy vấn: ngày này có trong sales_tickets không?
        → Kết quả: chưa có
        → KHÔNG ghi gì vào database
        ↓
Form trống hoàn toàn
Date picker: editable
Revenue: empty
Diễn giải preview: auto-generated theo ngày đã chọn
        ↓
User nhập số tiền
        ↓
Nhấn "Lưu doanh thu" → INSERT dòng mới
```

> **Lưu ý**: Chọn ngày chỉ thực hiện truy vấn `SELECT` để xác định chế độ. **Không bao giờ** thực hiện `INSERT` hoặc `UPDATE` khi user thay đổi ngày. Việc ghi chỉ xảy ra khi user nhấn nút Lưu.

#### Trường hợp B — Ngày đã ghi nhận doanh thu

```
User chọn ngày đã có dữ liệu
        ↓
[READ-ONLY] Hệ thống truy vấn: ngày này có trong sales_tickets không?
        → Kết quả: đã có
        → KHÔNG ghi gì vào database
        ↓
Form hiển thị dữ liệu đã ghi nhận:
Date picker: editable (nếu kỳ chưa chốt)
Revenue: giá trị đã ghi
Diễn giải (cột `notes`): hiển thị giá trị đã lưu (read-only)
        ↓
User chỉnh sửa số tiền nếu cần
        ↓
Nhấn "Cập nhật doanh thu" → UPDATE dòng đã có
```

> **Nguyên tắc quan trọng**: Chọn ngày **không bao giờ** ghi dữ liệu vào database.
> Chỉ có 2 hành động ghi dữ liệu:
> - **INSERT**: Khi user nhấn "Lưu doanh thu" và ngày đó chưa có record.
> - **UPDATE**: Khi user nhấn "Cập nhật doanh thu" và ngày đó đã có record.

### 2.3. Luồng từ danh sách

```
Người dùng xem danh sách doanh thu (S1AList)
        ↓
Click vào dòng bất kỳ
        ↓
Mở form hiển thị dữ liệu đã ghi nhận
        ↓
→ Tiếp tục như Trường hợp B
```

---

## 3. UI Requirements

### 3.1. Form Ghi nhận doanh thu

#### Bắt buộc hiển thị

| Field | Type | Behavior |
|-------|------|----------|
| Ngày | Date picker | Mặc định = hôm nay. User có thể chọn ngày khác. Disabled nếu kỳ đã chốt. |
| Doanh thu | VND number input | Bắt buộc nhập. Chỉ chấp nhận số > 0. |
| Diễn giải | Read-only preview | Auto-generated. Cập nhật ngay khi date thay đổi. **User không được sửa.** |

#### Tùy chọn hiển thị

| Field | Type | Behavior |
|-------|------|----------|
| Ghi chú | Textarea | Tùy chọn. User nhập khi cần ghi chú đặc biệt. |

#### Bắt buộc ẨN khỏi UI S1A

| Field | Lý do |
|-------|-------|
| Nhóm hàng (group_key) | Không liên quan workflow. Chủ HKD không phân loại doanh thu theo nhóm. |
| Số phiếu (ticket_number) | Không cần thiết — date là unique key tự nhiên. Không được sinh mới. |
| Dropdown nhóm hàng | Không hiển thị, không có trong form |

#### Buttons

| Button | Action |
|--------|--------|
| Hủy | Đóng form, không lưu, quay về danh sách |
| Lưu doanh thu | Validate → hệ thống tự quyết định tạo mới hay cập nhật → Success toast → Reset form |

### 3.2. Màn hình danh sách (S1AList)

| Column | Mô tả |
|--------|--------|
| Ngày | `sale_date` — format DD/MM/YYYY |
| Diễn giải | `notes` — auto-generated, read-only (**business label: Diễn giải; kỹ thuật: cột `notes`**) |
| Số tiền | `total_amount` — format VND |
| Thao tác | Mở dòng (hiển thị dữ liệu) + Xóa (với confirm) |

### 3.3. Mobile UI

- Form stack dọc (không phải 2 cột)
- Date picker: full-width
- VND input: full-width, font lớn
- Nút Lưu: full-width, dễ tap
- Danh sách: card view thay vì bảng

---

## 4. Auto Description Rule

### 4.1. Template

```
Doanh thu bán lẻ tạp hóa ngày DD/MM/YYYY theo bảng kê ngày DD/MM/YYYY
```

### 4.2. Ví dụ

| Date input | Description output |
|------------|-------------------|
| 09/07/2026 | Doanh thu bán lẻ tạp hóa ngày 09/07/2026 theo bảng kê ngày 09/07/2026 |
| 01/01/2026 | Doanh thu bán lẻ tạp hóa ngày 01/01/2026 theo bảng kê ngày 01/01/2026 |
| 31/12/2025 | Doanh thu bán lẻ tạp hóa ngày 31/12/2025 theo bảng kê ngày 31/12/2025 |

### 4.3. Generation Rules

| Trigger | Hành vi |
|---------|---------|
| Date thay đổi trong form | Description preview cập nhật ngay lập tức |
| User sửa revenue | Description **không thay đổi** (chỉ phụ thuộc date) |
| Save thành công | Lưu description vào cột `notes` cùng record |
| Mở form cho ngày đã ghi | Description hiển thị giá trị đã lưu trong `notes` (read-only, không cho sửa) |
| User đổi date trong edit mode | Description preview cập nhật theo date mới |

### 4.4. Ngày/tháng Format

- Sử dụng format Việt Nam: `DD/MM/YYYY`
- Không dùng format Mỹ (`MM/DD/YYYY`)
- Không có chữ (không viết "tháng 7", không viết "July")

### 4.5. Read-Only Invariant

> **Diễn giải là read-only. Không bao giờ được cho phép user sửa.**

Nếu user có thể sửa Diễn giải:
- User A ghi: "doanh thu hôm nay"
- User B ghi: "bán tạp hóa ngày 10/7"
- User C ghi: "abc"

→ Mất chuẩn hóa hoàn toàn. Đây là business invariant.

---

## 5. Data Rules

### 5.1. Database (Không thay đổi)

Bảng `sales_tickets` giữ nguyên schema hiện tại:

| Column | Type | Constraint | Ghi chú |
|--------|------|------------|---------|
| `id` | UUID | PK | Technical primary key |
| `ticket_number` | TEXT | Nullable | **Ẩn khỏi UI. Không được sinh mới.** |
| `sale_date` | DATE | NOT NULL | Ngày doanh thu |
| `total_amount` | NUMERIC | NOT NULL | Tổng doanh thu |
| `group_key` | TEXT | Nullable, Default `'Hàng hóa tổng hợp'` | **Ẩn khỏi UI** — legacy S2A |
| `notes` | TEXT | Nullable | Diễn giải kế toán tự động. **Business label: Diễn giải. Technical column: `notes`.** Read-only. |
| `created_at` | TIMESTAMPTZ | NOT NULL | Thời điểm tạo record |

> **Ghi chú schema**: Bảng hiện tại **không có** cột `description`, `updated_at`, hoặc `created_by`. Sprint 1 ghi Diễn giải vào cột **`notes`**. Không thêm migration cho các cột không tồn tại.

### 5.2. Application-level Rules

| Rule | Implementation | Lý do |
|------|--------------|-------|
| 1 ngày = 1 dòng | Kiểm tra tồn tại trước khi ghi | Business invariant |
| group_key không hiển thị | Không render field, không gửi lên server | Không thuộc workflow S1A |
| ticket_number không hiển thị | Không render field | Không cần thiết. Không được sinh mới. |
| ticket_number không được sinh | Không tạo logic auto-gen ticket_number | Business rule cấm hoàn toàn |
| Diễn giải (`notes`) auto | Tạo từ template khi save, lưu vào cột `notes` | Không user-generated |
| Diễn giải (`notes`) read-only | Input field disabled hoặc hiển thị plain text | Business invariant — không cho phép user sửa |
| Kỳ chốt không sửa | Check `closed_periods` trước mọi ghi | Yêu cầu thuế |

### 5.3. Điền default cho legacy fields

Khi tạo record mới (INSERT):

| Trường | Giá trị mặc định |
|--------|------------------|
| `group_key` | Để `NULL` — database tự áp dụng default `'Hàng hóa tổng hợp'` |
| `ticket_number` | `NULL` — không được tạo giá trị mới |
| `notes` | Auto-generated từ template và gửi lên server cùng INSERT/UPDATE |

> **Về `group_key`**: Không cần gửi giá trị khi INSERT. Để PostgreSQL tự áp dụng default `'Hàng hóa tổng hợp'`. Đây là trường legacy S2A — ẩn hoàn toàn khỏi UI S1A.

---

## 6. Daily Revenue Uniqueness Rule

> **Đổi tên từ "Duplicate Date Rule" vì đây không phải duplicate. Đây là business invariant.**

### 6.1. Nguyên tắc cốt lõi

> **Một ngày chỉ có thể có tối đa một dòng doanh thu.**

Đây là business invariant — không phải lỗi, không phải cảnh báo. Đây là cách hệ thống được thiết kế.

### 6.2. Enforcement trong Sprint 1

> ⚠️ **Trạng thái database hiện tại**: Bảng `sales_tickets` **không có** ràng buộc `UNIQUE(sale_date)`.

Sprint 1 thực thi business rule ở **application level**:

| Cơ chế | Mô tả |
|--------|-------|
| Kiểm tra trước INSERT | Query `SELECT` theo `sale_date` trước khi ghi. Nếu đã tồn tại → chuyển sang UPDATE thay vì INSERT. |
| Kiểm tra trước UPDATE (đổi ngày) | Nếu user đổi `sale_date`, kiểm tra ngày mới đã có record chưa. Cảnh báo nếu trùng. |

> **Concurrency risk**: Khi 2 user đồng thời ghi nhận cùng ngày (race condition), cả hai đều không tìm thấy record → cả hai INSERT → **tạo 2 dòng cùng ngày** ở database level. Sprint 1 không giải quyết race condition. Ràng buộc `UNIQUE(sale_date)` ở database level sẽ được xem xét sau khi kiểm toán dữ liệu production.

### 6.3. Kịch bản xử lý

| Kịch bản | Hành vi |
|-----------|---------|
| User chọn ngày chưa ghi nhận | Hệ thống tạo dòng mới cho ngày đó |
| User chọn ngày đã ghi nhận | Hệ thống cập nhật dòng đã có |
| User cố tình tạo 2 dòng cùng ngày (UI) | Không thể — hệ thống tự nhận biết và cập nhật thay vì tạo mới |
| Race condition (2 client cùng INSERT 1 ngày) | Cả hai INSERT thành công — tạo 2 dòng cùng ngày. Giải pháp: thêm `UNIQUE(sale_date)` sau khi kiểm toán dữ liệu production. |

### 6.4. UX khi ngày đã ghi nhận doanh thu

```
User chọn ngày 15/07/2026 (đã có dữ liệu)
        ↓
Hệ thống: "Ngày 15/07/2026 đã ghi nhận doanh thu."
        ↓
Form hiển thị dữ liệu đã ghi nhận
        ↓
Nút: "Cập nhật doanh thu"
        ↓
User chỉnh sửa → Save → hệ thống cập nhật dòng đã có
```

### 6.5. Đổi ngày trong chế độ chỉnh sửa

| Thay đổi | Hành vi |
|-----------|---------|
| Chỉ đổi revenue, giữ nguyên ngày | Cập nhật revenue → Diễn giải giữ nguyên |
| Đổi ngày sang ngày mới (chưa ghi nhận) | Cập nhật ngày + regenerate Diễn giải |
| Đổi ngày sang ngày đã ghi nhận (khác dòng hiện tại) | Cảnh báo: "Ngày này đã ghi nhận doanh thu. Bạn muốn mở dòng đó?" |

---

## 7. Closed Period Rule

### 7.1. Nguyên tắc

> **Kỳ kế toán đã chốt sổ (closed_periods) không được thêm, sửa, hoặc xóa bất kỳ dữ liệu nào trong tháng đó.**

### 7.2. Xác định kỳ

- Kỳ = tháng của `sale_date`, format `YYYY-MM`
- Ví dụ: `sale_date = 2026-07-15` → kỳ = `2026-07`

### 7.3. Check trước mọi thao tác ghi

```
Trước khi ghi (tạo mới hoặc cập nhật):
        ↓
Lấy kỳ từ sale_date: YYYY-MM
        ↓
Query closed_periods WHERE period_month = 'YYYY-MM'
        ↓
Có kết quả?
        ↓
[Có] → Block thao tác, hiển thị cảnh báo
[Không] → Tiếp tục thực hiện
```

### 7.4. UX khi kỳ đã chốt

| Thao tác | Hành vi |
|-----------|---------|
| Mở form ghi nhận | Date picker disabled nếu là tháng đã chốt |
| Chọn ngày đã chốt | Toast cảnh báo: "Kỳ tháng XX/YYYY đã chốt sổ. Không thể lưu." |
| Submit form | Block ở server, return lỗi |
| Mở form cho ngày đã chốt | Read-only mode — user chỉ xem, không sửa |

### 7.5. Đổi ngày trong chế độ chỉnh sửa

| Tình huống | Hành vi |
|------------|---------|
| Ngày nguồn (record đang xem) đã chốt | Không cho sửa ngày — disabled |
| Ngày đích (ngày mới muốn đổi sang) đã chốt | Cảnh báo: "Kỳ đích đã chốt. Không thể di chuyển dữ liệu." |

---

## 8. Validation Rules

### 8.1. Bắt buộc (Required)

| Field | Rule | Error message |
|-------|------|---------------|
| `sale_date` | Không được trống | "Vui lòng chọn ngày." |
| `total_amount` | Không được trống | "Vui lòng nhập số tiền doanh thu." |

### 8.2. Số hợp lệ (Numeric)

| Field | Rule | Error message |
|-------|------|---------------|
| `total_amount` | Phải > 0 | "Số tiền phải lớn hơn 0." |
| `total_amount` | Phải là số | "Số tiền không hợp lệ." |
| `total_amount` | Không quá 15 chữ số | "Số tiền quá lớn." |

### 8.3. Kỳ kế toán

| Rule | Error message |
|------|---------------|
| Kỳ của sale_date đã chốt sổ | "Kỳ tháng XX/YYYY đã chốt sổ. Không thể lưu." |
| Ngày mới đổi sang kỳ đã chốt | "Kỳ đích đã chốt. Không thể di chuyển dữ liệu." |

### 8.4. Thứ tự validate

```
[1] Ngày không trống
        ↓
[2] Số tiền không trống
        ↓
[3] Số tiền > 0
        ↓
[4] Kỳ của ngày chưa chốt
        ↓
[5] Ngày không thuộc tương lai (tùy chọn — khuyến nghị)
        ↓
[6] Lưu
```

---

## 9. Edge Cases

### 9.1. Ngày đã ghi nhận doanh thu

| Tình huống | Hành vi |
|------------|---------|
| User mở form, ngày mặc định = hôm nay, hôm nay đã ghi nhận | Form hiển thị dữ liệu đã ghi, chế độ cập nhật tự động |
| User chọn ngày đã có trong danh sách | Form hiển thị dữ liệu đã ghi, chế độ cập nhật tự động |
| User chọn ngày tương lai | Cho phép — doanh thu tương lai vẫn hợp lệ |

### 9.2. Đổi ngày trong chế độ xem/sửa

| Tình huống | Hành vi |
|------------|---------|
| Đang xem ngày A, đổi sang ngày B chưa ghi nhận | Cập nhật ngày + regenerate Diễn giải |
| Đang xem ngày A, đổi sang ngày B đã ghi nhận (khác dòng hiện tại) | Cảnh báo: "Ngày này đã ghi nhận. Bạn muốn mở dòng đó?" |
| Ngày nguồn đã chốt sổ | Ngày picker disabled |
| Chỉ đổi số tiền, không đổi ngày | Cập nhật số tiền, Diễn giải giữ nguyên |

### 9.3. Đổi ngày sang tháng đã chốt

| Tình huống | Hành vi |
|------------|---------|
| Đổi ngày sang tháng đã chốt | Block: "Kỳ đích đã chốt. Không thể di chuyển dữ liệu." |
| Đổi ngày từ tháng chưa chốt sang tháng chưa chốt khác | Cập nhật bình thường |

### 9.4. Đổi ngày sang ngày đã ghi nhận khác

| Tình huống | Hành vi |
|------------|---------|
| Đổi ngày sang ngày đã có bản ghi khác | Cảnh báo rõ ràng: "Ngày XX/XX/XXXX đã ghi nhận doanh thu. Bạn muốn mở dòng đó?" |

### 9.5. Record cũ có ticket_number hoặc group_key

| Tình huống | Hành vi |
|------------|---------|
| Record cũ có `group_key` | Hiển thị bình thường trong danh sách, không cho sửa |
| Record cũ có `ticket_number` | Không hiển thị trong UI S1A |
| Record cũ không có `notes` | Regenerate từ template khi user mở xem |

### 9.6. Midnight / timezone

| Tình huống | Hành vi |
|------------|---------|
| User ở múi giờ khác | Sử dụng local date (không UTC) — `sale_date` lưu dạng DATE, không phải TIMESTAMPTZ |

### 9.7. Xóa record

| Tình huống | Hành vi |
|------------|---------|
| Xóa record | Confirm dialog: "Xóa doanh thu ngày XX/XX/XXXX? Hành động này không thể hoàn tác." |
| Kỳ đã chốt | Không cho xóa — button xóa disabled |

---

## 10. Affected Files

### 10.1. Likely Affected (Priority High)

| File | Lý do | Thay đổi dự kiến |
|------|-------|------------------|
| `src/components/s1a/AddTicketForm.jsx` | Form ghi nhận doanh thu chính | Loại bỏ group_key dropdown, bỏ ticket_number, bỏ manual description input, thêm auto description (read-only), logic ghi nhận tạo mới hay cập nhật tự động |
| `src/components/s1a/S1AList.jsx` | Danh sách doanh thu | Thêm cột Diễn giải (read-only, cột `notes`), loại bỏ cột nhóm hàng (nếu có) |
| `src/pages/HoSoS1A.jsx` | Hub S1A | Cập nhật UI labels: "Thêm phiếu" → "Ghi nhận doanh thu" |

### 10.2. Likely Affected (Priority Medium)

| File | Lý do | Thay đổi dự kiến |
|------|-------|------------------|
| `src/components/s1a/AddMonthlyRevenueForm.jsx` | Nhập doanh thu theo tháng | ⚠️ Xem Section 11.3 — **đã xác định xung đột, deferred** |
| `src/components/s1a/SoS1aHKD.jsx` | Mẫu in S1A | Thêm cột Diễn giải (`notes`) vào mẫu in |
| `src/pages/BaoCao.jsx` | Báo cáo | Kiểm tra tab "Doanh thu theo nhóm" — có thể cần ẩn hoặc hiển thị thông báo trống |

### 10.3. Possibly Affected (Priority Low)

| File | Lý do | Thay đổi dự kiến |
|------|-------|------------------|
| `src/utils/dateHelper.js` | Helper ngày tháng | Thêm function tạo Diễn giải từ template |
| `src/data/constants.js` | Constants | Không cần thay đổi |

### 10.4. Không cần thay đổi

| File | Lý do |
|------|-------|
| `src/components/s1a/CloseBookForm.jsx` | Logic chốt sổ không đổi |
| `src/components/RoleGuard.jsx` | RBAC không đổi |
| `src/lib/supabase.js` | Supabase client không đổi |
| `supabase/migrations/` | Database — không thay đổi schema |

---

## 11. Implementation Notes

### 11.1. Nguyên tắc thực hiện

1. **Giữ thay đổi tối thiểu** — Chỉ sửa những gì cần thiết
2. **Không đổi tên file** — Trừ khi bắt buộc phải đổi
3. **Không đổi tên bảng/cột database** — Giữ nguyên schema
4. **Ưu tiên thay đổi UI labels và logic trước** — Ít rủi ro nhất
5. **Giữ nguyên các report đang hoạt động** — Trừ khi xung đột trực tiếp với S1A rules
6. **Diễn giải là read-only invariant** — Không bao giờ cho user sửa
7. **Không sinh ticket_number mới** — Cấm hoàn toàn trong S1A

### 11.2. Thứ tự ưu tiên implementation

| Bước | Task | Priority |
|------|------|----------|
| 1 | Thêm auto description template + generation logic | P0 — Core feature |
| 2 | Sửa `AddTicketForm.jsx`: bỏ group_key, bỏ ticket_number, bỏ manual description, thêm auto description (read-only) | P0 — Core feature |
| 3 | Sửa logic ghi: kiểm tra ngày tồn tại → hiển thị dữ liệu hoặc form trống. Hệ thống tự quyết định tạo mới hay cập nhật | P0 — Core feature |
| 4 | Cập nhật `S1AList.jsx`: thêm cột Diễn giải (`notes`, read-only) | P1 |
| 5 | Cập nhật `HoSoS1A.jsx`: UI labels | P1 |
| 6 | Cập nhật `SoS1aHKD.jsx`: thêm cột Diễn giải | P2 |
| 7 | Kiểm tra `BaoCao.jsx`: tab doanh thu theo nhóm | P2 |

### 11.3. AddMonthlyRevenueForm — Deferred (Không thuộc Sprint 1)

> ⚠️ **Đã xác định xung đột nghiệp vụ. Form này bị ẩn khỏi UI và không được thay đổi trong Sprint 1.**

**Xung đột đã xác nhận:**

`AddMonthlyRevenueForm.jsx` tạo record với `sale_date = YYYY-MM-01` (ngày đầu tháng). Mỗi lần user nhấn "Thêm doanh thu tháng" → tạo **1 dòng mới** bất kể ngày đó đã có record hay chưa. Điều này trực tiếp vi phạm business rule **"1 ngày = 1 dòng"** (cùng ngày đầu tháng có thể tạo nhiều dòng).

Ngoài ra, form này:
- Gửi `group_key` (hiển thị dropdown nhóm hàng) — vi phạm nguyên tắc S1A
- Sinh `ticket_number` tự động — vi phạm nguyên tắc S1A
- Ghi `notes = 'Nhập nhanh doanh thu từ form tổng hợp'` — không đúng template

**Trạ thái hiện tại:**
- Form đã bị **ẩn khỏi navigation** trong `HoSoS1A.jsx` (NAV_CARDS filtered out `batchAdd`)
- Route vẫn tồn tại (`view === 'batchAdd'`) nhưng không ai truy cập được qua UI
- Không nên kích hoạt lại hoặc sửa trong Sprint 1

**Khuyến nghị:**
- **Deferred** — không xử lý trong Sprint 1
- Có thể thiết kế lại hoàn toàn sau khi Sprint 1 hoàn thành, hoặc xóa hẳn
- Không khuyến khích sửa patch để "làm cho tương thích" — đó là thiết kế S2A cũ

### 11.4. Điều không được làm trong implementation

- Không xóa bảng `sales_tickets`
- Không xóa cột `group_key`, `ticket_number` trong database
- Không thêm migration thay đổi schema
- Không đổi tên file component (giữ nguyên `AddTicketForm.jsx`)
- Không thêm logic tạo ticket_number mới
- Không cho phép user sửa Diễn giải
- Không thêm complexity không có trong spec này

---

## 12. Test Cases

### 12.1. Ghi nhận — Ngày chưa ghi nhận

| TC | Mô tả | Steps | Expected Result |
|----|--------|-------|-----------------|
| TC-01 | Ghi nhận ngày hôm nay (chưa có) | 1. Mở Ghi nhận doanh thu<br>2. Date mặc định = hôm nay<br>3. Nhập 1,500,000<br>4. Nhấn Lưu | Hệ thống tạo dòng mới. Toast "Đã ghi nhận doanh thu ngày XX/XX/XXXX". Diễn giải đúng template. |
| TC-02 | Ghi nhận ngày quá khứ (chưa có) | 1. Mở Ghi nhận doanh thu<br>2. Chọn ngày 01/07/2026<br>3. Nhập 2,000,000<br>4. Nhấn Lưu | Hệ thống tạo dòng mới cho ngày 01/07. Diễn giải tự tạo theo template. |
| TC-03 | Validation: không nhập ngày | 1. Mở Ghi nhận doanh thu<br>2. Xóa date<br>3. Nhập tiền<br>4. Nhấn Lưu | Error: "Vui lòng chọn ngày." |
| TC-04 | Validation: không nhập tiền | 1. Mở Ghi nhận doanh thu<br>2. Nhập date<br>3. Bỏ trống revenue<br>4. Nhấn Lưu | Error: "Vui lòng nhập số tiền doanh thu." |
| TC-05 | Validation: tiền = 0 | 1. Mở Ghi nhận doanh thu<br>2. Nhập date, revenue = 0<br>3. Nhấn Lưu | Error: "Số tiền phải lớn hơn 0." |
| TC-06 | Validation: tiền âm | 1. Mở Ghi nhận doanh thu<br>2. Nhập date, revenue = -500,000<br>3. Nhấn Lưu | Error: "Số tiền phải lớn hơn 0." |

### 12.2. Ghi nhận — Ngày đã ghi nhận

| TC | Mô tả | Steps | Expected Result |
|----|--------|-------|-----------------|
| TC-10 | Mở form cho ngày đã ghi nhận (từ hub) | 1. Hôm nay đã ghi nhận<br>2. Mở Ghi nhận doanh thu<br>3. Date mặc định = hôm nay | Form hiển thị dữ liệu đã ghi. Label: "Cập nhật doanh thu". |
| TC-11 | Cập nhật số tiền cho ngày đã ghi | 1. Mở form cho ngày 10/07 (đã ghi 1,000,000)<br>2. Sửa thành 1,500,000<br>3. Nhấn Cập nhật | Hệ thống cập nhật. Toast "Đã cập nhật doanh thu ngày 10/07/2026". Diễn giải giữ nguyên. |
| TC-12 | Không thể tạo 2 dòng cùng ngày (UI) | 1. Ngày 12/07 đã có record<br>2. Cố gắng tạo dòng mới cho ngày đó | Hệ thống tự nhận biết → chuyển sang UPDATE thay vì INSERT. Không tạo dòng mới. |

### 12.3. Diễn giải tự động

| TC | Mô tả | Steps | Expected Result |
|----|--------|-------|-----------------|
| TC-20 | Diễn giải tạo khi chọn ngày | 1. Mở form, chọn ngày 15/07/2026<br>2. Nhập tiền<br>3. Nhìn Diễn giải preview | Preview: "Doanh thu bán lẻ tạp hóa ngày 15/07/2026 theo bảng kê ngày 15/07/2026" |
| TC-21 | Diễn giải cập nhật khi đổi ngày | 1. Mở form xem ngày 01/07<br>2. Đổi ngày → 10/07<br>3. Nhìn Diễn giải preview | Preview cập nhật thành "...ngày 10/07/2026..." |
| TC-22 | Revenue không ảnh hưởng Diễn giải | 1. Mở form<br>2. Đổi revenue: 1M → 2M → 3M<br>3. Diễn giải preview giữ nguyên | Diễn giải chỉ phụ thuộc ngày, không thay đổi khi revenue thay đổi |
| TC-23 | Diễn giải là read-only | 1. Mở form<br>2. Tìm input Diễn giải<br>3. Thử sửa | Không có input để sửa — Diễn giải hiển thị dạng plain text, disabled, hoặc read-only |

### 12.4. Kỳ chốt sổ

| TC | Mô tả | Steps | Expected Result |
|----|--------|-------|-----------------|
| TC-30 | Ghi nhận vào tháng đã chốt | 1. Tháng 06/2026 đã chốt sổ<br>2. Mở form, chọn ngày 15/06/2026<br>3. Nhập tiền<br>4. Nhấn Lưu | Block: "Kỳ tháng 06/2026 đã chốt sổ. Không thể lưu." |
| TC-31 | Xem record trong tháng đã chốt | 1. Tháng 06/2026 đã chốt sổ<br>2. Click vào dòng ngày 15/06<br>3. Form mở | Read-only mode — các field disabled, nút Lưu không hoạt động |
| TC-32 | Xóa record trong tháng đã chốt | 1. Tháng 06/2026 đã chốt sổ<br>2. Trong danh sách, tìm dòng tháng 06<br>3. Click nút xóa | Button disabled hoặc confirm dialog hiển thị lỗi |

### 12.5. Đổi ngày

| TC | Mô tả | Steps | Expected Result |
|----|--------|-------|-----------------|
| TC-40 | Đổi ngày sang ngày mới (chưa ghi nhận) | 1. Mở form xem ngày 01/07<br>2. Đổi ngày → 05/07 (05/07 chưa có)<br>3. Nhấn Lưu | Cập nhật ngày. Diễn giải regenerate thành "...ngày 05/07/2026..." |
| TC-41 | Đổi ngày sang ngày đã ghi nhận khác | 1. Mở form xem ngày 01/07<br>2. Đổi ngày → 05/07 (05/07 đã ghi nhận)<br>3. Nhấn Lưu | Cảnh báo: "Ngày 05/07/2026 đã ghi nhận doanh thu. Bạn muốn mở dòng đó?" |
| TC-42 | Đổi ngày sang tháng đã chốt | 1. Mở form xem ngày 01/07<br>2. Đổi ngày → tháng đã chốt sổ<br>3. Nhấn Lưu | Block: "Kỳ đích đã chốt. Không thể di chuyển dữ liệu." |

### 12.6. Mobile UI

| TC | Mô tả | Steps | Expected Result |
|----|--------|-------|-----------------|
| TC-50 | Form trên mobile | 1. Mở app trên điện thoại<br>2. Mở Ghi nhận doanh thu<br>3. Nhìn layout | Form hiển thị stack dọc, input full-width, nút Lưu full-width, dễ tap |
| TC-51 | Danh sách trên mobile | 1. Mở app trên điện thoại<br>2. Mở danh sách S1A | Card view thay vì bảng, mỗi card = 1 ngày |
| TC-52 | Date picker trên mobile | 1. Tap vào date picker<br>2. Date picker mở | Native date picker hoặc calendar modal phù hợp touch |

### 12.7. Reports

| TC | Mô tả | Steps | Expected Result |
|----|--------|-------|-----------------|
| TC-60 | Xem mẫu in S1A | 1. Mở Sổ S1A-HKD<br>2. Chọn kỳ tháng<br>3. Nhấn In | Mẫu in hiển thị đầy đủ ngày, số tiền, Diễn giải (`notes`) |
| TC-61 | Báo cáo doanh thu theo ngày | 1. Mở Báo cáo → tab Doanh thu theo ngày<br>2. Chọn kỳ | Danh sách ngày → số tiền. Không có cột nhóm hàng. |
| TC-62 | Báo cáo doanh thu theo nhóm | 1. Mở Báo cáo → tab Doanh thu theo nhóm | ⚠️ Tab có thể trống hoặc hiển thị thông báo "Không có dữ liệu" — đúng theo business model mới |

---

## 13. Glossary

| Thuật ngữ | Định nghĩa |
|-----------|------------|
| **Daily Revenue** | Entity nghiệp vụ: một dòng doanh thu cho một ngày |
| **sales_tickets** | Tên bảng database (technical implementation) |
| **group_key** | Legacy field từ S2A — phân loại hàng hóa — ẩn khỏi S1A UI. Default DB: `'Hàng hóa tổng hợp'` |
| **ticket_number** | Legacy field — số phiếu — ẩn khỏi S1A UI, không được sinh mới |
| **Diễn giải** | Mô tả kế toán tự động theo mẫu cố định. **Business label: Diễn giải. Technical column: `notes`. Read-only. Không bao giờ được sửa.** |
| **notes** | Tên cột database lưu Diễn giải. Nullable. Auto-generated. Read-only. |
| **Closed Period** | Kỳ kế toán đã chốt sổ — không cho phép thay đổi dữ liệu |
| **Kỳ** | Tháng kế toán, format `YYYY-MM` |
| **Business Invariant** | Quy tắc nghiệp vụ bất biến — không được vi phạm dưới bất kỳ điều kiện nào |

---

## 14. References

- `PROJECT_OVERVIEW.md` — Section 1.5: Core Business Rules
- `PROJECT_OVERVIEW.md` — Section 2.1: Quản lý Sổ S1A
- `PROJECT_OVERVIEW.md` — Section 7: Tổng quan Database
- `PROJECT_OVERVIEW.md` — Section 8: Các quy tắc nghiệp vụ quan trọng
- `AGENT_CONTROL.md` — Quy tắc phát triển và Output Report format
- `supabase/migrations/20240101_create_sales_tables.sql` — Schema thực tế (nguồn sự thật cho Section 5.1)
