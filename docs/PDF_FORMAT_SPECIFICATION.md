# PDF Format Specification — S2A-HKD Legacy Revenue Book

> **Mục đích**: Tài liệu này định nghĩa cấu trúc chính xác của file PDF S2A-HKD — báo cáo doanh thu bán hàng hóa, dịch vụ của Hộ Kinh Doanh.  
> **Đối tượng đọc**: Lập trình viên viết parser, reviewer, QA.  
> **Quy tắc**: Parser implementation PHẢI tuân thủ nghiêm ngặt theo tài liệu này. Tài liệu này KHÔNG tuân theo bất kỳ implementation nào.  
> **Nguồn mẫu**: `BCT_Thang1.pdf` — Sổ báo cáo tháng 01/2026, Hộ Kinh Doanh Tạp hoá Hải Kiều.  
> **Cập nhật lần cuối**: Dựa trên phân tích mẫu PDF tháng 01/2026.

---

## 1. Purpose

Tài liệu này tồn tại để đảm bảo bất kỳ parser nào được viết để đọc sổ S2A cũ đều xử lý **cùng một định dạng PDF** theo cùng một quy tắc.

Nó trả lời các câu hỏi:

- Cột nào trong bảng chứa ngày?
- Cột nào chứa số tiền?
- Làm sao phân biệt dòng doanh thu với dòng tổng cộng?
- Làm sao kiểm tra kết quả đúng?

Tài liệu này là **nguồn sự thật duy nhất** về cấu trúc PDF. Mọi thay đổi định dạng phải được cập nhật ở đây trước khi sửa parser.

---

## 2. Supported PDF Version

| Thuộc tính | Giá trị |
|-----------|---------|
| Tên báo cáo | SỔ DOANH THU BÁN HÀNG HOÁ, DỊCH VỤ |
| Mẫu biểu | S2a-HKD |
| Quy định | Thông tư 152/2025/TT-BTC của Bộ Tài chính Việt Nam |
| Nguồn xuất | Cơ quan thuế (Bộ Tài chính) hoặc phần mềm kế toán kết xuất theo mẫu |
| Cấu trúc | Dạng text-based (không phải scanned/image) |
| Số trang | 1 trang / tháng (có thể nhiều trang nếu số dòng vượt giới hạn một trang) |
| Bảng mã | UTF-8 hoặc UTF-16 (Vietnamese characters có dấu được hỗ trợ) |
| Bố cục | Fixed-width / monospaced alignment (giống máy đánh chữ) |

**Không hỗ trợ:**

- Bản scan (image-only PDF, không có text layer)
- PDF mật khẩu (password-protected)
- Mẫu biểu khác S2a-HKD
- Phiên bản mẫu biểu cũ hơn hoặc khác Thông tư 152/2025/TT-BTC

---

## 3. Overall Document Structure

Mỗi trang của PDF có cấu trúc phân tầng sau (từ trên xuống dưới):

```
┌─────────────────────────────────────────────────┐
│ Cơ quan thuế / Tiêu đề trang (nếu có)           │
│ Tên đơn vị: TẠP HÓA HẢI KIỀU                    │
│ Địa chỉ: Thôn 10, Quảng Tín, Lâm Đồng           │
│ Mã số thuế: 051179002157                        │
│                                                  │
│ Kỳ báo cáo: Tháng 01 năm 2026                   │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │  BẢNG KÊ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ  │ │
│ │  STT │ Ngày │ Số CT │ ... │ Diễn giải │ Thuế │ Doanh thu │
│ │  ────┼──────┼───────┼────┼───────────┼──────┼──────────│ │
│ │   1  │01/01 │01/BL  │ ... │ Bán lẻ ...│ 1%   │ 529.000  │ │
│ │  ... │  ... │  ...  │ ... │    ...    │ ...  │    ...   │ │
│ │  ────┼──────┼───────┼────┼───────────┼──────┼──────────│ │
│ │  Tổng │      │       │     │           │      │  (sub)   │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ (các nhóm hàng tiếp theo, mỗi nhóm có bảng con) │
│                                                  │
│ ─── Tổng cộng các nhóm ───                       │
│ Thuế GTGT: ...                                   │
│ Thuế TNCN: ...                                   │
│ Tổng số thuế GTGT phải nộp: ...                  │
│ Tổng số thuế TNCN phải nộp: ...                  │
│                                                  │
│ Người đại diện / Ký tên                          │
│ (chữ ký)                                         │
└─────────────────────────────────────────────────┘
```

**Các thành phần chính:**

1. **Report header** — tên HKD, địa chỉ, MST
2. **Period header** — Tháng XX / YYYY
3. **Revenue table(s)** — một hoặc nhiều bảng con (mỗi nhóm hàng một bảng)
4. **Group subtotals** — Tổng cộng (1), (2), (3), (4)
5. **Tax summary** — Thuế GTGT, Thuế TNCN
6. **Signature block** — Người đại diện ký tên
7. **Footer / regulation** — Thông tư, cơ quan thuế

---

## 4. Header Specification

### 4.1 Business Name (Tên đơn vị)

**Xuất hiện:** Dòng đầu tiên của header.

**Dạng:**

```
Tên đơn vị: TẠP HÓA HẢI KIỀU
```

hoặc

```
Đơn vị: TẠP HÓA HẢI KIỀU
```

**Cách nhận diện:** Dòng chứa từ khóa `Tên đơn vị` hoặc `Đơn vị`, theo sau là tên cửa hàng.

**Giá trị mẫu:** `TẠP HÓA HẢI KIỀU`

**Trong parser:** Lưu vào metadata. Không dùng làm khóa phân biệt — chỉ hiển thị.

---

### 4.2 Address (Địa chỉ)

**Xuất hiện:** Dòng ngay sau tên đơn vị.

**Dạng:**

```
Địa chỉ: Thôn 10, Xã Quảng Tín, Tỉnh Lâm Đồng
```

**Cách nhận diện:** Dòng chứa từ khóa `Địa chỉ:`.

**Giá trị mẫu:** `Thôn 10, Xã Quảng Tín, Tỉnh Lâm Đồng`

---

### 4.3 Tax Code (Mã số thuế)

**Xuất hiện:** Dòng sau địa chỉ.

**Dạng:**

```
Mã số thuế: 051179002157
```

**Cách nhận diện:** Dòng chứa từ khóa `Mã số thuế:`, theo sau là chuỗi 10–13 chữ số.

**Giá trị mẫu:** `051179002157`

**Định dạng:** Chỉ chữ số, 10 đến 13 ký tự.

---

### 4.4 Period (Kỳ báo cáo)

**Xuất hiện:** Sau thông tin đơn vị, trước bảng.

**Dạng:**

```
Tháng 01 năm 2026
```

hoặc

```
Tháng 1 năm 2026
```

**Cách nhận diện:** Dòng chứa `Tháng` theo sau là số (1 hoặc 01), theo sau là `năm` và năm dương lịch (4 chữ số).

**Giá trị mẫu:** Tháng `01`, Năm `2026`

**Định dạng tháng:** `DD` hoặc `D` (1 hoặc 2 chữ số, không có số 0 đi đầu bắt buộc).  
**Định dạng năm:** `YYYY` (4 chữ số).

**Trong parser:** Dùng để kiểm tra tính nhất quán của các ngày trong bảng (tất cả ngày phải thuộc tháng/năm này).

---

### 4.5 Regulation Reference

**Xuất hiện:** Trong header hoặc footer.

**Dạng:**

```
Kèm theo Thông tư 152/2025/TT-BTC
```

hoặc

```
(Thông tư 152/2025/TT-BTC)
```

**Cách nhận diện:** Dòng chứa `Thông tư` và mã số.  
**Trong parser:** Bỏ qua. Không có giá trị nghiệp vụ.

---

## 5. Table Specification

### 5.1 Bảng chính

Bảng chính chứa dữ liệu doanh thu, có **7 cột** theo thứ tự:

| # | Tên cột (theo PDF) | Business meaning | Required | Parsed | Ignored |
|---|-------------------|-----------------|----------|--------|---------|
| 1 | `STT` | Số thứ tự dòng trong nhóm hàng | Yes | No | — |
| 2 | `Ngày, tháng ghi sổ` | Ngày ghi doanh thu | Yes | **Yes** | — |
| 3 | `Số hiệu chứng từ` | Ký hiệu + số chứng từ | Yes | No | — |
| 4 | `Ngày, tháng chứng từ` | Ngày trên chứng từ | Yes | No | — |
| 5 | `Diễn giải` | Mô tả giao dịch | Yes | **Yes** (để xác nhận "Bán lẻ") | — |
| 6 | `Thuế suất` | Thuế suất GTGT | Yes | **Yes** (để xác nhận hợp lệ) | — |
| 7 | `Doanh thu` | Số tiền doanh thu (VNĐ) | Yes | **Yes** | — |

---

### 5.2 Cột 2: Ngày, tháng ghi sổ

**Vị trí:** Cột thứ 2 trong bảng.

**Dạng:**

```
01/01/2026
```

**Định dạng bắt buộc:** `DD/MM/YYYY`

- `DD`: 01–31
- `MM`: 01–12
- `YYYY`: 4 chữ số

**Quy tắc:**

- Dấu phân cách: `/` (solidus)
- Không chứa chữ, không có dấu gạch ngang
- Ngày phải hợp lệ (không có 31/02)
- Tất cả ngày trong cùng một PDF phải thuộc cùng một tháng và năm đã khai báo ở phần header
- Ngày phải nằm trong khoảng tháng đã khai báo (từ ngày 01 đến ngày cuối tháng)

**Trong parser:** Đây là khóa chính cho aggregation. Được convert sang ISO `YYYY-MM-DD` để lưu vào database.

---

### 5.3 Cột 3: Số hiệu chứng từ

**Dạng:**

```
01/BL
```

**Cấu trúc:** `NN/BL` — hai chữ số, dấu `/`, hai chữ `BL` (viết tắt của "Bán lẻ").

**Cách nhận diện:** Chuỗi kết thúc bằng `/BL`.

**Trong parser:** Không cần lưu. Chỉ dùng để xác nhận dòng là dòng doanh thu hợp lệ (có chứng từ bán lẻ).

---

### 5.4 Cột 4: Ngày, tháng chứng từ

**Dạng:** Giống cột 2 — `DD/MM/YYYY`.

**Trong parser:** Không cần lưu. Thường trùng với cột 2 (ngày ghi sổ). Dùng để cross-check nếu cần.

---

### 5.5 Cột 5: Diễn giải

**Dạng:** Chuỗi văn bản tự do, bắt đầu bằng `Bán lẻ`.

**Ví dụ:**

```
Bán lẻ Nhóm Hóa mỹ phẩm & Tẩy rửa cho khách hàng cá nhân
Bán lẻ Nhóm Đồ dùng gia đình & Tiện ích cho khách hàng cá nhân
Bán lẻ Nhóm Thực phẩm đóng gói & Đồ uống cho khách hàng cá nhân
```

**Quy tắc nhận diện:**

- Bắt buộc chứa cụm từ `Bán lẻ`
- Theo sau là tên nhóm hàng (xem Section 6)
- Có thể kết thúc bằng `cho khách hàng cá nhân` (không bắt buộc)

**Trong parser:** Dùng để xác nhận tính hợp lệ của dòng và xác định nhóm hàng.

---

### 5.6 Cột 6: Thuế suất

**Dạng:**

```
1%
```

**Quy tắc:**

- Bắt đầu bằng số (0–100)
- Kết thúc bằng dấu `%`
- Đối với S2A-HKD (phân phối hàng hóa), thuế suất chuẩn là `1%` (GTGT) và `0.5%` (TNCN)
- Trong bảng doanh thu bán hàng, thuế suất ghi trên mỗi dòng thường là `1%`

**Trong parser:** Dùng để xác nhận dòng là dòng doanh thu hợp lệ. Thuế suất khác `1%` hoặc `0%` đánh dấu cần kiểm tra (`needsReview`).

---

### 5.7 Cột 7: Doanh thu

**Dạng:**

```
529.000
```

hoặc

```
17.229.000
```

**Định dạng:**

- Chỉ chữ số và dấu chấm (`.`)
- Dấu chấm là phân cách hàng nghìn (not decimal separator)
- Không có dấu phẩy
- Không có dấu tiền tệ (đ, VND, …)
- Không có khoảng trắng
- Giá trị từ 0 trở lên

**Quy tắc parse:**

1. Loại bỏ toàn bộ dấu chấm
2. Kiểm tra phần còn lại chỉ chứa chữ số
3. Parse thành integer
4. So sánh với 0 — nếu = 0, đánh dấu `needsReview` (trừ khi đây là dòng tổng cộng đã được loại bỏ ở bước phân loại)

**Ví dụ:**

| Giá trị trong PDF | Sau khi loại dấu chấm | Giá trị numeric |
|------------------|----------------------|-----------------|
| `529.000` | `529000` | 529000 |
| `17.229.000` | `17229000` | 17229000 |
| `0` | `0` | 0 (needsReview) |

---

## 6. Group Definition

### 6.1 Tổng quan

PDF được chia thành các **nhóm hàng** (product groups). Mỗi nhóm có:

- Một dòng tiêu đề nhóm
- Nhiều dòng doanh thu chi tiết
- Một dòng tổng cộng của nhóm

### 6.2 Danh sách nhóm hàng

| # | Tên đầy đủ (trong PDF) | Mã nhóm | Mô tả |
|---|----------------------|---------|-------|
| 1 | Nhóm Hóa mỹ phẩm & Tẩy rửa | `hmpt` | Mỹ phẩm, dung môi, sữa rửa mặt, ... |
| 2 | Nhóm Đồ dùng gia đình & Tiện ích | `ddgd` | Chén đĩa, khăn lau, bao bóng đèn, ... |
| 3 | Nhóm Thực phẩm đóng gói & Đồ uống | `tpdg` | Mì gói, nước ngọt, kẹo, ... |
| 4 | Nhóm hàng hóa tươi sống | `tpts` | Rau, thịt, cá, trứng (trong PDF mẫu: doanh thu = 0) |

### 6.3 Cách nhận diện nhóm

Dòng tiêu đề nhóm có dạng:

```
Nhóm Hóa mỹ phẩm & Tẩy rửa
```

**Quy tắc nhận diện:**

- Bắt đầu bằng `Nhóm`
- Không chứa số ở đầu dòng (không phải STT)
- Không chứa `Tổng cộng`
- Một trong 4 tên đầy đủ đã liệt kê ở trên

**Trong parser:** Khi gặp tiêu đề nhóm, tất cả các dòng doanh thu tiếp theo (cho đến dòng `Tổng cộng` tiếp theo) được gán `sourceGroup` tương ứng.

### 6.4 Trong pipeline migration

Nhóm hàng chỉ xuất hiện ở **Level 2 preview** (source breakdown) để người dùng kiểm tra.

Nhóm hàng **không được import** vào `sales_tickets`.

---

## 7. Aggregation Rule

### 7.1 Mục tiêu

Mỗi **một ngày dương lịch** tạo ra **đúng một bản ghi S1A**, bất kể có bao nhiêu dòng nguồn trong PDF.

### 7.2 Quy tắc tổng hợp

```
Input:  Tất cả dòng doanh thu hợp lệ từ tất cả nhóm hàng
Output: Một AggregatedDay mỗi ngày duy nhất

Quy tắc:
  1. Gom tất cả dòng có cùng isoDate (YYYY-MM-DD)
  2. Cộng tổng amount của tất cả dòng trong ngày đó
  3. Tạo một AggregatedDay với:
       isoDate      = YYYY-MM-DD
       displayDate  = DD/MM/YYYY
       totalAmount  = Σ(amount của tất cả dòng trong ngày)
       sourceRowCount = số dòng nguồn đã gom
       groups       = { hmpt: Σ, ddgd: Σ, tpdg: Σ, tpts: Σ }  (chỉ để hiển thị)
       status       = xác định bởi ConflictDetector
  4. Sắp xếp kết quả theo isoDate tăng dần
```

### 7.3 Ví dụ tổng hợp

**Dữ liệu nguồn:**

```
01/01/2026  |  Nhóm Hóa mỹ phẩm & Tẩy rửa  |  529.000
01/01/2026  |  Nhóm Đồ dùng gia đình       |  646.000
01/01/2026  |  Nhóm Thực phẩm đóng gói      |  175.000
02/01/2026  |  Nhóm Hóa mỹ phẩm & Tẩy rửa   |  420.000
02/01/2026  |  Nhóm Đồ dùng gia đình        |  580.000
```

**Kết quả sau aggregation:**

```
AggregatedDay 1:
  isoDate:      2026-01-01
  displayDate:  01/01/2026
  totalAmount:  1.350.000
  sourceRowCount: 3
  groups: { hmpt: 529000, ddgd: 646000, tpdg: 175000, tpts: null }

AggregatedDay 2:
  isoDate:      2026-01-02
  displayDate:  02/01/2026
  totalAmount:  1.000.000
  sourceRowCount: 2
  groups: { hmpt: 420000, ddgd: 580000, tpdg: null, tpts: null }
```

### 7.4 Nguyên tắc quan trọng

**Không bao giờ import nhóm hàng.** Mỗi nhóm chỉ dùng để minh chứng cho tổng doanh thu. Khi import, chỉ ghi `totalAmount` vào cột `total_amount` của `sales_tickets`.

---

## 8. Ignored Rows

Các loại dòng sau PHẢI bị loại bỏ hoàn toàn. Không bao giờ được đưa vào quá trình aggregation.

### 8.1 Tiêu đề bảng

| Mẫu | Cách nhận diện |
|-----|---------------|
| Dòng chứa `STT` + `Ngày, tháng` + `Số hiệu` | Chứa đồng thời `STT` và `Ngày, tháng` và `Số hiệu` |
| Dòng chứa `Ngày tháng` (header đơn) | Chứa `Ngày tháng` nhưng không có ngày tháng hợp lệ (không phải `DD/MM/YYYY`) |

### 8.2 Tiêu đề nhóm hàng

| Mẫu | Cách nhận diện |
|-----|---------------|
| `Nhóm Hóa mỹ phẩm & Tẩy rửa` | Bắt đầu bằng `Nhóm`, theo sau tên nhóm đã định nghĩa |
| `Nhóm Đồ dùng gia đình & Tiện ích` | Tương tự |
| `Nhóm Thực phẩm đóng gói & Đồ uống` | Tương tự |
| `Nhóm hàng hóa tươi sống` | Tương tự |

### 8.3 Dòng tổng cộng nhóm (subtotal)

| Mẫu | Cách nhận diện |
|-----|---------------|
| `Tổng cộng (1)` | Chứa `Tổng cộng` theo sau là số trong ngoặc đơn |
| `Tổng cộng (2)` | Tương tự |
| `Tổng cộng (3)` | Tương tự |
| `Tổng cộng (4)` | Tương tự |

**Lưu ý:** Có đúng 4 dòng `Tổng cộng` (1 dòng mỗi nhóm). Có thể không có nếu nhóm không có dòng nào.

### 8.4 Tổng cộng chung

| Mẫu | Cách nhận diện |
|-----|---------------|
| `Tổng cộng` (không có số trong ngoặc) | Chứa `Tổng cộng` nhưng không có `(1)`, `(2)`, `(3)`, `(4)` ngay sau |

### 8.5 Thuế

| Mẫu | Cách nhận diện |
|-----|---------------|
| `Thuế GTGT` | Chứa `Thuế GTGT` hoặc `Thuế giá trị gia tăng` |
| `Thuế TNCN` | Chứa `Thuế TNCN` hoặc `Thuế thu nhập` |
| `Tổng số thuế GTGT phải nộp` | Chứa `Tổng số thuế GTGT` |
| `Tổng số thuế TNCN phải nộp` | Chứa `Tổng số thuế TNCN` |

### 8.6 Chữ ký

| Mẫu | Cách nhận diện |
|-----|---------------|
| `Người đại diện` | Chứa `Người đại diện` |
| `Ký, họ tên` | Chứa `Ký` và `họ tên` |
| `Điểm bán hàng` | Chứa `Điểm bán hàng` |

### 8.7 Văn bản quy định / footer

| Mẫu | Cách nhận diện |
|-----|---------------|
| `Thông tư 152/...` | Bắt đầu bằng `Thông tư` theo sau là số |
| Dòng chỉ chứa tên cơ quan thuế (ví dụ: `Cục Thuế ...`) | Chứa `Cục Thuế` hoặc `Chi cục Thuế` |
| Số trang | Chỉ chứa số, thường ở góc dưới, ví dụ: `Trang 1/5` |

### 8.8 Dòng trống

| Mẫu | Cách nhận diện |
|-----|---------------|
| Empty line | Chuỗi rỗng sau khi trim khoảng trắng |

### 8.9 Dòng không hợp lệ

| Mẫu | Cách nhận diện |
|-----|---------------|
| Amount = 0 | Sau khi parse, amount = 0 (đánh dấu `needsReview`, không tự động loại bỏ) |
| Ngày không hợp lệ | Ngày không tồn tại (ví dụ 31/02) hoặc nằm ngoài tháng đã khai báo |
| Không chứa `Bán lẻ` | Diễn giải không chứa từ khóa `Bán lẻ` |
| Không có số hiệu `/BL` | Số hiệu chứng từ không kết thúc bằng `/BL` |
| Thuế suất không hợp lệ | Thuế suất không phải số theo sau bởi `%` |

---

## 9. Validation Rules

Parser thực hiện validation theo thứ tự sau. Mỗi bước phải PASS trước khi bước tiếp theo chạy.

### Bước 1 — Format validation

| Rule | Điều kiện | Hành vi nếu FAIL |
|------|-----------|-----------------|
| Có text content | Số dòng text > 20 sau khi extract | Báo "File có vẻ là bản scan. Vui lòng dùng file PDF có text." |
| Nhận diện S2A-HKD | 10 dòng đầu chứa `SỔ DOANH THU` hoặc `S2a-HKD` | Báo "Định dạng không nhận diện được." |
| Có tiêu đề nhóm | Có ít nhất 1 dòng bắt đầu bằng `Nhóm` | Báo "Không tìm thấy nhóm hàng." |

### Bước 2 — Per-row validation

| Rule | Điều kiện | Hành vi nếu FAIL |
|------|-----------|-----------------|
| Ngày hợp lệ | `DD/MM/YYYY` với day 01–31, month 01–12, year >= 2020 | Đánh dấu `needsReview`, giữ lại để user xem |
| Số hiệu hợp lệ | Kết thúc bằng `/BL` | Đánh dấu `needsReview` |
| Diễn giải hợp lệ | Chứa `Bán lẻ` | Đánh dấu `needsReview` |
| Thuế suất hợp lệ | Là số theo sau bởi `%` | Đánh dấu `needsReview` |
| Amount hợp lệ | Chỉ chữ số và `.`, > 0 (sau khi loại dấu chấm) | Đánh dấu `needsReview` |
| Ngày thuộc tháng đúng | Ngày nằm trong [01/MM/YYYY, last_day/MM/YYYY] của kỳ đã khai báo | Đánh dấu `needsReview` |

### Bước 3 — Month consistency

| Rule | Điều kiện | Hành vi nếu FAIL |
|------|-----------|-----------------|
| Tháng nhất quán | Tất cả ngày trong tất cả các dòng hợp lệ đều thuộc cùng một tháng/năm | Báo "Dữ liệu không nhất quán: phát hiện nhiều tháng trong cùng file." |
| Khớp với header | Tháng/năm từ dòng header trùng với tháng/năm của dòng dữ liệu | Cảnh báo (không chặn, cho phép user quyết định) |

### Bước 4 — Count sanity

| Rule | Điều kiện | Hành vi nếu FAIL |
|------|-----------|-----------------|
| Có dòng doanh thu | Ít nhất 1 dòng hợp lệ sau khi loại excluded rows | Báo "Không tìm thấy dòng doanh thu nào." |
| Số ngày hợp lý | Số ngày duy nhất <= số ngày trong tháng × 1.5 (chừa chỗ cho lỗi) | Cảnh báo |

---

## 10. Reconciliation Rule

### 10.1 Tổng quan

Reconciliation là bước **bắt buộc**, chạy sau aggregation và trước khi hiển thị preview. Import **KHÔNG được** tiến hành nếu reconciliation FAIL.

### 10.2 Các phép kiểm tra

**Kiểm tra 1 — Grand total so sánh trước và sau aggregation:**

```
grandTotalBefore = Σ(amount của TẤT CẢ các dòng nguồn hợp lệ)
grandTotalAfter  = Σ(totalAmount của TẤT CẢ AggregatedDay)

Điều kiện PASS: grandTotalBefore === grandTotalAfter

Nếu FAIL:
  → Dừng toàn bộ quá trình import
  → Hiển thị thông báo lỗi kỹ thuật cho developer/QA
  → Ghi lại chi tiết: số dòng, tổng trước, tổng sau, chênh lệch
```

**Kiểm tra 2 — Group subtotal cross-check (advisory, không chặn):**

```
Với mỗi nhóm hàng:
  parsedGroupTotal = Σ(amount các dòng thuộc nhóm đó)
  pdfSubtotal      = giá trị dòng "Tổng cộng (N)" của nhóm đó

  Nếu parsedGroupTotal ≠ pdfSubtotal:
    → Đánh dấu ⚠️ trong preview
    → Hiển thị: "Tổng nhóm X không khớp với bảng kê (đã đọc: Y, bảng kê ghi: Z)"
    → Không chặn import
    → User quyết định có tiếp tục hay không
```

**Kiểm tra 3 — Source row count so với kỳ vọng:**

```
knownGroupTotals = {
  hmpt: 20957000,
  ddgd: 17533000,
  tpdg: 17229000,
  tpts: 0
}

expectedGrandTotal = Σ(knownGroupTotals.values)
actualGrandTotal   = grandTotalBefore

Nếu |expectedGrandTotal - actualGrandTotal| > threshold:
  → Đánh dấu ⚠️
  → Hiển thị thông báo phân tích
```

### 10.3 Reconciliation output

Reconciliation trả về một object:

```
ReconciliationResult {
  grandTotalBefore: number     // Tổng tất cả dòng nguồn
  grandTotalAfter: number      // Tổng tất cả ngày đã tổng
  totalsMatch: boolean         // grandTotalBefore === grandTotalAfter
  groupTotals: {
    hmpt: { parsed: number, pdfSubtotal: number | null, match: boolean | null }
    ddgd: { parsed: number, pdfSubtotal: number | null, match: boolean | null }
    tpdg: { parsed: number, pdfSubtotal: number | null, match: boolean | null }
    tpts: { parsed: number, pdfSubtotal: number | null, match: boolean | null }
  }
  sourceRowCount: number       // Tổng số dòng nguồn đã parse (valid + needsReview)
  uniqueDateCount: number      // Số ngày duy nhất
  importableRowCount: number   // Số ngày có status = 'ready' sau conflict check
}
```

---

## 11. Multi-page Rule

### 11.1 Tổng quan

PDF có thể nhiều trang. Mỗi trang có cấu trúc giống nhau (header lặp lại, bảng tiếp nối).

### 11.2 Cách xử lý

```
extractAllPages(pdfFile)
  → forEach page:
       extractTextLines(page)
       append to flatLineList
  → parse(flatLineList)  ← xử lý toàn bộ như một luồng liên tục
```

**Quy tắc:**

1. Extract toàn bộ các trang trước khi parse
2. Nối tất cả text lines thành một danh sách duy nhất
3. Parse toàn bộ danh sách — không tách biệt theo trang
4. Header lặp lại ở mỗi trang: parser phải bỏ qua header lặp (đã có rule loại bỏ tiêu đề)
5. Tiêu đề nhóm có thể lặp ở đầu mỗi trang: parser phải nhận diện và gán lại đúng nhóm

### 11.3 Tiêu đề trang (page header)

Một số PDF có dòng tiêu đề ở mỗi trang:

```
Cục Thuế tỉnh Lâm Đồng
Tháng 01 năm 2026
Trang 2
```

**Cách nhận diện:**

- Chứa `Trang` theo sau là số
- Hoặc chỉ chứa tên cơ quan thuế

**Hành vi:** Bỏ qua. Không coi là dữ liệu.

### 11.4 Nguyên tắc continuity

- STT có thể reset ở mỗi trang (1, 2, 3...) hoặc liên tục (1, 2, 3... 88).  
  **Parser không dựa vào STT để xác định ngày.**
- Ngày được xác định từ cột "Ngày, tháng ghi sổ" — đây là khóa chính, không phải STT.

---

## 12. Known Limitations

### 12.1 Scanned PDF (không có text layer)

**Hạn chế:** Không hỗ trợ.

**Hành vi:** Parser phát hiện < 20 dòng text sau extract → thông báo rõ cho user:

> "File này có vẻ là bản scan (không có nội dung text). Tính năng này chỉ hỗ trợ file PDF có text. Vui lòng xuất file từ phần mềm kế toán dưới dạng PDF có text."

### 12.2 Password-protected PDF

**Hạn chế:** Không hỗ trợ.

**Hành vi:** pdf.js trả lỗi khi mở file có mật khẩu. Thông báo cho user nhập file khác không có mật khẩu.

### 12.3 Mẫu biểu khác S2A-HKD

**Hạn chế:** Không hỗ trợ.

**Hành vi:** Parser không nhận diện được cấu trúc → thông báo:

> "Định dạng file không phải sổ S2A-HKD. Tính năng này chỉ hỗ trợ sổ doanh thu S2A-HKD theo Thông tư 152/2025/TT-BTC."

### 12.4 Số nhóm hàng khác 4

**Hạn chế:** Có thể parser bỏ sót nhóm nếu tên khác mẫu.

**Hành vi:** Nhóm hàng không được nhận diện → các dòng trong nhóm đó được đánh dấu `needsReview` với reason `"Nhóm hàng không nhận diện được"`. Hiển thị trong preview cho user xác nhận.

### 12.5 Ngày trùng lặp trong cùng một nhóm

**Hạn chế:** Trong lý thuyết không nên xảy ra. Nếu xảy ra, cả hai dòng đều được giữ lại và cộng vào tổng của ngày đó.

### 12.6 Dòng thiếu cột (cột trống)

**Hạn chế:** Một số dòng có thể thiếu một số cột do lỗi xuất file.

**Hành vi:** Dòng thiếu cột bắt buộc (ngày, amount) → đánh dấu `needsReview`.

### 12.7 Amount quá lớn

**Hành vi:** Nếu amount > 99 tỷ (99.000.000.000) → đánh dấu `needsReview`. Giá trị doanh thu một ngày của tạp hóa nhỏ không vượt quá giới hạn này.

---

## 13. Future Compatibility

### 13.1 Nguyên tắc thiết kế

Pipeline migration được thiết kế theo mô hình **Source → PreviewModel**. Mỗi source format chỉ cần implement một adapter (parser) để biến raw data thành `PreviewModel`. Phần còn lại của pipeline (aggregation, conflict detection, preview, import) không cần thay đổi.

```
                    ┌──────────────┐
  BCT_Thang1.pdf ──→│  S2aPdfParser │──┐
                    └──────────────┘  │
                                      ▼
                    ┌──────────────┐  │  Aggregator
  sales_q1_2026.csv─→│  CsvParser   │──┤  (chung)
                    └──────────────┘  │
                                      ▼
                    ┌──────────────┐  │  ConflictDetector
  kiot_export.xlsx ─→│ ExcelParser  │──┤  (chung)
                    └──────────────┘  │
                                      ▼
                               ┌──────────┐
                               │PreviewModel│──→ UI (chung)
                               └──────────┘
```

### 13.2 Yêu cầu cho parser mới

Mọi parser mới (Excel, CSV, POS…) phải:

1. Trích xuất raw source rows từ file đầu vào
2. Phân loại từng row thành: `valid`, `needsReview`, hoặc `excluded`
3. Ánh xạ mỗi `valid` row thành cấu trúc tương đương với `ParsedRow` (xem Section 7)
4. Trả về kết quả cho Aggregator xử lý

Parser KHÔNG cần:

- Hiểu về S1A database
- Xử lý conflict
- Tạo giao diện người dùng

### 13.3 Định dạng có thể hỗ trợ trong tương lai

| Định dạng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| S2A PDF (mẫu hiện tại) | ✅ Đã có spec | Tháng 01/2026 trở đi |
| CSV (xuất từ phần mềm kế toán) | 🔜 Tương lai | Cấu trúc cột tương tự bảng PDF |
| Excel (.xlsx) | 🔜 Tương lai | Mỗi sheet là một tháng |
| KiotViet Export | 🔜 Tương lai | Format riêng, cần parser mới |
| POS Export (bán lẻ) | 🔜 Tương lai | Khác S2A — cần specification riêng |
| JSON / API export | 🔜 Tương lai | Dễ parse nhất — chỉ cần map field |

### 13.4 Lưu ý khi mở rộng

- Mỗi định dạng mới cần tài liệu specification riêng (giống tài liệu này)
- `PreviewModel` là contract trung tâm — không thay đổi khi thêm parser mới
- Nếu một định dạng mới có cấu trúc khác biệt lớn (ví dụ: không có nhóm hàng), cần bàn thêm trước khi implement

---

## Appendix A: Sample Raw Data Trace

Dưới đây là trace dữ liệu thật từ `BCT_Thang1.pdf` để dùng làm reference cho implementation.

### A.1 Dòng hợp lệ (đã trích xuất)

```
STT: 1
Ngày ghi sổ: 01/01/2026
Số hiệu CT: 01/BL
Ngày CT: 01/01/2026
Diễn giải: Bán lẻ Nhóm Hóa mỹ phẩm & Tẩy rửa cho khách hàng cá nhân
Thuế suất: 1%
Doanh thu: 529.000

STT: 1
Ngày ghi sổ: 01/01/2026
Số hiệu CT: 01/BL
Ngày CT: 01/01/2026
Diễn giải: Bán lẻ Nhóm Đồ dùng gia đình & Tiện ích cho khách hàng cá nhân
Thuế suất: 1%
Doanh thu: 646.000

STT: 1
Ngày ghi sổ: 01/01/2026
Số hiệu CT: 01/BL
Ngày CT: 01/01/2026
Diễn giải: Bán lẻ Nhóm Thực phẩm đóng gói & Đồ uống cho khách hàng cá nhân
Thuế suất: 1%
Doanh thu: 175.000
```

→ Sau aggregation:

```
2026-01-01 | 01/01/2026 | 3 dòng | 1.350.000 đ | hmpt: 529000, ddgd: 646000, tpdg: 175000
```

### A.2 Dòng bị loại

```
STT | Ngày, tháng ghi sổ | Số hiệu chứng từ | ...     → Table header (excluded)
Nhóm Hóa mỹ phẩm & Tẩy rửa                             → Group title (excluded)
Tổng cộng (1)                                           → Group subtotal (excluded)
Tổng cộng (2)                                           → Group subtotal (excluded)
Tổng cộng (3)                                           → Group subtotal (excluded)
Thuế GTGT                                               → Tax summary (excluded)
Thuế TNCN                                               → Tax summary (excluded)
Tổng số thuế GTGT phải nộp: ...                         → Tax summary (excluded)
Người đại diện                                          → Signature (excluded)
Ký, họ tên                                             → Signature (excluded)
(Trống)                                                 → Empty (excluded)
```

### A.3 Tổng hợp tham chiếu

| Nhóm | Tổng trong PDF | Trạng thái |
|------|---------------|-----------|
| Hóa mỹ phẩm & Tẩy rửa | 20.957.000 | Reference |
| Đồ dùng gia đình & Tiện ích | 17.533.000 | Reference |
| Thực phẩm đóng gói & Đồ uống | 17.229.000 | Reference |
| Hàng hóa tươi sống | 0 | Reference |
| **Tổng** | **55.719.000** | Target |

---

## Appendix B: Decision Log

| Quyết định | Lý do |
|-----------|-------|
| Dùng `pdfjs-dist` (không OCR) | PDF là text-based. OCR không cần thiết, thêm chi phí và độ phức tạp |
| Không dùng pdf-lib | pdf-lib là PDF editor, không phải extractor |
| Parse theo dòng (line-by-line) thay vì table cell | S2A PDF là monospaced layout, không có table cells chuẩn |
| Group nhóm hàng dùng cho preview, không import | Business rule S1A: không phân loại doanh thu theo nhóm |
| STT không dùng làm khóa | STT reset mỗi nhóm; ngày mới là khóa tự nhiên |
| Reconciliation là bắt buộc trước khi import | Nguyên tắc an toàn: không import nếu tổng không khớp |
| Multi-file từ đầu | Kiến trúc cho phép mở rộng; ít file hơn so với thêm sau |

---

> **Lưu ý cuối:** Tài liệu này là specification. Bất kỳ thay đổi định dạng PDF (do cơ quan thuế thay đổi mẫu biểu) phải được cập nhật ở đây trước khi thay đổi bất kỳ code nào liên quan.
