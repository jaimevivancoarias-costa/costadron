import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await signIn(email, password)
    if (error) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }
    const { data: usr } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', data.session.user.id)
      .single()
    if (usr?.rol === 'piloto') {
      window.location.href = '/jornada'
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(160deg, #022847 0%, #064979 50%, #0D6CB0 100%)' }}>

      <div className="mb-8 flex flex-col items-center">
        <div className="bg-white rounded-2xl px-6 py-4 mb-4 shadow-lg">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CostaMarket" className="h-12 w-auto" />
            <div>
              <div className="text-xs font-medium tracking-widest uppercase" style={{ color: '#064979' }}>COSTADRON</div>
              <div className="text-[10px] tracking-wide" style={{ color: '#7BB6FD' }}>by CostaMarket S.A.</div>
            </div>
          </div>
        </div>
        <div className="text-white/70 text-sm">Operación dron agrícola · El Oro</div>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-xl">

        {error && (
          <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1.5">Correo electrónico</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nombre@costadron.ec"
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none transition-all"
              onFocus={e => e.target.style.borderColor = '#0D6CB0'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1.5">Contraseña</label>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none transition-all"
              onFocus={e => e.target.style.borderColor = '#0D6CB0'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full h-10 text-white text-sm font-medium rounded-lg transition-all mt-2 disabled:opacity-60"
            style={{ background: loading ? '#7BB6FD' : '#0D6CB0' }}
            onMouseEnter={e => !loading && (e.target.style.background = '#064979')}
            onMouseLeave={e => !loading && (e.target.style.background = '#0D6CB0')}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100">
          <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-3">Acceso según rol</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 border border-gray-100 rounded-lg" style={{ background: '#f8fafc' }}>
              <div className="text-xs font-medium text-gray-700">Piloto</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Registro de jornadas</div>
            </div>
            <div className="p-2.5 border border-gray-100 rounded-lg" style={{ background: '#f8fafc' }}>
              <div className="text-xs font-medium text-gray-700">Jefe</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Dashboard y reportes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 text-white/40 text-xs">© 2026 CostaMarket S.A.</div>
    </div>
  )
}
