import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

const REQUIRED = ['fecha', 'cliente_id', 'cantidad_vuelos', 'kg_esparcidos', 'hectareas']

function fmt(n) {
  return n != null ? Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

export default function FormularioJornada() {
  const { usuario } = useAuth()
  const [clientes, setClientes] = useState([])
  const [jornadas, setJornadas] = useState([])
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState('')
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
    cargarJornadas()
  }, [])

  const cargarJornadas = async () => {
    const now = new Date()
    const desde = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const { data } = await supabase
      .from('jornadas')
      .select('*, clientes(nombre)')
      .gte('fecha', desde)
      .order('fecha', { ascending: false })
    setJornadas(data || [])
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    REQUIRED.forEach(k => { if (!form[k]) e[k] = true })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validate()) return
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

    if (error) { showToast('Error al guardar. Intentá de nuevo.', true); return }
    showToast(editId ? 'Jornada actualizada.' : 'Jornada guardada.')
    limpiar()
    cargarJornadas()
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
    cargarJornadas()
  }

  const limpiar = () => {
    setForm({ fecha: hoy, cliente_id: '', cantidad_vuelos: '', minutos_volados: '', cargas_baterias: '', kg_esparcidos: '', sacos_aplicados: '', hectareas: '' })
    setEditId(null)
    setErrors({})
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const minHa = form.minutos_volados && form.hectareas
    ? (Number(form.minutos_volados) / Number(form.hectareas)).toFixed(2)
    : null

  const totVuelos = jornadas.reduce((s, j) => s + j.cantidad_vuelos, 0)
  const totHa = jornadas.reduce((s, j) => s + Number(j.hectareas || 0), 0)
  const totKg = jornadas.reduce((s, j) => s + Number(j.kg_esparcidos || 0), 0)

  const inp = (key, extra = {}) => ({
    value: form[key],
    onChange: e => set(key, e.target.value),
    className: `w-full h-10 px-3 border rounded-lg text-sm outline-none transition-all
      ${errors[key] ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200 focus:border-[#0D6CB0] focus:ring-2 focus:ring-[#0D6CB0]/10'}`,
    ...extra
  })

  return (
    <Layout>
      <div className="max-w-2xl mx-auto pb-16">
        <h1 className="text-2xl font-medium text-gray-900 mb-1">Registrar jornada</h1>
        <p className="text-sm text-gray-400 mb-6">
          Campos con <span className="text-[#0D6CB0]">*</span> son obligatorios.
        </p>

        {/* Identificación */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Identificación</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Fecha <span className="text-[#0D6CB0]">*</span></label>
              <input type="date" {...inp('fecha')} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Cliente <span className="text-[#0D6CB0]">*</span></label>
              <select {...inp('cliente_id')}>
                <option value="">— Seleccionar —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Vuelo */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Datos de vuelo</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Vuelos <span className="text-[#0D6CB0]">*</span></label>
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

        {/* Insumo */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Insumo aplicado</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">KG esparcidos <span className="text-[#0D6CB0]">*</span></label>
              <input type="number" step="0.01" placeholder="0.00" {...inp('kg_esparcidos')} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Sacos aplicados</label>
              <input type="number" step="0.01" placeholder="0.00" {...inp('sacos_aplicados')} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1.5">Hectáreas <span className="text-[#0D6CB0]">*</span></label>
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

        {/* Actions */}
        <div className="flex gap-3 justify-end mb-3">
          <button onClick={limpiar} className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            Limpiar
          </button>
          <button onClick={guardar} className="h-9 px-5 bg-[#0D6CB0] hover:bg-[#064979] text-white text-sm font-medium rounded-lg transition-colors">
            {editId ? 'Actualizar jornada' : 'Guardar jornada'}
          </button>
        </div>

        {toast && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800 mb-4">
            ✓ {toast}
          </div>
        )}

        {/* Lista del mes */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Jornadas del mes</div>
            <span className="text-[11px] font-medium px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
              {jornadas.length} registradas
            </span>
          </div>

          {jornadas.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">No hay jornadas registradas este mes.</div>
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
                        <button onClick={() => editar(j)} className="text-xs text-[#0D6CB0] hover:bg-blue-50 px-2 py-1 rounded transition-colors">Editar</button>
                        <button onClick={() => eliminar(j.id)} className="text-xs text-gray-300 hover:text-red-400 hover:bg-red-50 px-2 py-1 rounded transition-colors ml-1">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={2} className="pt-3 px-2 text-xs text-gray-400 font-medium">Total mes ({jornadas.length} jornadas)</td>
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
    </Layout>
  )
}
