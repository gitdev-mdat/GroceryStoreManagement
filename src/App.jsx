import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AppProvider } from './context/AppContext'
import TonKhoDauNam from './pages/TonKhoDauNam'
import HoSoS1A from './pages/HoSoS1A'
import BaoCao from './pages/BaoCao'
import HoaDonVAT from './pages/HoaDonVAT'
import BangKeMuaVao from './pages/BangKeMuaVao'
import NhatKyHoaDon from './pages/NhatKyHoaDon'
import TraCuuGia from './pages/TraCuuGia'
import TongHopThang from './pages/TongHopThang'
import LoginPage from './pages/LoginPage'

const NAV_GROUPS = [
  {
    label: 'Quản lý sổ sách',
    items: [
      { to: '/', end: true, label: 'Tồn kho đầu năm', icon: '' },
      { to: '/s1a', label: 'Hồ sơ S1A', icon: '' },
      { to: '/bang-ke-mua-vao', label: 'Bảng kê mua vào', icon: '' },
    ],
  },
  {
    label: 'Chứng từ đầu vào',
    items: [
      { to: '/hoa-don', label: 'Nhập hóa đơn', icon: '' },
      { to: '/nhat-ky-hoa-don', label: 'Nhật ký hóa đơn', icon: '' },
    ],
  },
  {
    label: 'Danh mục & tra cứu',
    items: [
      { to: '/tra-cuu-gia', label: 'Tra cứu giá sản phẩm', icon: '' },
    ],
  },
  {
    label: 'Báo cáo thống kê',
    items: [
      { to: '/bao-cao', label: 'Báo cáo biến động', icon: '' },
      { to: '/tong-hop-thang', label: 'Tổng hợp mua vào', icon: '' },
    ],
  },
]

const SIDEBAR_KEY = 'hk-sidebar-collapsed'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1' } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [])

  const toggleCollapse = () => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0') } catch {}
  }

  return (
    <AppProvider>
      <BrowserRouter>
        <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
          {mobileOpen && (
            <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
          )}

          <aside className={`app-sidebar${sidebarCollapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
            {/* Sidebar Header */}
            <div className="app-sidebar-header">
              <div className="flex items-center gap-3">
                <div className="app-sidebar-logo-mark">HK</div>
                {!sidebarCollapsed && (
                  <div>
                    <div className="app-sidebar-logo-name">Hải Kiều</div>
                    <div className="app-sidebar-logo-sub">Sổ Doanh thu</div>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Collapse Toggle Button */}
            <button
              type="button"
              className="sidebar-toggle-btn desktop-only"
              onClick={toggleCollapse}
              title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              {sidebarCollapsed ? '▶' : '◀'}
            </button>

            <nav className="app-sidebar-nav">
              {!sidebarCollapsed && (
                <div className="app-sidebar-section-label">Menu</div>
              )}
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="app-sidebar-group">
                  {!sidebarCollapsed && (
                    <div className="app-sidebar-group-label">{group.label}</div>
                  )}
                  {group.items.map(({ to, end, label, icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        'app-sidebar-item' + (isActive ? ' active' : '')
                      }
                      title={sidebarCollapsed ? label : undefined}
                    >
                      <span className="app-sidebar-icon">{icon}</span>
                      {!sidebarCollapsed && (
                        <span className="app-sidebar-text">{label}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>

            <div className="app-sidebar-footer">
              {!sidebarCollapsed && (
                <>
                  <div className="app-sidebar-mst">MST: 051179002157</div>
                  <div className="app-sidebar-ver">v2025.1</div>
                </>
              )}

              <button
                type="button"
                className="sidebar-mobile-close-btn mobile-only"
                onClick={() => setMobileOpen(false)}
                title="Đóng menu"
              >
                ✕
              </button>
            </div>
          </aside>

          <div className="app-body">
            <div className="mobile-topbar">
              <button
                type="button"
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(true)}
                aria-label="Mở menu"
              >
                ☰
              </button>
            </div>

            <Routes>
              <Route path="/" element={<TonKhoDauNam />} />
              <Route path="/s1a" element={<HoSoS1A />} />
              <Route path="/hoa-don" element={<HoaDonVAT />} />
              <Route path="/nhat-ky-hoa-don" element={<NhatKyHoaDon />} />
              <Route path="/bang-ke-mua-vao" element={<BangKeMuaVao />} />
              <Route path="/bao-cao" element={<BaoCao />} />
              <Route path="/tra-cuu-gia" element={<TraCuuGia />} />
              <Route path="/tong-hop-thang" element={<TongHopThang />} />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}
