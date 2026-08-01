import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

const REQUIRED = ['fecha', 'cliente_id', 'cantidad_vuelos', 'kg_esparcidos', 'hectareas']

const MESES = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

const keyMes = (anio, mes) => `${anio}-${mes}`

export default function FormularioJornada() {
  const { usuario } = useAuth()
  const [clientes, setClientes] = useState([])
  const [todas, setTodas] = useState([])
  const [meses, setMeses] = useState([])
  const [idx, setIdx] = useState(null)
  const [cerrados, setCerrados] = useState(new Set())
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState('')
  const [toastWarn, setToastWarn] = useState('')
  const [errors, setErrors] = useState({})

  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    fecha: hoy, cliente_id: '', cantidad_vuelos: '',
    minutos_volados: '', cargas_baterias: '',
    kg_esparcidos: '', sacos_aplicados: '', hectareas: ''
  })

  useEffect(() => {
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setClientes(data || []))
    cargarTodo()
  }, [])

  const cargarTodo = async () => {
    const [{ data: js }, { data: cerr }] = await Promise.all([
      supabase.from('jornadas').select('*, clientes(nombre)')
        .eq('piloto_id', usuario.id).order('fecha', { ascending: false }),
      supabase.from('costos_variables_mes_zona').select('anio, mes, cerrado').eq('cerrado', true)
    ])
    const lista = js || []
    setTodas(lista)

    const setCerr = new Set((cerr || []).map(c => keyMes(c.anio, c.mes)))
    setCerrados(setCerr)

    const unicos = {}
    lista.forEach(j => {
      const d = new Date(j.fecha + 'T12:00:00')
      unicos[keyMes(d.getFullYear(), d.getMonth() + 1)] = { anio: d.getFullYear(), mes: d.getMonth() + 1 }
    })
    const now = new Date()
    unicos[keyMes(now.getFullYear(), now.getMonth() + 1)] = { anio: now.getFullYear(), mes: now.getMonth() + 1 }
    const listaMeses = Object.values(unicos).sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
    setMeses(listaMeses)
    setIdx(prev => (prev === null ? listaMeses.length - 1 : prev))
  }

  const periodo = idx !== null && meses.length > 0 ? meses[idx] : null
  const mesCerrado = periodo ? cerrados.has(keyMes(periodo.anio, periodo.mes)) : false
  const jornadas = periodo
    ? todas.filter(j => {
        const d = new Date(j.fecha + 'T12:00:00')
        return d.getFullYear() === periodo.anio && d.getMonth() + 1 === periodo.mes
      })
    : []

  const mesLabel = periodo ? `${MESES[periodo.mes]} ${periodo.anio}` : ''
  const puedeAtras = idx !== null && idx > 0
  const puedeAdelante = idx !== null && idx < meses.length - 1

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mesDeFecha = (fechaStr) => {
    const d = new Date(fechaStr + 'T12:00:00')
    return keyMes(d.getFullYear(), d.getMonth() + 1)
  }

  const validate = () => {
    const e = {}
    REQUIRED.forEach(k => { if (!form[k]) e[k] = true })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validate()) return

    if (Number(form.hectareas) <= 0) {
      setErrors(e => ({ ...e, hectareas: true }))
      showToast('Las hectáreas deben ser mayor a 0.')
      return
    }

    if (cerrados.has(mesDeFecha(form.fecha))) {
      showToast('Ese mes está cerrado. Pídele al jefe que lo reabra para corregir.')
      return
    }

    const { data: existente } = await supabase
      .from('jornadas')
      .select('id')
      .eq('fecha', form.fecha)
      .eq('cliente_id', form.cliente_id)
      .neq('id', editId || '00000000-0000-0000-0000-000000000000')
      .single()

    if (existente) {
      setToastWarn('Ya existe una jornada para este cliente en esta fecha. ¿Querés guardar de todas formas?')
      return
    }

    await ejecutarGuardar()
  }

  const ejecutarGuardar = async () => {
    setToastWarn('')
    const payload = {
      fecha: form.fecha,
      cliente_id: form.cliente_id,
      piloto_id: usuario.id,
      cantidad_vuelos: Number(form.cantidad_vuelos),
      minutos_volados: Number(form.minutos_volados) || 0,
      cargas_baterias: Number(form.cargas_baterias) || 0,
      kg_esparcidos: Number(form.kg_esparcidos),
      sacos_aplicados: Number(form.sacos_aplicados) || null,
      hectareas: Number(form.hectareas),
    }

    let error
    if (editId) {
      ({ error } = await supabase.from('jornadas').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('jornadas').insert(payload))
    }

    if (error) { showToast('Error al guardar.'); return }
    showToast(editId ? 'Jornada actualizada.' : 'Jornada guardada.')
    limpiar()
    cargarTodo()
  }

  const editar = (j) => {
    setEditId(j.id)
    setForm({
      fecha: j.fecha, cliente_id: j.cliente_id,
      cantidad_vuelos: j.cantidad_vuelos, minutos_volados: j.minutos_volados,
      cargas_baterias: j.cargas_baterias, kg_esparcidos: j.kg_esparcidos,
      sacos_aplicados: j.sacos_aplicados || '', hectareas: j.hectareas
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const eliminar = async (id) => {
    await supabase.from('jornadas').delete().eq('id', id)
    if (editId === id) limpiar()
    cargarTodo()
  }

  const limpiar = () => {
    setForm({ fecha: hoy, cliente_id: '', cantidad_vuelos: '', minutos_volados: '', cargas_baterias: '', kg_esparcidos: '', sacos_aplicados: '', hectareas: '' })
    setEditId(null)
    setErrors({})
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const minHa = form.minutos_volados && form.hectareas
    ? (Number(form.minutos_volados) / Number(form.hectareas)).toFixed(2)
    : null

  const totVuelos = jornadas.reduce((s, j) => s + j.cantidad_vuelos, 0)
  const totHa = jornadas.reduce((s, j) => s + Number(j.hectareas || 0), 0)
  const totKg = jornadas.reduce((s, j) => s + Number(j.kg_esparcidos || 0), 0)

  const inp = (key, extra = {}) => ({
    value: form[key],
    onChange: e => set(key, e.target.value),
    className: `w-full h-10 px-3 border rounded-lg text-sm outline-none transition-all ${errors[key] ? 'border-red-400' : 'border-gray-200'}`,
    onFocus: e => { if (!errors[key]) e.target.style.borderColor = '#0D6CB0' },
    onBlur: e => { if (!errors[key]) e.target.style.borderColor = '#e5e7eb' },
    ...extra
  })

  return (
    <Layout>
      <div className="max-w-2xl mx-auto pb-16">
        <h1 className="text-2xl font-medium text-gray-900 mb-1">Registrar jornada</h1>
        <p className="text-sm text-gray-400 mb-6">
          Campos con <span style={{ color: '#0D6CB0' }}>*</span> son obligatorios.
        </p>

        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Identificación</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Fecha <span style={{ color: '#0D6CB0' }}>*</span></label>
              <input type="date" {...inp('fecha')} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Cliente <span style={{ color: '#0D6CB0' }}>*</span></label>
              <select {...inp('cliente_id')}>
                <option value="">— Seleccionar —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Datos de vuelo</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Vuelos <span style={{ color: '#0D6CB0' }}>*</span></label>
              <input type="number" min="1" placeholder="0" {...inp('cantidad_vuelos')} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Minutos volados</label>
              <input type="number" step="0.1" placeholder="0.0" {...inp('minutos_volados')} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Cargas baterías</label>
              <input type="number" min="0" placeholder="0" {...inp('cargas_baterias')} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Insumo aplicado</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">KG esparcidos <span style={{ color: '#0D6CB0' }}>*</span></label>
              <input type="number" step="0.01" placeholder="0.00" {...inp('kg_esparcidos')} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Sacos aplicados</label>
              <input type="number" step="0.01" placeholder="0.00" {...inp('sacos_aplicados')} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Hectáreas <span style={{ color: '#0D6CB0' }}>*</span></label>
              <input type="number" step="0.01" placeholder="0.00" {...inp('hectareas')} />
            </div>
          </div>
          {minHa && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Min / ha</div>
                <div className="text-base font-medium text-gray-800">{minHa}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1">Vuelos</div>
                <div className="text-base font-medium text-gray-800">{form.cantidad_vuelos || '—'}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mb-3">
          <button onClick={limpiar} className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            {editId ? 'Cancelar' : 'Limpiar'}
          </button>
          <button
            onClick={guardar}
            className="h-9 px-5 text-white text-sm font-medium rounded-lg transition-colors"
            style={{ background: '#0D6CB0' }}
            onMouseEnter={e => e.target.style.background = '#064979'}
            onMouseLeave={e => e.target.style.background = '#0D6CB0'}
          >
            {editId ? 'Actualizar jornada' : 'Guardar jornada'}
          </button>
        </div>

        {toast && (
          <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm mb-3"
            style={{ background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1e40af' }}>
            ✓ {toast}
          </div>
        )}

        {toastWarn && (
          <div className="rounded-lg px-4 py-3 text-sm mb-3"
            style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
            <div className="font-medium mb-2">⚠ {toastWarn}</div>
            <div className="flex gap-2">
              <button
                onClick={ejecutarGuardar}
                className="h-7 px-3 text-white text-xs rounded-lg"
                style={{ background: '#0D6CB0' }}>
                Sí, guardar igual
              </button>
              <button
                onClick={() => setToastWarn('')}
                className="h-7 px-3 text-xs rounded-lg border border-gray-300 bg-white">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-xl p-5 mt-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Jornadas · {mesLabel}</div>
              {mesCerrado && (
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{ background: '#f1f5f9', color: '#64748b' }}>
                  Mes cerrado
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setIdx(i => i - 1); limpiar() }} disabled={!puedeAtras}
                className="h-8 px-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                {puedeAtras ? `← ${MESES[meses[idx - 1].mes]}` : '←'}
              </button>
              <button onClick={() => { setIdx(i => i + 1); limpiar() }} disabled={!puedeAdelante}
                className="h-8 px-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                {puedeAdelante ? `${MESES[meses[idx + 1].mes]} →` : '→'}
              </button>
            </div>
          </div>

          {mesCerrado && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm mb-4"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}>
              Este mes está cerrado. Para corregir algo, pídele al jefe que lo reabra.
            </div>
          )}

          {jornadas.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">No hay jornadas registradas en {mesLabel}.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Fecha','Cliente','Vuelos','KG','Ha',''].map(h => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-gray-400 pb-2 px-2 font-medium last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jornadas.map(j => (
                    <tr key={j.id} className={`border-b border-gray-50 last:border-0 ${editId === j.id ? 'bg-blue-50/50' : ''}`}>
                      <td className="py-2.5 px-2 text-gray-400 text-xs">{j.fecha?.slice(5)}</td>
                      <td className="py-2.5 px-2 font-medium text-xs">{j.clientes?.nombre}</td>
                      <td className="py-2.5 px-2 text-right text-xs">{j.cantidad_vuelos}</td>
                      <td className="py-2.5 px-2 text-right text-xs">{Number(j.kg_esparcidos).toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-right text-xs">{Number(j.hectareas).toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        {mesCerrado ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : (
                          <>
                            <button onClick={() => editar(j)} className="text-xs px-2 py-1 rounded transition-colors" style={{ color: '#0D6CB0' }}>Editar</button>
                            <button onClick={() => eliminar(j.id)} className="text-xs text-gray-300 hover:text-red-400 px-2 py-1 rounded transition-colors ml-1">×</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={2} className="pt-3 px-2 text-xs text-gray-400 font-medium">Total ({jornadas.length} jornadas)</td>
                    <td className="pt-3 px-2 text-right text-xs font-medium">{totVuelos}</td>
                    <td className="pt-3 px-2 text-right text-xs font-medium">{totKg.toFixed(1)}</td>
                    <td className="pt-3 px-2 text-right text-xs font-medium">{totHa.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {jornadas.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 mt-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">
            Tu resumen · {mesLabel}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Vuelos', value: totVuelos },
              { label: 'Hectáreas', value: totHa.toFixed(1) },
              { label: 'KG esparcidos', value: totKg.toFixed(0) },
              { label: 'Sacos', value: jornadas.reduce((s,j) => s + Number(j.sacos_aplicados||0), 0).toFixed(1) },
              { label: 'Jornadas', value: jornadas.length },
              { label: 'Clientes', value: new Set(jornadas.map(j => j.cliente_id)).size },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{k.label}</div>
                <div className="text-lg font-medium text-gray-900">{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </Layout>
  )
}
