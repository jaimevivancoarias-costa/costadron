import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

const MESES = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

const ZONA_CLIENTE = {
  'REYMAR': 'Puná', 'PACIMAR': 'Puná', 'LANGUISA': 'Puná',
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

export default function Dashboard() {
  const [mesesDisponibles, setMesesDisponibles] = useState([])
  const [idx, setIdx] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [clientesJambeli, setClientesJambeli] = useState([])
  const [clientesPuna, setClientesPuna] = useState([])
  const [costosMes, setCostosMes] = useState({ 'Jambel\u00ed': null, 'Pun\u00e1': null })
  const [varForms, setVarForms] = useState({
    'Jambel\u00ed': { gasolina_aceite: '', muellaje_costatech: '', comision_piloto: '' },
    'Pun\u00e1': { gasolina_aceite: '', muellaje_costatech: '', comision_piloto: '' }
  })
  const [muellajeItems, setMuellajeItems] = useState({
    'Jambel\u00ed': [{ descripcion: '', monto: '' }],
    'Pun\u00e1': [{ descripcion: '', monto: '' }]
  })
  const [varGuardados, setVarGuardados] = useState({ 'Jambel\u00ed': false, 'Pun\u00e1': false })
  const [varEditando, setVarEditando] = useState({ 'Jambel\u00ed': false, 'Pun\u00e1': false })
  const [modalCerrar, setModalCerrar] = useState(false)
  const [toast, setToast] = useState('')
  const [cargando, setCargando] = useState(true)
  const [pilotos, setPilotos] = useState([])
  const [zonas, setZonas] = useState([])
  const navigate = useNavigate()

  // --- Acceso por rol/zona (contador ve solo su zona) ---
  const { usuario } = useAuth()
  const esContador = usuario?.rol === 'contador'
  const zonaUser = usuario?.zona                                  // 'Puná' o 'Jambelí' (con tilde)
  const ZONAS = ['Jambelí', 'Puná']
  const zonasVisibles = esContador ? ZONAS.filter(z => z === zonaUser) : ZONAS
  const pilotosVisibles = esContador ? pilotos.filter(p => p.zona === zonaUser) : pilotos

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
    setClientesJambeli([])
    setClientesPuna([])
    setVarGuardados({ 'Jambel\u00ed': false, 'Pun\u00e1': false })
    setVarEditando({ 'Jambel\u00ed': false, 'Pun\u00e1': false })
    setVarForms({
      'Jambel\u00ed': { gasolina_aceite: '', muellaje_costatech: '', comision_piloto: '' },
      'Pun\u00e1': { gasolina_aceite: '', muellaje_costatech: '', comision_piloto: '' }
    })
    setMuellajeItems({
      'Jambel\u00ed': [{ descripcion: '', monto: '' }],
      'Pun\u00e1': [{ descripcion: '', monto: '' }]
    })

    const desde = primerDia(anio, mes)
    const hasta = ultimoDia(anio, mes)

    const [
      { data: jornadas },
      { data: fijosZona },
      { data: varsMes },
      { data: usuarios }
    ] = await Promise.all([
      supabase.from('jornadas').select('*, clientes(nombre)').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('costos_fijos_zona').select('*').eq('anio', anio),
      supabase.from('costos_variables_mes_zona').select('*').eq('anio', anio).eq('mes', mes),
      supabase.from('usuarios').select('*').eq('rol', 'piloto').eq('activo', true)
    ])

    // Pilotos
    if (usuarios) {
      const pilotosData = (usuarios || []).map(u => {
        const jornadasPiloto = (jornadas || []).filter(j => j.piloto_id === u.id)
        const porClienteMap = {}
        jornadasPiloto.forEach(j => {
          const nombre = j.clientes?.nombre || 'Sin cliente'
          if (!porClienteMap[nombre]) porClienteMap[nombre] = { nombre, vuelos: 0, ha: 0, kg: 0 }
          porClienteMap[nombre].vuelos += j.cantidad_vuelos
          porClienteMap[nombre].ha += Number(j.hectareas || 0)
          porClienteMap[nombre].kg += Number(j.kg_esparcidos || 0)
        })
        return {
          nombre: u.nombre,
          zona: u.zona,
          vuelos: jornadasPiloto.reduce((s, j) => s + j.cantidad_vuelos, 0),
          jornadas: jornadasPiloto.length,
          ha: jornadasPiloto.reduce((s, j) => s + Number(j.hectareas || 0), 0),
          kg: jornadasPiloto.reduce((s, j) => s + Number(j.kg_esparcidos || 0), 0),
          sacos: jornadasPiloto.reduce((s, j) => s + Number(j.sacos_aplicados || 0), 0),
          clientes: new Set(jornadasPiloto.map(j => j.cliente_id)).size,
          porCliente: Object.values(porClienteMap).sort((a, b) => b.vuelos - a.vuelos)
        }
      }).filter(p => p.jornadas > 0)
      setPilotos(pilotosData)
    }

    // Costos variables por zona
    const newCostosMes = { 'Jambel\u00ed': null, 'Pun\u00e1': null }
    const newVarForms = {
      'Jambel\u00ed': { gasolina_aceite: '', muellaje_costatech: '', comision_piloto: '' },
      'Pun\u00e1': { gasolina_aceite: '', muellaje_costatech: '', comision_piloto: '' }
    }
    const newMuellajeItems = {
      'Jambel\u00ed': [{ descripcion: '', monto: '' }],
      'Pun\u00e1': [{ descripcion: '', monto: '' }]
    }
    const newVarGuardados = { 'Jambel\u00ed': false, 'Pun\u00e1': false }

    ;(varsMes || []).forEach(v => {
      if (newCostosMes[v.zona] !== undefined) {
        newCostosMes[v.zona] = v
        newVarForms[v.zona] = {
          gasolina_aceite: v.gasolina_aceite,
          muellaje_costatech: v.muellaje_costatech,
          comision_piloto: v.comision_piloto
        }
        if (v.muellaje_items && v.muellaje_items.length > 0) {
          newMuellajeItems[v.zona] = v.muellaje_items
        }
        newVarGuardados[v.zona] = true
      }
    })

    setCostosMes(newCostosMes)
    setVarForms(newVarForms)
    setMuellajeItems(newMuellajeItems)
    setVarGuardados(newVarGuardados)

    calcularResumen(jornadas || [], fijosZona || [], varsMes || [])
    setCargando(false)
  }

  const calcularResumen = (jornadas, fijosZona, varsMes) => {
    const fijosMap = {}
    fijosZona.forEach(f => { fijosMap[f.zona] = f })

    const varsMap = {}
    varsMes.forEach(v => { varsMap[v.zona] = v })

    // Separar jornadas por zona
    const jornadasPorZona = { 'Jambel\u00ed': [], 'Pun\u00e1': [] }
    jornadas.forEach(j => {
      const nombreCliente = j.clientes?.nombre?.toUpperCase() || ''
      const zona = ZONA_CLIENTE[nombreCliente]
      if (zona) jornadasPorZona[zona].push(j)
    })

    // Calcular costo por zona
    const calcZona = (zona) => {
      const js = jornadasPorZona[zona]
      const totalVuelos = js.reduce((s, j) => s + j.cantidad_vuelos, 0)
      const totalHa = js.reduce((s, j) => s + Number(j.hectareas || 0), 0)
      const totalKg = js.reduce((s, j) => s + Number(j.kg_esparcidos || 0), 0)
      const totalCargas = js.reduce((s, j) => s + Number(j.cargas_baterias || 0), 0)
      const totalSacos = js.reduce((s, j) => s + Number(j.sacos_aplicados || 0), 0)

      const costoFijo = calcCostoFijoZona(fijosMap[zona], totalCargas)
      const vars = varsMap[zona]
      const costoVar = vars
        ? Number(vars.gasolina_aceite) + Number(vars.muellaje_costatech) + Number(vars.comision_piloto)
        : 0
      const totalCosto = costoFijo + costoVar
      const factorVuelo = totalVuelos > 0 ? totalCosto / totalVuelos : 0

      // Clientes de esta zona
      const porCliente = {}
      js.forEach(j => {
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

      return { totalVuelos, totalHa, totalKg, totalCargas, totalSacos, totalCosto, factorVuelo, clientesArr, jornadas: js.length }
    }

    const j = calcZona('Jambel\u00ed')
    const p = calcZona('Pun\u00e1')

    setClientesJambeli(j.clientesArr)
    setClientesPuna(p.clientesArr)

    setZonas([
      { nombre: 'Jambel\u00ed', vuelos: j.totalVuelos, ha: j.totalHa, kg: j.totalKg, costo: j.totalCosto, factorVuelo: j.factorVuelo },
      { nombre: 'Pun\u00e1', vuelos: p.totalVuelos, ha: p.totalHa, kg: p.totalKg, costo: p.totalCosto, factorVuelo: p.factorVuelo },
    ])

    const totalCosto = j.totalCosto + p.totalCosto
    const totalVuelos = j.totalVuelos + p.totalVuelos
    const totalHa = j.totalHa + p.totalHa
    const totalKg = j.totalKg + p.totalKg
    const totalJornadas = j.jornadas + p.jornadas

    const varJambeli = varsMap['Jambel\u00ed']
    const varPuna = varsMap['Pun\u00e1']
    const jambeliAplica = j.jornadas > 0
    const punaAplica = p.jornadas > 0
    const ambosVarGuardados = (!jambeliAplica || !!varJambeli) && (!punaAplica || !!varPuna)
    const todosCerrado = (!jambeliAplica || varJambeli?.cerrado) && (!punaAplica || varPuna?.cerrado)

    setResumen({
      totalCosto,
      totalVuelos,
      totalHa,
      totalKg,
      jornadas: totalJornadas,
      costoVuelo: totalVuelos > 0 ? totalCosto / totalVuelos : 0,
      costoHa: totalHa > 0 ? totalCosto / totalHa : 0,
      clientes: j.clientesArr.length + p.clientesArr.length,
      cerrado: todosCerrado,
      sinDatos: totalJornadas === 0,
      ambosVarGuardados
    })
  }

  const guardarVars = async (zona) => {
    const { anio, mes } = periodo
    const items = muellajeItems[zona]
    const totalMuellaje = items.reduce((s, i) => s + (Number(i.monto) || 0), 0)
    const payload = {
      anio, mes, zona,
      gasolina_aceite: Number(varForms[zona].gasolina_aceite) || 0,
      muellaje_costatech: totalMuellaje,
      muellaje_items: items.filter(i => i.descripcion || i.monto),
      comision_piloto: Number(varForms[zona].comision_piloto) || 0,
    }
    const { error } = await supabase
      .from('costos_variables_mes_zona')
      .upsert(payload, { onConflict: 'anio,mes,zona' })
    if (error) { showToast('Error al guardar.'); return }
    setVarGuardados(g => ({ ...g, [zona]: true }))
    setVarEditando(e => ({ ...e, [zona]: false }))
    showToast('Costos de ' + zona + ' guardados.')
    cargarDatos(periodo)
  }

  const cerrarMes = async () => {
    const { anio, mes } = periodo
    await supabase.from('costos_variables_mes_zona')
      .update({ cerrado: true })
      .eq('anio', anio).eq('mes', mes)
    setModalCerrar(false)
    showToast('Mes cerrado.')
    cargarDatos(periodo)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const mesLabel = periodo ? `${MESES[periodo.mes]} ${periodo.anio}` : ''
  const puedeIrAtras = idx !== null && idx > 0
  const puedeIrAdelante = idx !== null && idx < mesesDisponibles.length - 1
  const mesYaTermino = periodo ? new Date() > new Date(periodo.anio, periodo.mes, 0) : false
  const diasDesdeFinMes = periodo ? Math.floor((new Date() - new Date(periodo.anio, periodo.mes, 0)) / (1000 * 60 * 60 * 24)) : 0

  const renderVarsZona = (zona) => {
    const guardado = varGuardados[zona]
    const editando = varEditando[zona]
    const form = varForms[zona]
    const items = muellajeItems[zona]
    const totalVar = (Number(form.gasolina_aceite) || 0)
      + items.reduce((s, i) => s + (Number(i.monto) || 0), 0)
      + (Number(form.comision_piloto) || 0)
    const colorZona = zona === 'Jambel\u00ed' ? '#eff6ff' : '#f0fdf4'
    const borderZona = zona === 'Jambel\u00ed' ? '#bfdbfe' : '#bbf7d0'

    return (
      <div key={zona} className="bg-white rounded-xl p-5 mb-3"
        style={{ border: !guardado ? '1px solid #EF9F27' : '1px solid ' + borderZona }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: zona === 'Jambel\u00ed' ? '#3b82f6' : '#22c55e' }} />
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Costos variables {zona} — {mesLabel}
            </div>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{
              background: guardado && !editando ? colorZona : '#fef3c7',
              color: guardado && !editando ? (zona === 'Jambel\u00ed' ? '#1e40af' : '#166534') : '#92400e'
            }}>
            {guardado && !editando ? 'Cargados' : editando ? 'Editando' : 'Pendiente'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1.5">Gasolina y aceite</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" step="0.01" placeholder="0.00"
                value={form.gasolina_aceite}
                onChange={e => setVarForms(f => ({ ...f, [zona]: { ...f[zona], gasolina_aceite: e.target.value } }))}
                readOnly={guardado && !editando}
                className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all"
                style={guardado && !editando ? { borderColor: borderZona, background: colorZona } : {}}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1.5">Comision piloto</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" step="0.01" placeholder="0.00"
                value={form.comision_piloto}
                onChange={e => setVarForms(f => ({ ...f, [zona]: { ...f[zona], comision_piloto: e.target.value } }))}
                readOnly={guardado && !editando}
                className="w-full h-10 pl-7 pr-3 border border-gray-200 rounded-lg text-sm outline-none transition-all"
                style={guardado && !editando ? { borderColor: borderZona, background: colorZona } : {}}
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm text-gray-500">Muellaje / CostaTech</label>
            {(!guardado || editando) && (
              <button onClick={() => setMuellajeItems(m => ({ ...m, [zona]: [...m[zona], { descripcion: '', monto: '' }] }))}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                + Agregar item
              </button>
            )}
          </div>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="text" placeholder="Descripcion"
                value={item.descripcion}
                onChange={e => {
                  const ni = [...items]; ni[i] = { ...ni[i], descripcion: e.target.value }
                  setMuellajeItems(m => ({ ...m, [zona]: ni }))
                }}
                readOnly={guardado && !editando}
                className="flex-1 h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none"
                style={guardado && !editando ? { borderColor: borderZona, background: colorZona } : {}}
              />
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" step="0.01" placeholder="0.00"
                  value={item.monto}
                  onChange={e => {
                    const ni = [...items]; ni[i] = { ...ni[i], monto: e.target.value }
                    setMuellajeItems(m => ({ ...m, [zona]: ni }))
                  }}
                  readOnly={guardado && !editando}
                  className="w-full h-10 pl-7 pr-2 border border-gray-200 rounded-lg text-sm outline-none"
                  style={guardado && !editando ? { borderColor: borderZona, background: colorZona } : {}}
                />
              </div>
              {(!guardado || editando) && items.length > 1 && (
                <button onClick={() => setMuellajeItems(m => ({ ...m, [zona]: m[zona].filter((_, j) => j !== i) }))}
                  className="h-10 px-2 text-gray-300 hover:text-red-400 rounded-lg">x</button>
              )}
            </div>
          ))}
          <div className="text-xs text-gray-400 mt-1">
            Total muellaje: {items.reduce((s, i) => s + (Number(i.monto) || 0), 0).toFixed(2)}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">Total: <span className="font-medium text-gray-900">{fmt$(totalVar)}</span></div>
          <div className="flex gap-2">
            {guardado && !editando ? (
              <button onClick={() => setVarEditando(e => ({ ...e, [zona]: true }))}
                className="h-8 px-4 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Editar
              </button>
            ) : (
              <>
                {editando && (
                  <button onClick={() => setVarEditando(e => ({ ...e, [zona]: false }))}
                    className="h-8 px-4 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                )}
                <button onClick={() => guardarVars(zona)}
                  className="h-8 px-4 text-white text-sm font-medium rounded-lg transition-colors"
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
    )
  }

  const renderTablaClientes = (clientes, zona, totalCostoZona) => (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full" style={{ background: zona === 'Jambel\u00ed' ? '#3b82f6' : '#22c55e' }} />
        <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          Valor a facturar — {zona}
        </div>
      </div>
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
            const pct = totalCostoZona > 0 ? (c.valor / totalCostoZona * 100).toFixed(0) : 0
            return (
              <tr key={c.nombre} className="border-b border-gray-50 last:border-0">
                <td className="py-2 text-xs font-medium">{c.nombre}</td>
                <td className="py-2 text-right text-xs text-gray-500">{c.vuelos}</td>
                <td className="py-2 text-right">
                  <div className="text-xs font-medium">{fmt$(c.valor)}</div>
                  <div className="w-full bg-gray-100 rounded h-1 mt-1">
                    <div className="h-1 rounded" style={{ width: `${pct}%`, background: zona === 'Jambel\u00ed' ? '#3b82f6' : '#22c55e' }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200">
            <td colSpan={2} className="pt-2.5 text-xs text-gray-400 font-medium">Total {zona}</td>
            <td className="pt-2.5 text-right text-xs font-medium">{fmt$(totalCostoZona)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )

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
            <button onClick={() => setIdx(i => i - 1)} disabled={!puedeIrAtras}
              className="h-8 px-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              {puedeIrAtras ? `\u2190 ${MESES[mesesDisponibles[idx - 1].mes]}` : '\u2190'}
            </button>
            <button onClick={() => setIdx(i => i + 1)} disabled={!puedeIrAdelante}
              className="h-8 px-3 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              {puedeIrAdelante ? `${MESES[mesesDisponibles[idx + 1].mes]} \u2192` : '\u2192'}
            </button>
          </div>
        </div>

        {mesYaTermino && !resumen?.cerrado && !cargando && !resumen?.sinDatos && !esContador && (
          <div className="flex flex-col gap-2 mb-5">
            {!resumen?.ambosVarGuardados && (
              <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
                style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
                <span>&#9888;</span>
                <span>Faltan costos variables para cerrar el mes.</span>
              </div>
            )}
            {diasDesdeFinMes > 5 && (
              <div className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
                style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>
                <span>&#9888;</span>
                <span>{mesLabel} lleva {diasDesdeFinMes} dias sin cerrar.</span>
              </div>
            )}
          </div>
        )}

        {cargando && <div className="text-center py-16 text-sm text-gray-400">Cargando datos...</div>}

        {!cargando && resumen?.sinDatos && (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="text-gray-300 text-4xl mb-3">&#9675;</div>
            <div className="text-sm font-medium text-gray-500 mb-1">{mesLabel} — sin jornadas registradas</div>
            <div className="text-xs text-gray-400">Los pilotos aun no han registrado vuelos este mes.</div>
          </div>
        )}

        {!cargando && resumen && !resumen.sinDatos && (
          <>
            {/* KPIs consolidados (ocultos para contador: mostraría totales de ambas zonas) */}
            {!esContador && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
              {[
                { label: 'Costo operacional', value: fmt$(resumen.totalCosto), sub: `${resumen.clientes} clientes` },
                { label: 'Vuelos realizados', value: resumen.totalVuelos, sub: `${resumen.jornadas} jornadas` },
                { label: 'Hectareas aplicadas', value: resumen.totalHa.toFixed(0), sub: 'ha' },
                { label: 'Costo por vuelo', value: fmt$(resumen.costoVuelo), sub: `${fmt$(resumen.costoHa)} / ha` },
              ].map(k => (
                <div key={k.label} className="bg-gray-50 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
                  <div className="text-xl font-medium text-gray-900">{k.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>
            )}

            {/* KPIs por zona */}
            {zonas.filter(z => zonasVisibles.includes(z.nombre)).map(z => (
              <div key={z.nombre} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
                {[
                  { label: `${z.nombre} \u2014 Costo`, value: fmt$(z.costo) },
                  { label: `${z.nombre} \u2014 Vuelos`, value: z.vuelos },
                  { label: `${z.nombre} \u2014 Ha`, value: z.ha.toFixed(0) },
                  { label: `${z.nombre} \u2014 Costo/vuelo`, value: fmt$(z.vuelos > 0 ? z.costo / z.vuelos : 0) },
                ].map(k => (
                  <div key={k.label} className="rounded-xl p-4"
                    style={{ background: z.nombre === 'Jambel\u00ed' ? '#eff6ff' : '#f0fdf4' }}>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{k.label}</div>
                    <div className="text-xl font-medium text-gray-900">{k.value}</div>
                  </div>
                ))}
              </div>
            ))}

            <div className="mb-3" />

            {/* Costos variables por zona */}
            {!resumen.cerrado && zonasVisibles.map(z => renderVarsZona(z))}

            {resumen.cerrado && (
              <div className="bg-white border border-gray-100 rounded-xl p-5 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Costos variables — {mesLabel}</div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-400">Mes cerrado</span>
                </div>
                <div className="grid grid-cols-2 gap-6 text-sm">
                  {zonasVisibles.map(zona => {
                    const v = costosMes[zona]
                    return v ? (
                      <div key={zona}>
                        <div className="text-xs font-medium text-gray-500 mb-2">{zona}</div>
                        <div className="space-y-1">
                          <div className="flex justify-between"><span className="text-gray-400">Gasolina</span><span>{fmt$(v.gasolina_aceite)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-400">Muellaje</span><span>{fmt$(v.muellaje_costatech)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-400">Comision</span><span>{fmt$(v.comision_piloto)}</span></div>
                        </div>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            )}

            {toast && (
              <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm mb-4"
                style={{ background: '#dbeafe', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                &#10003; {toast}
              </div>
            )}

            {/* Tablas de facturación por zona */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {zonasVisibles.includes('Jambel\u00ed') && renderTablaClientes(clientesJambeli, 'Jambel\u00ed', zonas.find(z => z.nombre === 'Jambel\u00ed')?.costo || 0)}
              {zonasVisibles.includes('Pun\u00e1') && renderTablaClientes(clientesPuna, 'Pun\u00e1', zonas.find(z => z.nombre === 'Pun\u00e1')?.costo || 0)}
            </div>

            {/* Acciones */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col">
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Acciones</div>
              <div className="flex flex-col gap-2">
                <button onClick={() => navigate(`/reporte/${periodo.anio}/${periodo.mes}`)}
                  className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-left text-gray-600 hover:bg-gray-50 transition-colors">
                  Ver reporte completo &#8594;
                </button>
                <button onClick={() => navigate('/costos-fijos')}
                  className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-left text-gray-600 hover:bg-gray-50 transition-colors">
                  Configurar costos fijos &#8594;
                </button>
                <button onClick={() => navigate('/ytd')}
                  className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-left text-gray-600 hover:bg-gray-50 transition-colors">
                  Ver resumen anual &#8594;
                </button>
              </div>
              {!resumen.cerrado && !esContador && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setModalCerrar(true)}
                    disabled={!resumen.ambosVarGuardados}
                    className="w-full h-9 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#0D6CB0' }}
                    onMouseEnter={e => { if (resumen.ambosVarGuardados) e.target.style.background = '#064979' }}
                    onMouseLeave={e => { if (resumen.ambosVarGuardados) e.target.style.background = '#0D6CB0' }}>
                    Cerrar mes
                  </button>
                  <div className="text-xs text-gray-400 mt-1.5 text-center">
                    {!resumen.ambosVarGuardados ? 'Carga los costos variables de ambas zonas primero' : 'El mes esta listo para cerrar'}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Estado de pilotos */}
        {pilotosVisibles.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 mt-4 mb-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-4">Estado de pilotos — {mesLabel}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pilotosVisibles.map(p => (
                <div key={p.nombre} className="rounded-xl p-4"
                  style={{ background: p.zona === 'Jambel\u00ed' ? '#eff6ff' : p.zona === 'Pun\u00e1' ? '#f0fdf4' : '#f9fafb' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium"
                      style={{ background: p.zona === 'Jambel\u00ed' ? '#dbeafe' : '#dcfce7', color: p.zona === 'Jambel\u00ed' ? '#1e40af' : '#166534' }}>
                      {p.nombre[0]}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{p.nombre}</div>
                      {p.zona && <div className="text-xs text-gray-400">{p.zona}</div>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'Vuelos', value: p.vuelos },
                      { label: 'Jornadas', value: p.jornadas },
                      { label: 'Clientes', value: p.clientes },
                      { label: 'Ha', value: p.ha.toFixed(0) },
                      { label: 'KG', value: p.kg.toFixed(0) },
                      { label: 'Sacos', value: p.sacos.toFixed(1) },
                    ].map(k => (
                      <div key={k.label}>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400">{k.label}</div>
                        <div className="text-sm font-medium text-gray-900">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  {p.porCliente && p.porCliente.length > 0 && (
                    <div className="border-t border-gray-200 pt-2 mt-1">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Desglose por cliente</div>
                      {p.porCliente.map(c => (
                        <div key={c.nombre} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                          <span className="text-xs text-gray-600">{c.nombre}</span>
                          <span className="text-xs text-gray-400">{c.vuelos} vuelos &middot; {c.ha.toFixed(0)} ha</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {modalCerrar && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-sm w-full">
              <h2 className="text-base font-medium text-gray-900 mb-2">Cerrar {mesLabel}?</h2>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                Esta accion congela todos los datos del mes. No podras modificar jornadas ni costos una vez cerrado.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Total a facturar</span><span className="font-medium">{resumen ? fmt$(resumen.totalCosto) : '-'}</span></div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setModalCerrar(false)}
                  className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={cerrarMes}
                  className="h-9 px-4 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
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
