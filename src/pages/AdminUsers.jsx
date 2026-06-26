import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllProfiles, createEmployee, updateProfileAsAdmin, updateProfile } from '../lib/supabase'

// ── Helpers ──────────────────────────────────────────────────────────────────
function UserRow({ user, currentUserId, onEdit, onToggleActive }) {
  const isSelf = user.id === currentUserId
  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${!user.is_active ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${user.role === 'ADMIN' ? 'bg-[#1e3a5f]' : 'bg-slate-400'}`}>
            {user.full_name ? user.full_name.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{user.full_name || '(Không có tên)'}</div>
            {isSelf && <span className="text-[10px] text-sky-600 font-medium">Bạn</span>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 truncate max-w-[180px]">{user.email}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
          user.role === 'ADMIN'
            ? 'bg-[#1e3a5f]/10 text-[#1e3a5f]'
            : 'bg-slate-100 text-slate-500'
        }`}>
          {user.role === 'ADMIN' ? '⭐ ADMIN' : '👤 STAFF'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
          user.is_active
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
          {user.is_active ? 'Hoạt động' : 'Đã khóa'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {new Date(user.created_at).toLocaleDateString('vi-VN')}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          {/* Edit name / role */}
          <button
            type="button"
            onClick={() => onEdit(user)}
            title="Chỉnh sửa"
            className="w-7 h-7 rounded-lg hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-500"
          >
            ✏️
          </button>
          {/* Toggle active — disabled for self */}
          <button
            type="button"
            onClick={() => !isSelf && onToggleActive(user)}
            disabled={isSelf}
            title={isSelf ? 'Không thể tự khóa tài khoản' : (user.is_active ? 'Khóa tài khoản' : 'Mở khóa')}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isSelf
                ? 'opacity-30 cursor-not-allowed'
                : user.is_active
                  ? 'hover:bg-red-50 text-red-500'
                  : 'hover:bg-emerald-50 text-emerald-600'
            }`}
          >
            {user.is_active ? '🔒' : '🔓'}
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditUserModal({ user, onClose, onSave }) {
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [role, setRole] = useState(user.role)
  const [isActive, setIsActive] = useState(user.is_active)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isSelf = user.id === user.id // kept for clarity if self-check needed later

  const handleSave = async () => {
    setError('')
    setLoading(true)
    try {
      // Save name via own profile update (always allowed for self)
      if (fullName.trim() !== user.full_name) {
        const nameResult = await updateProfile({ full_name: fullName.trim() })
        if (nameResult?.error) { setError(nameResult.error.message); return }
      }
      // Save role / is_active via admin function
      if (role !== user.role || isActive !== user.is_active) {
        const adminResult = await updateProfileAsAdmin(user.id, { role, is_active: isActive })
        if (adminResult?.error) { setError(adminResult.error.message); return }
      }
      onSave()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-[#1e3a5f] px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-base">Chỉnh sửa nhân viên</h2>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">{error}</div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
            <div className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">{user.email}</div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Họ và tên</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20"
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Vai trò</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20 bg-white"
            >
              <option value="STAFF">👤 STAFF</option>
              <option value="ADMIN">⭐ ADMIN</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Trạng thái</label>
            <select
              value={String(isActive)}
              onChange={(e) => setIsActive(e.target.value === 'true')}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20 bg-white"
            >
              <option value="true">✅ Hoạt động</option>
              <option value="false">🔒 Đã khóa</option>
            </select>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Hủy
          </button>
          <button type="button" onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#16304f] transition-colors disabled:opacity-60">
            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Employee Modal ─────────────────────────────────────────────────────
function CreateEmployeeModal({ onClose, onCreated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('STAFF')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await createEmployee({ email, password, fullName, role })
      if (result?.error) { setError(result.error.message); return }
      onCreated()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-[#1e3a5f] px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-base">Tạo tài khoản nhân viên</h2>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">{error}</div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Họ và tên</label>
              <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20"
                placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20"
                placeholder="nv@example.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Mật khẩu</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20"
                placeholder="Tối thiểu 6 ký tự" minLength={6} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Vai trò</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20 bg-white">
                <option value="STAFF">👤 STAFF</option>
                <option value="ADMIN">⭐ ADMIN</option>
              </select>
            </div>
          </div>
          <div className="px-6 pb-5 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#16304f] transition-colors disabled:opacity-60">
              {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Confirm Toggle Modal ──────────────────────────────────────────────────────
function ConfirmToggleModal({ user, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  const isDeactivating = user.is_active
  const handleConfirm = async () => {
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false); onClose() }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-5">
          <div className="text-3xl mb-3">{isDeactivating ? '🔒' : '🔓'}</div>
          <h2 className="text-base font-bold text-slate-800 mb-1">
            {isDeactivating ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}
          </h2>
          <p className="text-sm text-slate-500">
            {isDeactivating
              ? `Tài khoản "${user.full_name || user.email}" sẽ bị khóa và không thể đăng nhập.`
              : `Tài khoản "${user.full_name || user.email}" sẽ được mở khóa và có thể đăng nhập.`}
          </p>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-60 ${isDeactivating ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            {loading ? '...' : isDeactivating ? 'Khóa' : 'Mở khóa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const { user: currentUser, refreshProfile } = useAuth()
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await getAllProfiles()
    if (result?.error) {
      setError(result.error.message)
    } else {
      setAllUsers(result.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Re-fetch own profile so role badge in nav stays current
  useEffect(() => { if (currentUser) refreshProfile() }, [currentUser, refreshProfile])

  const filtered = allUsers.filter((u) => {
    const q = search.toLowerCase()
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  const handleSave = () => { fetchUsers(); if (currentUser) refreshProfile() }

  const handleToggleActive = async () => {
    const result = await updateProfileAsAdmin(confirmTarget.id, { is_active: !confirmTarget.is_active })
    if (result?.error) { setError(result.error.message); return }
    fetchUsers()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Quản lý người dùng</h1>
          <p className="text-sm text-slate-400 mt-0.5">{allUsers.length} tài khoản</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#16304f] transition-colors shadow-sm"
        >
          <span>＋</span> Tạo nhân viên
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          ⚠️ <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc email..."
          className="w-full max-w-sm rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
            Đang tải...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-sm gap-1">
            <span className="text-2xl">🔍</span>
            <span>{search ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có tài khoản nào.'}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Người dùng</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Vai trò</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">Ngày tạo</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUserId={currentUser?.id}
                    onEdit={setEditTarget}
                    onToggleActive={setConfirmTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateEmployeeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => fetchUsers()}
        />
      )}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
        />
      )}
      {confirmTarget && (
        <ConfirmToggleModal
          user={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleToggleActive}
        />
      )}
    </div>
  )
}
