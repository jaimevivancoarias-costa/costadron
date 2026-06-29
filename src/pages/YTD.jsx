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

const ZONA_CLIENTE = {
  'REYMAR': 'Pun\u00e1', 'PACIMAR': 'Pun\u00e1', 'LANGUISA': 'Pun\u00e1',
  'NUTRIFEED': 'Jambel\u00ed', 'OCEANAZUL': 'Jambel\u00ed', 'AUSTROMAR': 'Jambel\u00ed',
  'LIMONVER': 'Jambel\u00ed', 'OCEANMARKET': 'Jambel\u00ed', 'SEVILLA': 'Jambel\u00ed',
  'MAREEXPORT': 'Jambel\u00ed', 'AGRIMARINE': 'Jambel\u00ed'
}

function fmt$(n) {
  return '$' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Gráfica de barras simple (un solo valor por mes)
function BarChart({ data, valueKey, color, fmt }) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', marginTop: '12px' }}>
      {data.map((d, i) => {
        const val = d[valueKey] || 0
        const pct = val / max * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: '8px', color: '#9ca3af', textAlign: 'center' }}>
              {val > 0 ? (fmt ? fmt(val) : Math.round(val)) : ''}
            </div>
            <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: val > 0 ? color : '#f3f4f6', height: Math.max(pct, val > 0 ? 4 : 0) + '%', transition: 'height 0.3s' }} />
            <div style={{ fontSize: '8px', color: '#9ca3af', textAlign: 'center' }}>{MESES[d.mes]}</div>
          </div>
        )
      })}
    </div>
  )
}

// Gráfica de barras apiladas (dos zonas por mes)
function BarChartDoble({ data, keyJ, keyP, fmtFn }) {
  const max = Math.max(...data.map(d => (d[keyJ] || 0) + (d[keyP] || 0)), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', marginTop: '12px' }}>
      {data.map((d, i) => {
        const vJ = d[keyJ] || 0
        const vP = d[keyP] || 0
        const total = vJ + vP
        const pctJ = vJ / max * 100
        const pctP = vP / max * 100
        const pctTotal = total / max * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
            {total > 0 && (
              <div style={{ fontSize: '8px', color: '#6b7280', textAlign: 'center', lineHeight: 1.2 }}>
                {fmtFn ? fmtFn(total) : Math.round(total)}
              </div>
            )}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: Math.max(pctTotal, total > 0 ? 4 : 0) + '%' }}>
              {vP > 0 && (
                <div style={{ background: '#22c55e', width: '100%', flex: pctP, borderRadius: vJ === 0 ? '3px 3px 0 0' : '3px 3px 0 0' }}>
                  {pctP > 8 && (
                    <div style={{ fontSize: '7px', color: '#fff', textAlign: 'center', paddingTop: '2px' }}>
                      {fmtFn ? fmtFn(vP) : Math.round(vP)}
                    </div>
                  )}
                </div>
              )}
              {vJ > 0 && (
                <div style={{ background: '#3b82f6', width: '100%', flex: pctJ, borderRadius: vP === 0 ? '3px 3px 0 0' : '0' }}>
                  {pctJ > 8 && (
                    <div style={{ fontSize: '7px', color: '#fff', textAlign: 'center', paddingTop: '2px' }}>
                      {fmtFn ? fmtFn(vJ) : Math.round(vJ)}
                    </div>
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
    <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
        <span style={{ fontSize: '11px', color: '#6b7280' }}>Jambel\u00ed</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e' }} />
        <span style={{ fontSize: '11px', color: '#6b7280' }}>Pun\u00e1</span>
      </div>
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

    const [{ data: jornadas }, { data: fijosZona }, { data: variables }] = await Promise.all([
      supabase.from('jornadas').select('*, clientes(nombre)').gte('fecha', '2026-01-01').lte('fecha', '2026-12-31'),
      supabase.from('costos_fijos_zona').select('*').eq('anio', 2026),
      supabase.from('costos_variables_mes_zona').select('*').eq('anio', 2026)
    ])

    if (!jornadas) { setCargando(false); return }

    const fijosMap = {}
    ;(fijosZona || []).forEach(f => { fijosMap[f.zona] = f })

    const porMes = {}
    for (let m = 1; m <= 12; m++) {
      porMes[m] = {
        mes: m,
        'Jambel\u00ed': { vuelos: 0, ha: 0, kg: 0, cargas: 0, porCliente: {} },
        'Pun\u00e1': { vuelos: 0, ha: 0, kg: 0, cargas: 0, porCliente: {} }
      }
    }

    jornadas.forEach(j => {
      const d = new Date(j.fecha + 'T12:00:00')
      const m = d.getMonth() + 1
      const zona = ZONA_CLIENTE[j.clientes?.nombre?.toUpperCase() || '']
      if (!zona) return
      porMes[m][zona].vuelos += j.cantidad_vuelos
      porMes[m][zona].ha += Number(j.hectareas || 0)
      porMes[m][zona].kg += Number(j.kg_esparcidos || 0)
      porMes[m][zona].cargas += Number(j.cargas_baterias || 0)
      const nombre = j.clientes?.nombre || 'Sin cliente'
      if (!porMes[m][zona].porCliente[nombre]) porMes[m][zona].porCliente[nombre] = { vuelos: 0, ha: 0, kg: 0 }
      porMes[m][zona].porCliente[nombre].vuelos += j.cantidad_vuelos
      porMes[m][zona].porCliente[nombre].ha += Number(j.hectareas || 0)
      porMes[m][zona].porCliente[nombre].kg += Number(j.kg_esparcidos || 0)
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
    for (let m = 1; m <= 12; m++) {
      const md = porMes[m]
      const varJ = variables?.find(v => v.mes === m && v.zona === 'Jambel\u00ed')
      const varP = variables?.find(v => v.mes === m && v.zona === 'Pun\u00e1')

      const costoJ = md['Jambel\u00ed'].vuelos > 0 ? calcCostoZona(fijosMap['Jambel\u00ed'], md['Jambel\u00ed'].cargas, varJ) : 0
      const costoP = md['Pun\u00e1'].vuelos > 0 ? calcCostoZona(fijosMap['Pun\u00e1'], md['Pun\u00e1'].cargas, varP) : 0
      const factorJ = md['Jambel\u00ed'].vuelos > 0 ? costoJ / md['Jambel\u00ed'].vuelos : 0
      const factorP = md['Pun\u00e1'].vuelos > 0 ? costoP / md['Pun\u00e1'].vuelos : 0

      const porClienteMonto = {}
      Object.entries(md['Jambel\u00ed'].porCliente).forEach(([c, v]) => {
        porClienteMonto[c] = { valor: factorJ * v.vuelos, vuelos: v.vuelos, ha: v.ha, kg: v.kg }
      })
      Object.entries(md['Pun\u00e1'].porCliente).forEach(([c, v]) => {
        porClienteMonto[c] = { valor: factorP * v.vuelos, vuelos: v.vuelos, ha: v.ha, kg: v.kg }
      })

      const vuelosJ = md['Jambel\u00ed'].vuelos
      const vuelosP = md['Pun\u00e1'].vuelos
      const haJ = md['Jambel\u00ed'].ha
      const haP = md['Pun\u00e1'].ha
      const kgJ = md['Jambel\u00ed'].kg
      const kgP = md['Pun\u00e1'].kg

      resultado.push({
        mes: m,
        vuelos: vuelosJ + vuelosP,
        vuelosJ, vuelosP,
        ha: haJ + haP,
        haJ, haP,
        kg: kgJ + kgP,
        kgJ, kgP,
        costo: costoJ + costoP,
        costoJ, costoP,
        costoHa: (haJ + haP) > 0 ? (costoJ + costoP) / (haJ + haP) : 0,
        porCliente: porClienteMonto
      })
    }

    const todosClientes = [...new Set(jornadas.map(j => j.clientes?.nombre).filter(Boolean))].sort()
    setClientesUnicos(todosClientes)
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

  const tablaClientes = clientesUnicos.map(c => {
    const porMesCliente = datos.map(d => ({
      mes: d.mes,
      valor: d.porCliente[c]?.valor || 0,
      vuelos: d.porCliente[c]?.vuelos || 0,
      ha: d.porCliente[c]?.ha || 0
    }))
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
            <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">
              &larr; Volver al dashboard
            </button>
            <h1 className="text-2xl font-medium text-gray-900">Resumen anual 2026</h1>
            <p className="text-sm text-gray-400 mt-1">{mesesConDatos.length} meses con datos</p>
          </div>
        </div>

        {/* KPIs General */}
        <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-2">General</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
          {[
            { label: 'Costo YTD', value: fmt$(totalCosto), sub: 'acumulado 2026' },
            { label: 'Vuelos YTD', value: totalVuelos, sub: 'total del ano' },
            { label: 'Hectareas YTD', value: totalHa.toFixed(0), sub: 'ha aplicadas' },
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

        {/* KPIs por zona */}
        {[
          { zona: 'Jambel\u00ed', costo: totalCostoJ, vuelos: totalVuelosJ, ha: totalHaJ, kg: totalKgJ },
          { zona: 'Pun\u00e1', costo: totalCostoP, vuelos: totalVuelosP, ha: totalHaP, kg: totalKgP }
        ].map(z => (
          <div key={z.zona}>
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-2">{z.zona}</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
              {[
                { label: 'Costo', value: fmt$(z.costo) },
                { label: 'Vuelos', value: z.vuelos },
                { label: 'Hectareas', value: z.ha.toFixed(0) },
                { label: 'KG', value: z.kg.toFixed(0) },
                { label: 'Sacos', value: (z.kg / 30).toFixed(0) },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-4"
                  style={{ background: z.zona === 'Jambel\u00ed' ? '#eff6ff' : '#f0fdf4' }}>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
                  <div className="text-xl font-medium text-gray-900">{k.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mb-2" />

        {/* Gráfica costo operacional — barras apiladas */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Costo operacional por mes</div>
          <Leyenda />
          <BarChartDoble data={datos} keyJ="costoJ" keyP="costoP" fmtFn={fmt$} />
        </div>

        {/* Vuelos por mes */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">Vuelos por mes</div>
          <Leyenda />
          <BarChartDoble data={datos} keyJ="vuelosJ" keyP="vuelosP" />
        </div>

        {/* Ha por mes */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">Hectareas por mes</div>
          <Leyenda />
          <BarChartDoble data={datos} keyJ="haJ" keyP="haP" fmtFn={v => v.toFixed(0)} />
        </div>

        {/* Facturación por cliente */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Facturacion por cliente</div>
            <select value={clienteFiltro} onChange={e => setClienteFiltro(e.target.value)}
              className="h-8 px-3 border border-gray-200 rounded-lg text-xs outline-none"
              onFocus={e => e.target.style.borderColor = '#0D6CB0'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}>
              <option value="todos">Todos los clientes</option>
              {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {clienteFiltro === 'todos' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: '500px' }}>
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
                  {tablaClientes.map(c => {
                    const zona = ZONA_CLIENTE[c.cliente.toUpperCase()]
                    return (
                      <tr key={c.cliente} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 font-medium">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: zona === 'Jambel\u00ed' ? '#3b82f6' : '#22c55e' }} />
                            {c.cliente}
                          </div>
                        </td>
                        {mesesConDatos.map(d => (
                          <td key={d.mes} className="py-2 text-right text-gray-600">
                            {c.porMes.find(m => m.mes === d.mes)?.valor > 0
                              ? fmt$(c.porMes.find(m => m.mes === d.mes)?.valor)
                              : '\u2014'}
                          </td>
                        ))}
                        <td className="py-2 text-right font-medium" style={{ color: '#0D6CB0' }}>{fmt$(c.totalValor)}</td>
                      </tr>
                    )
                  })}
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
              </table>
            </div>
          ) : (
            clienteFiltrado && (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-[10px] uppercase text-gray-400 mb-1">Total facturado</div>
                    <div className="text-base font-medium" style={{ color: '#0D6CB0' }}>{fmt$(clienteFiltrado.totalValor)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-400 mb-1">Vuelos totales</div>
                    <div className="text-base font-medium">{clienteFiltrado.totalVuelos}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-gray-400 mb-1">Hectareas totales</div>
                    <div className="text-base font-medium">{clienteFiltrado.totalHa.toFixed(1)}</div>
                  </div>
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

        {/* Tabla detalle por mes */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Detalle por mes</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '560px' }}>
              <thead>
                <tr className="border-b border-gray-100">
                  {['Mes', 'Vuelos', 'Ha', 'KG', 'Sacos', 'Costo', 'Costo/ha', 'Costo/vuelo'].map(h => (
                    <th key={h} className="text-left text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.filter(d => d.vuelos > 0).map(d => (
                  <tr key={d.mes} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-xs font-medium pr-4">{MESES_FULL[d.mes]}</td>
                    <td className="py-2 text-xs pr-4">
                      <div>{d.vuelos}</div>
                      <div className="text-[10px] text-gray-400">J:{d.vuelosJ} P:{d.vuelosP}</div>
                    </td>
                    <td className="py-2 text-xs pr-4">
                      <div>{d.ha.toFixed(0)}</div>
                      <div className="text-[10px] text-gray-400">J:{d.haJ.toFixed(0)} P:{d.haP.toFixed(0)}</div>
                    </td>
                    <td className="py-2 text-xs pr-4">{d.kg.toFixed(0)}</td>
                    <td className="py-2 text-xs pr-4">{(d.kg / 30).toFixed(1)}</td>
                    <td className="py-2 text-xs font-medium pr-4">
                      <div>{fmt$(d.costo)}</div>
                      <div className="text-[10px] text-gray-400">J:{fmt$(d.costoJ)} P:{fmt$(d.costoP)}</div>
                    </td>
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
