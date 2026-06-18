import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { formatVndExact } from '../components/FormatNumber'

export default function TongHopThang() {
  const { vatInvoices } = useApp()

  const summary = useMemo(() => {
    const map = {}
    vatInvoices.forEach((inv) => {
      const ym = (inv.date || '').slice(0, 7)
      if (!ym) return
      if (!map[ym]) map[ym] = { count: 0, amount: 0 }
      map[ym].count += 1
      map[ym].amount += Number(inv.amount) || 0
    })
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, v]) => ({ month, ...v }))
  }, [vatInvoices])

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-brand-700 m-0">Tổng hợp mua vào</h1>
        <p className="text-sm text-ink-muted mt-1 mb-0">
          Tổng quan chi phí nhập hàng theo từng tháng.
        </p>
      </div>

      <div className="card">
        {summary.length === 0 ? (
          <p className="text-sm text-ink-muted">Chưa có dữ liệu tổng hợp.</p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th className="number-cell">Số hóa đơn</th>
                  <th className="number-cell">Tổng tiền (VND)</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr key={row.month}>
                    <td>Tháng {row.month.slice(5)}/{row.month.slice(0, 4)}</td>
                    <td className="number-cell">{row.count}</td>
                    <td className="number-cell">{formatVndExact(row.amount)}</td>
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
