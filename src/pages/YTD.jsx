import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

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

const ZONA_CLIENTE = {
  'REYMAR': 'Puna', 'PACIMAR': 'Puna', 'LANGUISA': 'Puna',
  'NUTRIFEED': 'Jambeli', 'OCEANAZUL': 'Jambeli', 'AUSTROMAR': 'Jambeli',
  'LIMONVER': 'Jambeli', 'OCEANMARKET': 'Jambeli', 'SEVILLA': 'Jambeli',
  'MAREEXPORT': 'Jambeli', 'AGRIMARINE': 'Jambeli'
}

function fmt$(n) {
  return '$' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function BarChartDoble({ data, keyJ, keyP, fmtFn }) {
  const max = Math.max(...data.map(d => (d[keyJ] || 0) + (d[keyP] || 0)), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '130px', marginTop: '10px' }}>
      {data.map((d, i) => {
        const vJ = d[keyJ] || 0
        const vP = d[keyP] || 0
        const total = vJ + vP
        const pctTotal = total / max * 100
        const pctJ = total > 0 ? vJ / total * 100 : 0
        const pctP = total > 0 ? vP / total * 100 : 0
        const showLabelJ = pctJ > 20
        const showLabelP = pctP > 20
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
            {total > 0 && (
              <div style={{ fontSize: '8px', color: '#6b7280', textAlign: 'center', lineHeight: 1.2 }}>
                {fmtFn ? fmtFn(total) : Math.round(total)}
              </div>
            )}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: Math.max(pctTotal, total > 0 ? 5 : 0) + '%', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
              {vP > 0 && (
                <div style={{ background: '#22c55e', width: '100%', flex: pctP, minHeight: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showLabelP && (
                    <span style={{ fontSize: '7px', color: '#fff' }}>
                      {fmtFn ? fmtFn(vP) : Math.round(vP)}
                    </span>
                  )}
                </div>
              )}
              {vJ > 0 && (
                <div style={{ background: '#3b82f6', width: '100%', flex: pctJ, minHeight: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showLabelJ && (
                    <span style={{ fontSize: '7px', color: '#fff' }}>
                      {fmtFn ? fmtFn(vJ) : Math.round(vJ)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ fontSize: '8px', color: '#9ca3af', textAlign: 'center' }}>{MESES[d.mes]}</div>
          </div>
        )
      })}
    </div>
  )
}

function Leyenda() {
  return (
    <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
        <span style={{ fontSize: '11px', color: '#6b7280' }}>Jambeli</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e' }} />
        <span style={{ fontSize: '11px', color: '#6b7280' }}>Puna</span>
      </div>
    </div>
  )
}

export default function YTD() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const esContador = usuario?.rol === 'contador'
  const zonaKeyUser = usuario?.zona === 'Puná' ? 'Puna' : 'Jambeli'
  const verJambeli = !esContador || zonaKeyUser === 'Jambeli'
  const verPuna = !esContador || zonaKeyUser === 'Puna'
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [clientesJambeli, setClientesJambeli] = useState([])
  const [clientesPuna, setClientesPuna] = useState([])

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    setCargando(true)

    const [{ data: jornadas }, { data: fijosZona }, { data: variables }] = await Promise.all([
      supabase.from('jornadas').select('*, clientes(nombre)').gte('fecha', '2026-01-01').lte('fecha', '2026-12-31'),
      supabase.from('costos_fijos_zona').select('*').eq('anio', 2026),
      supabase.from('costos_variables_mes_zona').select('*').eq('anio', 2026)
    ])

    if (!jornadas) { setCargando(false); return }

    const fijosMap = {}
    ;(fijosZona || []).forEach(f => {
      if (f.zona === 'Jambeli' || f.zona === 'Jambeli') fijosMap['Jambeli'] = f
      if (f.zona === 'Puna' || f.zona === 'Puna') fijosMap['Puna'] = f
      if (f.zona === 'Jambel\u00ed') fijosMap['Jambeli'] = f
      if (f.zona === 'Pun\u00e1') fijosMap['Puna'] = f
    })

    const porMes = {}
    for (let m = 1; m <= 12; m++) {
      porMes[m] = {
        mes: m,
        Jambeli: { vuelos: 0, ha: 0, kg: 0, cargas: 0, porCliente: {} },
        Puna: { vuelos: 0, ha: 0, kg: 0, cargas: 0, porCliente: {} }
      }
    }

    jornadas.forEach(j => {
      const d = new Date(j.fecha + 'T12:00:00')
      const m = d.getMonth() + 1
      const zonaKey = ZONA_CLIENTE[j.clientes?.nombre?.toUpperCase() || '']
      if (!zonaKey) return
      porMes[m][zonaKey].vuelos += j.cantidad_vuelos
      porMes[m][zonaKey].ha += Number(j.hectareas || 0)
      porMes[m][zonaKey].kg += Number(j.kg_esparcidos || 0)
      porMes[m][zonaKey].cargas += Number(j.cargas_baterias || 0)
      const nombre = j.clientes?.nombre || 'Sin cliente'
      if (!porMes[m][zonaKey].porCliente[nombre]) porMes[m][zonaKey].porCliente[nombre] = { vuelos: 0, ha: 0, kg: 0 }
      porMes[m][zonaKey].porCliente[nombre].vuelos += j.cantidad_vuelos
      porMes[m][zonaKey].porCliente[nombre].ha += Number(j.hectareas || 0)
      porMes[m][zonaKey].porCliente[nombre].kg += Number(j.kg_esparcidos || 0)
    })

    const calcCostoZona = (fijos, cargas, vars) => {
      if (!fijos) return 0
      const seguroMes = fijos.seguro_dron_anual / 12
      const depDron = fijos.dep_dron_costo_total / (fijos.dep_dron_meses_vida_util || 1)
      const depBat = (fijos.dep_baterias_costo_total / (fijos.dep_baterias_vida_util_ciclos || 1)) * cargas
      const depGen = fijos.dep_generador_costo_total / (fijos.dep_generador_meses_vida_util || 1)
      const fijo = (fijos.sueldo_piloto || 0) + (fijos.sueldo_botero || 0) + (fijos.vacuna || 0) + seguroMes + depDron + depBat + depGen
      const variable = vars ? Number(vars.gasolina_aceite) + Number(vars.muellaje_costatech) + Number(vars.comision_piloto) : 0
      return fijo + variable
    }

    const resultado = []
    const acumJambeli = {}
    const acumPuna = {}

    for (let m = 1; m <= 12; m++) {
      const md = porMes[m]
      const fijosJ = fijosMap['Jambeli']
      const fijosP = fijosMap['Puna']
      const varJ = variables?.find(v => v.mes === m && (v.zona === 'Jambeli' || v.zona === 'Jambel\u00ed'))
      const varP = variables?.find(v => v.mes === m && (v.zona === 'Puna' || v.zona === 'Pun\u00e1'))

      const costoJ = md.Jambeli.vuelos > 0 ? calcCostoZona(fijosJ, md.Jambeli.cargas, varJ) : 0
      const costoP = md.Puna.vuelos > 0 ? calcCostoZona(fijosP, md.Puna.cargas, varP) : 0
      const factorJ = md.Jambeli.vuelos > 0 ? costoJ / md.Jambeli.vuelos : 0
      const factorP = md.Puna.vuelos > 0 ? costoP / md.Puna.vuelos : 0

      Object.entries(md.Jambeli.porCliente).forEach(([c, v]) => {
        const val = factorJ * v.vuelos
        if (!acumJambeli[c]) acumJambeli[c] = { total: 0, porMes: {} }
        acumJambeli[c].total += val
        acumJambeli[c].porMes[m] = val
      })
      Object.entries(md.Puna.porCliente).forEach(([c, v]) => {
        const val = factorP * v.vuelos
        if (!acumPuna[c]) acumPuna[c] = { total: 0, porMes: {} }
        acumPuna[c].total += val
        acumPuna[c].porMes[m] = val
      })

      resultado.push({
        mes: m,
        vuelos: md.Jambeli.vuelos + md.Puna.vuelos,
        vuelosJ: md.Jambeli.vuelos, vuelosP: md.Puna.vuelos,
        ha: md.Jambeli.ha + md.Puna.ha,
        haJ: md.Jambeli.ha, haP: md.Puna.ha,
        kg: md.Jambeli.kg + md.Puna.kg,
        kgJ: md.Jambeli.kg, kgP: md.Puna.kg,
        costo: costoJ + costoP,
        costoJ, costoP,
        costoHa: (md.Jambeli.ha + md.Puna.ha) > 0 ? (costoJ + costoP) / (md.Jambeli.ha + md.Puna.ha) : 0,
      })
    }

    setClientesJambeli(
      Object.entries(acumJambeli).filter(([, v]) => v.total > 0)
        .map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.total - a.total)
    )
    setClientesPuna(
      Object.entries(acumPuna).filter(([, v]) => v.total > 0)
        .map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.total - a.total)
    )
    setDatos(resultado)
    setCargando(false)
  }

  if (cargando) return <Layout><div className="text-center py-16 text-sm text-gray-400">Cargando YTD...</div></Layout>

  const mesesConDatos = datos.filter(d => d.vuelos > 0)
  const totalCosto = mesesConDatos.reduce((s, d) => s + d.costo, 0)
  const totalCostoJ = mesesConDatos.reduce((s, d) => s + d.costoJ, 0)
  const totalCostoP = mesesConDatos.reduce((s, d) => s + d.costoP, 0)
  const totalVuelos = mesesConDatos.reduce((s, d) => s + d.vuelos, 0)
  const totalVuelosJ = mesesConDatos.reduce((s, d) => s + d.vuelosJ, 0)
  const totalVuelosP = mesesConDatos.reduce((s, d) => s + d.vuelosP, 0)
  const totalHa = mesesConDatos.reduce((s, d) => s + d.ha, 0)
  const totalHaJ = mesesConDatos.reduce((s, d) => s + d.haJ, 0)
  const totalHaP = mesesConDatos.reduce((s, d) => s + d.haP, 0)
  const totalKg = mesesConDatos.reduce((s, d) => s + d.kg, 0)
  const totalKgJ = mesesConDatos.reduce((s, d) => s + d.kgJ, 0)
  const totalKgP = mesesConDatos.reduce((s, d) => s + d.kgP, 0)
  const totalClientesJ = clientesJambeli.reduce((s, c) => s + c.total, 0)
  const totalClientesP = clientesPuna.reduce((s, c) => s + c.total, 0)

  const renderTablaClientes = (clientes, zonaLabel, colorText, totalZona, getCosto) => (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full" style={{ background: zonaLabel === 'Jambeli' ? '#3b82f6' : '#22c55e' }} />
        <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          Facturacion por cliente &mdash; {zonaLabel}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: '420px' }}>
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">Cliente</th>
              {mesesConDatos.map(d => (
                <th key={d.mes} className="text-right text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium px-1">{MESES[d.mes]}</th>
              ))}
              <th className="text-right text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(c => (
              <tr key={c.nombre} className="border-b border-gray-50 last:border-0">
                <td className="py-2 font-medium">{c.nombre}</td>
                {mesesConDatos.map(d => (
                  <td key={d.mes} className="py-2 text-right text-gray-600 px-1">
                    {c.porMes[d.mes] > 0 ? fmt$(c.porMes[d.mes]) : '\u2014'}
                  </td>
                ))}
                <td className="py-2 text-right font-medium" style={{ color: colorText }}>{fmt$(c.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200">
              <td className="pt-3 font-medium">Total {zonaLabel}</td>
              {mesesConDatos.map(d => (
                <td key={d.mes} className="pt-3 text-right font-medium px-1">{fmt$(getCosto(d))}</td>
              ))}
              <td className="pt-3 text-right font-medium" style={{ color: colorText }}>{fmt$(totalZona)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-16">

        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">
              &larr; Volver al dashboard
            </button>
            <h1 className="text-2xl font-medium text-gray-900">Resumen anual 2026</h1>
            <p className="text-sm text-gray-400 mt-1">{mesesConDatos.length} meses con datos</p>
          </div>
        </div>

        {/* KPIs General (ocultos para contador: totalizan ambas zonas) */}
        {!esContador && (<>
        <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-2">General</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
          {[
            { label: 'Costo YTD', value: fmt$(totalCosto) },
            { label: 'Vuelos YTD', value: totalVuelos },
            { label: 'Hectareas YTD', value: totalHa.toFixed(0) },
            { label: 'KG YTD', value: totalKg.toFixed(0) },
            { label: 'Sacos YTD', value: (totalKg / 30).toFixed(0) },
          ].map(k => (
            <div key={k.label} className="bg-gray-50 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
              <div className="text-xl font-medium text-gray-900">{k.value}</div>
            </div>
          ))}
        </div>

        </>)}

        {/* KPIs Jambeli */}
        {verJambeli && (<>
        <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-2">Jambeli</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
          {[
            { label: 'Costo', value: fmt$(totalCostoJ) },
            { label: 'Vuelos', value: totalVuelosJ },
            { label: 'Hectareas', value: totalHaJ.toFixed(0) },
            { label: 'KG', value: totalKgJ.toFixed(0) },
            { label: 'Sacos', value: (totalKgJ / 30).toFixed(0) },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4" style={{ background: '#eff6ff' }}>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
              <div className="text-xl font-medium text-gray-900">{k.value}</div>
            </div>
          ))}
        </div>

        </>)}

        {/* KPIs Puna */}
        {verPuna && (<>
        <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-2">Puna</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4">
          {[
            { label: 'Costo', value: fmt$(totalCostoP) },
            { label: 'Vuelos', value: totalVuelosP },
            { label: 'Hectareas', value: totalHaP.toFixed(0) },
            { label: 'KG', value: totalKgP.toFixed(0) },
            { label: 'Sacos', value: (totalKgP / 30).toFixed(0) },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4" style={{ background: '#f0fdf4' }}>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
              <div className="text-xl font-medium text-gray-900">{k.value}</div>
            </div>
          ))}
        </div>

        </>)}

        {/* Graficas (comparan zonas; ocultas para contador) */}
        {!esContador && (<>
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Costo operacional por mes</div>
          <Leyenda />
          <BarChartDoble data={datos} keyJ="costoJ" keyP="costoP" fmtFn={fmt$} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Vuelos por mes</div>
            <Leyenda />
            <BarChartDoble data={datos} keyJ="vuelosJ" keyP="vuelosP" />
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Hectareas por mes</div>
            <Leyenda />
            <BarChartDoble data={datos} keyJ="haJ" keyP="haP" fmtFn={v => v.toFixed(0)} />
          </div>
        </div>

        </>)}

        {/* Facturacion por cliente — dos tablas */}
        {verJambeli && renderTablaClientes(clientesJambeli, 'Jambeli', '#1e40af', totalClientesJ, d => d.costoJ)}
        {verPuna && renderTablaClientes(clientesPuna, 'Puna', '#166534', totalClientesP, d => d.costoP)}

        {/* Detalle por mes — cards (oculto para contador: mezcla ambas zonas) */}
        {!esContador && (
        <div className="mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-3">Detalle por mes</div>
          <div className="flex flex-col gap-3">
            {datos.filter(d => d.vuelos > 0).map(d => (
              <div key={d.mes} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-900">{MESES_FULL[d.mes]}</div>
                  <div className="text-sm font-medium" style={{ color: '#0D6CB0' }}>{fmt$(d.costo)}</div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[
                    { label: 'Vuelos', value: d.vuelos },
                    { label: 'Hectareas', value: d.ha.toFixed(0) + ' ha' },
                    { label: 'KG', value: d.kg.toFixed(0) },
                    { label: 'Sacos', value: (d.kg / 30).toFixed(1) },
                  ].map(k => (
                    <div key={k.label}>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">{k.label}</div>
                      <div className="text-sm font-medium text-gray-900">{k.value}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Jambeli', costo: d.costoJ, vuelos: d.vuelosJ, ha: d.haJ, color: '#3b82f6', bg: '#eff6ff', pct: d.costo > 0 ? d.costoJ / d.costo * 100 : 0 },
                    { label: 'Puna', costo: d.costoP, vuelos: d.vuelosP, ha: d.haP, color: '#22c55e', bg: '#f0fdf4', pct: d.costo > 0 ? d.costoP / d.costo * 100 : 0 },
                  ].map(z => (
                    <div key={z.label} className="rounded-lg p-3" style={{ background: z.bg }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: z.color }}>{z.label}</span>
                        <span className="text-xs font-medium text-gray-700">{fmt$(z.costo)}</span>
                      </div>
                      <div className="flex gap-3 text-[10px] text-gray-400 mb-2">
                        <span>{z.vuelos} vuelos</span>
                        <span>{z.ha.toFixed(0)} ha</span>
                      </div>
                      <div className="w-full bg-white rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: z.pct + '%', background: z.color }} />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">{z.pct.toFixed(0)}% del costo total del mes</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

      </div>
    </Layout>
  )
}
