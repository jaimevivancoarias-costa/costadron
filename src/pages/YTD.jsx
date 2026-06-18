import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const MESES = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr',
  5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Ago',
  9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
}

const MESES_FULL = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

function fmt$(n) {
  return '$' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function BarChart({ data, valueKey, color, fmt }) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', marginTop: '16px' }}>
      {data.map((d, i) => {
        const val = d[valueKey] || 0
        const pct = val / max * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 500, textAlign: 'center' }}>
              {val > 0 ? (fmt ? fmt(val) : Math.round(val)) : ''}
            </div>
            <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: val > 0 ? (color || '#0D6CB0') : '#f3f4f6', height: `${Math.max(pct, val > 0 ? 4 : 0)}%`, minHeight: val > 0 ? '4px' : '0', transition: 'height 0.3s' }}></div>
            <div style={{ fontSize: '9px', color: '#9ca3af', textAlign: 'center' }}>{MESES[d.mes]}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function YTD() {
  const navigate = useNavigate()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [clientesUnicos, setClientesUnicos] = useState([])
  const [clienteFiltro, setClienteFiltro] = useState('todos')

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    setCargando(true)

    const { data: jornadas } = await supabase
      .from('jornadas').select('*, clientes(nombre)')
      .gte('fecha', '2026-01-01').lte('fecha', '2026-12-31')

    const { data: fijos } = await supabase
      .from('costos_fijos').select('*').eq('anio', 2026).single()

    const { data: variables } = await supabase
      .from('costos_variables_mes').select('*').eq('anio', 2026)

    if (!fijos || !jornadas) { setCargando(false); return }

    const porMes = {}
    for (let m = 1; m <= 12; m++) {
      porMes[m] = { mes: m, vuelos: 0, ha: 0, kg: 0, cargas: 0, porCliente: {} }
    }

    jornadas.forEach(j => {
      const d = new Date(j.fecha + 'T12:00:00')
      const m = d.getMonth() + 1
      porMes[m].vuelos += j.cantidad_vuelos
      porMes[m].ha += Number(j.hectareas || 0)
      porMes[m].kg += Number(j.kg_esparcidos || 0)
      porMes[m].cargas += Number(j.cargas_baterias || 0)
      const nombre = j.clientes?.nombre || 'Sin cliente'
      if (!porMes[m].porCliente[nombre]) porMes[m].porCliente[nombre] = { vuelos: 0, ha: 0, kg: 0 }
      porMes[m].porCliente[nombre].vuelos += j.cantidad_vuelos
      porMes[m].porCliente[nombre].ha += Number(j.hectareas || 0)
      porMes[m].porCliente[nombre].kg += Number(j.kg_esparcidos || 0)
    })

    const resultado = []
    for (let m = 1; m <= 12; m++) {
      const md = porMes[m]
      if (md.vuelos === 0) { resultado.push({ mes: m, vuelos: 0, ha: 0, kg: 0, costo: 0, costoHa: 0, porCliente: {} }); continue }

      const varMes = variables?.find(v => v.mes === m)
      const seguroMes = fijos.seguro_dron_anual / 12
      const depDron = fijos.dep_dron_costo_total / fijos.dep_dron_meses_vida_util
      const depBat = (fijos.dep_baterias_costo_total / fijos.dep_baterias_vida_util_ciclos) * md.cargas
      const depGen = fijos.dep_generador_costo_total / fijos.dep_generador_meses_vida_util
      const totalFijos = fijos.sueldo_piloto + fijos.sueldo_botero + seguroMes + fijos.vacuna + depDron + depBat + depGen
      const totalVars = varMes ? Number(varMes.gasolina_aceite) + Number(varMes.muellaje_costatech) + Number(varMes.comision_piloto) : 0
      const costo = totalFijos + totalVars
      const factorVuelo = md.vuelos > 0 ? costo / md.vuelos : 0

      const porClienteMonto = {}
      Object.entries(md.porCliente).forEach(([c, v]) => {
        porClienteMonto[c] = { valor: factorVuelo * v.vuelos, vuelos: v.vuelos, ha: v.ha, kg: v.kg }
      })

      resultado.push({ mes: m, vuelos: md.vuelos, ha: md.ha, kg: md.kg, costo, costoHa: md.ha > 0 ? costo / md.ha : 0, porCliente: porClienteMonto })
    }

    const todosClientes = [...new Set(jornadas.map(j => j.clientes?.nombre).filter(Boolean))].sort()
    setClientesUnicos(todosClientes)
    setDatos(resultado)
    setCargando(false)
  }

  if (cargando) return <Layout><div className="text-center py-16 text-sm text-gray-400">Cargando YTD...</div></Layout>

  const mesesConDatos = datos.filter(d => d.vuelos > 0)
  const totalCosto = mesesConDatos.reduce((s, d) => s + d.costo, 0)
  const totalVuelos = mesesConDatos.reduce((s, d) => s + d.vuelos, 0)
  const totalHa = mesesConDatos.reduce((s, d) => s + d.ha, 0)
  const totalKg = mesesConDatos.reduce((s, d) => s + d.kg, 0)

  // Tabla de facturación por cliente
  const tablaClientes = clientesUnicos.map(c => {
    const porMesCliente = datos.map(d => ({ mes: d.mes, valor: d.porCliente[c]?.valor || 0, vuelos: d.porCliente[c]?.vuelos || 0, ha: d.porCliente[c]?.ha || 0 }))
    const totalValor = porMesCliente.reduce((s, m) => s + m.valor, 0)
    const totalVuelosC = porMesCliente.reduce((s, m) => s + m.vuelos, 0)
    const totalHaC = porMesCliente.reduce((s, m) => s + m.ha, 0)
    return { cliente: c, porMes: porMesCliente, totalValor, totalVuelos: totalVuelosC, totalHa: totalHaC }
  }).filter(c => c.totalValor > 0).sort((a, b) => b.totalValor - a.totalValor)

  const clienteFiltrado = clienteFiltro === 'todos' ? null : tablaClientes.find(c => c.cliente === clienteFiltro)

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-16">

        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">← Volver al dashboard</button>
            <h1 className="text-2xl font-medium text-gray-900">Resumen anual 2026</h1>
            <p className="text-sm text-gray-400 mt-1">{mesesConDatos.length} meses con datos</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
          {[
            { label: 'Costo YTD', value: fmt$(totalCosto), sub: 'acumulado 2026' },
            { label: 'Vuelos YTD', value: totalVuelos, sub: 'total del año' },
            { label: 'Hectáreas YTD', value: totalHa.toFixed(0), sub: 'ha aplicadas' },
            { label: 'KG YTD', value: totalKg.toFixed(0), sub: 'kg esparcidos' },
			{ label: 'Sacos YTD', value: (totalKg / 30).toFixed(0), sub: 'sacos aplicados' },
          ].map(k => (
            <div key={k.label} className="bg-gray-50 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
              <div className="text-xl font-medium text-gray-900">{k.value}</div>
              <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Costo por mes */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Costo operacional por mes</div>
          <BarChart data={datos} valueKey="costo" color="#0D6CB0" fmt={fmt$} />
        </div>

        {/* Vuelos y Ha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Vuelos por mes</div>
            <BarChart data={datos} valueKey="vuelos" color="#1591EA" />
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Hectáreas por mes</div>
            <BarChart data={datos} valueKey="ha" color="#064979" fmt={v => v.toFixed(0)} />
          </div>
        </div>

        {/* Facturación por cliente */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Facturación por cliente</div>
            <select
              value={clienteFiltro}
              onChange={e => setClienteFiltro(e.target.value)}
              className="h-8 px-3 border border-gray-200 rounded-lg text-xs outline-none"
              onFocus={e => e.target.style.borderColor = '#0D6CB0'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            >
              <option value="todos">Todos los clientes</option>
              {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {clienteFiltro === 'todos' ? (
            <div className="overflow-x-auto"><table className="w-full text-xs" style={{minWidth:"500px"}}>
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">Cliente</th>
                  {mesesConDatos.map(d => (
                    <th key={d.mes} className="text-right text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">{MESES[d.mes]}</th>
                  ))}
                  <th className="text-right text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {tablaClientes.map(c => (
                  <tr key={c.cliente} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-medium">{c.cliente}</td>
                    {mesesConDatos.map(d => (
                      <td key={d.mes} className="py-2 text-right text-gray-600">
                        {c.porMes.find(m => m.mes === d.mes)?.valor > 0 ? fmt$(c.porMes.find(m => m.mes === d.mes)?.valor) : '—'}
                      </td>
                    ))}
                    <td className="py-2 text-right font-medium" style={{ color: '#0D6CB0' }}>{fmt$(c.totalValor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="pt-3 font-medium">Total</td>
                  {mesesConDatos.map(d => (
                    <td key={d.mes} className="pt-3 text-right font-medium">{fmt$(d.costo)}</td>
                  ))}
                  <td className="pt-3 text-right font-medium" style={{ color: '#0D6CB0' }}>{fmt$(totalCosto)}</td>
                </tr>
              </tfoot>
            </table></div>
          ) : (
            clienteFiltrado && (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div><div className="text-[10px] uppercase text-gray-400 mb-1">Total facturado</div><div className="text-base font-medium" style={{ color: '#0D6CB0' }}>{fmt$(clienteFiltrado.totalValor)}</div></div>
                  <div><div className="text-[10px] uppercase text-gray-400 mb-1">Vuelos totales</div><div className="text-base font-medium">{clienteFiltrado.totalVuelos}</div></div>
                  <div><div className="text-[10px] uppercase text-gray-400 mb-1">Hectáreas totales</div><div className="text-base font-medium">{clienteFiltrado.totalHa.toFixed(1)}</div></div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">Mes</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">Vuelos</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">Ha</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">A facturar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clienteFiltrado.porMes.filter(m => m.valor > 0).map(m => (
                      <tr key={m.mes} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 font-medium">{MESES_FULL[m.mes]}</td>
                        <td className="py-2 text-right">{m.vuelos}</td>
                        <td className="py-2 text-right">{m.ha.toFixed(1)}</td>
                        <td className="py-2 text-right font-medium">{fmt$(m.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td className="pt-3 font-medium">Total</td>
                      <td className="pt-3 text-right font-medium">{clienteFiltrado.totalVuelos}</td>
                      <td className="pt-3 text-right font-medium">{clienteFiltrado.totalHa.toFixed(1)}</td>
                      <td className="pt-3 text-right font-medium" style={{ color: '#0D6CB0' }}>{fmt$(clienteFiltrado.totalValor)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}
        </div>

        {/* Tabla resumen */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Detalle por mes</div>
          <div className="overflow-x-auto -mx-5 px-5"><table className="w-full text-sm" style={{minWidth:"500px"}}>
            <thead>
              <tr className="border-b border-gray-100">
                {['Mes','Vuelos','Ha','KG','Sacos','Costo','Costo/ha','Costo/vuelo'].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.filter(d => d.vuelos > 0).map(d => (
                <tr key={d.mes} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-xs font-medium pr-4">{MESES_FULL[d.mes]}</td>
                  <td className="py-2 text-xs pr-4">{d.vuelos}</td>
                  <td className="py-2 text-xs pr-4">{d.ha.toFixed(0)}</td>
				  <td className="py-2 text-xs pr-4">{d.kg.toFixed(0)}</td>
                  <td className="py-2 text-xs pr-4">{(d.kg / 30).toFixed(1)}</td>
                  <td className="py-2 text-xs font-medium pr-4">{fmt$(d.costo)}</td>
                  <td className="py-2 text-xs pr-4">{fmt$(d.costoHa)}</td>
		          <td className="py-2 text-xs pr-4">{fmt$(d.vuelos > 0 ? d.costo / d.vuelos : 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td className="pt-3 text-xs font-medium">Total</td>
                <td className="pt-3 text-xs font-medium">{totalVuelos}</td>
                <td className="pt-3 text-xs font-medium">{totalHa.toFixed(0)}</td>
                <td className="pt-3 text-xs font-medium">{totalKg.toFixed(0)}</td>
				<td className="pt-3 text-xs font-medium">{(totalKg / 30).toFixed(1)}</td>
				<td className="pt-3 text-xs font-medium">{fmt$(totalCosto)}</td>
                <td className="pt-3 text-xs font-medium">{fmt$(totalHa > 0 ? totalCosto / totalHa : 0)}</td>
<td className="pt-3 text-xs font-medium">{fmt$(totalVuelos > 0 ? totalCosto / totalVuelos : 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
      </div>
    </Layout>
  )
}
