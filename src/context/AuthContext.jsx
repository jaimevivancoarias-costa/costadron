import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [usuario, setUsuario] = useState(undefined)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

if (accessToken && refreshToken) {
  supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    .then(({ data }) => {
      if (data.session) {
        setSession(data.session)
        window.history.replaceState({}, '', window.location.pathname)
      } else {
        setUsuario(null)
      }
    })

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
    setSession(s)
    if (!s) setUsuario(null)
  })

  return () => subscription.unsubscribe()
}

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setUsuario(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) setUsuario(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setUsuario(null); return }

    supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setUsuario(data ?? null))
  }, [session])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, usuario, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
