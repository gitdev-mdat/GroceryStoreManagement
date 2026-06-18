import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { formatVndExact } from '../components/FormatNumber'
import VndInput from '../components/VndInput'
import DatePicker from '../components/DatePicker'
import { formatDateForInput, formatDateDisplay } from '../components/FormatDate'

export default function BangKeMuaVao() {
  const {
    freshFoodPurchases,
    setFreshFoodPurchaseForMonth,
    deleteFreshFoodPurchase,
    freshFoodPurchasesDaily,
    setFreshFoodPurchaseForDay,
    deleteFreshFoodPurchaseDay,
  } = useApp()
  const [mode, setMode] = useState('thang') // 'thang' | 'ngay'
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [amount, setAmount] = useState(0)
  const [dayDate, setDayDate] = useState(formatDateForInput(new Date()))
  const [dayAmount, setDayAmount] = useState(0)
  const [notify, setNotify] = useState(null)

  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const existing = (freshFoodPurchases || []).find((e) => e.month === monthKey)
  const existingDay = (freshFoodPurchasesDaily || []).find((e) => e.date === dayDate)

  useEffect(() => {
    const entry = (freshFoodPurchases || []).find((e) => e.month === monthKey)
    setAmount(entry ? (entry.amount ?? 0) : 0)
  }, [monthKey, freshFoodPurchases])

  useEffect(() => {
    const entry = (freshFoodPurchasesDaily || []).find((e) => e.date === dayDate)
    setDayAmount(entry ? (entry.amount ?? 0) : 0)
  }, [dayDate, freshFoodPurchasesDaily])

  useEffect(() => {
    if (!notify) return
    const t = setTimeout(() => setNotify(null), 3000)
    return () => clearTimeout(t)
  }, [notify])

  const handleSaveMonth = () => {
    setFreshFoodPurchaseForMonth(monthKey, amount)
    setNotify({ type: 'success', text: existing ? `Đã cập nhật bảng kê tháng ${month}/${year}.` : `Đã lưu bảng kê tháng ${month}/${year}.` })
  }

  const handleSaveDay = () => {
    setFreshFoodPurchaseForDay(dayDate, dayAmount)
    setNotify({ type: 'success', text: existingDay ? `Đã cập nhật bảng kê ngày ${formatDateDisplay(dayDate)}.` : `Đã lưu bảng kê ngày ${formatDateDisplay(dayDate)}.` })
  }

  const sorted = [...(freshFoodPurchases || [])].sort((a, b) => b.month.localeCompare(a.month))
  const sortedDaily = [...(freshFoodPurchasesDaily || [])].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-brand-700 m-0">Bảng kê mua vào</h1>
        <p className="text-sm text-ink-muted mt-1 mb-0">
          Theo dõi chi phí mua vào nhóm <strong>Thực phẩm tươi sống</strong> (rau, thịt, cá, trứng…) — thường không có hóa đơn VAT.
        </p>
      </div>

      <div className="card">
        <h2>Nhập bảng kê</h2>
        <p className="text-sm text-ink-muted mb-4">
          Nhập <strong>theo tháng</strong> (một tổng cho cả tháng) hoặc <strong>theo ngày</strong> (từng ngày) — phù hợp với cách tạo phiếu S1A (theo ngày / theo tháng).
        </p>
        <div className="flex gap-2 mb-4 flex-wrap">
          <button type="button" className={`btn ${mode === 'thang' ? 'btn-primary' : ''}`} onClick={() => setMode('thang')}>Theo tháng</button>
          <button type="button" className={`btn ${mode === 'ngay' ? 'btn-primary' : ''}`} onClick={() => setMode('ngay')}>Theo ngày</button>
        </div>

        {mode === 'thang' && (
          <div className="form-row">
            <div className="form-group" style={{ minWidth: '120px' }}>
              <label>Tháng</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '110px' }}>
              <label>Năm</label>
              <input type="number" min={2020} max={2030} value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
            </div>
            <div className="form-group" style={{ minWidth: '200px' }}>
              <label>Tổng tiền mua vào tháng (VND)</label>
              <VndInput value={amount} onChange={setAmount} placeholder="0" />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleSaveMonth}>{existing ? 'Cập nhật' : 'Lưu bảng kê'}</button>
          </div>
        )}

        {mode === 'ngay' && (
          <div className="form-row">
            <div className="form-group" style={{ minWidth: '160px' }}>
              <label>Ngày</label>
              <DatePicker value={dayDate} onChange={setDayDate} aria-label="Chọn ngày" />
            </div>
            <div className="form-group" style={{ minWidth: '200px' }}>
              <label>Tổng tiền mua vào ngày (VND)</label>
              <VndInput value={dayAmount} onChange={setDayAmount} placeholder="0" />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleSaveDay}>{existingDay ? 'Cập nhật' : 'Lưu bảng kê'}</button>
          </div>
        )}

        {notify && (
          <div
            role="alert"
            className={
              'mt-3 px-3 py-2 rounded-lg text-sm ' +
              (notify.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200')
            }
          >
            {notify.text}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Danh sách bảng kê đã lưu</h2>

        <h3 className="text-base font-semibold mb-2 text-brand-700">Theo tháng</h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-muted mb-4">Chưa có bảng kê theo tháng.</p>
        ) : (
          <div className="overflow-x-auto mb-6">
            <table>
              <thead>
                <tr><th>Tháng</th><th className="number-cell">Tổng tiền (VND)</th><th></th></tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.month}>
                    <td>Tháng {row.month.slice(5)}/{row.month.slice(0, 4)}</td>
                    <td className="number-cell">{formatVndExact(row.amount)}</td>
                    <td><button type="button" className="btn btn-danger" onClick={() => deleteFreshFoodPurchase(row.month)}>Xóa</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="text-base font-semibold mb-2 text-brand-700">Theo ngày</h3>
        {sortedDaily.length === 0 ? (
          <p className="text-sm text-ink-muted">Chưa có bảng kê theo ngày.</p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Ngày</th><th className="number-cell">Tổng tiền (VND)</th><th></th></tr>
              </thead>
              <tbody>
                {sortedDaily.map((row) => (
                  <tr key={row.date}>
                    <td>{formatDateDisplay(row.date)}</td>
                    <td className="number-cell">{formatVndExact(row.amount)}</td>
                    <td><button type="button" className="btn btn-danger" onClick={() => deleteFreshFoodPurchaseDay(row.date)}>Xóa</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
