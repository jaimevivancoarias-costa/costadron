import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [usuario, setUsuario] = useState(undefined)

  useEffect(() => {
    let subscription

    const init = async () => {
      // 1) Si venimos del Hub con tokens en la URL, aplicar la sesion PRIMERO
      const params = new URLSearchParams(window.location.search)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        window.history.replaceState({}, '', window.location.pathname)
      }

      // 2) Recien ahora leer la sesion (ya establecida por el Hub o por un login previo)
      const { data } = await supabase.auth.getSession()
      setSession(data.session ?? null)
      if (!data.session) setUsuario(null)

      // 3) Y por ultimo suscribirse a cambios de sesion
      const sub = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s ?? null)
        if (!s) setUsuario(null)
      })
      subscription = sub.data.subscription
    }

    init()
    return () => { if (subscription) subscription.unsubscribe() }
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
