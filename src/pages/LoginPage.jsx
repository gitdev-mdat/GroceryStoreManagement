import { useState } from 'react'
import { Eye, EyeOff, User, Lock, Mail, Check } from 'lucide-react'

// ── Hardcoded credentials ─────────────────────────────────────────────────────
const VALID_USERNAMES = ['admin', 'admin@gmail.com']
const VALID_PASSWORD  = '123456'

// ── Branding Panel — Left Side ────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between w-1/2 min-h-screen bg-[#1e3a5f] px-14 py-12 relative overflow-hidden">

      {/* Background geometric decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full border border-white/5" />
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full border border-white/5" />
        <div className="absolute top-1/3 -left-8  w-40 h-40 rounded-full border border-white/5" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border border-white/5" />
        <div className="absolute bottom-16 right-0 w-32 h-32 rounded-full bg-white/[0.03]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
      </div>

      {/* Logo */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white font-black text-lg shadow-lg">
            HK
          </div>
          <div>
            <div className="text-white font-bold text-xl tracking-tight">Hải Kiều</div>
            <div className="text-white/50 text-xs font-medium">Hộ kinh doanh</div>
          </div>
        </div>
        <p className="text-white/60 text-sm leading-relaxed max-w-xs mt-1">
          Hệ thống Quản lý Doanh thu & Sổ sách Hộ kinh doanh
        </p>
      </div>

      {/* Dashboard illustration */}
      <div className="relative z-10 flex-1 flex items-center justify-center py-10">
        <div className="w-full max-w-xs space-y-3">

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Tồn kho', value: '48.2M', sub: '+12%', color: 'text-emerald-400' },
              { label: 'Doanh thu', value: '32.7M', sub: 'Tháng 6', color: 'text-sky-300' },
            ].map((card) => (
              <div key={card.label} className="bg-white/10 rounded-xl p-3.5 border border-white/10">
                <div className="text-white/50 text-xs font-medium mb-1.5">{card.label}</div>
                <div className="text-white font-bold text-lg tabular-nums">
                  {card.value}<span className="text-xs font-normal ml-0.5">đ</span>
                </div>
                <div className={`text-xs font-semibold mt-1 ${card.color}`}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Mini table */}
          <div className="bg-white/8 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/10">
              <div className="text-white/40 text-xs font-semibold uppercase tracking-wide">Nhật ký hóa đơn</div>
            </div>
            {[
              { label: 'Hóa mỹ phẩm', value: '8.4M',  dot: 'bg-sky-400' },
              { label: 'Thực phẩm',   value: '14.2M', dot: 'bg-emerald-400' },
              { label: 'Gia dụng',    value: '5.9M',  dot: 'bg-violet-400' },
              { label: 'Tươi sống',   value: '9.7M',  dot: 'bg-amber-400' },
            ].map((row, i) => (
              <div key={row.label} className={`flex items-center justify-between px-4 py-2.5 ${i < 3 ? 'border-b border-white/5' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${row.dot}`} />
                  <span className="text-white/60 text-xs">{row.label}</span>
                </div>
                <span className="text-white/80 text-xs font-semibold tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Progress bars */}
          <div className="bg-white/8 rounded-xl border border-white/10 p-4 space-y-3">
            {[
              { label: 'Hoàn thành sổ sách',    pct: 78 },
              { label: 'Hóa đơn VAT đã nhập',   pct: 55 },
            ].map((bar) => (
              <div key={bar.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-white/50 text-xs">{bar.label}</span>
                  <span className="text-white/70 text-xs font-semibold">{bar.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-400" style={{ width: `${bar.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10">
        <p className="text-white/30 text-xs">© 2025 Hải Kiều · MST 051179002157</p>
      </div>
    </div>
  )
}

// ── Styled Input ──────────────────────────────────────────────────────────────
function FormInput({ id, label, type = 'text', value, onChange, placeholder, icon: Icon, rightEl, disabled }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icon size={16} />
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50/60
            text-sm text-slate-800 placeholder-slate-400
            outline-none transition-all duration-150
            hover:border-slate-300
            focus:bg-white focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10
            disabled:opacity-60 disabled:cursor-not-allowed
            ${Icon ? 'pl-10' : 'pl-4'} ${rightEl ? 'pr-12' : 'pr-4'} py-3`}
        />
        {rightEl && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</span>
        )}
      </div>
    </div>
  )
}

// ── Custom Checkbox ───────────────────────────────────────────────────────────
function Checkbox({ id, checked, onChange, label }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        id={id}
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-150 flex-shrink-0 ${
          checked ? 'bg-[#1e3a5f] border-[#1e3a5f]' : 'bg-white border-slate-300 hover:border-[#1e3a5f]'
        }`}
      >
        {checked && <Check size={10} strokeWidth={3} className="text-white" />}
      </button>
      <span className="text-sm text-slate-600">{label}</span>
    </label>
  )
}

// ── Error Alert ───────────────────────────────────────────────────────────────
function ErrorAlert({ message }) {
  if (!message) return null
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="font-medium">{message}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LoginPage({ onLogin }) {
  const [mode, setMode]             = useState('login')
  const [showPass, setShowPass]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [remember, setRemember]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName]     = useState('')

  const isLogin = mode === 'login'

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (isLogin) {
      // ── Hardcoded auth check — accepts "admin" OR "admin@gmail.com" ──
      if (VALID_USERNAMES.includes(email.trim()) && password === VALID_PASSWORD) {
        setLoading(true)
        setTimeout(() => {
          setLoading(false)
          if (onLogin) onLogin()
        }, 700)
      } else {
        setError('Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.')
      }
    } else {
      // Register: just simulate success
      if (!fullName.trim()) { setError('Vui lòng nhập họ và tên.'); return }
      if (!email.trim())    { setError('Vui lòng nhập email.');       return }
      if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return }
      if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return }
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        setMode('login')
        setError('')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setFullName('')
      }, 900)
    }
  }

  const switchMode = () => {
    setMode(isLogin ? 'register' : 'login')
    setError('')
    setEmail(''); setPassword(''); setConfirmPassword(''); setFullName('')
    setShowPass(false); setShowConfirm(false)
  }

  return (
    <div className="fixed inset-0 flex bg-white overflow-auto">

      {/* LEFT: Branding */}
      <BrandPanel />

      {/* RIGHT: Form */}
      <div className="flex-1 flex items-center justify-center min-h-screen bg-white px-5 py-12 lg:px-14 relative">

        {/* Mobile logo */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 lg:hidden flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1e3a5f] flex items-center justify-center text-white font-black text-sm">HK</div>
          <span className="font-bold text-[#1e3a5f] text-base">Hải Kiều</span>
        </div>

        <div className="w-full max-w-md pt-14 lg:pt-0">

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900 mb-1.5 tracking-tight">
              {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
            </h1>
            <p className="text-sm text-slate-500">
              {isLogin
                ? 'Nhập thông tin tài khoản để tiếp tục quản lý sổ sách.'
                : 'Điền thông tin để đăng ký tài khoản mới.'}
            </p>
          </div>

          {/* Error */}
          <div className="mb-4">
            <ErrorAlert message={error} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {!isLogin && (
              <FormInput id="fullname" label="Họ và tên" value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A" icon={User} disabled={loading} />
            )}

            <FormInput id="email" label="Tên đăng nhập / Email" type="text"
              value={email} onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder={isLogin ? 'admin hoặc admin@gmail.com' : 'email@example.com'}
              icon={isLogin ? User : Mail} disabled={loading} />

            <FormInput id="password" label="Mật khẩu"
              type={showPass ? 'text' : 'password'}
              value={password} onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="••••••••" icon={Lock} disabled={loading}
              rightEl={
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPass(v => !v)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                  aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              } />

            {!isLogin && (
              <FormInput id="confirm-password" label="Xác nhận mật khẩu"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" icon={Lock} disabled={loading}
                rightEl={
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowConfirm(v => !v)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                } />
            )}

            {isLogin && (
              <div className="flex items-center justify-between gap-2 pt-0.5 w-full min-w-0">
                <div className="flex-shrink-0">
                  <Checkbox id="remember" checked={remember} onChange={setRemember} label="Ghi nhớ đăng nhập" />
                </div>
                <button
                  type="button"
                  className="flex-shrink-0 text-sm font-semibold text-[#1e3a5f] hover:text-[#16304f] hover:underline underline-offset-2 transition-colors whitespace-nowrap"
                >
                  Quên mật khẩu?
                </button>
              </div>
            )}

            {!isLogin && (
              <p className="text-xs text-slate-400 pt-1 leading-relaxed">
                Bằng việc đăng ký, bạn đồng ý với{' '}
                <span className="text-[#1e3a5f] font-semibold cursor-pointer hover:underline underline-offset-2">Điều khoản sử dụng</span>
                {' '}và{' '}
                <span className="text-[#1e3a5f] font-semibold cursor-pointer hover:underline underline-offset-2">Chính sách bảo mật</span>.
              </p>
            )}

            {/* Hint for test account — login only */}
            {isLogin && (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 leading-relaxed">
                💡 Tài khoản thử:{' '}
                <span className="font-mono font-semibold text-slate-600">admin</span>
                {' '}hoặc{' '}
                <span className="font-mono font-semibold text-slate-600">admin@gmail.com</span>
                {' '}·{' '}
                mật khẩu:{' '}
                <span className="font-mono font-semibold text-slate-600">123456</span>
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl text-sm font-bold text-white bg-[#1e3a5f]
                hover:bg-[#16304f] active:bg-[#0f2340]
                transition-all duration-150 shadow-md
                disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white/70" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {isLogin ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...'}
                </>
              ) : (
                isLogin ? 'Đăng nhập' : 'Tạo tài khoản'
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">hoặc</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <p className="text-center text-sm text-slate-500">
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
            <button type="button" onClick={switchMode}
              className="font-bold text-[#1e3a5f] hover:text-[#16304f] hover:underline underline-offset-2 transition-colors">
              {isLogin ? 'Đăng ký ngay →' : '← Đăng nhập'}
            </button>
          </p>

          <p className="text-center text-xs text-slate-300 mt-8">
            © 2025 Hải Kiều · Hộ kinh doanh · MST 051179002157
          </p>
        </div>
      </div>
    </div>
  )
}
