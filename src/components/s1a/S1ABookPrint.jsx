import SoS1aHKD from '../SoS1aHKD'

export default function S1ABookPrint() {
  return (
    <div className="card">
      <p className="text-sm text-ink-muted mb-4">
        Mẫu Sổ S1a-HKD (Theo Thông tư 152/2021/TT-BTC). Hệ thống tự động gom toàn bộ
        phiếu doanh thu trong kỳ kê khai, tổng hợp theo 3 cột chuẩn: Ngày tháng (A) |
        Diễn giải (B) | Số tiền (1). Hỗ trợ in hoặc xuất file PDF trực quan.
      </p>
      <SoS1aHKD />
    </div>
  )
}
