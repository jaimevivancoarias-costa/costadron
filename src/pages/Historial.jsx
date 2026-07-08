import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

// Nombres amigables de tablas y campos
const TABLA_LABEL = {
  costos_variables_mes_zona: 'Costos variables',
  costos_fijos_zona: 'Costos fijos',
}

const CAMPO_LABEL = {
  gasolina_aceite: 'Gasolina y aceite',
  muellaje_costatech: 'Muellaje / CostaTech',
  muellaje_items: 'Items de muellaje',
  comision_piloto: 'Comisión piloto',
  cerrado: 'Mes cerrado',
  sueldo_piloto: 'Sueldo piloto',
  sueldo_botero: 'Sueldo botero',
  vacuna: 'Vacuna',
  seguro_dron_anual: 'Seguro dron (anual)',
  dep_dron_costo_total: 'Costo total dron',
  dep_dron_meses_vida_util: 'Vida útil dron (meses)',
  dep_baterias_costo_total: 'Costo total baterías',
  dep_baterias_vida_util_ciclos: 'Vida útil baterías (ciclos)',
  dep_generador_costo_total: 'Costo total generador',
  dep_generador_meses_vida_util: 'Vida útil generador (meses)',
}

const MESES = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

// Campos internos que no vale la pena mostrar como "cambio"
const CAMPOS_OCULTOS = new Set(['id', 'creado_en', 'actualizado_en', 'created_at', 'updated_at'])

function fmtValor(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function fmtFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

const ACCION_STYLE = {
  INSERT: { label: 'Creado', bg: '#dcfce7', color: '#166534' },
  UPDATE: { label: 'Editado', bg: '#dbeafe', color: '#1e40af' },
  DELETE: { label: 'Eliminado', bg: '#fee2e2', color: '#991b1b' },
}

export default function Historial() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroTabla, setFiltroTabla] = useState('todas')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('costos_cambios_log')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(300)
    setRows(data || [])
    setCargando(false)
  }

  const rowsFiltradas = rows.filter(r => filtroTabla === 'todas' || r.tabla === filtroTabla)

  const renderCambios = (r) => {
    if (r.accion === 'UPDATE' && r.cambios) {
      const entradas = Object.entries(r.cambios).filter(([k]) => !CAMPOS_OCULTOS.has(k))
      if (entradas.length === 0) return null
      return (
        <div className="mt-3 flex flex-col gap-2">
          {entradas.map(([campo, val]) => (
            <div key={campo} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-gray-700">{CAMPO_LABEL[campo] || campo}</span>
              <span className="px-2 py-0.5 rounded bg-gray-50 text-gray-400 line-through">{fmtValor(val?.antes)}</span>
              <span className="text-gray-300">&rarr;</span>
              <span className="px-2 py-0.5 rounded" style={{ background: '#eff6ff', color: '#1e40af' }}>{fmtValor(val?.despues)}</span>
            </div>
          ))}
        </div>
      )
    }
    // INSERT / DELETE: mostrar los campos relevantes de la fila
    const fila = r.accion === 'DELETE' ? r.fila_anterior : r.fila_nueva
    if (!fila) return null
    const entradas = Object.entries(fila).filter(([k, v]) =>
      !CAMPOS_OCULTOS.has(k) && k !== 'zona' && k !== 'anio' && k !== 'mes' && v !== null && v !== '' && CAMPO_LABEL[k]
    )
    if (entradas.length === 0) return null
    return (
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {entradas.map(([campo, v]) => (
          <div key={campo} className="text-xs">
            <div className="text-gray-400">{CAMPO_LABEL[campo] || campo}</div>
            <div className="font-medium text-gray-700">{fmtValor(v)}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-16">

        <div className="mb-6">
          <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">
            &larr; Volver al dashboard
          </button>
          <h1 className="text-2xl font-medium text-gray-900">Historial de cambios</h1>
          <p className="text-sm text-gray-400 mt-1">Registro de ediciones en costos variables y costos fijos</p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'todas', label: 'Todas' },
            { key: 'costos_variables_mes_zona', label: 'Costos variables' },
            { key: 'costos_fijos_zona', label: 'Costos fijos' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltroTabla(f.key)}
              className="h-8 px-3 rounded-lg text-sm border transition-colors"
              style={filtroTabla === f.key
                ? { background: '#0D6CB0', color: '#fff', borderColor: '#0D6CB0' }
                : { background: '#fff', color: '#64748b', borderColor: '#e5e7eb' }}>
              {f.label}
            </button>
          ))}
        </div>

        {cargando && <div className="text-center py-16 text-sm text-gray-400">Cargando historial...</div>}

        {!cargando && rowsFiltradas.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="text-gray-300 text-4xl mb-3">&#9675;</div>
            <div className="text-sm font-medium text-gray-500 mb-1">Sin cambios registrados</div>
            <div className="text-xs text-gray-400">Cuando alguien edite costos variables o fijos, aparecerá aquí.</div>
          </div>
        )}

        {!cargando && rowsFiltradas.length > 0 && (
          <div className="flex flex-col gap-3">
            {rowsFiltradas.map(r => {
              const acc = ACCION_STYLE[r.accion] || { label: r.accion, bg: '#f1f5f9', color: '#64748b' }
              const periodo = r.mes ? `${MESES[r.mes]} ${r.anio}` : (r.anio ? `${r.anio}` : '')
              return (
                <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{TABLA_LABEL[r.tabla] || r.tabla}</span>
                        {r.zona && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: r.zona === 'Jambelí' ? '#eff6ff' : '#f0fdf4', color: r.zona === 'Jambelí' ? '#1e40af' : '#166534' }}>
                            {r.zona}
                          </span>
                        )}
                        {periodo && <span className="text-xs text-gray-400">{periodo}</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        {fmtFecha(r.creado_en)}{r.usuario_email ? ' · ' + r.usuario_email : ''}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                      style={{ background: acc.bg, color: acc.color }}>
                      {acc.label}
                    </span>
                  </div>
                  {renderCambios(r)}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </Layout>
  )
}
