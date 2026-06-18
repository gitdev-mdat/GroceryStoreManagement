import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { LEGACY_GROUP_TO_INVENTORY_ID, DEFAULT_INVENTORY_CATEGORIES } from "../data/constants";
import { formatVnd, formatVndExact } from "../components/FormatNumber";
import { formatDateDisplay } from "../components/FormatDate";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const REPORT_TABS = [
  { id: "inventory", label: "Biến động tồn kho" },
  { id: "byDay", label: "Doanh thu theo ngày" },
  { id: "byMonth", label: "Doanh thu theo tháng" },
  { id: "byGroup", label: "Doanh thu theo nhóm" },
  { id: "vat", label: "Hóa đơn VAT đầu vào" },
];

export default function BaoCao() {
  const {
    inventory,
    s2a,
    vatInvoices,
    freshFoodPurchases,
    freshFoodPurchasesDaily,
  } = useApp();
  const [activeReport, setActiveReport] = useState("inventory");
  const [nhapTrongNam, setNhapTrongNam] = useState({
    'Nhóm Hóa mỹ phẩm & Tẩy rửa': 0,
    'Nhóm Đồ dùng gia đình & Tiện ích': 0,
    'Nhóm Thực phẩm đóng gói & Đồ uống': 0,
    'Nhóm hàng hóa tươi sống': 0,
  });
  const [daBanTrongNam, setDaBanTrongNam] = useState({
    'Nhóm Hóa mỹ phẩm & Tẩy rửa': 0,
    'Nhóm Đồ dùng gia đình & Tiện ích': 0,
    'Nhóm Thực phẩm đóng gói & Đồ uống': 0,
    'Nhóm hàng hóa tươi sống': 0,
  });

  const fetchVatImports = async () => {
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_type,
          total_amount,
          price_history (
            products (
              group_key
            )
          )
        `)
        .eq('invoice_type', 'VAT')
        .gt('total_amount', 0);

      if (invoicesError) throw invoicesError;

      const totals = {
        'Nhóm Hóa mỹ phẩm & Tẩy rửa': 0,
        'Nhóm Đồ dùng gia đình & Tiện ích': 0,
        'Nhóm Thực phẩm đóng gói & Đồ uống': 0,
        'Nhóm hàng hóa tươi sống': 0,
      };

      if (invoicesData) {
        invoicesData.forEach((invoice) => {
          const amount = Number(invoice.total_amount || 0);
          const rows = invoice.price_history || [];
          let matchedGroup = null;

          if (rows.length > 0) {
            const rawGroup = String(rows[0].products?.group_key || '').toUpperCase();
            if (
              rawGroup.includes('HÀNG HÓA TỔNG HỢP') ||
              rawGroup.includes('THỰC PHẨM') ||
              rawGroup.includes('ĐỒ UỐNG')
            ) {
              matchedGroup = 'Nhóm Thực phẩm đóng gói & Đồ uống';
            } else if (
              rawGroup.includes('HÓA MỸ PHẨM') ||
              rawGroup.includes('MỸ PHẨM') ||
              rawGroup.includes('TẨY RỬA')
            ) {
              matchedGroup = 'Nhóm Hóa mỹ phẩm & Tẩy rửa';
            } else if (
              rawGroup.includes('ĐỒ DÙNG') ||
              rawGroup.includes('TIỆN ÍCH')
            ) {
              matchedGroup = 'Nhóm Đồ dùng gia đình & Tiện ích';
            } else if (rawGroup.includes('TƯƠI SỐNG') || rawGroup.includes('TƯƠI')) {
              matchedGroup = 'Nhóm hàng hóa tươi sống';
            }
          }

          if (!matchedGroup) {
            matchedGroup = 'Nhóm Thực phẩm đóng gói & Đồ uống';
          }

          totals[matchedGroup] += amount;
        });
      }

      setNhapTrongNam(totals);
    } catch (err) {
      console.error('❌ Loi fetchVatImports:', err.message);
      setNhapTrongNam({
        'Nhóm Hóa mỹ phẩm & Tẩy rửa': 0,
        'Nhóm Đồ dùng gia đình & Tiện ích': 0,
        'Nhóm Thực phẩm đóng gói & Đồ uống': 0,
        'Nhóm hàng hóa tươi sống': 0,
      });
    }
  };

  const fetchSalesData = async () => {
    if (!isSupabaseConfigured()) {
      setDaBanTrongNam({
        'Nhóm Hóa mỹ phẩm & Tẩy rửa': 0,
        'Nhóm Đồ dùng gia đình & Tiện ích': 0,
        'Nhóm Thực phẩm đóng gói & Đồ uống': 0,
        'Nhóm hàng hóa tươi sống': 0,
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sales_tickets')
        .select('group_key, total_amount');

      if (error) throw error;

      const totals = {};
      (data || []).forEach((ticket) => {
        const amount = Number(ticket.total_amount) || 0;
        const gid = ticket.group_key || inventory[0]?.id || 'ddgd';
        const invId = LEGACY_GROUP_TO_INVENTORY_ID[gid] ?? gid;
        const category = DEFAULT_INVENTORY_CATEGORIES.find((c) => c.id === invId);
        const groupName = category?.name || invId;
        if (!totals[groupName]) totals[groupName] = 0;
        totals[groupName] += amount;
      });

      setDaBanTrongNam({
        'Nhóm Hóa mỹ phẩm & Tẩy rửa': totals['Nhóm Hóa mỹ phẩm & Tẩy rửa'] || 0,
        'Nhóm Đồ dùng gia đình & Tiện ích': totals['Nhóm Đồ dùng gia đình & Tiện ích'] || 0,
        'Nhóm Thực phẩm đóng gói & Đồ uống': totals['Nhóm Thực phẩm đóng gói & Đồ uống'] || 0,
        'Nhóm hàng hóa tươi sống': totals['Nhóm hàng hóa tươi sống'] || 0,
      });
    } catch (err) {
      console.error('Loi fetch sales data:', err);
      setDaBanTrongNam({
        'Nhóm Hóa mỹ phẩm & Tẩy rửa': 0,
        'Nhóm Đồ dùng gia đình & Tiện ích': 0,
        'Nhóm Thực phẩm đóng gói & Đồ uống': 0,
        'Nhóm hàng hóa tươi sống': 0,
      });
    }
  };

  useEffect(() => {
    fetchVatImports();
  }, [inventory]);

  useEffect(() => {
    fetchSalesData();
  }, [inventory]);

  const {
    byCategory,
    totalRevenue,
    totalInitial,
    totalImport,
    totalCurrentReal,
  } = useMemo(() => {
    const byCategory = {};
    (inventory || []).forEach((inv) => {
      byCategory[inv.id] = {
        name: inv.name,
        initial: (inv.quantity ?? 0) * (inv.unitPrice ?? 0),
        sold: 0,
        imported: 0,
      };
    });

    let totalInitial = 0;
    let totalImport = 0;
    let totalSold = 0;
    let totalCurrentReal = 0;

    Object.keys(byCategory).forEach((id) => {
      const c = byCategory[id];
      const nhap = nhapTrongNam[c.name] || 0;
      const ban = daBanTrongNam[c.name] || 0;
      c.imported = nhap;
      c.sold = ban;
      c.currentReal = c.initial + nhap - ban;
      totalInitial += c.initial;
      totalImport += nhap;
      totalSold += ban;
      totalCurrentReal += c.currentReal;
    });

    return {
      byCategory,
      totalRevenue: totalSold,
      totalInitial,
      totalImport,
      totalCurrentReal,
    };
  }, [inventory, nhapTrongNam, daBanTrongNam]);

  const { vatByGroup, vatByMonth, vatTotal } = useMemo(() => {
    const byGroup = {};
    const byMonth = {};
    let total = 0;
    inventory.forEach((inv) => {
      byGroup[inv.id] = { name: inv.name, count: 0, amount: 0 };
    });
    (vatInvoices || []).forEach((inv) => {
      const amt = Number(inv.amount) || 0;
      total += amt;
      const gid = inv.groupKey || inventory[0]?.id;
      if (byGroup[gid]) {
        byGroup[gid].count += 1;
        byGroup[gid].amount += amt;
      } else {
        byGroup[gid] = {
          name: inventory.find((c) => c.id === gid)?.name ?? gid,
          count: 1,
          amount: amt,
        };
      }
      const ym = (inv.date || "").slice(0, 7);
      if (ym) {
        if (!byMonth[ym]) byMonth[ym] = { count: 0, amount: 0 };
        byMonth[ym].count += 1;
        byMonth[ym].amount += amt;
      }
    });
    const monthList = Object.entries(byMonth)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ym, v]) => ({ month: ym, ...v }));
    return {
      vatByGroup: Object.entries(byGroup).map(([id, v]) => ({ id, ...v })),
      vatByMonth: monthList,
      vatTotal: total,
    };
  }, [inventory, vatInvoices]);

  const revenueByDay = useMemo(() => {
    const byDate = {};
    (s2a || []).forEach((entry) => {
      const d = entry.date || "";
      if (!d) return;
      if (!byDate[d]) byDate[d] = { count: 0, amount: 0 };
      byDate[d].count += 1;
      byDate[d].amount += Number(entry.amount) || 0;
    });
    return Object.entries(byDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, v]) => ({ date, ...v }));
  }, [s2a]);

  const revenueByMonth = useMemo(() => {
    const byMonth = {};
    (s2a || []).forEach((entry) => {
      const ym = (entry.date || "").slice(0, 7);
      if (!ym) return;
      if (!byMonth[ym]) byMonth[ym] = { count: 0, amount: 0 };
      byMonth[ym].count += 1;
      byMonth[ym].amount += Number(entry.amount) || 0;
    });
    return Object.entries(byMonth)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, v]) => ({ month, ...v }));
  }, [s2a]);

  const revenueByGroupList = useMemo(() => {
    return Object.entries(byCategory)
      .filter(([, c]) => (c.sold ?? 0) > 0 || (c.initial ?? 0) > 0)
      .map(([id, c]) => ({ id, name: c.name, sold: c.sold ?? 0 }))
      .sort((a, b) => b.sold - a.sold);
  }, [byCategory]);

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-brand-700 m-0">Báo cáo biến động</h1>
        <p className="text-sm text-ink-muted mt-1 mb-0">
          Chọn loại báo cáo bên dưới để xem doanh thu theo ngày, theo tháng, theo nhóm hoặc biến động tồn kho.
        </p>
      </div>

      <nav className="section-tabs" aria-label="Loại báo cáo">
        {REPORT_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={activeReport === id ? "active" : ""}
            onClick={() => setActiveReport(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeReport === "inventory" && (
        <div className="card">
          <h2>Biến động tồn kho</h2>
          <p className="text-sm text-ink-muted mb-4">
            Tồn kho thực = Tồn đầu kỳ + Nhập trong năm (VAT đầu vào + tươi sống) - Đã bán (S1A theo nhóm).
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Nhóm hàng hóa</th>
                  <th className="number-cell">Tồn đầu kỳ (VND)</th>
                  <th className="number-cell">Nhập trong năm (VND)</th>
                  <th className="number-cell">Đã bán (VND)</th>
                  <th className="number-cell">Tồn hiện tại thực (VND)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byCategory).map(([id, c]) => (
                  <tr key={id}>
                    <td>{c.name}</td>
                    <td className="number-cell">{formatVndExact(c.initial)}</td>
                    <td className="number-cell text-brand-600 font-medium">+ {formatVndExact(nhapTrongNam[c.name] || 0)}</td>
                    <td className="number-cell text-amber-600 font-medium">- {formatVndExact(c.sold)}</td>
                    <td className="number-cell font-bold">{formatVndExact(c.currentReal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="report-summary mt-6">
            <div className="report-box">
              <div className="label">Tổng giá trị tồn đầu kỳ</div>
              <div className="value">{formatVndExact(totalInitial)} VND</div>
            </div>
            <div className="report-box">
              <div className="label">Tổng nhập trong năm</div>
              <div className="value text-brand-600 font-bold text-lg">{formatVndExact(
                Object.values(nhapTrongNam).reduce((sum, value) => sum + value, 0)
              )} VND</div>
            </div>
            <div className="report-box">
              <div className="label">Tổng doanh thu đã ghi (S1A)</div>
              <div className="value deduct">- {formatVndExact(totalRevenue)} VND</div>
            </div>
            <div className="report-box">
              <div className="label">Tổng tồn kho thực hiện tại</div>
              <div className="value">{formatVndExact(totalCurrentReal)} VND</div>
            </div>
          </div>
        </div>
      )}

      {activeReport === "byDay" && (
        <div className="card">
          <h2>Doanh thu theo ngày</h2>
          <p className="text-sm text-ink-muted mb-4">Tổng doanh thu S1A theo từng ngày (số phiếu + tổng tiền).</p>
          {revenueByDay.length === 0 ? (
            <p className="text-sm text-ink-muted">Chưa có phiếu S1A nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th className="number-cell">Số phiếu</th>
                    <th className="number-cell">Tổng doanh thu (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueByDay.map(({ date, count, amount }) => (
                    <tr key={date}>
                      <td>{formatDateDisplay(date)}</td>
                      <td className="number-cell">{count}</td>
                      <td className="number-cell">{formatVnd(amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="report-box mt-4">
            <div className="label">Tổng doanh thu (tất cả ngày)</div>
            <div className="value">{formatVnd(totalRevenue)} VND</div>
          </div>
        </div>
      )}

      {activeReport === "byMonth" && (
        <div className="card">
          <h2>Doanh thu theo tháng</h2>
          <p className="text-sm text-ink-muted mb-4">Tổng doanh thu S1A theo từng tháng (số phiếu + tổng tiền).</p>
          {revenueByMonth.length === 0 ? (
            <p className="text-sm text-ink-muted">Chưa có phiếu S1A nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th className="number-cell">Số phiếu</th>
                    <th className="number-cell">Tổng doanh thu (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueByMonth.map(({ month, count, amount }) => (
                    <tr key={month}>
                      <td>Tháng {month.slice(5)}/{month.slice(0, 4)}</td>
                      <td className="number-cell">{count}</td>
                      <td className="number-cell">{formatVnd(amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="report-box mt-4">
            <div className="label">Tổng doanh thu (tất cả tháng)</div>
            <div className="value">{formatVnd(totalRevenue)} VND</div>
          </div>
        </div>
      )}

      {activeReport === "byGroup" && (
        <div className="card">
          <h2>Doanh thu theo nhóm hàng</h2>
          <p className="text-sm text-ink-muted mb-4">Tổng doanh thu S1A theo từng nhóm hàng hóa (đã bán).</p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Nhóm hàng hóa</th>
                  <th className="number-cell">Doanh thu đã bán (VND)</th>
                </tr>
              </thead>
              <tbody>
                {revenueByGroupList.map(({ id, name, sold }) => (
                  <tr key={id}>
                    <td>{name}</td>
                    <td className="number-cell">{formatVnd(sold)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="report-box mt-4">
            <div className="label">Tổng doanh thu (tất cả nhóm)</div>
            <div className="value">{formatVnd(totalRevenue)} VND</div>
          </div>
        </div>
      )}

      {activeReport === "vat" && (
        <div className="card">
          <h2>Hóa đơn VAT (đầu vào)</h2>
          <p className="text-sm text-ink-muted mb-4">
            Tổng hợp hóa đơn VAT đã nhập theo nhóm hàng và theo tháng — dùng để theo dõi biến động chi phí đầu vào.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-base font-semibold m-0 mb-2 text-brand-700">Theo nhóm hàng</h3>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Nhóm hàng</th>
                      <th className="number-cell">Số HĐ</th>
                      <th className="number-cell">Tổng tiền (VND)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatByGroup.map((g) => (
                      <tr key={g.id}>
                        <td>{g.name}</td>
                        <td className="number-cell">{g.count}</td>
                        <td className="number-cell">{formatVndExact(g.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold m-0 mb-2 text-brand-700">Theo tháng</h3>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Tháng</th>
                      <th className="number-cell">Số HĐ</th>
                      <th className="number-cell">Tổng tiền (VND)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatByMonth.map(({ month, count, amount }) => (
                      <tr key={month}>
                        <td>Tháng {month.slice(5)}/{month.slice(0, 4)}</td>
                        <td className="number-cell">{count}</td>
                        <td className="number-cell">{formatVndExact(amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="report-box mt-4">
            <div className="label">Tổng hóa đơn VAT đầu vào (tất cả kỳ)</div>
            <div className="value">{formatVndExact(vatTotal)} VND</div>
          </div>
          {vatInvoices?.length === 0 && (
            <p className="text-sm text-ink-muted mt-2">Chưa có hóa đơn VAT nào. Nhập tại mục Hóa đơn VAT.</p>
          )}
        </div>
      )}

      <div className="card">
        <h2>Nhóm S1A = Nhóm tồn kho đầu năm</h2>
        <p className="text-sm text-ink-muted">
          Các nhóm khi ghi phiếu S1A trùng với các nhóm đã khai báo ở tồn kho đầu năm. Số tiền bán được trừ trực tiếp vào đúng nhóm đó.
        </p>
        <ul className="mt-2 pl-5 text-sm text-ink-muted">
          {inventory.map((c) => (
            <li key={c.id}>{c.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
