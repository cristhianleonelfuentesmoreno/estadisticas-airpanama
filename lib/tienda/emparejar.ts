// Une cada línea leída de una factura con un producto del inventario.
// Primero por código de barras (seguro); si no hay, por palabras del nombre (sugerencia que la persona confirma).

import { normalizarCodigo } from '@/lib/tienda/formato'

type ProductoBase = { id: string; nombre: string; codigo_barras: string | null }

export type Coincidencia = { producto_id: string; por: 'codigo' | 'nombre' } | null

// Palabras que no ayudan a distinguir productos en una factura
const RELLENO = new Set([
  'de', 'del', 'la', 'el', 'con', 'en', 'sin', 'por', 'para', 'pet', 'und', 'unid', 'bolsa', 'caja', 'pack', 'paquete',
  'no', 'retornable', 'sabor', 'surtido', 'x',
])

export function palabras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .split(' ')
    .filter(p => p.length >= 3 && !RELLENO.has(p) && !/^\d+$/.test(p))
}

export function emparejar(
  linea: { descripcion: string; codigo_barras: string | null },
  productos: ProductoBase[],
): Coincidencia {
  if (linea.codigo_barras) {
    const c = normalizarCodigo(linea.codigo_barras)
    const p = productos.find(x => x.codigo_barras && normalizarCodigo(x.codigo_barras) === c)
    if (p) return { producto_id: p.id, por: 'codigo' }
  }

  const deLinea = new Set(palabras(linea.descripcion))
  if (deLinea.size === 0) return null
  let mejor: { id: string; puntaje: number; comunes: number } | null = null
  for (const p of productos) {
    const delProducto = palabras(p.nombre)
    if (!delProducto.length) continue
    const comunes = delProducto.filter(x => deLinea.has(x)).length
    // Qué parte del nombre del producto aparece en la línea de la factura
    const puntaje = comunes / delProducto.length
    if (!mejor || puntaje > mejor.puntaje || (puntaje === mejor.puntaje && comunes > mejor.comunes)) {
      mejor = { id: p.id, puntaje, comunes }
    }
  }
  if (mejor && mejor.comunes >= 2 && mejor.puntaje >= 0.6) return { producto_id: mejor.id, por: 'nombre' }
  if (mejor && mejor.comunes === 1 && mejor.puntaje === 1) return { producto_id: mejor.id, por: 'nombre' }
  return null
}
