import { getTiendaParaOperar } from '@/lib/tienda/servidor'
import { agregarTabla, nombreArchivo, nuevoLibro, respuestaExcel, type Columna } from '@/lib/tienda/excel'
import { CATEGORIAS } from '@/lib/tienda/categorias'

const COLUMNAS: Columna[] = [
  { titulo: 'Producto', clave: 'nombre', ancho: 34 },
  { titulo: 'Código de barras', clave: 'codigo', ancho: 18, tipo: 'texto' },
  { titulo: 'Categoría', clave: 'categoria', ancho: 22 },
  { titulo: 'Se vende por', clave: 'vende_por', ancho: 13 },
  { titulo: 'Disponible', clave: 'disponible', ancho: 12, tipo: 'numero' },
  { titulo: 'Mínimo', clave: 'minimo', ancho: 10, tipo: 'numero' },
  { titulo: 'Precio de venta', clave: 'precio', ancho: 15, tipo: 'dinero' },
  { titulo: 'Me cuesta', clave: 'costo', ancho: 12, tipo: 'dinero' },
]

// Plantilla vacía para subir el inventario. La hoja «Cómo llenarlo» trae ejemplos que no se importan.
export async function GET(_req: Request, { params }: RouteContext<'/t/[slug]/inventario/plantilla'>) {
  const { slug } = await params
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) return new Response('No encontrado', { status: 404 })

  const libro = nuevoLibro()
  const hoja = agregarTabla(libro, 'Inventario', COLUMNAS, [])
  // Unas filas listas para escribir, con la lista de categorías y "unidad / libra" para elegir
  for (let n = 2; n <= 300; n++) {
    hoja.getCell(`C${n}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${CATEGORIAS.join(',')}"`] }
    hoja.getCell(`D${n}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Unidad,Libra"'] }
  }
  const ayuda = libro.addWorksheet('Cómo llenarlo')
  ayuda.columns = [{ width: 30 }, { width: 18 }, { width: 22 }, { width: 13 }, { width: 12 }, { width: 10 }, { width: 15 }, { width: 12 }]
  ayuda.addRow(['Llena la hoja «Inventario». Una fila por producto. Solo el nombre es obligatorio.']).font = { bold: true }
  ayuda.addRow(['Si dejas el precio vacío y pones lo que te cuesta, el precio se calcula con tu % de ganancia.'])
  ayuda.addRow(['«Disponible» es lo que hay hoy en el estante. Si lo dejas vacío, no se cuenta.'])
  ayuda.addRow(['Si un producto ya existe (mismo código o mismo nombre), se actualiza; no se repite.'])
  ayuda.addRow([])
  ayuda.addRow(COLUMNAS.map(c => c.titulo)).font = { bold: true }
  ayuda.addRow(['Coca-Cola 2 L', '7501055303786', 'Bebidas', 'Unidad', 12, 3, 2.3, 1.6])
  ayuda.addRow(['Papa', '', 'Verduras y frutas', 'Libra', 25.5, '', 1.2, 0.8])
  ayuda.addRow(['Comino molido (sobre)', '', 'Especias y condimentos', 'Unidad', 48, 10, '', 0.1])

  return respuestaExcel(libro, `plantilla-inventario-${nombreArchivo(tienda.nombre)}.xlsx`)
}
