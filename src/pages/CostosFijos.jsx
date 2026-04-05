import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

function fmt$(n) {
  return '$' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CostosFijos() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    anio: 2026,
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
  })
  const [guardado, setGuardado] = useState(false)
  const [toast, setToast] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    const { data } = await supabase.from('costos_fijos').select('*').eq('anio', 2026).single()
    if (data) {
      setForm({
        anio: data.anio,
        sueldo_piloto: data.sueldo_piloto,
        sueldo_botero: data.sueldo_botero,
        vacuna: data.vacuna,
        seguro_dron_anual: data.seguro_dron_anual,
        dep_dron_costo_total: data.dep_dron_costo_total,
        dep_dron_meses_vida_util: data.dep_dron_meses_vida_util,
        dep_baterias_costo_total: data.dep_baterias_costo_total,
        dep_baterias_vida_util_ciclos: data.dep_baterias_vida_util_ciclos,
        dep_generador_costo_total: data.dep_generador_costo_total,
        dep_generador_meses_vida_util: data.dep_generador_meses_vida_util,
      })
      setGuardado(true)
    }
    setCargando(false)
  }

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setGuardado(false)
  }

  const guardar = async () => {
    const payload = {
      anio: form.anio,
      sueldo_piloto: Number(form.sueldo_piloto),
      sueldo_botero: Number(form.sueldo_botero),
      vacuna: Number(form.vacuna),
      seguro_dron_anual: Number(form.seguro_dron_anual),
      dep_dron_costo_total: Number(form.dep_dron_costo_total),
      dep_dron_meses_vida_util: Number(form.dep_dron_meses_vida_util),
      dep_baterias_costo_total: Number(form.dep_baterias_costo_total),
      dep_baterias_vida_util_ciclos: Number(form.dep_baterias_vida_util_ciclos),
      dep_generador_costo_total: Number(form.dep_generador_costo_total),
      dep_generador_meses_vida_util: Number(form.dep_generador_meses_vida_util),
    }
    const { error } = await supabase.from('costos_fijos').upsert(payload, { onConflict: 'anio' })
    if (error) { showToast('Error al guardar.'); return }
    setGuardado(true)
    showToast('Configuración guardada.')
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const seguroMes = Number(form.seguro_dron_anual) / 12
  const depDron = Number(form.dep_dron_costo_total) / (Number(form.dep_dron_meses_vida_util) || 1)
  const depBatCiclo = Number(form.dep_baterias_costo_total) / (Number(form.dep_baterias_vida_util_ciclos) || 1)
  const depGen = Number(form.dep_generador_costo_total) / (Number(form.dep_generador_meses_vida_util) || 1)
  const totalFijoMes = Number(form.sueldo_piloto) + Number(form.sueldo_botero) + Number(form.vacuna) + seguroMes + depDron + depGen

  const inp = (key, extra = {}) => ({
    value: form[key],
    onChange: e => set(key, e.target.value),
    className: 'w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none transition-all',
    onFocus: e => e.target.style.borderColor = '#0D6CB0',
    onBlur: e => e.target.style.borderColor = '#e5e7eb',
    ...extra
  })

  if (cargando) return <Layout><div className="text-center py-16 text-sm text-gray-400">Cargando...</div></Layout>

  return (
    <Layout>
      <div className="max-w-2xl mx-auto pb-16">

        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">
              ← Volver al dashboard
            </button>
            <h1 className="text-2xl font-medium text-gray-900">Configuración de costos fijos</h1>
            <p className="text-sm text-gray-400 mt-1">Año 2026 — se aplican automáticamente cada mes</p>
          </div>
          <span className={`text-[11px] font-medium px-3 py-1 rounded-full ${guardado ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
            {guardado ? 'Guardado' : 'Con cambios'}
          </span>
        </div>

        {/* Resumen */}
        <div className="bg-gray-50 rounded-xl p-4 mb-5 grid grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Total fijo / mes</div>
            <div className="text-lg font-medium text-gray-900">{fmt$(totalFijoMes)}</div>
            <div className="text-xs text-gray-400">sin baterías</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Costo / ciclo batería</div>
            <div className="text-lg font-medium text-gray-900">{fmt$(depBatCiclo)}</div>
            <div className="text-xs text-gray-400">varía según uso</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Seguro mensual</div>
            <div className="text-lg font-medium text-gray-900">{fmt$(seguroMes)}</div>
            <div className="text-xs text-gray-400">anual ÷ 12</div>
          </div>
        </div>

        {/* Personal */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Personal</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Sueldo piloto</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" {...inp('sueldo_piloto')} className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div className="text-xs text-gray-400 mt-1">por mes</div>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Sueldo botero</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" {...inp('sueldo_botero')} className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div className="text-xs text-gray-400 mt-1">por mes</div>
            </div>
          </div>
        </div>

        {/* Seguros y otros */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Seguros y otros</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Seguro dron — total anual</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" {...inp('seguro_dron_anual')} className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div className="text-xs text-gray-400 mt-1">se divide ÷ 12 automáticamente → {fmt$(seguroMes)}/mes</div>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Vacuna</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" {...inp('vacuna')} className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div className="text-xs text-gray-400 mt-1">por mes</div>
            </div>
          </div>
        </div>

        {/* Depreciación dron */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Depreciación — Dron</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Costo total del dron</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" {...inp('dep_dron_costo_total')} className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Vida útil</label>
              <div className="relative">
                <input type="number" step="1" {...inp('dep_dron_meses_vida_util')} className="w-full h-10 px-3 pr-16 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">meses</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">→ {fmt$(depDron)}/mes</div>
            </div>
          </div>
        </div>

        {/* Depreciación baterías */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Depreciación — Baterías</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Costo total baterías</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" {...inp('dep_baterias_costo_total')} className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Vida útil en ciclos</label>
              <div className="relative">
                <input type="number" step="1" {...inp('dep_baterias_vida_util_ciclos')} className="w-full h-10 px-3 pr-16 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">ciclos</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">→ {fmt$(depBatCiclo)}/ciclo</div>
            </div>
          </div>
        </div>

        {/* Depreciación generador */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Depreciación — Generador</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Costo total generador</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" {...inp('dep_generador_costo_total')} className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
              <div className="text-xs text-gray-400 mt-1">$0 si no aplica</div>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Vida útil</label>
              <div className="relative">
                <input type="number" step="1" {...inp('dep_generador_meses_vida_util')} className="w-full h-10 px-3 pr-16 border border-gray-200 rounded-lg text-sm outline-none transition-all" onFocus={e => e.target.style.borderColor = '#0D6CB0'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">meses</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">→ {fmt$(depGen)}/mes</div>
            </div>
          </div>
        </div>

        {toast && (
          <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm mb-4"
            style={{ background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1e40af' }}>
            ✓ {toast}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={() => navigate('/dashboard')} className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={guardar}
            className="h-9 px-6 text-white text-sm font-medium rounded-lg transition-colors"
            style={{ background: '#0D6CB0' }}
            onMouseEnter={e => e.target.style.background = '#064979'}
            onMouseLeave={e => e.target.style.background = '#0D6CB0'}
          >
            Guardar configuración
          </button>
        </div>

      </div>
    </Layout>
  )
}