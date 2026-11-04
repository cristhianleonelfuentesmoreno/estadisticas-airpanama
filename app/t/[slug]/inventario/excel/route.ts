import { getProductos, getTienda } from '@/lib/tienda/servidor'
import { agregarResumen, agregarTabla, nombreArchivo, nuevoLibro, respuestaExcel, type Columna } from '@/lib/tienda/excel'
import { filaInventario, leFalta } from '@/lib/tienda/reportes'
import { redondear2 } from '@/lib/tienda/formato'

const COLUMNAS: Columna[] = [
  { titulo: 'Producto', clave: 'nombre', ancho: 34 },
  { titulo: 'Categoría', clave: 'categoria', ancho: 22 },
  { titulo: 'Código de barras', clave: 'codigo', ancho: 18, tipo: 'texto' },
  { titulo: 'Se vende por', clave: 'vende_por', ancho: 12 },
  { titulo: 'Disponible', clave: 'disponible', ancho: 12, tipo: 'numero' },
  { titulo: 'Mínimo', clave: 'minimo', ancho: 10, tipo: 'numero' },
  { titulo: 'Precio de venta', clave: 'precio', ancho: 15, tipo: 'dinero' },
  { titulo: 'Me cuesta', clave: 'costo', ancho: 12, tipo: 'dinero' },
  { titulo: 'Gano por unidad', clave: 'ganas', ancho: 15, tipo: 'dinero' },
  { titulo: 'Ganancia', clave: 'margen', ancho: 10, tipo: 'porcentaje' },
  { titulo: 'Vale a costo', clave: 'valor_costo', ancho: 13, tipo: 'dinero' },
  { titulo: 'Vale a precio de venta', clave: 'valor_venta', ancho: 20, tipo: 'dinero' },
  { titulo: 'Le falta', clave: 'le_falta', ancho: 36 },
]

// Todo el inventario en Excel: lo que hay, cuánto vale y qué le falta a cada producto
export async function GET(_req: Request, { params }: RouteContext<'/t/[slug]/inventario/excel'>) {
  const { slug } = await params
  const tienda = await getTienda(slug)
  if (!tienda) return new Response('No encontrado', { status: 404 })

  const productos = await getProductos(tienda)
  const filas = productos.map(filaInventario)
  const cuantos = (que: string) => productos.filter(p => leFalta(p).includes(que)).length
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date())

  const libro = nuevoLibro()
  agregarResumen(libro, `Inventario de ${tienda.nombre} · ${hoy}`, [
    ['Productos', productos.length, 'numero'],
    ['Tu mercancía vale a costo (solo lo que tiene costo)', redondear2(filas.reduce((s, f) => s + (f.valor_costo ?? 0), 0)), 'dinero'],
    ['Tu mercancía vale a precio de venta', redondear2(filas.reduce((s, f) => s + (f.valor_venta ?? 0), 0)), 'dinero'],
    ['', ''],
    ['Les falta el precio', cuantos('precio'), 'numero'],
    ['Les falta lo que te cuestan', cuantos('costo'), 'numero'],
    ['Les falta el código de barras', cuantos('código de barras'), 'numero'],
    ['Falta contarlos', cuantos('contarlo'), 'numero'],
  ])
  const hoja = agregarTabla(libro, 'Inventario', COLUMNAS, filas)
  // Lo que falta se marca en amarillo para verlo de un vistazo
  hoja.eachRow((fila, n) => {
    if (n === 1) return
    for (const clave of ['disponible', 'precio', 'costo', 'codigo'] as const) {
      const celda = fila.getCell(clave)
      if (celda.value === null || celda.value === '') celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    }
  })
  agregarTabla(libro, 'Le falta algo', COLUMNAS, filas.filter(f => f.le_falta))

  return respuestaExcel(libro, `inventario-${nombreArchivo(tienda.nombre)}-${hoy}.xlsx`)
}
