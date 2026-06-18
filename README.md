# Hộ kinh doanh — Tồn kho & S2A

Ứng dụng web React + Vite để:
1. **Khai báo hàng tồn kho đầu năm** (theo biên bản kiểm kê 01/01/2026)
2. **Ghi nhận doanh thu từng ngày** (Hồ sơ S2A)
3. **Báo cáo biến động tồn kho** (tồn đầu kỳ − đã bán = tồn hiện tại)

## Chạy dự án

```bash
npm install
npm run dev
```

Mở địa chỉ mà Vite in ra (thường là http://localhost:5173).

## Cấu trúc

- **Tồn kho đầu năm**: 4 nhóm hàng mặc định theo ảnh biên bản (Hóa mỹ phẩm & Tẩy rửa, Đồ dùng gia đình & Tiện ích, Thực phẩm đóng gói & Đồ uống, Hàng hóa khác). Có thể sửa số lượng, đơn giá, ghi chú và khôi phục số liệu mặc định.
- **Hồ sơ S2A**: Thêm phiếu bán lẻ theo ngày, nhóm (Đồ uống & Thực phẩm, Hóa mỹ phẩm & Gia dụng, Đồ cúng & Hàng khác). Số hiệu mặc định dạng 01/BL, 02/BL...
- **Báo cáo biến động**: Tồn đầu kỳ từng nhóm, tổng doanh thu đã ghi S2A, tồn hiện tại. Khi bán lẻ nhóm nào thì tồn kho nhóm đó trừ tương ứng.

Dữ liệu lưu trong `localStorage` của trình duyệt.
