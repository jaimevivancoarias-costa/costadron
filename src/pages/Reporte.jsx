import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const MESES = {
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

// Helper para colores en jsPDF — siempre r, g, b separados
function fill(doc, r, g, b) { doc.setFillColor(r, g, b) }
function stroke(doc, r, g, b) { doc.setDrawColor(r, g, b) }
function color(doc, r, g, b) { doc.setTextColor(r, g, b) }

export default function Reporte() {
  const { anio, mes } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const esContador = usuario?.rol === 'contador'
  const zonaKeyUser = usuario?.zona === 'Puná' ? 'Puna' : 'Jambeli'   // clave interna (sin tilde)
  const zonaKeysVisibles = esContador ? [zonaKeyUser] : ['Jambeli', 'Puna']
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [logoBase64, setLogoBase64] = useState(null)

  useEffect(() => { cargarDatos(); cargarLogo() }, [anio, mes])

  const cargarLogo = () => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
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
    ;(fijosZona || []).forEach(f => {
      if (f.zona === 'Jambelí') fijosMap['Jambeli'] = f
      if (f.zona === 'Puná') fijosMap['Puna'] = f
    })

    const varsMap = {}
    ;(varsMes || []).forEach(v => {
      if (v.zona === 'Jambelí') varsMap['Jambeli'] = v
      if (v.zona === 'Puná') varsMap['Puna'] = v
    })

    const jornadasArr = jornadas || []
    const jornadasPorZona = { Jambeli: [], Puna: [] }
    jornadasArr.forEach(j => {
      const z = ZONA_CLIENTE[j.clientes?.nombre?.toUpperCase() || '']
      if (z) jornadasPorZona[z].push(j)
    })

    const calcZona = (zonaKey) => {
      const js = jornadasPorZona[zonaKey]
      const totalVuelos = js.reduce((s, j) => s + j.cantidad_vuelos, 0)
      const totalHa = js.reduce((s, j) => s + Number(j.hectareas || 0), 0)
      const totalKg = js.reduce((s, j) => s + Number(j.kg_esparcidos || 0), 0)
      const totalCargas = js.reduce((s, j) => s + Number(j.cargas_baterias || 0), 0)
      const fijos = fijosMap[zonaKey]
      const vars = varsMap[zonaKey]
      const costoFijo = calcCostoFijoZona(fijos, totalCargas)
      const costoVar = vars ? Number(vars.gasolina_aceite) + Number(vars.muellaje_costatech) + Number(vars.comision_piloto) : 0
      const totalCosto = costoFijo + costoVar
      const factorVuelo = totalVuelos > 0 ? totalCosto / totalVuelos : 0

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

      return { totalVuelos, totalHa, totalKg, totalCargas, costoFijo, costoVar, totalCosto, factorVuelo, costosFijosDetalle, costosVariablesDetalle, clientes: clientesArr, jornadas: js }
    }

    const j = calcZona('Jambeli')
    const p = calcZona('Puna')
    const totalCosto = j.totalCosto + p.totalCosto
    const totalVuelos = j.totalVuelos + p.totalVuelos
    const totalHa = j.totalHa + p.totalHa
    const totalKg = j.totalKg + p.totalKg

    setData({
      jornadas: jornadasArr,
      zonas: { Jambeli: { ...j, fijos: fijosMap['Jambeli'], vars: varsMap['Jambeli'] }, Puna: { ...p, fijos: fijosMap['Puna'], vars: varsMap['Puna'] } },
      totalCosto, totalVuelos, totalHa, totalKg,
      costoVuelo: totalVuelos > 0 ? totalCosto / totalVuelos : 0,
      costoHa: totalHa > 0 ? totalCosto / totalHa : 0,
      todosClientes: [...j.clientes, ...p.clientes].sort((a, b) => b.valor - a.valor),
    })
    setCargando(false)
  }

  const generarPDFCliente = (zonaKey, clienteNombre) => {
    const zonaData = data.zonas[zonaKey]
    const c = zonaData.clientes.find(x => x.nombre === clienteNombre)
    if (!c) return
    const zonaLabel = zonaKey === 'Jambeli' ? 'Jambeli' : 'Puna'
    const doc = new jsPDF()
    const mesLabel = `${MESES[Number(mes)]} ${anio}`
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    fill(doc, 2, 40, 71); doc.rect(0, 0, pageW, 50, 'F')
    fill(doc, 13, 108, 176); doc.rect(0, 41, pageW, 9, 'F')
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 12, 8, 28, 22)
    color(doc, 255, 255, 255)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text('COSTADRON', pageW - 14, 20, { align: 'right' })
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    color(doc, 180, 210, 240)
    doc.text('Reporte de servicio  |  ' + mesLabel, pageW - 14, 29, { align: 'right' })
    doc.text('El Oro, Ecuador', pageW - 14, 37, { align: 'right' })

    color(doc, 15, 23, 42)
    doc.setFontSize(16); doc.setFont('helvetica', 'bold')
    doc.text(c.nombre, 14, 64)
    doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    color(doc, 100, 116, 139)
    doc.text('Zona: ' + zonaLabel + '   |   Periodo: ' + mesLabel + '   |   Emitido: ' + new Date().toLocaleDateString('es'), 14, 71)
    stroke(doc, 226, 232, 240); doc.setLineWidth(0.5); doc.line(14, 75, pageW - 14, 75)

    const kpis = [
      { label: 'Jornadas', value: '' + c.jornadasCount },
      { label: 'Vuelos', value: '' + c.vuelos },
      { label: 'Hectareas', value: c.ha.toFixed(1) + ' ha' },
      { label: 'KG esparcidos', value: c.kg.toFixed(0) + ' kg' },
      { label: 'Sacos', value: (c.kg / 30).toFixed(1) },
      { label: 'Costo/ha', value: fmt$(c.costoHa) },
    ]
    const cardW = (pageW - 28 - 10) / 3
    const cardH = 22
    kpis.forEach((k, i) => {
      const col = i % 3; const row = Math.floor(i / 3)
      const x = 14 + col * (cardW + 5); const y = 80 + row * (cardH + 4)
      fill(doc, 248, 250, 252); doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F')
      doc.setFontSize(7); color(doc, 100, 116, 139); doc.setFont('helvetica', 'normal')
      doc.text(k.label.toUpperCase(), x + 5, y + 7)
      doc.setFontSize(11); color(doc, 15, 23, 42); doc.setFont('helvetica', 'bold')
      doc.text(k.value, x + 5, y + 16)
    })

    const totalY = 138
    fill(doc, 2, 40, 71); doc.roundedRect(14, totalY, pageW - 28, 22, 3, 3, 'F')
    fill(doc, 13, 108, 176); doc.roundedRect(14, totalY, 4, 22, 2, 2, 'F')
    color(doc, 255, 255, 255)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text('VALOR TOTAL A PAGAR', 24, totalY + 9)
    doc.setFontSize(16); doc.setFont('helvetica', 'bold')
    doc.text(fmt$(c.valor), pageW - 18, totalY + 14, { align: 'right' })

    color(doc, 2, 40, 71)
    doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('DETALLE DE JORNADAS', 14, 172)
    stroke(doc, 13, 108, 176); doc.setLineWidth(1.5); doc.line(14, 175, 65, 175)

    autoTable(doc, {
      startY: 179,
      head: [['Fecha', 'Vuelos', 'Hectareas', 'KG aplicados', 'Sacos', 'Valor']],
      body: c.jornadas.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(j => [
        j.fecha, j.cantidad_vuelos, Number(j.hectareas).toFixed(2),
        Number(j.kg_esparcidos).toFixed(2), (Number(j.kg_esparcidos) / 30).toFixed(1),
        fmt$(zonaData.factorVuelo * j.cantidad_vuelos)
      ]),
      foot: [['Total', c.vuelos, c.ha.toFixed(2), c.kg.toFixed(2), (c.kg / 30).toFixed(1), fmt$(c.valor)]],
      headStyles: { fillColor: [2, 40, 71], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 4 },
      footStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42], cellPadding: 3.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 5: { halign: 'right' } },
      margin: { left: 14, right: 14 }
    })

    fill(doc, 2, 40, 71); doc.rect(0, pageH - 12, pageW, 12, 'F')
    color(doc, 150, 180, 210); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text('CostaMarket S.A.  |  Operacion COSTADRON  |  El Oro, Ecuador', pageW / 2, pageH - 4, { align: 'center' })
    doc.save('COSTADRON_' + c.nombre + '_' + MESES[Number(mes)] + anio + '.pdf')
  }

  const generarPDFInterno = () => {
    if (!data) return
    const doc = new jsPDF()
    const mesLabel = `${MESES[Number(mes)]} ${anio}`
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()

    // Header pagina 1
    fill(doc, 2, 40, 71); doc.rect(0, 0, pageW, 52, 'F')
    fill(doc, 13, 108, 176); doc.rect(0, 42, pageW, 10, 'F')
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 12, 7, 30, 24)
    color(doc, 255, 255, 255)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text('REPORTE OPERACIONAL', pageW - 14, 18, { align: 'right' })
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    color(doc, 180, 210, 240)
    doc.text('INTERNO  |  COSTADRON', pageW - 14, 27, { align: 'right' })
    doc.setFontSize(8)
    doc.text(mesLabel + '   |   Generado: ' + new Date().toLocaleDateString('es'), pageW - 14, 37, { align: 'right' })

    // KPIs consolidados
    let y = 64
    color(doc, 2, 40, 71); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN EJECUTIVO', 14, y)
    stroke(doc, 13, 108, 176); doc.setLineWidth(1.5); doc.line(14, y + 3, 70, y + 3)
    y += 8

    // Si es contador, el resumen ejecutivo refleja solo su zona
    const _z = esContador ? data.zonas[zonaKeyUser] : null
    const _totCosto  = esContador ? _z.totalCosto : data.totalCosto
    const _totVuelos = esContador ? _z.totalVuelos : data.totalVuelos
    const _totHa     = esContador ? _z.totalHa : data.totalHa
    const _totKg     = esContador ? _z.totalKg : data.totalKg
    const _costoVuelo = esContador ? (_z.totalVuelos > 0 ? _z.totalCosto / _z.totalVuelos : 0) : data.costoVuelo
    const _costoHa    = esContador ? (_z.totalHa > 0 ? _z.totalCosto / _z.totalHa : 0) : data.costoHa
    const _jornadas   = esContador ? _z.jornadas.length : data.jornadas.length
    const _clientes   = esContador ? _z.clientes.length : data.todosClientes.length
    const kpis = [
      { label: 'Costo total', value: fmt$(_totCosto) },
      { label: 'Vuelos', value: '' + _totVuelos },
      { label: 'Hectareas', value: _totHa.toFixed(1) + ' ha' },
      { label: 'KG esparcidos', value: _totKg.toFixed(0) + ' kg' },
      { label: 'Sacos', value: (_totKg / 30).toFixed(1) },
      { label: 'Costo/vuelo', value: fmt$(_costoVuelo) },
      { label: 'Costo/ha', value: fmt$(_costoHa) },
      { label: 'Jornadas', value: '' + _jornadas },
      { label: 'Clientes', value: '' + _clientes },
    ]
    const cW = (pageW - 28 - 8) / 3
    const cH = 20
    kpis.forEach((k, i) => {
      const col = i % 3; const row = Math.floor(i / 3)
      const x = 14 + col * (cW + 4); const cy = y + row * (cH + 3)
      fill(doc, 248, 250, 252); doc.roundedRect(x, cy, cW, cH, 2, 2, 'F')
      doc.setFontSize(6.5); color(doc, 100, 116, 139); doc.setFont('helvetica', 'normal')
      doc.text(k.label.toUpperCase(), x + 4, cy + 6)
      doc.setFontSize(10); color(doc, 15, 23, 42); doc.setFont('helvetica', 'bold')
      doc.text(k.value, x + 4, cy + 15)
    })
    y += 3 * (cH + 3) + 8

    // Desglose por zona
    color(doc, 2, 40, 71); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('DESGLOSE POR ZONA', 14, y)
    stroke(doc, 13, 108, 176); doc.setLineWidth(1.5); doc.line(14, y + 3, 75, y + 3)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [['Zona', 'Vuelos', 'Ha', 'KG', 'Sacos', 'Costo fijo', 'Costo var.', 'Total', 'Costo/vuelo']],
      body: [
        ...(zonaKeysVisibles.includes('Jambeli') ? [['Jambeli',
          data.zonas.Jambeli.totalVuelos, data.zonas.Jambeli.totalHa.toFixed(1),
          data.zonas.Jambeli.totalKg.toFixed(0), (data.zonas.Jambeli.totalKg / 30).toFixed(1),
          fmt$(data.zonas.Jambeli.costoFijo), fmt$(data.zonas.Jambeli.costoVar),
          fmt$(data.zonas.Jambeli.totalCosto),
          fmt$(data.zonas.Jambeli.totalVuelos > 0 ? data.zonas.Jambeli.totalCosto / data.zonas.Jambeli.totalVuelos : 0)
        ]] : []),
        ...(zonaKeysVisibles.includes('Puna') ? [['Puna',
          data.zonas.Puna.totalVuelos, data.zonas.Puna.totalHa.toFixed(1),
          data.zonas.Puna.totalKg.toFixed(0), (data.zonas.Puna.totalKg / 30).toFixed(1),
          fmt$(data.zonas.Puna.costoFijo), fmt$(data.zonas.Puna.costoVar),
          fmt$(data.zonas.Puna.totalCosto),
          fmt$(data.zonas.Puna.totalVuelos > 0 ? data.zonas.Puna.totalCosto / data.zonas.Puna.totalVuelos : 0)
        ]] : []),
      ],
      headStyles: { fillColor: [2, 40, 71], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 3.5 },
      bodyStyles: { fontSize: 7.5, cellPadding: 3.5 },
      didParseCell: (hookData) => {
        if (hookData.section === 'body') {
          const esJambeli = hookData.row.raw[0] === 'Jambeli'
          hookData.cell.styles.fillColor = esJambeli ? [239, 246, 255] : [240, 253, 244]
          hookData.cell.styles.textColor = esJambeli ? [30, 64, 175] : [22, 101, 52]
        }
      },
      margin: { left: 14, right: 14 }
    })
    y = doc.lastAutoTable.finalY + 10

    // Clientes Jambeli (solo si la zona es visible)
    if (zonaKeysVisibles.includes('Jambeli')) {
    color(doc, 30, 64, 175); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('CLIENTES JAMBELI', 14, y)
    stroke(doc, 30, 64, 175); doc.setLineWidth(1.5); doc.line(14, y + 3, 72, y + 3)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [['Cliente', 'Jornadas', 'Vuelos', 'Ha', 'KG', 'Sacos', 'Costo/ha', 'A facturar', '%']],
      body: data.zonas.Jambeli.clientes.map(c => [
        c.nombre, c.jornadasCount, c.vuelos, c.ha.toFixed(1), c.kg.toFixed(0),
        (c.kg / 30).toFixed(1), fmt$(c.costoHa), fmt$(c.valor), c.pct.toFixed(1) + '%'
      ]),
      foot: [['Total Jambeli', '', data.zonas.Jambeli.totalVuelos, data.zonas.Jambeli.totalHa.toFixed(1), data.zonas.Jambeli.totalKg.toFixed(0), (data.zonas.Jambeli.totalKg / 30).toFixed(1), '', fmt$(data.zonas.Jambeli.totalCosto), '100%']],
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 3.5 },
      footStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, cellPadding: 3, textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      columnStyles: { 7: { halign: 'right' }, 8: { halign: 'right' } },
      margin: { left: 14, right: 14 }
    })
    y = doc.lastAutoTable.finalY + 10
    }

    // Clientes Puna (solo si la zona es visible)
    if (zonaKeysVisibles.includes('Puna')) {
    color(doc, 22, 101, 52); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('CLIENTES PUNA', 14, y)
    stroke(doc, 22, 101, 52); doc.setLineWidth(1.5); doc.line(14, y + 3, 62, y + 3)
    y += 7

    autoTable(doc, {
      startY: y,
      head: [['Cliente', 'Jornadas', 'Vuelos', 'Ha', 'KG', 'Sacos', 'Costo/ha', 'A facturar', '%']],
      body: data.zonas.Puna.clientes.map(c => [
        c.nombre, c.jornadasCount, c.vuelos, c.ha.toFixed(1), c.kg.toFixed(0),
        (c.kg / 30).toFixed(1), fmt$(c.costoHa), fmt$(c.valor), c.pct.toFixed(1) + '%'
      ]),
      foot: [['Total Puna', '', data.zonas.Puna.totalVuelos, data.zonas.Puna.totalHa.toFixed(1), data.zonas.Puna.totalKg.toFixed(0), (data.zonas.Puna.totalKg / 30).toFixed(1), '', fmt$(data.zonas.Puna.totalCosto), '100%']],
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', cellPadding: 3.5 },
      footStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, cellPadding: 3, textColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [245, 255, 248] },
      columnStyles: { 7: { halign: 'right' }, 8: { halign: 'right' } },
      margin: { left: 14, right: 14 }
    })
    }

    fill(doc, 2, 40, 71); doc.rect(0, pageH - 12, pageW, 12, 'F')
    color(doc, 150, 180, 210); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text('CostaMarket S.A.  |  Operacion COSTADRON  |  Documento interno confidencial', pageW / 2, pageH - 4, { align: 'center' })

    // PAGINA 2 — Composicion de costos
    doc.addPage()
    fill(doc, 2, 40, 71); doc.rect(0, 0, pageW, 28, 'F')
    fill(doc, 13, 108, 176); doc.rect(0, 20, pageW, 8, 'F')
    color(doc, 255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold')
    doc.text('COMPOSICION DE COSTOS  |  ' + mesLabel, pageW / 2, 14, { align: 'center' })

    let y2 = 38
    const zonaConfigs = [
      { key: 'Jambeli', label: 'JAMBELI', hr: [30, 64, 175], hf: [219, 234, 254], tf: [30, 64, 175], alt: [245, 248, 255] },
      { key: 'Puna', label: 'PUNA', hr: [22, 101, 52], hf: [220, 252, 231], tf: [22, 101, 52], alt: [245, 255, 248] },
    ]

    zonaConfigs.filter(({ key }) => zonaKeysVisibles.includes(key)).forEach(({ key, label, hr, hf, tf, alt }) => {
      const z = data.zonas[key]
      color(doc, hr[0], hr[1], hr[2]); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
      doc.text('COSTOS ' + label, 14, y2)
      stroke(doc, hr[0], hr[1], hr[2]); doc.setLineWidth(1.5)
      doc.line(14, y2 + 3, 14 + label.length * 5.2, y2 + 3)
      y2 += 7

      const todosCostos = [
        ...z.costosFijosDetalle,
        ...z.costosVariablesDetalle.flatMap(c =>
          c.nombre === 'Muellaje / CostaTech' && c.items?.length > 0
            ? [c, ...c.items.map(i => ({ nombre: '  - ' + i.descripcion, monto: Number(i.monto) }))]
            : [c]
        )
      ]

      autoTable(doc, {
        startY: y2,
        head: [['Componente de costo', 'Monto', '% del total zona']],
        body: todosCostos.map(c => [c.nombre, fmt$(c.monto), z.totalCosto > 0 ? (c.monto / z.totalCosto * 100).toFixed(1) + '%' : '0%']),
        foot: [['Total ' + (key === 'Jambeli' ? 'Jambeli' : 'Puna'), fmt$(z.totalCosto), '100%']],
        headStyles: { fillColor: hr, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 4 },
        footStyles: { fillColor: hf, textColor: tf, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, cellPadding: 3.5, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: alt },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: 14, right: 14 }
      })
      y2 = doc.lastAutoTable.finalY + 12
    })

    fill(doc, 2, 40, 71); doc.rect(0, pageH - 12, pageW, 12, 'F')
    color(doc, 150, 180, 210); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text('CostaMarket S.A.  |  Operacion COSTADRON  |  Documento interno confidencial', pageW / 2, pageH - 4, { align: 'center' })

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

        {!esContador && (
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
        )}

        {[
          { zonaKey: 'Jambeli', label: 'Jambelí', bg: '#eff6ff' },
          { zonaKey: 'Puna', label: 'Puná', bg: '#f0fdf4' }
        ].filter(({ zonaKey }) => zonaKeysVisibles.includes(zonaKey)).map(({ zonaKey, label, bg }) => {
          const z = data.zonas[zonaKey]
          return (
            <div key={zonaKey} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
              {[
                { label: label + ' — Costo', value: fmt$(z.totalCosto) },
                { label: label + ' — Vuelos', value: z.totalVuelos },
                { label: label + ' — Ha', value: z.totalHa.toFixed(0) },
                { label: label + ' — Costo/vuelo', value: fmt$(z.totalVuelos > 0 ? z.totalCosto / z.totalVuelos : 0) },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-4" style={{ background: bg }}>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
                  <div className="text-xl font-medium text-gray-900">{k.value}</div>
                </div>
              ))}
            </div>
          )
        })}

        <div className="mb-5" />

        {[
          { zonaKey: 'Jambeli', label: 'Jambelí', color: '#3b82f6', textColor: '#1e40af' },
          { zonaKey: 'Puna', label: 'Puná', color: '#22c55e', textColor: '#166534' }
        ].filter(({ zonaKey }) => zonaKeysVisibles.includes(zonaKey)).map(({ zonaKey, label, color, textColor }) => {
          const z = data.zonas[zonaKey]
          if (z.clientes.length === 0) return null
          return (
            <div key={zonaKey} className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Desglose por cliente &mdash; {label}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Cliente', 'Jornadas', 'Vuelos', 'Ha', 'KG', 'Sacos', 'Costo/ha', 'Costo/vuelo', 'A facturar', '%', ''].map(h => (
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
                        <td className="py-2 text-xs pr-3">{fmt$(c.vuelos > 0 ? c.valor / c.vuelos : 0)}</td>
                        <td className="py-2 text-xs font-medium pr-3">{fmt$(c.valor)}</td>
                        <td className="py-2 text-xs text-gray-400 pr-3">{c.pct.toFixed(1)}%</td>
                        <td className="py-2">
                          <button onClick={() => generarPDFCliente(zonaKey, c.nombre)}
                            className="text-xs px-2 py-1 rounded text-white"
                            style={{ background: textColor }}>
                            PDF &#8595;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td className="pt-3 text-xs font-medium">Total {label}</td>
                      <td className="pt-3 text-xs">{z.jornadas.length}</td>
                      <td className="pt-3 text-xs">{z.totalVuelos}</td>
                      <td className="pt-3 text-xs">{z.totalHa.toFixed(1)}</td>
                      <td className="pt-3 text-xs">{z.totalKg.toFixed(0)}</td>
                      <td className="pt-3 text-xs">{(z.totalKg / 30).toFixed(1)}</td>
                      <td className="pt-3 text-xs font-medium">{fmt$(z.totalHa > 0 ? z.totalCosto / z.totalHa : 0)}</td>
                      <td className="pt-3 text-xs font-medium">{fmt$(z.totalVuelos > 0 ? z.totalCosto / z.totalVuelos : 0)}</td>
                      <td className="pt-3 text-xs font-medium" style={{ color: textColor }}>{fmt$(z.totalCosto)}</td>
                      <td className="pt-3 text-xs">100%</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        })}

        {[
          { zonaKey: 'Jambeli', label: 'Jambelí', color: '#1e40af' },
          { zonaKey: 'Puna', label: 'Puná', color: '#166534' }
        ].filter(({ zonaKey }) => zonaKeysVisibles.includes(zonaKey)).map(({ zonaKey, label, color }) => {
          const z = data.zonas[zonaKey]
          if (!z.fijos) return null
          return (
            <div key={zonaKey} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Costos fijos &mdash; {label}</div>
                </div>
                {z.costosFijosDetalle.map(c => (
                  <div key={c.nombre} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">{c.nombre}</span>
                    <span className="text-xs font-medium">{fmt$(c.monto)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
                  <span className="text-xs font-medium text-gray-700">Total fijos</span>
                  <span className="text-xs font-medium" style={{ color }}>{fmt$(z.costoFijo)}</span>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Costos variables &mdash; {label}</div>
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
                  <span className="text-xs font-medium" style={{ color }}>{fmt$(z.costoVar)}</span>
                </div>
              </div>
            </div>
          )
        })}

      </div>
    </Layout>
  )
}
