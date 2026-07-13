    # AGENT_CONTROL.md

    > **Mục đích**: Quy tắc bắt buộc cho mọi AI agent và developer khi làm việc trên dự án Hải Kiều.
    > **Đọc PROJECT_OVERVIEW.md TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ.**

    ---

    ## 1. Thứ tự đọc tài liệu bắt buộc

    | Khi cần | Đọc file |
    |---------|---------|
    | Hiểu toàn bộ dự án | `PROJECT_OVERVIEW.md` |
    | Thêm / sửa bảng database | `docs/schema.sql` + migration file liên quan |
    | Setup Supabase từ đầu | `docs/SETUP.md` |
    | Migration database | `docs/SUPABASE_MIGRATION.md` |
    | Chỉnh sửa component/page cụ thể | Source file trong `src/pages/` hoặc `src/components/` |
    | Viết logic nghiệp vụ | Source file trong `src/utils/` hoặc `src/context/` |

    **Quy tắc**: Đọc `PROJECT_OVERVIEW.md` trước tiên, luôn luôn. Không bắt đầu code khi chưa hiểu bối cảnh.

    ---

    ## 2. Quy tắc workflow

    ### Requirement Analysis

    - Đọc PROJECT_OVERVIEW.md trước.
    - Phân tích yêu cầu.
    - Nếu yêu cầu chưa rõ → hỏi lại.
    - Nếu yêu cầu rõ → trình bày kế hoạch thực hiện.

    ### Implementation

    - Chỉ bắt đầu code sau khi đã hiểu yêu cầu.
    - Chỉ sửa các file liên quan.
    - Không mở rộng phạm vi.

    ### Validation

    - Tự review thay đổi.
    - Kiểm tra ảnh hưởng.
    - Viết Output Report.
    ---

    ## 3. Quy tắc an toàn

    ### 3.1. Tuyệt đối không làm

    | Hành động | Lý do |
    |-----------|-------|
    | Không refactor code không liên quan | Rủi ro break chức năng đang hoạt động |
    | Không đổi tên file/folder | Break import path, đứt link Git |
    | Không thay đổi database schema | Có thể mất dữ liệu, phá vỡ RLS/RLS policies |
    | Không thay đổi quy tắc nghiệp vụ | Vi phạm logic thuế / kế toán HKD |
    | Không thêm dependency mới | Có thể conflict với bộ hiện tại; phải có lý do và được giải thích |
    | Không expose secret/key | Service role key, API key không được đưa vào code |
    | Không push `.env.local` | Gitignore đã có rồi — tuân thủ nghiêm ngặt |

    ### 3.2. Thận trọng cao với

    - **`HoaDonVAT.jsx`**: OCR prompt dài, logic phức tạp. Thay đổi phải test kỹ.
    - **`AppContext.jsx`**: Đang chuyển đổi từ localStorage sang Supabase. Cẩn thận không break data flow hiện tại.
    - **`db.js`**: Đã viết xong nhưng chưa tích hợp. Việc kết nối cần review cẩn thận.
    - **`closed_periods`**: Sổ đã chốt KHÔNG được sửa/xóa. Logic này phải được giữ nguyên.

    ---

    ## 4. Quy tắc đặc thù dự án

    ### 4.1. Đây là app HKD nhỏ, không phải ERP

    - Ưu tiên: **đơn giản, nhanh, dễ dùng cho người không rành công nghệ.
    - Không over-engineer. Không thêm layer phức tạp không cần thiết.
    - UI phải thân thiện với người dùng cuối (chủ HKD, nhân viên bán hàng).

    ### 4.2. Giữ nguyên các logic bắt buộc

    | Logic | Vị trí | Tại sao phải giữ |
    |-------|---------|-----------------|
    | ADMIN / STAFF RBAC | `RoleGuard.jsx`, `AuthContext.jsx` | Phân quyền bảo mật cơ bản |
    | Supabase Auth + JWT | `lib/supabase.js`, `AuthContext.jsx` | Xác thực người dùng |
    | Row Level Security (RLS) | Supabase migrations | Bảo vệ dữ liệu per-user |
    | Thuật toán định giá ×1.15 + làm tròn | `HoaDonVAT.jsx`, `TraCuuGia.jsx`, `BangKeMuaVao.jsx` | Quy tắc kinh doanh |
    | Chốt sổ kỳ kế toán | `closed_periods` + `CloseBookForm.jsx` | Yêu cầu thuế |
    | Thuế suất S2A: 1% GTGT + 0.5% TNCN | Thông tư 152/2025/TT-BTC | Pháp lý |

    ### 4.3. localStorage ↔ Supabase

    Đây là dự án đang trong giai đoạn chuyển đổi:

    ```
    ĐÃ DÙNG SUPABASE:     sales_tickets, closed_periods, profiles
    VẪN DÙNG localStorage: inventory, invoices, companies, fresh food
    ```

    - Khi thêm tính năng mới cho phần localStorage → chuyển luôn sang Supabase nếu có thể.
    - Khi đọc code cũ → phân biệt rõ 2 hệ thống này.
    - Map legacy abbreviation: `LEGACY_GROUP_TO_INVENTORY_ID` trong `data/constants.js` dùng cho dữ liệu cũ trong localStorage.

    ### 4.4. Edge Function

    - `create-employee` chỉ gọi được khi đã có ADMIN.
    - Lần đầu setup → chạy `seed.js` thủ công với service role key (không bao giờ để trong frontend).

    ---

    ## 5. Output Report bắt buộc

    Sau mọi thay đổi, báo cáo phải gồm:

    ```
    ## Output Report

    ### File đã thay đổi
    - [danh sách file]

    ### Đã thay đổi gì
    - [mô tả ngắn gọn từng thay đổi]

    ### Tại sao thay đổi
    - [lý do]

    ### Risk / Impact
    - [ảnh hưởng gì, có break gì không]

    ### Cách test
    - [bước kiểm tra cụ thể]

    ### Đã KHÔNG thay đổi
    - [danh sách file/logic được giữ nguyên]
    ```

    ---

    ## 6. Checklist trước khi commit/dừng làm

    - [ ] Đã đọc `PROJECT_OVERVIEW.md`
    - [ ] Yêu cầu đã rõ ràng — đã hỏi nếu mơ hồ
    - [ ] Đã giải thích phương án trước khi code
    - [ ] Chỉ sửa file liên quan
    - [ ] Không thay đổi database schema
    - [ ] Không expose secret/key
    - [ ] Đã kiểm tra logic nghiệp vụ (ADMIN/STAFF, chốt sổ, định giá)
    - [ ] Đã cung cấp Output Report

    ## Decision Priority

    Nếu có mâu thuẫn giữa các nguồn thông tin,
    ưu tiên theo thứ tự:

    1. User request
    2. PROJECT_OVERVIEW.md
    3. Database schema
    4. Existing business rules
    5. Existing codebase
    6. AI assumptions

    Không được tự ý suy diễn nếu chưa đủ thông tin.

    Nếu không chắc chắn,
    hãy hỏi thay vì đoán.