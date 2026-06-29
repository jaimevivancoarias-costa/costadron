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

const ZONA_CLIENTE = {
  'REYMAR': 'Pun\u00e1', 'PACIMAR': 'Pun\u00e1', 'LANGUISA': 'Pun\u00e1',
  'NUTRIFEED': 'Jambel\u00ed', 'OCEANAZUL': 'Jambel\u00ed', 'AUSTROMAR': 'Jambel\u00ed',
  'LIMONVER': 'Jambel\u00ed', 'OCEANMARKET': 'Jambel\u00ed', 'SEVILLA': 'Jambel\u00ed',
  'MAREEXPORT': 'Jambel\u00ed', 'AGRIMARINE': 'Jambel\u00ed'
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

function calcCostoFijoZona(fijos, totalCargas) {
  if (!fijos) return 0
  const seguroMes = fijos.seguro_dron_anual / 12
  const depDron = fijos.dep_dron_costo_total / (fijos.dep_dron_meses_vida_util || 1)
  const depBat = (fijos.dep_baterias_costo_total / (fijos.dep_baterias_vida_util_ciclos || 1)) * totalCargas
  const depGen = fijos.dep_generador_costo_total / (fijos.dep_generador_meses_vida_util || 1)
  return (fijos.sueldo_piloto || 0) + (fijos.sueldo_botero || 0) + (fijos.vacuna || 0) + seguroMes + depDron + depBat + depGen
}

export default function Reporte() {
  const { anio, mes } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
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

    const [{ data: jornadas }, { data: fijosZona }, { data: varsMes }] = await Promise.all([
      supabase.from('jornadas').select('*, clientes(nombre)').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase.from('costos_fijos_zona').select('*').eq('anio', anio),
      supabase.from('costos_variables_mes_zona').select('*').eq('anio', anio).eq('mes', mes)
    ])

    const fijosMap = {}
    ;(fijosZona || []).forEach(f => { fijosMap[f.zona] = f })

    const varsMap = {}
    ;(varsMes || []).forEach(v => { varsMap[v.zona] = v })

    const jornadasArr = jornadas || []

    // Separar por zona
    const jornadasPorZona = { 'Jambel\u00ed': [], 'Pun\u00e1': [] }
    jornadasArr.forEach(j => {
      const z = ZONA_CLIENTE[j.clientes?.nombre?.toUpperCase() || '']
      if (z) jornadasPorZona[z].push(j)
    })

    const calcZona = (zona) => {
      const js = jornadasPorZona[zona]
      const totalVuelos = js.reduce((s, j) => s + j.cantidad_vuelos, 0)
      const totalHa = js.reduce((s, j) => s + Number(j.hectareas || 0), 0)
      const totalKg = js.reduce((s, j) => s + Number(j.kg_esparcidos || 0), 0)
      const totalCargas = js.reduce((s, j) => s + Number(j.cargas_baterias || 0), 0)
      const fijos = fijosMap[zona]
      const vars = varsMap[zona]

      const costoFijo = calcCostoFijoZona(fijos, totalCargas)
      const costoVar = vars
        ? Number(vars.gasolina_aceite) + Number(vars.muellaje_costatech) + Number(vars.comision_piloto)
        : 0
      const totalCosto = costoFijo + costoVar
      const factorVuelo = totalVuelos > 0 ? totalCosto / totalVuelos : 0

      // Detalle de costos fijos
      const seguroMes = fijos ? fijos.seguro_dron_anual / 12 : 0
      const depDron = fijos ? fijos.dep_dron_costo_total / (fijos.dep_dron_meses_vida_util || 1) : 0
      const depBat = fijos ? (fijos.dep_baterias_costo_total / (fijos.dep_baterias_vida_util_ciclos || 1)) * totalCargas : 0
      const depGen = fijos ? fijos.dep_generador_costo_total / (fijos.dep_generador_meses_vida_util || 1) : 0

      const costosFijosDetalle = fijos ? [
        { nombre: 'Sueldo piloto', monto: fijos.sueldo_piloto || 0 },
        ...(fijos.sueldo_botero > 0 ? [{ nombre: 'Sueldo botero', monto: fijos.sueldo_botero }] : []),
        { nombre: 'Seguro dron', monto: seguroMes },
        { nombre: 'Vacuna', monto: fijos.vacuna || 0 },
        { nombre: 'Depreciacion dron', monto: depDron },
        { nombre: 'Depreciacion baterias', monto: depBat },
        ...(depGen > 0 ? [{ nombre: 'Depreciacion generador', monto: depGen }] : []),
      ] : []

      const muellajeItems = vars?.muellaje_items?.filter(i => i.descripcion || i.monto) || []
      const costosVariablesDetalle = vars ? [
        { nombre: 'Gasolina y aceite', monto: Number(vars.gasolina_aceite) || 0 },
        { nombre: 'Muellaje / CostaTech', monto: Number(vars.muellaje_costatech) || 0, items: muellajeItems },
        { nombre: 'Comision piloto', monto: Number(vars.comision_piloto) || 0 },
      ] : []

      // Clientes de esta zona
      const porCliente = {}
      js.forEach(j => {
        const nombre = j.clientes?.nombre || 'Sin cliente'
        if (!porCliente[nombre]) porCliente[nombre] = { nombre, vuelos: 0, ha: 0, kg: 0, jornadasCount: 0, jornadas: [] }
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

      return {
        totalVuelos, totalHa, totalKg, totalCargas,
        costoFijo, costoVar, totalCosto, factorVuelo,
        costosFijosDetalle, costosVariablesDetalle,
        clientes: clientesArr,
        jornadas: js
      }
    }

    const j = calcZona('Jambel\u00ed')
    const p = calcZona('Pun\u00e1')

    const totalCosto = j.totalCosto + p.totalCosto
    const totalVuelos = j.totalVuelos + p.totalVuelos
    const totalHa = j.totalHa + p.totalHa
    const totalKg = j.totalKg + p.totalKg
    const todosClientes = [...j.clientes, ...p.clientes].sort((a, b) => b.valor - a.valor)

    setData({
      jornadas: jornadasArr,
      zonas: {
        'Jambel\u00ed': { ...j, fijos: fijosMap['Jambel\u00ed'], vars: varsMap['Jambel\u00ed'] },
        'Pun\u00e1': { ...p, fijos: fijosMap['Pun\u00e1'], vars: varsMap['Pun\u00e1'] }
      },
      totalCosto, totalVuelos, totalHa, totalKg,
      costoVuelo: totalVuelos > 0 ? totalCosto / totalVuelos : 0,
      costoHa: totalHa > 0 ? totalCosto / totalHa : 0,
      todosClientes,
      fijosMap, varsMap
    })
    setCargando(false)
  }

  const generarPDFCliente = (zona, clienteNombre) => {
    const zonaData = data.zonas[zona]
    const c = zonaData.clientes.find(x => x.nombre === clienteNombre)
    if (!c) return

    const doc = new jsPDF()
    const mesLabel = `${MESES[Number(mes)]} ${anio}`
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFillColor(6, 73, 121)
    doc.rect(0, 0, pageW, 40, 'F')
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 10, 5, 40, 30)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('COSTADRON', pageW - 15, 18, { align: 'right' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Operacion dron agricola - El Oro', pageW - 15, 25, { align: 'right' })
    doc.text('Reporte de servicio - ' + mesLabel, pageW - 15, 32, { align: 'right' })

    doc.setTextColor(6, 73, 121)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(c.nombre, 15, 55)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Periodo: ' + mesLabel, 15, 62)
    doc.text('Zona: ' + zona, 15, 68)
    doc.text('Fecha de emision: ' + new Date().toLocaleDateString('es'), 15, 74)

    doc.setFillColor(240, 247, 255)
    doc.rect(15, 80, pageW - 30, 30, 'F')
    doc.setTextColor(6, 73, 121)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN DEL SERVICIO', 20, 89)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    doc.text('Jornadas: ' + c.jornadasCount, 20, 97)
    doc.text('Vuelos totales: ' + c.vuelos, 80, 97)
    doc.text('Hectareas aplicadas: ' + c.ha.toFixed(2) + ' ha', 140, 97)
    doc.text('KG esparcidos: ' + c.kg.toFixed(2) + ' kg', 20, 104)
    doc.text('Sacos aplicados: ' + (c.kg / 30).toFixed(1) + ' sacos', 80, 104)
    doc.text('Costo por hectarea: ' + fmt$(c.costoHa), 140, 104)

    doc.setFillColor(13, 108, 176)
    doc.rect(15, 115, pageW - 30, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('VALOR TOTAL A PAGAR', 20, 126)
    doc.setFontSize(14)
    doc.text(fmt$(c.valor), pageW - 20, 126, { align: 'right' })

    doc.setTextColor(6, 73, 121)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('DETALLE DE JORNADAS', 15, 145)

    const jornadasCliente = c.jornadas.sort((a, b) => a.fecha.localeCompare(b.fecha))
    autoTable(doc, {
      startY: 150,
      head: [['Fecha', 'Vuelos', 'Hectareas', 'KG aplicados', 'Sacos', 'Valor']],
      body: jornadasCliente.map(j => [
        j.fecha, j.cantidad_vuelos,
        Number(j.hectareas).toFixed(2),
        Number(j.kg_esparcidos).toFixed(2),
        (Number(j.kg_esparcidos) / 30).toFixed(1),
        fmt$(zonaData.factorVuelo * j.cantidad_vuelos)
      ]),
      foot: [['Total', c.vuelos, c.ha.toFixed(2), c.kg.toFixed(2), (c.kg / 30).toFixed(1), fmt$(c.valor)]],
      headStyles: { fillColor: [6, 73, 121], textColor: 255, fontSize: 8 },
      footStyles: { fillColor: [240, 247, 255], textColor: [6, 73, 121], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 15, right: 15 }
    })

    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(6, 73, 121)
    doc.rect(0, pageH - 15, pageW, 15, 'F')
    doc.setTextColor(198, 219, 254)
    doc.setFontSize(7)
    doc.text('CostaMarket S.A. - Operacion COSTADRON - El Oro, Ecuador', pageW / 2, pageH - 6, { align: 'center' })

    doc.save('COSTADRON_' + c.nombre + '_' + MESES[Number(mes)] + anio + '.pdf')
  }

  const generarPDFInterno = () => {
    if (!data) return
    const doc = new jsPDF()
    const mesLabel = `${MESES[Number(mes)]} ${anio}`
    const pageW = doc.internal.pageSize.getWidth()

    // Portada
    doc.setFillColor(2, 40, 71)
    doc.rect(0, 0, pageW, 40, 'F')
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 10, 5, 35, 28)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('REPORTE OPERACIONAL INTERNO', pageW - 15, 18, { align: 'right' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(mesLabel + ' - COSTADRON', pageW - 15, 26, { align: 'right' })
    doc.text('Generado: ' + new Date().toLocaleDateString('es'), pageW - 15, 33, { align: 'right' })

    // Resumen ejecutivo consolidado
    doc.setTextColor(2, 40, 71)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN EJECUTIVO CONSOLIDADO', 15, 52)

    autoTable(doc, {
      startY: 56,
      body: [
        ['Costo operacional total', fmt$(data.totalCosto)],
        ['Vuelos realizados', '' + data.totalVuelos],
        ['Hectareas aplicadas', data.totalHa.toFixed(1) + ' ha'],
        ['KG esparcidos', data.totalKg.toFixed(1) + ' kg'],
        ['Sacos aplicados', (data.totalKg / 30).toFixed(1) + ' sacos'],
        ['Costo por vuelo', fmt$(data.costoVuelo)],
        ['Costo por hectarea', fmt$(data.costoHa)],
        ['Jornadas totales', '' + data.jornadas.length],
        ['Clientes atendidos', '' + data.todosClientes.length],
      ],
      columnStyles: { 0: { fontStyle: 'bold', textColor: [6, 73, 121] }, 1: { halign: 'right' } },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [240, 247, 255] },
      margin: { left: 15, right: 15 }
    })

    // Desglose por zona
    doc.setTextColor(2, 40, 71)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('DESGLOSE POR ZONA', 15, doc.lastAutoTable.finalY + 12)

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Zona', 'Vuelos', 'Ha', 'KG', 'Sacos', 'Costo fijo', 'Costo var.', 'Total', 'Costo/vuelo']],
      body: ['Jambel\u00ed', 'Pun\u00e1'].map(zona => {
        const z = data.zonas[zona]
        return [
          zona, z.totalVuelos, z.totalHa.toFixed(1), z.totalKg.toFixed(0),
          (z.totalKg / 30).toFixed(1),
          fmt$(z.costoFijo), fmt$(z.costoVar), fmt$(z.totalCosto),
          fmt$(z.totalVuelos > 0 ? z.totalCosto / z.totalVuelos : 0)
        ]
      }),
      headStyles: { fillColor: [2, 40, 71], textColor: 255, fontSize: 7 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 247, 255] },
      margin: { left: 15, right: 15 }
    })

    // Clientes por zona — Jambelí
    doc.setTextColor(2, 40, 71)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('CLIENTES JAMBELI', 15, doc.lastAutoTable.finalY + 12)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Cliente', 'Jornadas', 'Vuelos', 'Ha', 'KG', 'Sacos', 'Costo/ha', 'A facturar', '%']],
      body: data.zonas['Jambel\u00ed'].clientes.map(c => [
        c.nombre, c.jornadasCount, c.vuelos,
        c.ha.toFixed(1), c.kg.toFixed(0), (c.kg / 30).toFixed(1),
        fmt$(c.costoHa), fmt$(c.valor), c.pct.toFixed(1) + '%'
      ]),
      foot: [['Total Jambeli', '', data.zonas['Jambel\u00ed'].totalVuelos,
        data.zonas['Jambel\u00ed'].totalHa.toFixed(1),
        data.zonas['Jambel\u00ed'].totalKg.toFixed(0),
        (data.zonas['Jambel\u00ed'].totalKg / 30).toFixed(1),
        '', fmt$(data.zonas['Jambel\u00ed'].totalCosto), '100%']],
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 7 },
      footStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      margin: { left: 15, right: 15 }
    })

    // Clientes por zona — Puná
    doc.setTextColor(2, 40, 71)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('CLIENTES PUNA', 15, doc.lastAutoTable.finalY + 12)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Cliente', 'Jornadas', 'Vuelos', 'Ha', 'KG', 'Sacos', 'Costo/ha', 'A facturar', '%']],
      body: data.zonas['Pun\u00e1'].clientes.map(c => [
        c.nombre, c.jornadasCount, c.vuelos,
        c.ha.toFixed(1), c.kg.toFixed(0), (c.kg / 30).toFixed(1),
        fmt$(c.costoHa), fmt$(c.valor), c.pct.toFixed(1) + '%'
      ]),
      foot: [['Total Puna', '', data.zonas['Pun\u00e1'].totalVuelos,
        data.zonas['Pun\u00e1'].totalHa.toFixed(1),
        data.zonas['Pun\u00e1'].totalKg.toFixed(0),
        (data.zonas['Pun\u00e1'].totalKg / 30).toFixed(1),
        '', fmt$(data.zonas['Pun\u00e1'].totalCosto), '100%']],
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontSize: 7 },
      footStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { left: 15, right: 15 }
    })

    // Página 2 — Composición de costos por zona
    doc.addPage()
    doc.setFillColor(2, 40, 71)
    doc.rect(0, 0, pageW, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('COMPOSICION DE COSTOS - ' + mesLabel, pageW / 2, 13, { align: 'center' })

    ;['Jambel\u00ed', 'Pun\u00e1'].forEach((zona, zi) => {
      const z = data.zonas[zona]
      doc.setTextColor(2, 40, 71)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('COSTOS ' + zona.toUpperCase(), 15, zi === 0 ? 30 : doc.lastAutoTable.finalY + 14)

      const todosCostos = [
        ...z.costosFijosDetalle,
        ...z.costosVariablesDetalle.flatMap(c =>
          c.nombre === 'Muellaje / CostaTech' && c.items?.length > 0
            ? [c, ...c.items.map(i => ({ nombre: '  - ' + i.descripcion, monto: Number(i.monto) }))]
            : [c]
        )
      ]

      autoTable(doc, {
        startY: zi === 0 ? 34 : doc.lastAutoTable.finalY + 18,
        head: [['Componente', 'Monto', '% del total zona']],
        body: todosCostos.map(c => [
          c.nombre, fmt$(c.monto),
          z.totalCosto > 0 ? (c.monto / z.totalCosto * 100).toFixed(1) + '%' : '0%'
        ]),
        foot: [['Total ' + zona, fmt$(z.totalCosto), '100%']],
        headStyles: { fillColor: zona === 'Jambel\u00ed' ? [30, 64, 175] : [22, 101, 52], textColor: 255, fontSize: 8 },
        footStyles: {
          fillColor: zona === 'Jambel\u00ed' ? [219, 234, 254] : [220, 252, 231],
          textColor: zona === 'Jambel\u00ed' ? [30, 64, 175] : [22, 101, 52],
          fontStyle: 'bold', fontSize: 8
        },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: zona === 'Jambel\u00ed' ? [239, 246, 255] : [240, 253, 244] },
        margin: { left: 15, right: 15 }
      })
    })

    const pageH = doc.internal.pageSize.getHeight()
    doc.setFillColor(6, 73, 121)
    doc.rect(0, pageH - 15, pageW, 15, 'F')
    doc.setTextColor(198, 219, 254)
    doc.setFontSize(7)
    doc.text('CostaMarket S.A. - Operacion COSTADRON - Documento interno confidencial', pageW / 2, pageH - 6, { align: 'center' })

    doc.save('COSTADRON_Reporte_Interno_' + MESES[Number(mes)] + anio + '.pdf')
  }

  if (cargando) return <Layout><div className="text-center py-16 text-sm text-gray-400">Cargando reporte...</div></Layout>
  if (!data) return <Layout><div className="text-center py-16 text-sm text-gray-400">Sin datos para este periodo.</div></Layout>

  const mesLabel = `${MESES[Number(mes)]} ${anio}`

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-16">

        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
              &larr; Volver al dashboard
            </button>
            <h1 className="text-2xl font-medium text-gray-900">Reporte &mdash; {mesLabel}</h1>
          </div>
          <button onClick={generarPDFInterno}
            className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            PDF interno &#8595;
          </button>
        </div>

        {/* KPIs consolidados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
          {[
            { label: 'Costo total', value: fmt$(data.totalCosto), sub: data.todosClientes.length + ' clientes' },
            { label: 'Vuelos', value: data.totalVuelos, sub: data.jornadas.length + ' jornadas' },
            { label: 'Hectareas', value: data.totalHa.toFixed(0), sub: 'ha' },
            { label: 'Costo/vuelo', value: fmt$(data.costoVuelo), sub: fmt$(data.costoHa) + ' / ha' },
          ].map(k => (
            <div key={k.label} className="bg-gray-50 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
              <div className="text-xl font-medium text-gray-900">{k.value}</div>
              <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* KPIs por zona */}
        {['Jambel\u00ed', 'Pun\u00e1'].map(zona => {
          const z = data.zonas[zona]
          return (
            <div key={zona} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
              {[
                { label: zona + ' \u2014 Costo', value: fmt$(z.totalCosto) },
                { label: zona + ' \u2014 Vuelos', value: z.totalVuelos },
                { label: zona + ' \u2014 Ha', value: z.totalHa.toFixed(0) },
                { label: zona + ' \u2014 Costo/vuelo', value: fmt$(z.totalVuelos > 0 ? z.totalCosto / z.totalVuelos : 0) },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-4"
                  style={{ background: zona === 'Jambel\u00ed' ? '#eff6ff' : '#f0fdf4' }}>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
                  <div className="text-xl font-medium text-gray-900">{k.value}</div>
                </div>
              ))}
            </div>
          )
        })}

        <div className="mb-5" />

        {/* Tablas de clientes por zona */}
        {['Jambel\u00ed', 'Pun\u00e1'].map(zona => {
          const z = data.zonas[zona]
          if (z.clientes.length === 0) return null
          return (
            <div key={zona} className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: zona === 'Jambel\u00ed' ? '#3b82f6' : '#22c55e' }} />
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Desglose por cliente &mdash; {zona}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Cliente', 'Jornadas', 'Vuelos', 'Ha', 'KG', 'Sacos', 'Costo/ha', 'A facturar', '%', ''].map(h => (
                        <th key={h} className="text-left text-[10px] uppercase tracking-wider text-gray-400 pb-2 font-medium pr-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {z.clientes.map(c => (
                      <tr key={c.nombre} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 text-xs font-medium pr-3">{c.nombre}</td>
                        <td className="py-2 text-xs text-gray-500 pr-3">{c.jornadasCount}</td>
                        <td className="py-2 text-xs pr-3">{c.vuelos}</td>
                        <td className="py-2 text-xs pr-3">{c.ha.toFixed(1)}</td>
                        <td className="py-2 text-xs pr-3">{c.kg.toFixed(0)}</td>
                        <td className="py-2 text-xs pr-3">{(c.kg / 30).toFixed(1)}</td>
                        <td className="py-2 text-xs pr-3">{fmt$(c.costoHa)}</td>
                        <td className="py-2 text-xs font-medium pr-3">{fmt$(c.valor)}</td>
                        <td className="py-2 text-xs text-gray-400 pr-3">{c.pct.toFixed(1)}%</td>
                        <td className="py-2">
                          <button onClick={() => generarPDFCliente(zona, c.nombre)}
                            className="text-xs px-2 py-1 rounded text-white"
                            style={{ background: zona === 'Jambel\u00ed' ? '#1e40af' : '#166534' }}
                            onMouseEnter={e => e.target.style.opacity = '0.85'}
                            onMouseLeave={e => e.target.style.opacity = '1'}>
                            PDF &#8595;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td className="pt-3 text-xs font-medium">Total {zona}</td>
                      <td className="pt-3 text-xs">{z.jornadas.length}</td>
                      <td className="pt-3 text-xs">{z.totalVuelos}</td>
                      <td className="pt-3 text-xs">{z.totalHa.toFixed(1)}</td>
                      <td className="pt-3 text-xs">{z.totalKg.toFixed(0)}</td>
                      <td className="pt-3 text-xs">{(z.totalKg / 30).toFixed(1)}</td>
                      <td className="pt-3 text-xs"></td>
                      <td className="pt-3 text-xs font-medium">{fmt$(z.totalCosto)}</td>
                      <td className="pt-3 text-xs">100%</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        })}

        {/* Composición de costos por zona */}
        {['Jambel\u00ed', 'Pun\u00e1'].map(zona => {
          const z = data.zonas[zona]
          if (!z.fijos) return null
          return (
            <div key={zona} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full"
                    style={{ background: zona === 'Jambel\u00ed' ? '#3b82f6' : '#22c55e' }} />
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Costos fijos &mdash; {zona}
                  </div>
                </div>
                {z.costosFijosDetalle.map(c => (
                  <div key={c.nombre} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">{c.nombre}</span>
                    <span className="text-xs font-medium">{fmt$(c.monto)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
                  <span className="text-xs font-medium text-gray-700">Total fijos</span>
                  <span className="text-xs font-medium" style={{ color: zona === 'Jambel\u00ed' ? '#1e40af' : '#166534' }}>{fmt$(z.costoFijo)}</span>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full"
                    style={{ background: zona === 'Jambel\u00ed' ? '#3b82f6' : '#22c55e' }} />
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Costos variables &mdash; {zona}
                  </div>
                </div>
                {z.costosVariablesDetalle.length > 0 ? z.costosVariablesDetalle.map(c => (
                  <div key={c.nombre}>
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-xs text-gray-500">{c.nombre}</span>
                      <span className="text-xs font-medium">{fmt$(c.monto)}</span>
                    </div>
                    {c.nombre === 'Muellaje / CostaTech' && c.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1.5 pl-4 border-b border-gray-50">
                        <span className="text-xs text-gray-400">&middot; {item.descripcion}</span>
                        <span className="text-xs text-gray-400">{fmt$(item.monto)}</span>
                      </div>
                    ))}
                  </div>
                )) : (
                  <div className="text-xs text-gray-400 py-4 text-center">Sin costos variables cargados</div>
                )}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
                  <span className="text-xs font-medium text-gray-700">Total variables</span>
                  <span className="text-xs font-medium" style={{ color: zona === 'Jambel\u00ed' ? '#1e40af' : '#166534' }}>{fmt$(z.costoVar)}</span>
                </div>
              </div>
            </div>
          )
        })}

      </div>
    </Layout>
  )
}
