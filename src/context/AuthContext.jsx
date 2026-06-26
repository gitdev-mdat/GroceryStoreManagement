import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, getCurrentUser, signIn as supabaseSignIn, signOut as supabaseSignOut } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)         // { id, email, full_name, role, is_active }
  const [loading, setLoading] = useState(true)  // true while we restore session

  const doSignIn = useCallback(async (email, password) => {
    const result = await supabaseSignIn(email, password)
    if (result.error) return result
    // supabaseSignIn already calls getCurrentUser() which checks is_active
    setUser(result.data.user)
    return result
  }, [])

  const doSignOut = useCallback(async () => {
    await supabaseSignOut()
    setUser(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const result = await getCurrentUser()
    if (result && !result.error) {
      setUser(result)
    } else {
      setUser(null)
    }
    return result
  }, [])

  // ── Session restoration on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      const result = await getCurrentUser()

      if (cancelled) return

      if (result?.error) {
        setUser(null)
      } else if (result) {
        setUser(result)
      } else {
        setUser(null)
      }

      setLoading(false)
    }

    init()
    return () => { cancelled = true }
  }, [])

  // ── Listen for auth state changes (token refresh, sign-out, etc.) ────
  // supabase.auth.onAuthStateChange is the correct v2 API — no window hacks needed.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      // On any auth event (token refresh, sign-out, sign-in, etc.),
      // re-fetch the profile so the context always reflects the authoritative DB state.
      refreshProfile()
    })

    return () => subscription.unsubscribe()
  }, [refreshProfile])

  return (
    <AuthContext.Provider value={{ user, loading, signIn: doSignIn, signOut: doSignOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>.')
  }
  return ctx
}
