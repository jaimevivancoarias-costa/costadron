import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const MESES = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

const ZONA_STYLE = {
  'Jambelí': { tint: '#e6f1fb', avatar: '#0c447c', text: '#185fa5' },
  'Puná': { tint: '#eaf3de', avatar: '#27500a', text: '#3b6d11' },
}

function n1(x) { return (Math.round(x * 10) / 10).toFixed(1) }
function n2(x) { return (Math.round(x * 100) / 100).toFixed(2) }

function metricas(vuelos, jornadas, ha, kg) {
  return {
    vuelos, jornadas, ha, kg,
    vj: jornadas > 0 ? vuelos / jornadas : 0,
    haj: jornadas > 0 ? ha / jornadas : 0,
    hav: vuelos > 0 ? ha / vuelos : 0,
    dosis: ha > 0 ? kg / ha : 0,
  }
}

export default function Eficiencia() {
  const navigate = useNavigate()
  const [porMesPiloto, setPorMesPiloto] = useState({})
  const [meses, setMeses] = useState([])
  const [idx, setIdx] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setCargando(true)
    const [{ data: jornadas }, { data: usuarios }] = await Promise.all([
      supabase.from('jornadas').select('*'),
      supabase.from('usuarios').select('id, nombre, zona').eq('rol', 'piloto')
    ])
    const infoPiloto = {}
    ;(usuarios || []).forEach(u => { infoPiloto[u.id] = { nombre: u.nombre, zona: u.zona } })

    const acum = {}
    const setMesesRaw = {}
    ;(jornadas || []).forEach(j => {
      const d = new Date(j.fecha + 'T12:00:00')
      const anio = d.getFullYear(), mes = d.getMonth() + 1
      const key = `${anio}-${mes}`
      setMesesRaw[key] = { anio, mes }
      if (!acum[key]) acum[key] = {}
      if (!acum[key][j.piloto_id]) acum[key][j.piloto_id] = { vuelos: 0, jornadas: 0, ha: 0, kg: 0 }
      const a = acum[key][j.piloto_id]
      a.vuelos += Number(j.cantidad_vuelos || 0)
      a.jornadas += 1
      a.ha += Number(j.hectareas || 0)
      a.kg += Number(j.kg_esparcidos || 0)
    })

    const salida = {}
    Object.entries(acum).forEach(([key, pilotos]) => {
      salida[key] = {}
      Object.entries(pilotos).forEach(([pid, a]) => {
        const info = infoPiloto[pid] || { nombre: 'Piloto', zona: null }
        salida[key][pid] = { pid, nombre: info.nombre, zona: info.zona, m: metricas(a.vuelos, a.jornadas, a.ha, a.kg) }
      })
    })

    const listaMeses = Object.values(setMesesRaw).sort((x, y) => x.anio !== y.anio ? x.anio - y.anio : x.mes - y.mes)
    setPorMesPiloto(salida)
    setMeses(listaMeses)
    setIdx(listaMeses.length - 1)
    setCargando(false)
  }

  const periodo = idx !== null && meses.length > 0 ? meses[idx] : null
  const keyActual = periodo ? `${periodo.anio}-${periodo.mes}` : null
  const periodoPrev = idx !== null && idx > 0 ? meses[idx - 1] : null
  const keyPrev = periodoPrev ? `${periodoPrev.anio}-${periodoPrev.mes}` : null

  const pilotosMes = keyActual && porMesPiloto[keyActual]
    ? Object.values(porMesPiloto[keyActual]).filter(p => p.m.vuelos > 0)
      .sort((a, b) => (a.zona || '').localeCompare(b.zona || ''))
    : []
  const prevMap = keyPrev && porMesPiloto[keyPrev] ? porMesPiloto[keyPrev] : {}

  const mesLabel = periodo ? `${MESES[periodo.mes]} ${periodo.anio}` : ''
  const puedeAtras = idx !== null && idx > 0
  const puedeAdelante = idx !== null && idx < meses.length - 1

  const Tendencia = ({ actual, previo }) => {
    if (previo === undefined || previo === null || previo === 0) return null
    const diff = actual - previo
    if (Math.abs(diff) < 0.001) return <span style={{ fontSize: 11, color: '#9ca3af' }}>=</span>
    const pct = Math.round((diff / previo) * 100)
    const sube = diff > 0
    return (
      <span style={{ fontSize: 11, fontWeight: 500, color: sube ? '#3b6d11' : '#a32d2d' }}>
        {sube ? '▲' : '▼'} {Math.abs(pct)}%
      </span>
    )
  }

  const METRICAS = [
    { key: 'vj', label: 'Vuelos/jornada', fmt: n1 },
    { key: 'haj', label: 'Ha/jornada', fmt: n1 },
    { key: 'hav', label: 'Ha/vuelo', fmt: n2 },
  ]

  const lectura = () => {
    if (pilotosMes.length === 0) return []
    const lineas = []
    const lider = (metricaKey) => [...pilotosMes].sort((a, b) => b.m[metricaKey] - a.m[metricaKey])
    if (pilotosMes.length >= 2) {
      const vj = lider('vj')
      lineas.push({ icon: '⚡', color: '#3b6d11', titulo: 'Productividad',
        texto: `${vj[0].nombre} lidera en vuelos por día (${n1(vj[0].m.vj)} vs ${n1(vj[1].m.vj)}). Considera que cada zona tiene distinta cantidad de clientes y traslados.` })
      const hav = lider('hav')
      lineas.push({ icon: '◎', color: '#185fa5', titulo: 'Cobertura por vuelo',
        texto: `${hav[0].nombre} cubre más terreno por vuelo (${n2(hav[0].m.hav)} vs ${n2(hav[1].m.hav)} ha) — mejor aprovechamiento de batería y carga.` })
      const haj = lider('haj')
      lineas.push({ icon: '▦', color: '#3b6d11', titulo: 'Área por día',
        texto: `${haj[0].nombre} despacha más hectáreas por jornada (${n1(haj[0].m.haj)} vs ${n1(haj[1].m.haj)}).` })
    } else {
      const p = pilotosMes[0]
      lineas.push({ icon: '⚡', color: '#3b6d11', titulo: p.nombre,
        texto: `Promedió ${n1(p.m.vj)} vuelos por jornada, ${n1(p.m.haj)} ha por día y ${n2(p.m.hav)} ha por vuelo este mes.` })
    }
    return lineas
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-16">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">
              &larr; Volver al dashboard
            </button>
            <h1 className="text-2xl font-medium text-gray-900">Eficiencia de pilotos</h1>
            <p className="text-sm text-gray-400 mt-1">{mesLabel || 'Cargando...'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIdx(i => i - 1)} disabled={!puedeAtras}
              className="h-8 px-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              {puedeAtras ? `← ${MESES[meses[idx - 1].mes]}` : '←'}
            </button>
            <button onClick={() => setIdx(i => i + 1)} disabled={!puedeAdelante}
              className="h-8 px-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              {puedeAdelante ? `${MESES[meses[idx + 1].mes]} →` : '→'}
            </button>
          </div>
        </div>

        {cargando && <div className="text-center py-16 text-sm text-gray-400">Cargando datos...</div>}

        {!cargando && pilotosMes.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="text-gray-300 text-4xl mb-3">&#9675;</div>
            <div className="text-sm font-medium text-gray-500 mb-1">{mesLabel} — sin vuelos registrados</div>
            <div className="text-xs text-gray-400">No hay jornadas de pilotos este mes.</div>
          </div>
        )}

        {!cargando && pilotosMes.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {pilotosMes.map(p => {
                const st = ZONA_STYLE[p.zona] || { tint: '#f1f5f9', avatar: '#475569', text: '#64748b' }
                const prev = prevMap[p.pid]?.m
                return (
                  <div key={p.pid} className="bg-white border border-gray-100 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{ background: st.tint, color: st.avatar }}>
                        {p.nombre?.[0] || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{p.nombre}</div>
                        {p.zona && <div className="text-xs" style={{ color: st.text }}>{p.zona}</div>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {METRICAS.map(mt => (
                        <div key={mt.key}>
                          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{mt.label}</div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-medium text-gray-900">{mt.fmt(p.m[mt.key])}</span>
                            <Tendencia actual={p.m[mt.key]} previo={prev ? prev[mt.key] : null} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400">Dosis (KG/ha) · informativo</span>
                      <span className="text-sm text-gray-500">{n1(p.m.dosis)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-gray-50 rounded-xl p-5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-3">Lectura del mes</div>
              <div className="flex flex-col gap-3">
                {lectura().map((l, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-sm" style={{ color: l.color, marginTop: 1 }}>{l.icon}</span>
                    <div className="text-xs text-gray-600 leading-relaxed">
                      <span className="font-medium text-gray-800">{l.titulo}:</span> {l.texto}
                    </div>
                  </div>
                ))}
              </div>
              {periodoPrev && (
                <div className="mt-3 pt-3 border-t border-gray-200 text-[11px] text-gray-400 leading-relaxed">
                  Las flechas ▲▼ comparan contra {MESES[periodoPrev.mes]} {periodoPrev.anio}. La comparación entre zonas es referencial — lo más justo es medir a cada piloto contra su propio histórico.
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </Layout>
  )
}
