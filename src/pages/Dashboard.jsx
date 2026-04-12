import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const MESES = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

function fmt$(n) {
  return '$' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function primerDia(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

function ultimoDia(anio, mes) {
  return new Date(anio, mes, 0).toISOString().split('T')[0]
}

export default function Dashboard() {
  const [mesesDisponibles, setMesesDisponibles] = useState([])
  const [idx, setIdx] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [clientes, setClientes] = useState([])
  const [costosMes, setCostosMes] = useState(null)
  const [varForm, setVarForm] = useState({ gasolina_aceite: '', muellaje_costatech: '', comision_piloto: '' })
  const [varGuardados, setVarGuardados] = useState(false)
  const [varEditando, setVarEditando] = useState(false)
  const [modalCerrar, setModalCerrar] = useState(false)
  const [toast, setToast] = useState('')
  const [cargando, setCargando] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const cargarMeses = async () => {
      const { data } = await supabase.from('jornadas').select('fecha')
      const unicos = {}
      ;(data || []).forEach(j => {
        const d = new Date(j.fecha + 'T12:00:00')
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`
        unicos[key] = { anio: d.getFullYear(), mes: d.getMonth() + 1 }
      })
      const hoy = new Date()
      const keyHoy = `${hoy.getFullYear()}-${hoy.getMonth() + 1}`
      unicos[keyHoy] = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }
      const lista = Object.values(unicos).sort((a, b) =>
        a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes
      )
      setMesesDisponibles(lista)
      setIdx(lista.length - 1)
    }
    cargarMeses()
  }, [])

  const periodo = idx !== null && mesesDisponibles.length > 0 ? mesesDisponibles[idx] : null

  useEffect(() => {
    if (periodo) cargarDatos(periodo)
  }, [idx, mesesDisponibles.length])

  const cargarDatos = async ({ anio, mes }) => {
    setCargando(true)
    setResumen(null)
    setClientes([])
    setVarGuardados(false)
    setVarEditando(false)
    setVarForm({ gasolina_aceite: '', muellaje_costatech: '', comision_piloto: '' })

    const desde = primerDia(anio, mes)
    const hasta = ultimoDia(anio, mes)

    const [{ data: jornadas }, { data: fijos }, { data: varMes }] = await Promise.all([
      supabase.from('jornadas').select('*, clientes(nombre)').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('costos_fijos').select('*').eq('anio', anio).single(),
      supabase.from('costos_variables_mes').select('*').eq('anio', anio).eq('mes', mes).single()
    ])

    setCostosMes(varMes)
    if (varMes) {
      setVarForm({
        gasolina_aceite: varMes.gasolina_aceite,
        muellaje_costatech: varMes.muellaje_costatech,
        comision_piloto: varMes.comision_piloto
      })
      setVarGuardados(true)
    }
    if (fijos) calcularResumen(jornadas || [], fijos, varMes)
    setCargando(false)
  }

  const calcularResumen = (jornadas, fijos, varMes) => {
    const totalVuelos = jornadas.reduce((s, j) => s + j.cantidad_vuelos, 0)
    const totalHa = jornadas.reduce((s, j) => s + Number(j.hectareas || 0), 0)
    const totalKg = jornadas.reduce((s, j) => s + Number(j.kg_esparcidos || 0), 0)
    const totalCargas = jornadas.reduce((s, j) => s + Number(j.cargas_baterias || 0), 0)

    const seguroMes = fijos.seguro_dron_anual / 12
    const depDron = fijos.dep_dron_costo_total / fijos.dep_dron_meses_vida_util
    const depBat = (fijos.dep_baterias_costo_total / fijos.dep_baterias_vida_util_ciclos) * totalCargas
    const depGen = fijos.dep_generador_costo_total / fijos.dep_generador_meses_vida_util

    const totalFijos = fijos.sueldo_piloto + fijos.sueldo_botero + seguroMes + fijos.vacuna + depDron + depBat + depGen
    const totalVars = varMes
      ? Number(varMes.gasolina_aceite) + Number(varMes.muellaje_costatech) + Number(varMes.comision_piloto)
      : 0
    const totalCosto = totalFijos + totalVars
    const factorVuelo = totalVuelos > 0 ? totalCosto / totalVuelos : 0

    const porCliente = {}
    jornadas.forEach(j => {
      const nombre = j.clientes?.nombre || 'Sin cliente'
      if (!porCliente[nombre]) porCliente[nombre] = { nombre, vuelos: 0, ha: 0, kg: 0, jornadas: 0 }
      porCliente[nombre].vuelos += j.cantidad_vuelos
      porCliente[nombre].ha += Number(j.hectareas || 0)
      porCliente[nombre].kg += Number(j.kg_esparcidos || 0)
      porCliente[nombre].jornadas++
    })

    const clientesArr = Object.values(porCliente).map(c => ({
      ...c,
      valor: factorVuelo * c.vuelos,
      costoHa: c.ha > 0 ? (factorVuelo * c.vuelos) / c.ha : 0
    })).sort((a, b) => b.valor - a.valor)

    setClientes(clientesArr)
    setResumen({
      totalCosto, totalVuelos, totalHa, totalKg,
      jornadas: jornadas.length,
      costoVuelo: factorVuelo,
      costoHa: totalHa > 0 ? totalCosto / totalHa : 0,
      clientes: clientesArr.length,
      cerrado: varMes?.cerrado || false,
      sinDatos: jornadas.length === 0
    })
  }

  const guardarVars = async () => {
    const { anio, mes } = periodo
    const payload = {
      anio, mes,
      gasolina_aceite: Number(varForm.gasolina_aceite) || 0,
      muellaje_costatech: Number(varForm.muellaje_costatech) || 0,
      comision_piloto: Number(varForm.comision_piloto) || 0,
    }
    const { error } = await supabase.from('costos_variables_mes').upsert(payload, { onConflict: 'anio,mes' })
    if (error) { showToast('Error al guardar.'); return }
    setVarGuardados(true)
    setVarEditando(false)
    showToast('Costos variables guardados.')
    cargarDatos(periodo)
  }

  const cerrarMes = async () => {
    const { anio, mes } = periodo
    await supabase.from('costos_variables_mes').update({ cerrado: true }).eq('anio', anio).eq('mes', mes)
    setModalCerrar(false)
    showToast('Mes cerrado.')
    cargarDatos(periodo)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const totalVars = (Number(varForm.gasolina_aceite) || 0)
    + (Number(varForm.muellaje_costatech) || 0)
    + (Number(varForm.comision_piloto) || 0)

  const mesLabel = periodo ? `${MESES[periodo.mes]} ${periodo.anio}` : ''
  const puedeIrAtras = idx !== null && idx > 0
  const puedeIrAdelante = idx !== null && idx < mesesDisponibles.length - 1

  const mesYaTermino = periodo ? new Date() > new Date(periodo.anio, periodo.mes, 0) : false
  const diasDesdeFinMes = periodo ? Math.floor((new Date() - new Date(periodo.anio, periodo.mes, 0)) / (1000 * 60 * 60 * 24)) : 0

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-16">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-medium text-gray-900">{mesLabel || 'Cargando...'}</h1>
            {resumen && (
              <span className="text-[11px] font-medium px-3 py-1 rounded-full"
                style={{
                  background: resumen.cerrado ? '#dbeafe' : resumen.sinDatos ? '#f1f5f9' : '#fef3c7',
                  color: resumen.cerrado ? '#1e40af' : resumen.sinDatos ? '#94a3b8' : '#92400e'
                }}>
                {resumen.cerrado ? 'Mes cerrado' : resumen.sinDatos ? 'Sin datos' : 'Mes abierto'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIdx(i => i - 1)}
              disabled={!puedeIrAtras}
              className="h-8 px-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {puedeIrAtras ? `← ${MESES[mesesDisponibles[idx - 1].mes]}` : '←'}
            </button>
            <button
              onClick={() => setIdx(i => i + 1)}
              disabled={!puedeIrAdelante}
              className="h-8 px-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {puedeIrAdelante ? `${MESES[mesesDisponibles[idx + 1].mes]} →` : '→'}
            </button>
          </div>
        </div>

        {mesYaTermino && !resumen?.cerrado && !cargando && !resumen?.sinDatos && (
          <div className="flex flex-col gap-2 mb-5">
            {!varGuardados && mesYaTermino && (
              <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
                style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
                <span>⚠</span>
                <span>Los costos variables de {mesLabel} no están cargados. El reporte no puede cerrarse hasta completarlos.</span>
              </div>
            )}
            {diasDesdeFinMes > 5 && (
              <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
                style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
                <span>⚠</span>
                <span>{mesLabel} lleva {diasDesdeFinMes} días sin cerrar. Recordá cerrar el mes para congelar los datos.</span>
              </div>
            )}
          </div>
        )}

        {cargando && (
          <div className="text-center py-16 text-sm text-gray-400">Cargando datos...</div>
        )}

        {!cargando && resumen?.sinDatos && (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="text-gray-300 text-4xl mb-3">○</div>
            <div className="text-sm font-medium text-gray-500 mb-1">{mesLabel} — sin jornadas registradas</div>
            <div className="text-xs text-gray-400">Los pilotos aún no han registrado vuelos este mes.</div>
          </div>
        )}

        {!cargando && resumen && !resumen.sinDatos && (
          <>
            <div className="grid grid-cols-4 gap-2.5 mb-5">
              {[
                { label: 'Costo operacional', value: fmt$(resumen.totalCosto), sub: `${resumen.clientes} clientes` },
                { label: 'Vuelos realizados', value: resumen.totalVuelos, sub: `${resumen.jornadas} jornadas` },
                { label: 'Hectáreas aplicadas', value: resumen.totalHa.toFixed(0), sub: 'ha' },
                { label: 'Costo por vuelo', value: fmt$(resumen.costoVuelo), sub: `${fmt$(resumen.costoHa)} / ha` },
              ].map(k => (
                <div key={k.label} className="bg-gray-50 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
                  <div className="text-xl font-medium text-gray-900">{k.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>

            {!resumen.cerrado && (
              <div className="bg-white rounded-xl p-5 mb-5"
                style={{ border: !varGuardados ? '1px solid #EF9F27' : '1px solid #f1f5f9' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Costos variables — {mesLabel}
                  </div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                    style={{
                      background: varGuardados && !varEditando ? '#dbeafe' : '#fef3c7',
                      color: varGuardados && !varEditando ? '#1e40af' : '#92400e'
                    }}>
                    {varGuardados && !varEditando ? 'Cargados' : varEditando ? 'Editando' : 'Pendiente'}
                  </span>
                </div>
                {!varGuardados && mesYaTermino && (
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm mb-4"
                    style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
                    ⚠ Ingresá los costos variables antes de cerrar el mes.
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { key: 'gasolina_aceite', label: 'Gasolina y aceite', hint: 'combustible del mes' },
                    { key: 'muellaje_costatech', label: 'Muellaje / CostaTech', hint: 'gastos de bote y muellaje' },
                    { key: 'comision_piloto', label: 'Comision piloto', hint: '$0 si no aplica' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-sm text-gray-500 mb-1.5">{f.label}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number" step="0.01" placeholder="0.00"
                          value={varForm[f.key]}
                          onChange={e => setVarForm(v => ({ ...v, [f.key]: e.target.value }))}
                          readOnly={varGuardados && !varEditando}
                          className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all"
                          style={varGuardados && !varEditando ? { borderColor: '#bfdbfe', background: '#eff6ff', color: '#1e40af' } : {}}
                          onFocus={e => { if (!varGuardados || varEditando) e.target.style.borderColor = '#0D6CB0' }}
                          onBlur={e => { if (!varGuardados || varEditando) e.target.style.borderColor = '#e5e7eb' }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{f.hint}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="text-sm text-gray-500">Total: <span className="font-medium text-gray-900">{fmt$(totalVars)}</span></div>
                  <div className="flex gap-2">
                    {varGuardados && !varEditando ? (
                      <button onClick={() => setVarEditando(true)} className="h-8 px-4 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">Editar</button>
                    ) : (
                      <>
                        {varEditando && <button onClick={() => setVarEditando(false)} className="h-8 px-4 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">Cancelar</button>}
                        <button onClick={guardarVars} className="h-8 px-4 text-white text-sm font-medium rounded-lg transition-colors"
                          style={{ background: '#0D6CB0' }}
                          onMouseEnter={e => e.target.style.background = '#064979'}
                          onMouseLeave={e => e.target.style.background = '#0D6CB0'}>
                          Guardar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {resumen.cerrado && costosMes && (
              <div className="bg-white border border-gray-100 rounded-xl p-5 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Costos variables — {mesLabel}</div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">Mes cerrado</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><div className="text-gray-400 mb-1">Gasolina y aceite</div><div className="font-medium">{fmt$(costosMes.gasolina_aceite)}</div></div>
                  <div><div className="text-gray-400 mb-1">Muellaje / CostaTech</div><div className="font-medium">{fmt$(costosMes.muellaje_costatech)}</div></div>
                  <div><div className="text-gray-400 mb-1">Comision piloto</div><div className="font-medium">{fmt$(costosMes.comision_piloto)}</div></div>
                </div>
              </div>
            )}

            {toast && (
              <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm mb-4"
                style={{ background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                ✓ {toast}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Valor a facturar por cliente</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">Cliente</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">Vuelos</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">A facturar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map(c => {
                      const pct = resumen ? (c.valor / resumen.totalCosto * 100).toFixed(0) : 0
                      return (
                        <tr key={c.nombre} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 text-xs font-medium">{c.nombre}</td>
                          <td className="py-2 text-right text-xs text-gray-500">{c.vuelos}</td>
                          <td className="py-2 text-right">
                            <div className="text-xs font-medium">{fmt$(c.valor)}</div>
                            <div className="w-full bg-gray-100 rounded h-1 mt-1">
                              <div className="h-1 rounded" style={{ width: `${pct}%`, background: '#0D6CB0' }}></div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td colSpan={2} className="pt-2.5 text-xs text-gray-400 font-medium">Total</td>
                      <td className="pt-2.5 text-right text-xs font-medium">{fmt$(resumen.totalCosto)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col">
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Acciones</div>
                <div className="flex flex-col gap-2 flex-1">
                  <button
                    onClick={() => navigate(`/reporte/${periodo.anio}/${periodo.mes}`)}
                    className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-left text-gray-600 hover:bg-gray-50 transition-colors">
                    Ver reporte completo →
                  </button>
                  <button className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-left text-gray-600 hover:bg-gray-50 transition-colors">
                    Exportar PDF por cliente →
                  </button>
                  <button
                    onClick={() => navigate('/costos-fijos')}
                    className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-left text-gray-600 hover:bg-gray-50 transition-colors">
                    Configurar costos fijos →
                  </button>
                  <button
                    onClick={() => navigate('/ytd')}
                    className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-left text-gray-600 hover:bg-gray-50 transition-colors">
                    Ver resumen anual →
                  </button>
                </div>
                {!resumen.cerrado && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => setModalCerrar(true)}
                      disabled={!varGuardados}
                      className="w-full h-9 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: '#0D6CB0' }}
                      onMouseEnter={e => { if (varGuardados) e.target.style.background = '#064979' }}
                      onMouseLeave={e => { if (varGuardados) e.target.style.background = '#0D6CB0' }}
                    >
                      Cerrar mes
                    </button>
                    <div className="text-xs text-gray-400 mt-1.5 text-center">
                      {!varGuardados ? 'Carga los costos variables primero' : 'El mes esta listo para cerrar'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {modalCerrar && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-sm w-full">
              <h2 className="text-base font-medium text-gray-900 mb-2">Cerrar {mesLabel}?</h2>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Esta accion congela todos los datos del mes. No podras modificar jornadas ni costos una vez cerrado.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Costos variables</span><span className="font-medium">{fmt$(totalVars)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total a facturar</span><span className="font-medium">{resumen ? fmt$(resumen.totalCosto) : '-'}</span></div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModalCerrar(false)} className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">Cancelar</button>
                <button onClick={cerrarMes} className="h-9 px-4 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                  Si, cerrar {periodo ? MESES[periodo.mes] : ''}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
