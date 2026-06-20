import { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { LEGACY_GROUP_TO_INVENTORY_ID, DEFAULT_INVENTORY_CATEGORIES } from "../data/constants";
import { formatVnd, formatVndExact } from "../components/FormatNumber";
import { formatDateDisplay } from "../components/FormatDate";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const REPORT_TABS = [
  { id: "inventory", label: "Biến động tồn kho" },
  { id: "byDay",     label: "Doanh thu theo ngày" },
  { id: "byMonth",   label: "Doanh thu theo tháng" },
  { id: "byGroup",   label: "Doanh thu theo nhóm" },
  { id: "vat",       label: "Hóa đơn VAT đầu vào" },
];

// ── Mini icons ────────────────────────────────────────────────────────────────
const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

const IconEmptyClipboard = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 mx-auto mb-3">
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
)

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ message = 'Chưa có dữ liệu.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <IconEmptyClipboard />
      <p className="text-sm text-slate-400 font-medium">{message}</p>
    </div>
  )
}

// ── Shared: Premium Table Shell ───────────────────────────────────────────────
function TableShell({ children }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          {children}
        </table>
      </div>
    </div>
  )
}

function Thead({ children }) {
  return (
    <thead>
      <tr className="bg-slate-50 border-b border-slate-200">
        {children}
      </tr>
    </thead>
  )
}

const thBase  = "px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide"
const thLeft  = `${thBase} text-left`
const thRight = `${thBase} text-right`
const thCenter = `${thBase} text-center`

function Tbody({ children }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

function Tr({ children, idx = 0 }) {
  return (
    <tr className={`transition-colors hover:bg-blue-50/20 ${idx % 2 === 1 ? "bg-slate-50/30" : "bg-white"}`}>
      {children}
    </tr>
  )
}

const tdLeft   = "px-4 py-3.5 text-left text-slate-800 font-medium"
const tdRight  = "px-4 py-3.5 text-right tabular-nums"
const tdCenter = "px-4 py-3.5 text-center tabular-nums text-slate-600"

// ── Summary KPI Cards (4 boxes) ───────────────────────────────────────────────
function SummaryGrid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-5 lg:grid-cols-4">
      {items.map(({ label, value, color = "default" }) => (
        <div
          key={label}
          className="bg-white rounded-xl border border-slate-200 px-4 py-4 shadow-sm"
        >
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 leading-tight">
            {label}
          </div>
          <div className={`text-base font-bold tabular-nums leading-snug ${
            color === "blue"     ? "text-[#1e3a5f]"  :
            color === "red"      ? "text-red-700"    :
            color === "positive" ? "text-emerald-600" :
                                   "text-slate-800"
          }`}>
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Mobile Row Card (for inventory tab) ───────────────────────────────────────
function InventoryMobileCard({ name, initial, imported, sold, currentReal, idx }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm`}>
      <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100">
        <span className="font-bold text-slate-900 text-sm">{name}</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-400 font-medium mb-0.5">Tồn đầu kỳ</div>
          <div className="text-sm font-semibold text-slate-700 tabular-nums">{formatVndExact(initial)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium mb-0.5">Nhập trong năm</div>
          <div className="text-sm font-bold text-[#1e3a5f] tabular-nums">+ {formatVndExact(imported)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium mb-0.5">Đã bán (S1A)</div>
          <div className="text-sm font-semibold text-amber-700 tabular-nums">− {formatVndExact(sold)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium mb-0.5">Tồn hiện tại</div>
          <div className="text-sm font-bold text-slate-900 tabular-nums">{formatVndExact(currentReal)}</div>
        </div>
      </div>
    </div>
  )
}

// ── Generic Mobile Row Card ───────────────────────────────────────────────────
function SimpleMobileCard({ primary, secondary, amount, amountLabel = "Tổng tiền" }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="font-semibold text-slate-800 text-sm">{primary}</div>
          {secondary && <div className="text-xs text-slate-400 mt-0.5">{secondary}</div>}
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 mb-0.5">{amountLabel}</div>
          <div className="font-bold text-[#1e3a5f] text-sm tabular-nums">{amount}</div>
        </div>
      </div>
    </div>
  )
}

// ── INFO ALERT BOX ─────────────────────────────────────────────────────────────
function InfoAlert({ title, children }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-slate-50/80 border border-slate-100 px-4 py-3 mt-4">
      <span className="text-slate-300 mt-0.5"><IconInfo /></span>
      <div>
        {title && <p className="text-xs font-semibold text-slate-400 mb-0.5">{title}</p>}
        <div className="text-xs text-slate-400 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function BaoCao() {
  const { inventory, s2a, vatInvoices, freshFoodPurchases, freshFoodPurchasesDaily } = useApp();
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
        .select(`id, invoice_type, total_amount, price_history(products(group_key))`)
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
            if (rawGroup.includes('HÀNG HÓA TỔNG HỢP') || rawGroup.includes('THỰC PHẨM') || rawGroup.includes('ĐỒ UỐNG'))
              matchedGroup = 'Nhóm Thực phẩm đóng gói & Đồ uống';
            else if (rawGroup.includes('HÓA MỸ PHẨM') || rawGroup.includes('MỸ PHẨM') || rawGroup.includes('TẨY RỬA'))
              matchedGroup = 'Nhóm Hóa mỹ phẩm & Tẩy rửa';
            else if (rawGroup.includes('ĐỒ DÙNG') || rawGroup.includes('TIỆN ÍCH'))
              matchedGroup = 'Nhóm Đồ dùng gia đình & Tiện ích';
            else if (rawGroup.includes('TƯƠI SỐNG') || rawGroup.includes('TƯƠI'))
              matchedGroup = 'Nhóm hàng hóa tươi sống';
          }
          if (!matchedGroup) matchedGroup = 'Nhóm Thực phẩm đóng gói & Đồ uống';
          totals[matchedGroup] += amount;
        });
      }
      setNhapTrongNam(totals);
    } catch (err) {
      console.error('Loi fetchVatImports:', err.message);
    }
  };

  const fetchSalesData = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data, error } = await supabase.from('sales_tickets').select('group_key, total_amount');
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
    }
  };

  useEffect(() => { fetchVatImports(); }, [inventory]);
  useEffect(() => { fetchSalesData(); }, [inventory]);

  const { byCategory, totalRevenue, totalInitial, totalImport, totalCurrentReal } = useMemo(() => {
    const byCategory = {};
    (inventory || []).forEach((inv) => {
      byCategory[inv.id] = { name: inv.name, initial: (inv.quantity ?? 0) * (inv.unitPrice ?? 0), sold: 0, imported: 0 };
    });
    let totalInitial = 0, totalImport = 0, totalSold = 0, totalCurrentReal = 0;
    Object.keys(byCategory).forEach((id) => {
      const c = byCategory[id];
      const nhap = nhapTrongNam[c.name] || 0;
      const ban = daBanTrongNam[c.name] || 0;
      c.imported = nhap; c.sold = ban; c.currentReal = c.initial + nhap - ban;
      totalInitial += c.initial; totalImport += nhap; totalSold += ban; totalCurrentReal += c.currentReal;
    });
    return { byCategory, totalRevenue: totalSold, totalInitial, totalImport, totalCurrentReal };
  }, [inventory, nhapTrongNam, daBanTrongNam]);

  const { vatByGroup, vatByMonth, vatTotal } = useMemo(() => {
    const byGroup = {};
    const byMonth = {};
    let total = 0;
    inventory.forEach((inv) => { byGroup[inv.id] = { name: inv.name, count: 0, amount: 0 }; });
    (vatInvoices || []).forEach((inv) => {
      const amt = Number(inv.amount) || 0;
      total += amt;
      const gid = inv.groupKey || inventory[0]?.id;
      if (byGroup[gid]) { byGroup[gid].count += 1; byGroup[gid].amount += amt; }
      else byGroup[gid] = { name: inventory.find((c) => c.id === gid)?.name ?? gid, count: 1, amount: amt };
      const ym = (inv.date || "").slice(0, 7);
      if (ym) { if (!byMonth[ym]) byMonth[ym] = { count: 0, amount: 0 }; byMonth[ym].count += 1; byMonth[ym].amount += amt; }
    });
    return {
      vatByGroup: Object.entries(byGroup).map(([id, v]) => ({ id, ...v })),
      vatByMonth: Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([ym, v]) => ({ month: ym, ...v })),
      vatTotal: total,
    };
  }, [inventory, vatInvoices]);

  const revenueByDay = useMemo(() => {
    const byDate = {};
    (s2a || []).forEach((entry) => {
      const d = entry.date || ""; if (!d) return;
      if (!byDate[d]) byDate[d] = { count: 0, amount: 0 };
      byDate[d].count += 1; byDate[d].amount += Number(entry.amount) || 0;
    });
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([date, v]) => ({ date, ...v }));
  }, [s2a]);

  const revenueByMonth = useMemo(() => {
    const byMonth = {};
    (s2a || []).forEach((entry) => {
      const ym = (entry.date || "").slice(0, 7); if (!ym) return;
      if (!byMonth[ym]) byMonth[ym] = { count: 0, amount: 0 };
      byMonth[ym].count += 1; byMonth[ym].amount += Number(entry.amount) || 0;
    });
    return Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => ({ month, ...v }));
  }, [s2a]);

  const revenueByGroupList = useMemo(() => {
    return Object.entries(byCategory)
      .filter(([, c]) => (c.sold ?? 0) > 0 || (c.initial ?? 0) > 0)
      .map(([id, c]) => ({ id, name: c.name, sold: c.sold ?? 0 }))
      .sort((a, b) => b.sold - a.sold);
  }, [byCategory]);

  // ── KPI summary for inventory tab ──
  const totalNhap = Object.values(nhapTrongNam).reduce((s, v) => s + v, 0);
  const inventoryKPIs = [
    { label: "Tổng giá trị tồn đầu kỳ", value: `${formatVndExact(totalInitial)} đ`, color: "default" },
    { label: "Tổng nhập trong năm",      value: `${formatVndExact(totalNhap)} đ`,    color: "blue" },
    { label: "Tổng doanh thu đã ghi",    value: `− ${formatVndExact(totalRevenue)} đ`, color: "red" },
    { label: "Tồn kho thực hiện tại",    value: `${formatVndExact(totalCurrentReal)} đ`, color: "default" },
  ];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-brand-700 m-0 lg:text-2xl">Báo cáo biến động</h1>
      </div>

      {/* ── SEGMENTED TAB CONTROLLER ── */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex min-w-max border-b border-slate-200">
          {REPORT_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveReport(id)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-150 -mb-px ${
                activeReport === id
                  ? "border-[#1e3a5f] text-[#1e3a5f]"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ TAB: BIẾN ĐỘNG TỒN KHO ══ */}
      {activeReport === "inventory" && (
        <div className="card">

          {/* 1. KPI Summary — TOP of card */}
          <SummaryGrid items={inventoryKPIs} />

          {/* 2. Desktop Table */}
          <div className="hidden md:block">
            <TableShell>
              <Thead>
                <th className={thLeft}>Nhóm hàng hóa</th>
                <th className={thRight}>Tồn đầu kỳ (VND)</th>
                <th className={thRight}>Nhập trong năm (VND)</th>
                <th className={thRight}>Đã bán (VND)</th>
                <th className={thRight}>Tồn hiện tại thực (VND)</th>
              </Thead>
              <Tbody>
                {Object.entries(byCategory).map(([id, c], idx) => (
                  <Tr key={id} idx={idx}>
                    <td className={tdLeft}>{c.name}</td>
                    <td className={`${tdRight} text-slate-700`}>{formatVndExact(c.initial)}</td>
                    <td className={`${tdRight} font-semibold text-[#1e3a5f]`}>+ {formatVndExact(nhapTrongNam[c.name] || 0)}</td>
                    <td className={`${tdRight} font-semibold text-amber-700`}>− {formatVndExact(c.sold)}</td>
                    <td className={`${tdRight} font-bold text-slate-900`}>{formatVndExact(c.currentReal)}</td>
                  </Tr>
                ))}
              </Tbody>
            </TableShell>
          </div>

          {/* 2. Mobile Cards */}
          <div className="block md:hidden space-y-3">
            {Object.entries(byCategory).map(([id, c], idx) => (
              <InventoryMobileCard
                key={id}
                idx={idx}
                name={c.name}
                initial={c.initial}
                imported={nhapTrongNam[c.name] || 0}
                sold={c.sold}
                currentReal={c.currentReal}
              />
            ))}
          </div>

          {/* 3. Info note */}
          <InfoAlert title="Công thức tính">
            Tồn kho thực = Tồn đầu kỳ + Nhập trong năm (hóa đơn VAT đầu vào) − Đã bán (S1A theo nhóm).
          </InfoAlert>
        </div>
      )}

      {/* ══ TAB: DOANH THU THEO NGÀY ══ */}
      {activeReport === "byDay" && (
        <div className="card">
          {/* KPI */}
          <SummaryGrid items={[
            { label: "Tổng doanh thu (tất cả ngày)", value: `${formatVnd(totalRevenue)} đ`, color: "blue" },
            { label: "Số ngày có doanh thu",         value: `${revenueByDay.length} ngày`,   color: "default" },
            { label: "Tổng phiếu S1A",               value: `${revenueByDay.reduce((s, d) => s + d.count, 0)} phiếu`, color: "default" },
            { label: "TB mỗi ngày",                  value: revenueByDay.length > 0 ? `${formatVnd(Math.round(totalRevenue / revenueByDay.length))} đ` : "—", color: "default" },
          ]} />

          {revenueByDay.length === 0 ? (
            <EmptyState message="Chưa có phiếu S1A nào." />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <TableShell>
                  <Thead>
                    <th className={thLeft}>Ngày</th>
                    <th className={thCenter}>Số phiếu</th>
                    <th className={thRight}>Tổng doanh thu (VND)</th>
                  </Thead>
                  <Tbody>
                    {revenueByDay.map(({ date, count, amount }, idx) => (
                      <Tr key={date} idx={idx}>
                        <td className={tdLeft}>{formatDateDisplay(date)}</td>
                        <td className={tdCenter}>{count}</td>
                        <td className={`${tdRight} font-semibold text-slate-800`}>{formatVnd(amount)}</td>
                      </Tr>
                    ))}
                  </Tbody>
                </TableShell>
              </div>

              {/* Mobile */}
              <div className="block md:hidden space-y-3">
                {revenueByDay.map(({ date, count, amount }) => (
                  <SimpleMobileCard
                    key={date}
                    primary={formatDateDisplay(date)}
                    secondary={`${count} phiếu`}
                    amount={formatVnd(amount)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ TAB: DOANH THU THEO THÁNG ══ */}
      {activeReport === "byMonth" && (
        <div className="card">
          <SummaryGrid items={[
            { label: "Tổng doanh thu (tất cả tháng)", value: `${formatVnd(totalRevenue)} đ`, color: "blue" },
            { label: "Số tháng có doanh thu",          value: `${revenueByMonth.length} tháng`, color: "default" },
            { label: "Tổng phiếu S1A",                 value: `${revenueByMonth.reduce((s, m) => s + m.count, 0)} phiếu`, color: "default" },
            { label: "TB mỗi tháng",                   value: revenueByMonth.length > 0 ? `${formatVnd(Math.round(totalRevenue / revenueByMonth.length))} đ` : "—", color: "default" },
          ]} />

          {revenueByMonth.length === 0 ? (
            <EmptyState message="Chưa có phiếu S1A nào." />
          ) : (
            <>
              <div className="hidden md:block">
                <TableShell>
                  <Thead>
                    <th className={thLeft}>Tháng</th>
                    <th className={thCenter}>Số phiếu</th>
                    <th className={thRight}>Tổng doanh thu (VND)</th>
                  </Thead>
                  <Tbody>
                    {revenueByMonth.map(({ month, count, amount }, idx) => (
                      <Tr key={month} idx={idx}>
                        <td className={tdLeft}>Tháng {month.slice(5)}/{month.slice(0, 4)}</td>
                        <td className={tdCenter}>{count}</td>
                        <td className={`${tdRight} font-semibold text-slate-800`}>{formatVnd(amount)}</td>
                      </Tr>
                    ))}
                  </Tbody>
                </TableShell>
              </div>

              <div className="block md:hidden space-y-3">
                {revenueByMonth.map(({ month, count, amount }) => (
                  <SimpleMobileCard
                    key={month}
                    primary={`Tháng ${month.slice(5)}/${month.slice(0, 4)}`}
                    secondary={`${count} phiếu`}
                    amount={formatVnd(amount)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ TAB: DOANH THU THEO NHÓM ══ */}
      {activeReport === "byGroup" && (
        <div className="card">
          <SummaryGrid items={[
            { label: "Tổng doanh thu (tất cả nhóm)", value: `${formatVnd(totalRevenue)} đ`, color: "blue" },
            { label: "Số nhóm hàng có doanh thu",    value: `${revenueByGroupList.length} nhóm`, color: "default" },
            { label: "Nhóm doanh thu cao nhất",       value: revenueByGroupList[0]?.name?.split(' ').slice(0, 2).join(' ') || "—", color: "default" },
            { label: "—", value: "—", color: "default" },
          ]} />

          <div className="hidden md:block">
            <TableShell>
              <Thead>
                <th className={thLeft}>Nhóm hàng hóa</th>
                <th className={thRight}>Doanh thu đã bán (VND)</th>
              </Thead>
              <Tbody>
                {revenueByGroupList.map(({ id, name, sold }, idx) => (
                  <Tr key={id} idx={idx}>
                    <td className={tdLeft}>{name}</td>
                    <td className={`${tdRight} font-bold text-slate-800`}>{formatVnd(sold)}</td>
                  </Tr>
                ))}
              </Tbody>
            </TableShell>
          </div>

          <div className="block md:hidden space-y-3">
            {revenueByGroupList.map(({ id, name, sold }) => (
              <SimpleMobileCard key={id} primary={name} amount={formatVnd(sold)} />
            ))}
          </div>
        </div>
      )}

      {/* ══ TAB: HÓA ĐƠN VAT ĐẦU VÀO ══ */}
      {activeReport === "vat" && (
        <div className="card">
          <SummaryGrid items={[
            { label: "Tổng hóa đơn VAT đầu vào", value: `${formatVndExact(vatTotal)} đ`, color: "blue" },
            { label: "Số hóa đơn VAT",            value: `${vatInvoices?.length || 0} hóa đơn`, color: "default" },
            { label: "Số tháng có hóa đơn",       value: `${vatByMonth.length} tháng`, color: "default" },
            { label: "Số nhóm hàng",              value: `${vatByGroup.filter(g => g.amount > 0).length} nhóm`, color: "default" },
          ]} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* By Group */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Theo nhóm hàng</h3>
              <div className="hidden md:block">
                <TableShell>
                  <Thead>
                    <th className={thLeft}>Nhóm hàng</th>
                    <th className={thCenter}>Số HĐ</th>
                    <th className={thRight}>Tổng tiền (VND)</th>
                  </Thead>
                  <Tbody>
                    {vatByGroup.map((g, idx) => (
                      <Tr key={g.id} idx={idx}>
                        <td className={tdLeft}>{g.name}</td>
                        <td className={tdCenter}>{g.count}</td>
                        <td className={`${tdRight} font-semibold text-slate-800`}>{formatVndExact(g.amount)}</td>
                      </Tr>
                    ))}
                  </Tbody>
                </TableShell>
              </div>
              <div className="block md:hidden space-y-3">
                {vatByGroup.map((g) => (
                  <SimpleMobileCard key={g.id} primary={g.name} secondary={`${g.count} hóa đơn`} amount={formatVndExact(g.amount)} />
                ))}
              </div>
            </div>

            {/* By Month */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Theo tháng</h3>
              <div className="hidden md:block">
                <TableShell>
                  <Thead>
                    <th className={thLeft}>Tháng</th>
                    <th className={thCenter}>Số HĐ</th>
                    <th className={thRight}>Tổng tiền (VND)</th>
                  </Thead>
                  <Tbody>
                    {vatByMonth.map(({ month, count, amount }, idx) => (
                      <Tr key={month} idx={idx}>
                        <td className={tdLeft}>Tháng {month.slice(5)}/{month.slice(0, 4)}</td>
                        <td className={tdCenter}>{count}</td>
                        <td className={`${tdRight} font-semibold text-slate-800`}>{formatVndExact(amount)}</td>
                      </Tr>
                    ))}
                  </Tbody>
                </TableShell>
              </div>
              <div className="block md:hidden space-y-3">
                {vatByMonth.map(({ month, count, amount }) => (
                  <SimpleMobileCard
                    key={month}
                    primary={`Tháng ${month.slice(5)}/${month.slice(0, 4)}`}
                    secondary={`${count} hóa đơn`}
                    amount={formatVndExact(amount)}
                  />
                ))}
              </div>
            </div>
          </div>

          {vatInvoices?.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-sm">Chưa có hóa đơn VAT nào. Nhập tại mục Hóa đơn VAT.</div>
          )}
        </div>
      )}

      {/* ── INFO FOOTER — Nhóm S1A ── */}
      <InfoAlert title="Nhóm S1A = Nhóm tồn kho đầu năm">
        Các nhóm khi ghi phiếu S1A trùng với các nhóm đã khai báo ở tồn kho đầu năm. Số tiền bán được trừ trực tiếp vào đúng nhóm đó.
        {inventory.length > 0 && (
          <span className="block mt-1">
            Nhóm hiện tại: {inventory.map((c) => c.name).join(' · ')}
          </span>
        )}
      </InfoAlert>
    </div>
  );
}
