import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

export default function Reporte() {
  const { anio, mes } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [clienteSeleccionado, setClienteSeleccionado] = useState('')
  const [logoBase64, setLogoBase64] = useState(null)

  useEffect(() => {
    cargarDatos()
    cargarLogo()
  }, [anio, mes])

  const cargarLogo = () => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      setLogoBase64(canvas.toDataURL('image/png'))
    }
    img.src = '/logo.png'
  }

  const cargarDatos = async () => {
    setCargando(true)
    const desde = primerDia(anio, mes)
    const hasta = ultimoDia(anio, mes)

    const [{ data: jornadas }, { data: fijos }, { data: varMes }] = await Promise.all([
      supabase.from('jornadas').select('*, clientes(nombre)').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase.from('costos_fijos').select('*').eq('anio', anio).single(),
      supabase.from('costos_variables_mes').select('*').eq('anio', anio).eq('mes', mes).single()
    ])

    if (!fijos) { setCargando(false); return }

    const totalVuelos = (jornadas || []).reduce((s, j) => s + j.cantidad_vuelos, 0)
    const totalHa = (jornadas || []).reduce((s, j) => s + Number(j.hectareas || 0), 0)
    const totalKg = (jornadas || []).reduce((s, j) => s + Number(j.kg_esparcidos || 0), 0)
    const totalCargas = (jornadas || []).reduce((s, j) => s + Number(j.cargas_baterias || 0), 0)

    const seguroMes = fijos.seguro_dron_anual / 12
    const depDron = fijos.dep_dron_costo_total / fijos.dep_dron_meses_vida_util
    const depBat = (fijos.dep_baterias_costo_total / fijos.dep_baterias_vida_util_ciclos) * totalCargas
    const depGen = fijos.dep_generador_costo_total / fijos.dep_generador_meses_vida_util

    const costosFijosDetalle = [
      { nombre: 'Sueldo piloto', monto: fijos.sueldo_piloto },
      { nombre: 'Sueldo botero', monto: fijos.sueldo_botero },
      { nombre: 'Seguro dron', monto: seguroMes },
      { nombre: 'Vacuna', monto: fijos.vacuna },
      { nombre: 'Depreciación dron', monto: depDron },
      { nombre: 'Depreciación baterías', monto: depBat },
      { nombre: 'Depreciación generador', monto: depGen },
    ]

    const costosVariablesDetalle = varMes ? [
      { nombre: 'Gasolina y aceite', monto: Number(varMes.gasolina_aceite) },
      { nombre: 'Muellaje / CostaTech', monto: Number(varMes.muellaje_costatech) },
      { nombre: 'Comisión piloto', monto: Number(varMes.comision_piloto) },
    ] : []

    const totalFijos = costosFijosDetalle.reduce((s, c) => s + c.monto, 0)
    const totalVars = costosVariablesDetalle.reduce((s, c) => s + c.monto, 0)
    const totalCosto = totalFijos + totalVars
    const factorVuelo = totalVuelos > 0 ? totalCosto / totalVuelos : 0

    const porCliente = {}
    ;(jornadas || []).forEach(j => {
      const nombre = j.clientes?.nombre || 'Sin cliente'
      if (!porCliente[nombre]) porCliente[nombre] = { nombre, vuelos: 0, ha: 0, kg: 0, jornadas: [], jornadasCount: 0 }
      porCliente[nombre].vuelos += j.cantidad_vuelos
      porCliente[nombre].ha += Number(j.hectareas || 0)
      porCliente[nombre].kg += Number(j.kg_esparcidos || 0)
      porCliente[nombre].jornadasCount++
      porCliente[nombre].jornadas.push(j)
    })

    const clientesArr = Object.values(porCliente).map(c => ({
      ...c,
      valor: factorVuelo * c.vuelos,
      costoHa: c.ha > 0 ? (factorVuelo * c.vuelos) / c.ha : 0,
      pct: totalCosto > 0 ? (factorVuelo * c.vuelos) / totalCosto * 100 : 0
    })).sort((a, b) => b.valor - a.valor)

    setData({
      jornadas: jornadas || [],
      fijos, varMes,
      totalVuelos, totalHa, totalKg, totalCargas,
      totalFijos, totalVars, totalCosto, factorVuelo,
      costosFijosDetalle, costosVariablesDetalle,
      clientes: clientesArr,
      costoVuelo: factorVuelo,
      costoHa: totalHa > 0 ? totalCosto / totalHa : 0,
    })
    setCargando(false)
  }

  const generarPDFCliente = (cliente) => {
    const doc = new jsPDF()
    const c = data.clientes.find(x => x.nombre === cliente)
    if (!c) return

    const mesLabel = `${MESES[Number(mes)]} ${anio}`
    const pageW = doc.internal.pageSize.getWidth()

    // Header azul
    doc.setFillColor(6, 73, 121)
    doc.rect(0, 0, pageW, 40, 'F')

    // Logo
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 10, 5, 40, 30)
    }

    // Título
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('COSTADRON', pageW - 15, 18, { align: 'right' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Operación dron agrícola · El Oro', pageW - 15, 25, { align: 'right' })
    doc.text(`Reporte de servicio — ${mesLabel}`, pageW - 15, 32, { align: 'right' })

    // Cliente info
    doc.setTextColor(6, 73, 121)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(c.nombre, 15, 55)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Período: ${mesLabel}`, 15, 62)
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es')}`, 15, 68)

    // Resumen
    doc.setFillColor(240, 247, 255)
    doc.rect(15, 75, pageW - 30, 30, 'F')
    doc.setTextColor(6, 73, 121)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN DEL SERVICIO', 20, 84)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    doc.text(`Jornadas realizadas: ${c.jornadasCount}`, 20, 92)
    doc.text(`Vuelos totales: ${c.vuelos}`, 80, 92)
    doc.text(`Hectáreas aplicadas: ${c.ha.toFixed(2)} ha`, 140, 92)
    doc.text(`KG esparcidos: ${c.kg.toFixed(2)} kg`, 20, 99)
    doc.text(`Costo por hectárea: ${fmt$(c.costoHa)}`, 80, 99)

    // Total a pagar
    doc.setFillColor(13, 108, 176)
    doc.rect(15, 110, pageW - 30, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('VALOR TOTAL A PAGAR', 20, 121)
    doc.setFontSize(14)
    doc.text(fmt$(c.valor), pageW - 20, 121, { align: 'right' })

    // Detalle de jornadas
    doc.setTextColor(6, 73, 121)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('DETALLE DE JORNADAS', 15, 140)

    const jornadasCliente = c.jornadas.sort((a, b) => a.fecha.localeCompare(b.fecha))
    const factorVuelo = data.factorVuelo

    autoTable(doc, {
      startY: 145,
      head: [['Fecha', 'Vuelos', 'Hectáreas', 'KG aplicados', 'Valor']],
      body: jornadasCliente.map(j => [
        j.fecha,
        j.cantidad_vuelos,
        Number(j.hectareas).toFixed(2),
        Number(j.kg_esparcidos).toFixed(2),
        fmt$(factorVuelo * j.cantidad_vuelos)
      ]),
      foot: [['Total', c.vuelos, c.ha.toFixed(2), c.kg.toFixed(2), fmt$(c.valor)]],
      headStyles: { fillColor: [6, 73, 121], textColor: 255, fontSize: 8 },
      footStyles: { fillColor: [240, 247, 255], textColor: [6, 73, 121], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 15, right: 15 }
    })

    // Footer
    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(6, 73, 121)
    doc.rect(0, pageH - 15, pageW, 15, 'F')
    doc.setTextColor(198, 219, 254)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('CostaMarket S.A. · Operación COSTADRON · El Oro, Ecuador', pageW / 2, pageH - 6, { align: 'center' })

    doc.save(`COSTADRON_${c.nombre}_${MESES[Number(mes)]}${anio}.pdf`)
  }

  const generarPDFInterno = () => {
    if (!data) return
    const doc = new jsPDF()
    const mesLabel = `${MESES[Number(mes)]} ${anio}`
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFillColor(2, 40, 71)
    doc.rect(0, 0, pageW, 40, 'F')
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 10, 5, 35, 28)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('REPORTE OPERACIONAL INTERNO', pageW - 15, 18, { align: 'right' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${mesLabel} · COSTADRON`, pageW - 15, 26, { align: 'right' })
    doc.text(`Generado: ${new Date().toLocaleDateString('es')}`, pageW - 15, 33, { align: 'right' })

    // KPIs
    doc.setTextColor(2, 40, 71)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN EJECUTIVO', 15, 52)

    const kpis = [
      ['Costo operacional total', fmt$(data.totalCosto)],
      ['Vuelos realizados', `${data.totalVuelos}`],
      ['Hectáreas aplicadas', `${data.totalHa.toFixed(1)} ha`],
      ['KG esparcidos', `${data.totalKg.toFixed(1)} kg`],
      ['Costo por vuelo', fmt$(data.costoVuelo)],
      ['Costo por hectárea', fmt$(data.costoHa)],
      ['Jornadas', `${data.jornadas.length}`],
      ['Clientes atendidos', `${data.clientes.length}`],
    ]

    autoTable(doc, {
      startY: 56,
      body: kpis,
      columnStyles: { 0: { fontStyle: 'bold', textColor: [6, 73, 121] }, 1: { halign: 'right' } },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [240, 247, 255] },
      margin: { left: 15, right: 15 }
    })

    // Clientes
    doc.setTextColor(2, 40, 71)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('DESGLOSE POR CLIENTE', 15, doc.lastAutoTable.finalY + 12)

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Cliente', 'Jornadas', 'Vuelos', 'Hectáreas', 'KG', 'Costo/ha', 'A facturar', '%']],
      body: data.clientes.map(c => [
        c.nombre, c.jornadasCount, c.vuelos,
        c.ha.toFixed(1), c.kg.toFixed(1),
        fmt$(c.costoHa), fmt$(c.valor),
        c.pct.toFixed(1) + '%'
      ]),
      foot: [['Total', data.jornadas.length, data.totalVuelos, data.totalHa.toFixed(1), data.totalKg.toFixed(1), '', fmt$(data.totalCosto), '100%']],
      headStyles: { fillColor: [2, 40, 71], textColor: 255, fontSize: 7 },
      footStyles: { fillColor: [198, 219, 254], textColor: [2, 40, 71], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 15, right: 15 }
    })

    // Costos
    doc.addPage()
    doc.setFillColor(2, 40, 71)
    doc.rect(0, 0, pageW, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`COMPOSICIÓN DE COSTOS — ${mesLabel}`, pageW / 2, 13, { align: 'center' })

    const todosCostos = [...data.costosFijosDetalle, ...data.costosVariablesDetalle]
    autoTable(doc, {
      startY: 28,
      head: [['Componente de costo', 'Monto ($)', '% del total']],
      body: todosCostos.map(c => [
        c.nombre, fmt$(c.monto),
        (c.monto / data.totalCosto * 100).toFixed(1) + '%'
      ]),
      foot: [['Total', fmt$(data.totalCosto), '100%']],
      headStyles: { fillColor: [2, 40, 71], textColor: 255, fontSize: 9 },
      footStyles: { fillColor: [198, 219, 254], textColor: [2, 40, 71], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 15, right: 15 }
    })

    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(6, 73, 121)
    doc.rect(0, pageH - 15, pageW, 15, 'F')
    doc.setTextColor(198, 219, 254)
    doc.setFontSize(7)
    doc.text('CostaMarket S.A. · Operación COSTADRON · Documento interno confidencial', pageW / 2, pageH - 6, { align: 'center' })

    doc.save(`COSTADRON_Reporte_Interno_${MESES[Number(mes)]}${anio}.pdf`)
  }

  if (cargando) return <Layout><div className="text-center py-16 text-sm text-gray-400">Cargando reporte...</div></Layout>
  if (!data) return <Layout><div className="text-center py-16 text-sm text-gray-400">Sin datos para este período.</div></Layout>

  const mesLabel = `${MESES[Number(mes)]} ${anio}`

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-16">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
              ← Volver al dashboard
            </button>
            <h1 className="text-2xl font-medium text-gray-900">Reporte — {mesLabel}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generarPDFInterno}
              className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              PDF interno ↓
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          {[
            { label: 'Costo total', value: fmt$(data.totalCosto), sub: `${data.clientes.length} clientes` },
            { label: 'Vuelos', value: data.totalVuelos, sub: `${data.jornadas.length} jornadas` },
            { label: 'Hectáreas', value: data.totalHa.toFixed(0), sub: 'ha' },
            { label: 'Costo/vuelo', value: fmt$(data.costoVuelo), sub: `${fmt$(data.costoHa)} / ha` },
          ].map(k => (
            <div key={k.label} className="bg-gray-50 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
              <div className="text-xl font-medium text-gray-900">{k.value}</div>
              <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Clientes */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Desglose por cliente</div>
          <div className="overflow-x-auto"><table className="w-full text-sm" style={{minWidth:'600px'}}>
            <thead>
              <tr className="border-b border-gray-100">
                {['Cliente','Jornadas','Vuelos','Ha','KG','Costo/ha','A facturar','%',''].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium pr-3 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.clientes.map(c => (
                <tr key={c.nombre} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-xs font-medium pr-3">{c.nombre}</td>
                  <td className="py-2 text-xs text-gray-500 pr-3">{c.jornadasCount}</td>
                  <td className="py-2 text-xs pr-3">{c.vuelos}</td>
                  <td className="py-2 text-xs pr-3">{c.ha.toFixed(1)}</td>
                  <td className="py-2 text-xs pr-3">{c.kg.toFixed(0)}</td>
                  <td className="py-2 text-xs pr-3">{fmt$(c.costoHa)}</td>
                  <td className="py-2 text-xs font-medium pr-3">{fmt$(c.valor)}</td>
                  <td className="py-2 text-xs text-gray-400 pr-3">{c.pct.toFixed(1)}%</td>
                  <td className="py-2">
                    <button
                      onClick={() => generarPDFCliente(c.nombre)}
                      className="text-xs px-2 py-1 rounded text-white transition-colors"
                      style={{ background: '#0D6CB0' }}
                      onMouseEnter={e => e.target.style.background = '#064979'}
                      onMouseLeave={e => e.target.style.background = '#0D6CB0'}
                    >
                      PDF ↓
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td className="pt-3 text-xs font-medium">Total</td>
                <td className="pt-3 text-xs">{data.jornadas.length}</td>
                <td className="pt-3 text-xs">{data.totalVuelos}</td>
                <td className="pt-3 text-xs">{data.totalHa.toFixed(1)}</td>
                <td className="pt-3 text-xs">{data.totalKg.toFixed(0)}</td>
                <td className="pt-3 text-xs"></td>
                <td className="pt-3 text-xs font-medium">{fmt$(data.totalCosto)}</td>
                <td className="pt-3 text-xs">100%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Composición costos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Costos fijos</div>
            {data.costosFijosDetalle.map(c => (
              <div key={c.nombre} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{c.nombre}</span>
                <span className="text-xs font-medium">{fmt$(c.monto)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
              <span className="text-xs font-medium text-gray-700">Total fijos</span>
              <span className="text-xs font-medium" style={{ color: '#0D6CB0' }}>{fmt$(data.totalFijos)}</span>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Costos variables</div>
            {data.costosVariablesDetalle.map(c => (
              <div key={c.nombre}>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-xs text-gray-500">{c.nombre}</span>
                  <span className="text-xs font-medium">{fmt$(c.monto)}</span>
                </div>
                {c.nombre === 'Muellaje / CostaTech' && data.varMes?.muellaje_items?.filter(i => i.descripcion || i.monto).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1.5 pl-4 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-400">· {item.descripcion}</span>
                    <span className="text-xs text-gray-400">{fmt$(item.monto)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
              <span className="text-xs font-medium text-gray-700">Total variables</span>
              <span className="text-xs font-medium" style={{ color: '#0D6CB0' }}>{fmt$(data.totalVars)}</span>
            </div>
          </div>
        </div>

      </div>
      </div>
    </Layout>
  )
}
