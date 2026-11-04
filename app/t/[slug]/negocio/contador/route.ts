import { createClient } from '@/lib/supabase/server'
import { getTienda } from '@/lib/tienda/servidor'
import { agregarResumen, agregarTabla, nombreArchivo, nuevoLibro, respuestaExcel } from '@/lib/tienda/excel'
import { rangoMes, sumarDias, ventasPorDia, type VentaMes } from '@/lib/tienda/reportes'
import { redondear2 } from '@/lib/tienda/formato'

type FilaVenta = {
  creado_en: string; total: number | string; metodo_pago: VentaMes['metodo_pago']; anulada_en: string | null; motivo_anulacion: string | null
  ventas_lineas: { subtotal: number | string; productos: { itbms: number | string } | null }[]
}

// Reporte del mes para el contador: ventas por día con ITBMS, compras con factura, anuladas y pérdidas
export async function GET(req: Request, { params }: RouteContext<'/t/[slug]/negocio/contador'>) {
  const { slug } = await params
  const tienda = await getTienda(slug)
  if (!tienda) return new Response('No encontrado', { status: 404 })
  const mes = new URL(req.url).searchParams.get('mes') ?? ''
  const rango = rangoMes(mes)
  if (!rango) return new Response('Mes no válido', { status: 400 })

  const supabase = await createClient()
  const filas: FilaVenta[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from('ventas')
      .select('creado_en, total, metodo_pago, anulada_en, motivo_anulacion, ventas_lineas(subtotal, productos(itbms))')
      .eq('tienda_id', tienda.id).gte('creado_en', rango.desde).lt('creado_en', rango.hasta)
      .order('creado_en').range(desde, desde + 999)
    if (error) return new Response('No se pudo leer las ventas', { status: 500 })
    filas.push(...(data as unknown as FilaVenta[]))
    if (data.length < 1000) break
  }
  const ventas: VentaMes[] = filas.map(v => ({
    creado_en: v.creado_en, total: Number(v.total), metodo_pago: v.metodo_pago, anulada: v.anulada_en !== null,
    lineas: v.ventas_lineas.map(l => ({ subtotal: Number(l.subtotal), itbms: Number(l.productos?.itbms ?? 0) })),
  }))

  const [{ data: compras }, { data: perdidas }] = await Promise.all([
    supabase.from('entradas').select('fecha, proveedor, numero_factura, total')
      .eq('tienda_id', tienda.id).gte('fecha', rango.desde.slice(0, 10)).lt('fecha', rango.hasta.slice(0, 10)).order('fecha'),
    supabase.from('movimientos_inventario').select('cantidad, costo_unitario')
      .eq('tienda_id', tienda.id).eq('tipo', 'ajuste').eq('motivo', 'danado').gte('creado_en', rango.desde).lt('creado_en', rango.hasta),
  ])

  const dias = ventasPorDia(ventas)
  const t = sumarDias(dias)
  const anuladas = filas.filter(v => v.anulada_en)
  const totalCompras = redondear2((compras ?? []).reduce((s, c) => s + Number(c.total), 0))
  const totalPerdidas = redondear2((perdidas ?? []).reduce((s, m) => s + -Number(m.cantidad) * Number(m.costo_unitario ?? 0), 0))
  const nombreMes = new Intl.DateTimeFormat('es-PA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${mes}-15T12:00:00Z`))

  const libro = nuevoLibro()
  agregarResumen(libro, `${tienda.nombre} · ${nombreMes}`, [
    ['Ventas del mes', t.total, 'dinero'],
    ['Cantidad de ventas', t.ventas, 'numero'],
    ['  Efectivo', t.efectivo, 'dinero'],
    ['  Yappy', t.yappy, 'dinero'],
    ['  Tarjeta', t.tarjeta, 'dinero'],
    ['', ''],
    ['Ventas con ITBMS (7 %, ya incluido en el precio)', t.gravado, 'dinero'],
    ['ITBMS cobrado', t.itbms, 'dinero'],
    ['Ventas exentas', t.exento, 'dinero'],
    ['', ''],
    ['Compras con factura', totalCompras, 'dinero'],
    ['Facturas de compra', (compras ?? []).length, 'numero'],
    ['Mercancía dañada o vencida (a costo)', totalPerdidas, 'dinero'],
    ['Ventas anuladas', anuladas.length, 'numero'],
    ['', ''],
    ['Nota: el ITBMS se calcula con la tasa que tiene cada producto en el sistema.', ''],
  ])
  agregarTabla(libro, 'Ventas por día', [
    { titulo: 'Fecha', clave: 'fecha', ancho: 12 },
    { titulo: 'Ventas', clave: 'ventas', ancho: 9, tipo: 'numero' },
    { titulo: 'Efectivo', clave: 'efectivo', ancho: 12, tipo: 'dinero' },
    { titulo: 'Yappy', clave: 'yappy', ancho: 12, tipo: 'dinero' },
    { titulo: 'Tarjeta', clave: 'tarjeta', ancho: 12, tipo: 'dinero' },
    { titulo: 'Total', clave: 'total', ancho: 12, tipo: 'dinero' },
    { titulo: 'Con ITBMS', clave: 'gravado', ancho: 12, tipo: 'dinero' },
    { titulo: 'ITBMS', clave: 'itbms', ancho: 10, tipo: 'dinero' },
    { titulo: 'Exento', clave: 'exento', ancho: 12, tipo: 'dinero' },
  ], [...dias, { fecha: 'TOTAL', ...t }]).lastRow!.font = { bold: true }
  agregarTabla(libro, 'Compras', [
    { titulo: 'Fecha', clave: 'fecha', ancho: 12 },
    { titulo: 'Proveedor', clave: 'proveedor', ancho: 28 },
    { titulo: 'N.º de factura', clave: 'numero_factura', ancho: 16, tipo: 'texto' },
    { titulo: 'Total', clave: 'total', ancho: 12, tipo: 'dinero' },
  ], (compras ?? []).map(c => ({ ...c, total: Number(c.total) })))
  agregarTabla(libro, 'Anuladas', [
    { titulo: 'Fecha y hora', clave: 'cuando', ancho: 20 },
    { titulo: 'Monto', clave: 'total', ancho: 12, tipo: 'dinero' },
    { titulo: 'Motivo', clave: 'motivo', ancho: 40 },
  ], anuladas.map(v => ({
    cuando: new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(v.creado_en)),
    total: Number(v.total), motivo: v.motivo_anulacion ?? '',
  })))

  return respuestaExcel(libro, `contador-${nombreArchivo(tienda.nombre)}-${mes}.xlsx`)
}
