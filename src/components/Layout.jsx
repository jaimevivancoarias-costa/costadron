import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { usuario, signOut } = useAuth()

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div style={{ background: '#022847' }}>
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              
                href="https://costamarket-hub.vercel.app"
                style={{ color: '#7BB6FD', fontSize: '11px' }}
              >
                &larr; Hub
              </a>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#7BB6FD' }}>
                COSTADRON
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium`}
                  style={{ background: usuario?.rol === 'jefe' ? '#0D6CB0' : '#064979', color: '#C6DBFE' }}>
                  {usuario?.nombre?.[0] || '?'}
                </div>
                <span className="text-sm" style={{ color: '#C6DBFE' }}>{usuario?.nombre}</span>
              </div>
              <button
                onClick={signOut}
                className="text-xs transition-colors"
                style={{ color: '#7BB6FD' }}
                onMouseEnter={e => e.target.style.color = '#C6DBFE'}
                onMouseLeave={e => e.target.style.color = '#7BB6FD'}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  )
}
