// Subir el inventario desde un Excel: se lee la tabla, se revisa fila por fila y se decide
// qué producto se crea, cuál se actualiza y cuál queda igual. Sirve la plantilla y también
// el Excel que se descarga de Inventario.
import { CATEGORIAS } from '@/lib/tienda/categorias'
import { dinero, normalizarCodigo } from '@/lib/tienda/formato'
import type { VendePor } from '@/lib/tienda/tipos'

export const MAX_FILAS = 1000

export type FilaExcel = {
  fila: number
  nombre: string
  codigo: string | null
  categoria: string | null
  vende_por: VendePor | null
  disponible: number | null
  minimo: number | null
  precio: number | null
  costo: number | null
  error: string | null
}

export type ProductoExistente = {
  id: string
  nombre: string
  codigo_barras: string | null
  precio_venta: number | null
  costo: number | null
  categoria: string | null
  stock_minimo: number | null
  stock?: number
}

export type Paso = FilaExcel & {
  accion: 'nuevo' | 'actualizar' | 'igual' | 'error'
  producto_id: string | null
  cambios: string[]
}

type Campo = 'nombre' | 'codigo' | 'categoria' | 'vende_por' | 'disponible' | 'minimo' | 'precio' | 'costo'

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Nombres con que puede venir cada columna (sin acentos ni mayúsculas)
const ENCABEZADOS: Record<Campo, string[]> = {
  nombre: ['producto', 'nombre', 'descripcion', 'articulo', 'nombre del producto'],
  codigo: ['codigo de barras', 'codigo', 'barcode', 'ean', 'upc', 'cod. barras'],
  categoria: ['categoria'],
  vende_por: ['se vende por', 'vende por', 'unidad de venta'],
  disponible: ['disponible', 'cantidad', 'stock', 'existencia', 'existencias', 'hay', 'inventario'],
  minimo: ['minimo', 'stock minimo'],
  precio: ['precio de venta', 'precio', 'pvp', 'venta', 'precio venta'],
  costo: ['me cuesta', 'costo', 'costo unitario', 'precio de compra', 'compra'],
}

const CODIGO = /^[0-9A-Za-z-]{4,32}$/

function texto(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  return String(v).trim()
}

// "$1.25", "1,25", 1.25 → 1.25; vacío → null; otra cosa → NaN
function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : Number.NaN
  const t = texto(v).replace(/[$\s]/g, '')
  if (!t) return null
  const n = Number(/^\d+,\d+$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : Number.NaN
}

export function leerFilas(matriz: unknown[][]): FilaExcel[] | string {
  // El encabezado puede no estar en la primera fila (el Excel trae un título arriba)
  let inicio = -1
  let columnas: Partial<Record<Campo, number>> = {}
  for (let r = 0; r < Math.min(matriz.length, 10) && inicio < 0; r++) {
    const celdas = (matriz[r] ?? []).map(c => sinAcentos(texto(c)))
    const encontradas: Partial<Record<Campo, number>> = {}
    for (const campo of Object.keys(ENCABEZADOS) as Campo[]) {
      const i = celdas.findIndex(c => ENCABEZADOS[campo].includes(c))
      if (i >= 0) encontradas[campo] = i
    }
    if (encontradas.nombre !== undefined) {
      inicio = r
      columnas = encontradas
    }
  }
  if (inicio < 0) return 'No encontré la columna «Producto» o «Nombre» en el Excel'

  const filas: FilaExcel[] = []
  const vistos = new Map<string, number>()
  for (let r = inicio + 1; r < matriz.length; r++) {
    const celda = (campo: Campo) => (columnas[campo] === undefined ? null : (matriz[r] ?? [])[columnas[campo] as number])
    const nombre = texto(celda('nombre')).replace(/\s+/g, ' ').slice(0, 120)
    if (!nombre) continue
    const codigoCrudo = texto(celda('codigo')).replace(/\s/g, '')
    const vende = sinAcentos(texto(celda('vende_por')))
    const categoriaCruda = texto(celda('categoria')).slice(0, 60)
    const fila: FilaExcel = {
      fila: r + 1,
      nombre,
      codigo: codigoCrudo ? normalizarCodigo(codigoCrudo) : null,
      categoria: categoriaCruda ? CATEGORIAS.find(c => sinAcentos(c) === sinAcentos(categoriaCruda)) ?? categoriaCruda : null,
      vende_por: vende.startsWith('lib') || vende === 'lb' ? 'libra' : vende ? 'unidad' : null,
      disponible: numero(celda('disponible')),
      minimo: numero(celda('minimo')),
      precio: numero(celda('precio')),
      costo: numero(celda('costo')),
      error: null,
    }
    const malos: [keyof FilaExcel, string][] = [['precio', 'El precio'], ['costo', 'El costo'], ['disponible', 'La cantidad'], ['minimo', 'El mínimo']]
    for (const [k, t] of malos) {
      const v = fila[k] as number | null
      if (v !== null && Number.isNaN(v)) fila.error ??= `${t} no es un número`
      // La cantidad negativa se revisa al planear: el Excel descargado la trae así si se vendió más de lo contado
      else if (v !== null && v < 0 && k !== 'disponible') fila.error ??= `${t} no puede ser negativo`
    }
    if (fila.codigo && !CODIGO.test(fila.codigo)) fila.error ??= 'El código de barras no es válido'
    const clave = fila.codigo ?? `n:${sinAcentos(nombre)}`
    const antes = vistos.get(clave)
    if (antes !== undefined) fila.error ??= `Está repetido (fila ${antes})`
    else vistos.set(clave, fila.fila)
    filas.push(fila)
    if (filas.length >= MAX_FILAS) break
  }
  return filas
}

// Busca cada fila en los productos de la tienda: primero por código, después por nombre exacto
export function planear(filas: FilaExcel[], productos: ProductoExistente[]): Paso[] {
  const porCodigo = new Map(productos.filter(p => p.codigo_barras).map(p => [normalizarCodigo(p.codigo_barras as string), p]))
  const porNombre = new Map(productos.map(p => [sinAcentos(p.nombre), p]))
  return filas.map(f => {
    if (f.error) return { ...f, accion: 'error', producto_id: null, cambios: [] }
    const porNom = porNombre.get(sinAcentos(f.nombre))
    const p = (f.codigo ? porCodigo.get(f.codigo) : undefined) ?? (porNom && (!f.codigo || !porNom.codigo_barras) ? porNom : undefined)
    const negativo = f.disponible !== null && f.disponible < 0
    if (!p) return negativo ? { ...f, accion: 'error', error: 'La cantidad no puede ser negativa', producto_id: null, cambios: [] } : { ...f, accion: 'nuevo', producto_id: null, cambios: [] }
    if (negativo && f.disponible !== p.stock) return { ...f, accion: 'error', error: 'La cantidad no puede ser negativa', producto_id: p.id, cambios: [] }
    const cambios: string[] = []
    if (f.codigo && !p.codigo_barras) cambios.push('código de barras')
    if (f.precio !== null && f.precio !== p.precio_venta) cambios.push(`precio ${dinero(p.precio_venta)} → ${dinero(f.precio)}`)
    if (f.costo !== null && f.costo !== p.costo) cambios.push(`costo ${dinero(p.costo)} → ${dinero(f.costo)}`)
    if (f.categoria && f.categoria !== p.categoria) cambios.push(`categoría ${f.categoria}`)
    if (f.minimo !== null && f.minimo !== p.stock_minimo) cambios.push(`mínimo ${f.minimo}`)
    if (f.disponible !== null && f.disponible !== p.stock) cambios.push(`contar: ${f.disponible}`)
    return { ...f, accion: cambios.length ? 'actualizar' : 'igual', producto_id: p.id, cambios }
  })
}
