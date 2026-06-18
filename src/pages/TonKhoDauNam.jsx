import React, { useRef, useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { formatVnd, roundToThousands } from "../components/FormatNumber";
import VndInput from "../components/VndInput";

function buildXlsx(data) {
  const rows = [
    ["STT", "Nhóm hàng hóa", "Đơn vị", "Số lượng", "Đơn giá (VND)", "Thành tiền (VND)", "Ghi chú"],
  ];
  data.forEach((r, idx) => {
    rows.push([
      idx + 1,
      r.name ?? "",
      r.unit ?? "",
      Number(r.quantity ?? 0),
      Number(r.unitPrice ?? 0),
      Number((r.quantity ?? 0) * (r.unitPrice ?? 0)),
      r.note ?? "",
    ]);
  });
  rows.push([]);
  rows.push(["", "TỔNG CỘNG", "", "", "", totalFromRows(rows), ""]);

  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  return "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;base64,"
    + btoa(unescape(encodeURIComponent(csv)));
}

function totalFromRows(rows) {
  let s = 0;
  for (let i = 1; i < rows.length - 2; i++) s += Number(rows[i][5] || 0);
  return s;
}

export default function TonKhoDauNam() {
  const { inventory, setInventory, resetInventoryToDefault } = useApp();
  const printRef = useRef(null);
  const modalPrintRef = useRef(null);
  const detailsRef = useRef(null);
  const summaryRef = useRef(null);
  const [activeTab, setActiveTab] = useState("list");
  const [showDetails, setShowDetails] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const total = inventory.reduce(
    (sum, row) => sum + (row.quantity ?? 0) * (row.unitPrice ?? 0),
    0,
  );

  useEffect(() => {
    if (!showDetails) return;
    const onKey = (e) => { if (e.key === "Escape") setShowDetails(false) };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDetails]);

  useEffect(() => {
    if (!showDetails) return;
    const timer = setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(timer);
  }, [showDetails]);

  const toggleDetails = () => {
    setShowDetails((prev) => {
      if (prev) {
        setTimeout(() => {
          summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      }
      return !prev;
    });
  };

  const handleChange = (id, field, value) => {
    const next = inventory.map((row) => {
      if (row.id !== id) return row;
      if (field === "quantity") return { ...row, quantity: Number(value) || 0 };
      if (field === "unitPrice")
        return { ...row, unitPrice: roundToThousands(Number(value) || 0) };
      return { ...row, [field]: value };
    });
    setInventory(next);
  };

  const subTabs = [
    { id: "list", label: "Biên bản kiểm kê", icon: "📋" },
    { id: "reset", label: "Khôi phục số liệu", icon: "🔄" },
  ];

  const handleExportPDF = () => {
    setExportOpen(false);
    setTimeout(() => {
      const content = modalPrintRef.current || printRef.current;
      if (!content) return;
      const printWin = window.open("", "_blank", "width=1024,height=768");
      if (!printWin) return;
      printWin.document.write(`<!DOCTYPE html><html><head><title>Biên bản kiểm kê</title>
        <style>
          body{font-family:Arial,sans-serif;color:#111;padding:32px;}
          table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;}
          th,td{border:1px solid #222;padding:6px 8px;text-align:left;vertical-align:top;}
          th{background:#f5f5f5;font-weight:700;}
          .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
          h1{font-size:18px;text-transform:uppercase;text-align:center;margin:0 0 8px;}
          h2{font-size:15px;text-align:center;font-weight:600;margin:0 0 12px;}
          .meta{font-size:13px;margin-bottom:18px;}
          .sig{margin-top:32px;display:flex;justify-content:space-between;font-size:13px;}
        </style></head><body>`);
      printWin.document.write(content.innerHTML);
      printWin.document.write(`</body></html>`);
      printWin.document.close();
      setTimeout(() => printWin.print(), 300);
    }, 10);
  };

  const handleExportExcel = () => {
    setExportOpen(false);
    const a = document.createElement("a");
    a.href = buildXlsx(inventory);
    a.download = "Bien-ban-kiem-ke.xlsx";
    a.click();
  };

  return (
    <div className="page-shell">
      <div className="page-topbar">
        <div className="page-topbar-left">
          <h1 className="page-title">Tồn kho đầu năm</h1>
          <p className="page-subtitle">
            Biên bản kiểm kê hàng tồn kho · Thời điểm: 00:00 ngày 01/01/2026
          </p>
        </div>
        <nav className="page-tabs">
          {subTabs.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={`page-tab${activeTab === id ? " active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "list" && (
        <div className="card inventory-main-card">
          {/* ── Section 1 + 2: Mobile-first single column cards ── */}
          <div className="inventory-meta-section">
            <div className="info-card">
              <div className="info-card-title">
                <span className="info-card-icon" aria-hidden="true">🏪</span>
                <span>Thông tin hộ kinh doanh</span>
              </div>
              <div className="info-fields">
                <div className="info-field">
                  <span className="info-label">Tên hộ kinh doanh</span>
                  <span className="info-value">Hộ Kinh Doanh Tạp hoá Hải Kiều</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Mã số thuế</span>
                  <span className="info-value">051179002157</span>
                </div>
                <div className="info-field">
                  <span className="info-label">Địa chỉ</span>
                  <span className="info-value">Thôn 10, Xã Quảng Tín, Tỉnh Lâm Đồng, Việt Nam</span>
                </div>
              </div>
            </div>

            <div className="info-card">
              <div className="info-card-title">
                <span className="info-card-icon" aria-hidden="true">👥</span>
                <span>Ban kiểm kê thực tế</span>
              </div>
              <div className="info-fields">
                <div className="info-field">
                  <span className="info-label">Trưởng ban</span>
                  <span className="info-value">Phạm Thị Thuý Kiều</span>
                </div>
              </div>
            </div>
          </div>

          <div className="inventory-summary-section">
            <p className="inventory-summary-label">3. Kết quả kiểm kê hàng hóa thực tế</p>

            <div className="inventory-summary-card" ref={summaryRef}>
              <div className="inventory-summary-card-top">
                <div>
                  <p className="inventory-summary-tag">TỔNG CỘNG GIÁ TRỊ TỒN KHO</p>
                  <p className="inventory-summary-value">{formatVnd(total)}</p>
                  <p className="inventory-summary-date">Ngày 31 tháng 12 năm 2025</p>
                </div>
                <div className="inventory-summary-actions">
                  <button type="button" className="btn btn-ghost" onClick={toggleDetails}>
                    {showDetails ? "🙈 Ẩn chi tiết" : "👁 Xem chi tiết"}
                  </button>
                  <div className="export-menu">
                    <button type="button" className="btn btn-primary" onClick={() => setExportOpen((v) => !v)}>
                      ⬇ Xuất dữ liệu
                    </button>
                    {exportOpen && (
                      <div className="export-menu-dropdown">
                        <button type="button" className="export-menu-item" onClick={handleExportPDF}>
                          📄 Xuất file PDF
                        </button>
                        <button type="button" className="export-menu-item" onClick={handleExportExcel}>
                          📊 Xuất file Excel (XLSX)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showDetails && (
            <div className="inventory-details-wrap" ref={detailsRef}>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Nhóm hàng hóa</th>
                      <th>Đơn vị</th>
                      <th>Số lượng</th>
                      <th>Đơn giá bình quân (VND)</th>
                      <th>Thành tiền (VND)</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((row, index) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>
                        <td>{row.name}</td>
                        <td>
                          <input
                            type="text"
                            value={row.unit ?? ""}
                            onChange={(e) => handleChange(row.id, "unit", e.target.value)}
                            className="input-base !w-24"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={row.quantity ?? ""}
                            onChange={(e) => handleChange(row.id, "quantity", e.target.value)}
                            className="input-base !w-20 text-right"
                          />
                        </td>
                        <td className="number-cell">
                          <VndInput
                            value={row.unitPrice ?? 0}
                            onChange={(num) => handleChange(row.id, "unitPrice", num)}
                            className="!w-40"
                          />
                        </td>
                        <td className="number-cell">
                          {formatVnd((row.quantity ?? 0) * (row.unitPrice ?? 0))}
                        </td>
                        <td>
                          <textarea
                            value={row.note ?? ""}
                            onChange={(e) => handleChange(row.id, "note", e.target.value)}
                            className="input-base !min-w-[14rem] !max-w-[18rem] !py-1.5"
                            rows={2}
                            placeholder="Liệt kê vài mặt hàng đại diện (VD: Omo, dầu gội...)"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-between text-sm inventory-sig">
            <div>
              <p>Ngày 31 tháng 12 năm 2025</p>
            </div>
            <div className="text-right">
              <p><strong>ĐẠI DIỆN HỘ KINH DOANH / CÁ NHÂN KINH DOANH</strong></p>
              <p className="text-ink-muted">(Ký, ghi rõ họ tên)</p>
              <p className="mt-10"><strong>Phạm Thị Thuý Kiều</strong></p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "reset" && (
        <div className="card">
          <h2>Khôi phục số liệu</h2>
          <p className="text-sm text-ink-muted mb-3">
            Đang dùng số liệu cũ (Lẻ, 200, 2.000.000…)? Bấm nút bên dưới để chuyển sang <strong>bảng mặc định mới</strong> (phù hợp khoảng 250 triệu đồng tồn kho đầu năm).
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={resetInventoryToDefault}
          >
            Khôi phục số liệu mặc định theo biên bản kiểm kê
          </button>
        </div>
      )}
    </div>
  );
}
