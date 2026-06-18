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
  const { inventory, setInventory } = useApp();
  const detailsRef = useRef(null);
  const summaryRef = useRef(null);
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

  const handleExportPDF = () => {
    setExportOpen(false);
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
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="page-topbar-new">
        <div className="page-topbar-text">
          <h1 className="page-title-new">Tồn kho đầu năm</h1>
          <p className="page-subtitle-new">
            Biên bản kiểm kê hàng tồn kho &nbsp;·&nbsp; Thời điểm: 00:00 ngày 01/01/2026
          </p>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="inventory-content">
        {/* ── Stat Hero ── */}
        <div className="stat-hero" ref={summaryRef}>
          <div className="stat-hero-inner">
            <div className="stat-hero-label">Tổng cộng giá trị tồn kho</div>
            <div className="stat-hero-value">{formatVnd(total)}</div>
            <div className="stat-hero-meta">
              <span className="stat-hero-date">Ngày 31 tháng 12 năm 2025</span>
              <button
                type="button"
                className="btn-details-toggle"
                onClick={toggleDetails}
              >
                {showDetails ? "Ẩn chi tiết" : "Xem chi tiết"}
              </button>
            </div>
          </div>
          <div className="stat-hero-actions">
            <div className="export-dropdown-wrap">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setExportOpen((v) => !v)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Xuất dữ liệu
              </button>
              {exportOpen && (
                <div className="export-dropdown">
                  <button type="button" className="export-item" onClick={handleExportPDF}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Xuất file PDF
                  </button>
                  <button type="button" className="export-item" onClick={handleExportExcel}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="3" y1="15" x2="21" y2="15" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                      <line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                    Xuất file Excel (XLSX)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Info Section ── */}
        <div className="info-section">
          <div className="info-block">
            <div className="info-block-header">Thông tin hộ kinh doanh</div>
            <div className="info-grid-2col">
              <div className="info-col">
                <div className="info-row">
                  <span className="info-row-label">Tên hộ kinh doanh</span>
                  <span className="info-row-value">Hộ Kinh Doanh Tạp hoá Hải Kiều</span>
                </div>
                <div className="info-row">
                  <span className="info-row-label">Mã số thuế</span>
                  <span className="info-row-value">051179002157</span>
                </div>
                <div className="info-row">
                  <span className="info-row-label">Địa chỉ</span>
                  <span className="info-row-value">Thôn 10, Xã Quảng Tín, Tỉnh Lâm Đồng, Việt Nam</span>
                </div>
              </div>
              <div className="info-col">
                <div className="info-row">
                  <span className="info-row-label">Trưởng ban kiểm kê</span>
                  <span className="info-row-value">Phạm Thị Thuý Kiều</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Details Table ── */}
        {showDetails && (
          <div className="details-section" ref={detailsRef}>
            <div className="section-header">
              <span className="section-title">Kết quả kiểm kê hàng hóa thực tế</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Nhóm hàng hóa</th>
                    <th>Đơn vị</th>
                    <th className="text-right">Số lượng</th>
                    <th className="text-right">Đơn giá bình quân (VND)</th>
                    <th className="text-right">Thành tiền (VND)</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((row, index) => (
                    <tr key={row.id}>
                      <td className="text-muted">{index + 1}</td>
                      <td className="font-medium">{row.name}</td>
                      <td>
                        <input
                          type="text"
                          value={row.unit ?? ""}
                          onChange={(e) => handleChange(row.id, "unit", e.target.value)}
                          className="input-inline"
                        />
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={row.quantity ?? ""}
                          onChange={(e) => handleChange(row.id, "quantity", e.target.value)}
                          className="input-inline input-inline--right"
                        />
                      </td>
                      <td className="text-right">
                        <VndInput
                          value={row.unitPrice ?? 0}
                          onChange={(num) => handleChange(row.id, "unitPrice", num)}
                          className="input-inline input-inline--right"
                        />
                      </td>
                      <td className="text-right font-medium text-muted">
                        {formatVnd((row.quantity ?? 0) * (row.unitPrice ?? 0))}
                      </td>
                      <td>
                        <textarea
                          value={row.note ?? ""}
                          onChange={(e) => handleChange(row.id, "note", e.target.value)}
                          className="input-inline input-inline--textarea"
                          rows={2}
                          placeholder="VD: Omo, dầu gội..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Signature (Print Only) ── */}
        <div className="signature-section print-only">
          <div className="signature-row">
            <div className="signature-date">Ngày 31 tháng 12 năm 2025</div>
            <div className="signature-block">
              <div className="signature-title">ĐẠI DIỆN HỘ KINH DOANH / CÁ NHÂN KINH DOANH</div>
              <div className="signature-note">(Ký, ghi rõ họ tên)</div>
              <div className="signature-name">Phạm Thị Thuý Kiều</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
