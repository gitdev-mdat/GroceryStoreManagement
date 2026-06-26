import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import TonKhoDauNam from './pages/TonKhoDauNam'
import HoSoS1A from './pages/HoSoS1A'
import BaoCao from './pages/BaoCao'
import HoaDonVAT from './pages/HoaDonVAT'
import BangKeMuaVao from './pages/BangKeMuaVao'
import NhatKyHoaDon from './pages/NhatKyHoaDon'
import TraCuuGia from './pages/TraCuuGia'
import TongHopThang from './pages/TongHopThang'
import LoginPage from './pages/LoginPage'
import RoleGuard from './components/RoleGuard'
import AdminUsers from './pages/AdminUsers'

const NAV_GROUPS = [
  {
    label: 'Quản lý sổ sách',
    roles: ['ADMIN'],
    items: [
      { to: '/', end: true, label: 'Tồn kho đầu năm', icon: '📦', roles: ['ADMIN'] },
      { to: '/s1a', label: 'Hồ sơ S1A', icon: '📋', roles: ['ADMIN'] },
      { to: '/bang-ke-mua-vao', label: 'Bảng kê mua vào', icon: '🧾', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Chứng từ đầu vào',
    roles: ['ADMIN', 'STAFF'],
    items: [
      { to: '/hoa-don', label: 'Nhập hóa đơn', icon: '📄', roles: ['ADMIN', 'STAFF'] },
      { to: '/nhat-ky-hoa-don', label: 'Nhật ký hóa đơn', icon: '📒', roles: ['ADMIN', 'STAFF'] },
    ],
  },
  {
    label: 'Danh mục & tra cứu',
    roles: ['ADMIN', 'STAFF'],
    items: [
      { to: '/tra-cuu-gia', label: 'Tra cứu giá sản phẩm', icon: '🔍', roles: ['ADMIN', 'STAFF'] },
    ],
  },
  {
    label: 'Báo cáo thống kê',
    roles: ['ADMIN', 'STAFF'],
    items: [
      { to: '/bao-cao', label: 'Báo cáo biến động', icon: '📊', roles: ['ADMIN', 'STAFF'] },
      { to: '/tong-hop-thang', label: 'Tổng hợp mua vào', icon: '📅', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Hệ thống',
    roles: ['ADMIN'],
    items: [
      { to: '/admin/dashboard', label: 'Admin Dashboard', icon: '⚙️', roles: ['ADMIN'] },
      { to: '/admin/users', label: 'User Management', icon: '👥', roles: ['ADMIN'] },
    ],
  },
]

const SIDEBAR_KEY = 'hk-sidebar-collapsed'

// ── Full-screen loading indicator ──────────────────────────────────────────
function AuthLoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
          <span className="text-white font-black text-sm">HK</span>
        </div>
        <svg className="animate-spin w-5 h-5 text-[#1e3a5f]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="text-xs text-slate-400 font-medium">Đang khởi tạo...</span>
      </div>
    </div>
  )
}

// ── Main dashboard shell (only rendered when authenticated) ─────────────────
function Dashboard() {
  const { user, signOut } = useAuth()
  const userRole = user?.role ?? 'STAFF'

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

  const handleLogout = async () => {
    await signOut()
    setMobileOpen(false)
  }

  return (
    <AppProvider>
      <BrowserRouter>
        <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
          {mobileOpen && (
            <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
          )}

          <aside className={`app-sidebar${sidebarCollapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
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
              {NAV_GROUPS
                .filter(group => group.roles.includes(userRole))
                .map((group) => {
                  const allowedItems = group.items.filter(item => item.roles.includes(userRole))

                  if (allowedItems.length === 0) return null

                  return (
                    <div key={group.label} className="app-sidebar-group">
                      {!sidebarCollapsed && (
                        <div className="app-sidebar-group-label">{group.label}</div>
                      )}
                      {allowedItems.map(({ to, end, label, icon }) => (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          className={({ isActive }) =>
                            'app-sidebar-item' + (isActive ? ' active' : '')
                          }
                          title={sidebarCollapsed ? label : undefined}
                          onClick={() => setMobileOpen(false)}
                        >
                          <span className="app-sidebar-icon">{icon}</span>
                          {!sidebarCollapsed && (
                            <span className="app-sidebar-text">{label}</span>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )
                })}
            </nav>

            <div className="app-sidebar-footer flex flex-col gap-2">
              <div className="flex items-center gap-3 w-full bg-white/5 rounded-lg p-2 border border-white/10">
                <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white font-bold shrink-0">
                   {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold text-white truncate">{user?.full_name || 'Người dùng'}</span>
                    <span className="text-xs text-white/50">{user?.role === 'ADMIN' ? 'ADMIN' : 'STAFF'}</span>
                  </div>
                )}
              </div>

              {!sidebarCollapsed && (
                <div className="flex flex-col gap-1 mt-2">
                  <div className="app-sidebar-mst">MST: 051179002157</div>
                  <div className="app-sidebar-ver">v2025.1</div>
                </div>
              )}

              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất"
                className="sidebar-logout-btn mt-1"
              >
                <LogOut size={17} className="sidebar-logout-icon" />
                {!sidebarCollapsed && (
                  <span className="sidebar-logout-text">Đăng xuất</span>
                )}
              </button>

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
              <Route path="/" element={<RoleGuard roles={['ADMIN']} userRole={userRole}><TonKhoDauNam /></RoleGuard>} />
              <Route path="/s1a" element={<RoleGuard roles={['ADMIN']} userRole={userRole}><HoSoS1A /></RoleGuard>} />
              <Route path="/hoa-don" element={<RoleGuard roles={['ADMIN', 'STAFF']} userRole={userRole}><HoaDonVAT /></RoleGuard>} />
              <Route path="/nhat-ky-hoa-don" element={<RoleGuard roles={['ADMIN', 'STAFF']} userRole={userRole}><NhatKyHoaDon /></RoleGuard>} />
              <Route path="/bang-ke-mua-vao" element={<RoleGuard roles={['ADMIN']} userRole={userRole}><BangKeMuaVao /></RoleGuard>} />
              <Route path="/bao-cao" element={<RoleGuard roles={['ADMIN', 'STAFF']} userRole={userRole}><BaoCao /></RoleGuard>} />
              <Route path="/tra-cuu-gia" element={<RoleGuard roles={['ADMIN', 'STAFF']} userRole={userRole}><TraCuuGia /></RoleGuard>} />
              <Route path="/tong-hop-thang" element={<RoleGuard roles={['ADMIN']} userRole={userRole}><TongHopThang /></RoleGuard>} />
              <Route path="/admin/dashboard" element={<RoleGuard roles={['ADMIN']} userRole={userRole}><div style={{ padding: '2rem' }}>Admin Dashboard Placeholder</div></RoleGuard>} />
              <Route path="/admin/users" element={<RoleGuard roles={['ADMIN']} userRole={userRole}><AdminUsers /></RoleGuard>} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}

// ── Root component: handles auth state machine ───────────────────────────────
export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoadingScreen />

  if (!user) return <LoginPage />

  return <Dashboard />
}
