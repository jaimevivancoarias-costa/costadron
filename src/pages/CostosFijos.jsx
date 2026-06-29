import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

function fmt$(n) {
  return '$' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ZONA_CONFIG = {
  'Jambelí': {
    label: 'Jambelí — Dron 1',
    piloto: 'Ítalo Alcívar',
    color: '#eff6ff',
    border: '#bfdbfe',
    text: '#1e40af',
    campos: ['sueldo_piloto', 'sueldo_botero', 'vacuna', 'seguro_dron_anual',
      'dep_dron_costo_total', 'dep_dron_meses_vida_util',
      'dep_baterias_costo_total', 'dep_baterias_vida_util_ciclos',
      'dep_generador_costo_total', 'dep_generador_meses_vida_util']
  },
  'Puná': {
    label: 'Puná — Dron 2',
    piloto: 'Israel Villamil',
    color: '#f0fdf4',
    border: '#bbf7d0',
    text: '#166534',
    campos: ['sueldo_piloto', 'vacuna', 'seguro_dron_anual',
      'dep_dron_costo_total', 'dep_dron_meses_vida_util',
      'dep_baterias_costo_total', 'dep_baterias_vida_util_ciclos']
  }
}

const DEFAULTS = {
  sueldo_piloto: '',
  sueldo_botero: '',
  vacuna: '',
  seguro_dron_anual: '',
  dep_dron_costo_total: '',
  dep_dron_meses_vida_util: 36,
  dep_baterias_costo_total: '',
  dep_baterias_vida_util_ciclos: 4500,
  dep_generador_costo_total: '',
  dep_generador_meses_vida_util: 60,
}

export default function CostosFijos() {
  const navigate = useNavigate()
  const [forms, setForms] = useState({ 'Jambelí': { ...DEFAULTS }, 'Puná': { ...DEFAULTS } })
  const [guardado, setGuardado] = useState({ 'Jambelí': false, 'Puná': false })
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    const { data } = await supabase
      .from('costos_fijos_zona')
      .select('*')
      .eq('anio', 2026)
    if (data) {
      const nuevo = { 'Jambelí': { ...DEFAULTS }, 'Puná': { ...DEFAULTS } }
      data.forEach(row => {
        if (nuevo[row.zona]) {
          Object.keys(DEFAULTS).forEach(k => {
            if (row[k] !== undefined && row[k] !== null) nuevo[row.zona][k] = row[k]
          })
        }
      })
      setForms(nuevo)
      const g = {}
      ;['Jambelí', 'Puná'].forEach(z => {
        g[z] = data.some(r => r.zona === z)
      })
      setGuardado(g)
    }
    setCargando(false)
  }

  const set = (zona, k, v) => {
    setForms(f => ({ ...f, [zona]: { ...f[zona], [k]: v } }))
    setGuardado(g => ({ ...g, [zona]: false }))
  }

  const guardar = async (zona) => {
    const form = forms[zona]
    const payload = {
      anio: 2026,
      zona,
      sueldo_piloto: Number(form.sueldo_piloto) || 0,
      sueldo_botero: zona === 'Jambelí' ? Number(form.sueldo_botero) || 0 : 0,
      vacuna: Number(form.vacuna) || 0,
      seguro_dron_anual: Number(form.seguro_dron_anual) || 0,
      dep_dron_costo_total: Number(form.dep_dron_costo_total) || 0,
      dep_dron_meses_vida_util: Number(form.dep_dron_meses_vida_util) || 36,
      dep_baterias_costo_total: Number(form.dep_baterias_costo_total) || 0,
      dep_baterias_vida_util_ciclos: Number(form.dep_baterias_vida_util_ciclos) || 4500,
      dep_generador_costo_total: zona === 'Jambelí' ? Number(form.dep_generador_costo_total) || 0 : 0,
      dep_generador_meses_vida_util: zona === 'Jambelí' ? Number(form.dep_generador_meses_vida_util) || 60 : 60,
    }
    const { error } = await supabase
      .from('costos_fijos_zona')
      .upsert(payload, { onConflict: 'anio,zona' })
    if (error) { showToast('Error al guardar.'); return }
    setGuardado(g => ({ ...g, [zona]: true }))
    showToast(`Costos de ${zona} guardados.`)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const calcTotales = (zona) => {
    const f = forms[zona]
    const seguroMes = Number(f.seguro_dron_anual) / 12
    const depDron = Number(f.dep_dron_costo_total) / (Number(f.dep_dron_meses_vida_util) || 1)
    const depBatCiclo = Number(f.dep_baterias_costo_total) / (Number(f.dep_baterias_vida_util_ciclos) || 1)
    const depGen = zona === 'Jambelí'
      ? Number(f.dep_generador_costo_total) / (Number(f.dep_generador_meses_vida_util) || 1)
      : 0
    const totalFijoMes = Number(f.sueldo_piloto)
      + (zona === 'Jambelí' ? Number(f.sueldo_botero) : 0)
      + Number(f.vacuna) + seguroMes + depDron + depGen
    return { seguroMes, depDron, depBatCiclo, depGen, totalFijoMes }
  }

  const inp = (zona, key) => ({
    value: forms[zona][key],
    onChange: e => set(zona, key, e.target.value),
    className: 'w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none transition-all',
    onFocus: e => e.target.style.borderColor = '#0D6CB0',
    onBlur: e => e.target.style.borderColor = '#e5e7eb',
  })

  const inpDollar = (zona, key) => ({
    ...inp(zona, key),
    className: 'w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all',
  })

  if (cargando) return <Layout><div className="text-center py-16 text-sm text-gray-400">Cargando...</div></Layout>

  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-16">

        <div className="mb-6">
          <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">
            &larr; Volver al dashboard
          </button>
          <h1 className="text-2xl font-medium text-gray-900">Configuración de costos fijos</h1>
          <p className="text-sm text-gray-400 mt-1">Año 2026 — costos independientes por dron</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['Jambelí', 'Puná'].map(zona => {
            const cfg = ZONA_CONFIG[zona]
            const t = calcTotales(zona)
            return (
              <div key={zona} className="flex flex-col gap-4">

                {/* Header zona */}
                <div className="rounded-xl p-4 flex items-center justify-between"
                  style={{ background: cfg.color, border: `1px solid ${cfg.border}` }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: cfg.text }}>{cfg.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: cfg.text, opacity: 0.7 }}>Piloto: {cfg.piloto}</div>
                  </div>
                  <span className="text-[11px] font-medium px-3 py-1 rounded-full"
                    style={{
                      background: guardado[zona] ? '#dbeafe' : '#fef3c7',
                      color: guardado[zona] ? '#1e40af' : '#92400e'
                    }}>
                    {guardado[zona] ? 'Guardado' : 'Con cambios'}
                  </span>
                </div>

                {/* Resumen */}
                <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Total fijo/mes</div>
                    <div className="text-base font-medium text-gray-900">{fmt$(t.totalFijoMes)}</div>
                    <div className="text-xs text-gray-400">sin baterias</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Costo/ciclo bat.</div>
                    <div className="text-base font-medium text-gray-900">{fmt$(t.depBatCiclo)}</div>
                    <div className="text-xs text-gray-400">varia segun uso</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Seguro mensual</div>
                    <div className="text-base font-medium text-gray-900">{fmt$(t.seguroMes)}</div>
                    <div className="text-xs text-gray-400">anual / 12</div>
                  </div>
                </div>

                {/* Personal */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Personal</div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Sueldo piloto</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" step="0.01" {...inpDollar(zona, 'sueldo_piloto')} />
                      </div>
                    </div>
                    {zona === 'Jambelí' && (
                      <div>
                        <label className="block text-sm text-gray-500 mb-1.5">Sueldo botero</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input type="number" step="0.01" {...inpDollar(zona, 'sueldo_botero')} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Seguros */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Seguros y otros</div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Seguro dron — total anual</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" step="0.01" {...inpDollar(zona, 'seguro_dron_anual')} />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">-> {fmt$(t.seguroMes)}/mes</div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Vacuna</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" step="0.01" {...inpDollar(zona, 'vacuna')} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dep dron */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Depreciacion — Dron</div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Costo total del dron</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" step="0.01" {...inpDollar(zona, 'dep_dron_costo_total')} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Vida util (meses)</label>
                      <input type="number" step="1" {...inp(zona, 'dep_dron_meses_vida_util')} />
                      <div className="text-xs text-gray-400 mt-1">-> {fmt$(t.depDron)}/mes</div>
                    </div>
                  </div>
                </div>

                {/* Dep baterias */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Depreciacion — Baterias</div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Costo total baterias</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input type="number" step="0.01" {...inpDollar(zona, 'dep_baterias_costo_total')} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1.5">Vida util en ciclos</label>
                      <input type="number" step="1" {...inp(zona, 'dep_baterias_vida_util_ciclos')} />
                      <div className="text-xs text-gray-400 mt-1">-> {fmt$(t.depBatCiclo)}/ciclo</div>
                    </div>
                  </div>
                </div>

                {/* Dep generador — solo Jambeli */}
                {zona === 'Jambelí' && (
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Depreciacion — Generador</div>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-sm text-gray-500 mb-1.5">Costo total generador</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input type="number" step="0.01" {...inpDollar(zona, 'dep_generador_costo_total')} />
                        </div>
                        <div className="text-xs text-gray-400 mt-1">$0 si no aplica</div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1.5">Vida util (meses)</label>
                        <input type="number" step="1" {...inp(zona, 'dep_generador_meses_vida_util')} />
                        <div className="text-xs text-gray-400 mt-1">-> {fmt$(t.depGen)}/mes</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Boton guardar */}
                <button
                  onClick={() => guardar(zona)}
                  className="h-10 px-6 text-white text-sm font-medium rounded-lg transition-colors w-full"
                  style={{ background: '#0D6CB0' }}
                  onMouseEnter={e => e.target.style.background = '#064979'}
                  onMouseLeave={e => e.target.style.background = '#0D6CB0'}
                >
                  Guardar {zona}
                </button>

              </div>
            )
          })}
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm shadow-lg"
            style={{ background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1e40af' }}>
            checkmark {toast}
          </div>
        )}

      </div>
    </Layout>
  )
}
