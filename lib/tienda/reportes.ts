// Cálculos de los reportes en Excel (inventario y el del contador). Sin base de datos: fáciles de probar.
import { gananciaPorUnidad, margen, redondear2 } from '@/lib/tienda/formato'
import type { Producto } from '@/lib/tienda/tipos'

// Lo que le falta a un producto para estar completo, en palabras de tienda
export function leFalta(p: Pick<Producto, 'precio_venta' | 'costo' | 'codigo_barras' | 'contado'>): string[] {
  const falta: string[] = []
  if (p.precio_venta === null) falta.push('precio')
  if (p.costo === null) falta.push('costo')
  if (!p.codigo_barras) falta.push('código de barras')
  if (!p.contado) falta.push('contarlo')
  return falta
}

export type FilaInventario = {
  nombre: string
  categoria: string
  codigo: string
  vende_por: string
  disponible: number | null
  minimo: number | null
  precio: number | null
  costo: number | null
  ganas: number | null
  margen: number | null
  valor_costo: number | null
  valor_venta: number | null
  le_falta: string
}

export function filaInventario(p: Producto): FilaInventario {
  const stock = p.contado ? p.stock : null
  const hay = stock === null ? null : Math.max(stock, 0)
  return {
    nombre: p.nombre,
    categoria: p.categoria ?? '',
    codigo: p.codigo_barras ?? '',
    vende_por: p.vende_por === 'libra' ? 'Libra' : 'Unidad',
    disponible: stock,
    minimo: p.stock_minimo,
    precio: p.precio_venta,
    costo: p.costo,
    ganas: gananciaPorUnidad(p.precio_venta, p.costo),
    margen: margen(p.precio_venta, p.costo),
    valor_costo: hay === null || p.costo === null ? null : redondear2(hay * p.costo),
    valor_venta: hay === null || p.precio_venta === null ? null : redondear2(hay * p.precio_venta),
    le_falta: leFalta(p).join(', '),
  }
}

// Los precios en Panamá ya traen el ITBMS adentro: de $1.07 con 7 %, $0.07 es impuesto
export function itbmsIncluido(monto: number, tasa: number): number {
  if (tasa <= 0) return 0
  return redondear2((monto * tasa) / (100 + tasa))
}

// "2026-11" -> rango del mes en hora de Panamá
export function rangoMes(mes: string): { desde: string; hasta: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  if (!m) return null
  const anio = Number(m[1])
  const num = Number(m[2])
  if (num < 1 || num > 12) return null
  const sig = num === 12 ? `${anio + 1}-01` : `${anio}-${String(num + 1).padStart(2, '0')}`
  return { desde: `${mes}-01T00:00:00-05:00`, hasta: `${sig}-01T00:00:00-05:00` }
}

export type VentaMes = {
  creado_en: string
  total: number
  metodo_pago: 'efectivo' | 'yappy' | 'tarjeta'
  anulada: boolean
  lineas: { subtotal: number; itbms: number }[]
}

export type DiaContador = {
  fecha: string
  ventas: number
  efectivo: number
  yappy: number
  tarjeta: number
  total: number
  gravado: number
  itbms: number
  exento: number
}

const diaPanama = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date(iso))

// Una fila por día con ventas; las anuladas no cuentan
export function ventasPorDia(ventas: VentaMes[]): DiaContador[] {
  const dias = new Map<string, DiaContador>()
  for (const v of ventas) {
    if (v.anulada) continue
    const fecha = diaPanama(v.creado_en)
    const d = dias.get(fecha) ?? { fecha, ventas: 0, efectivo: 0, yappy: 0, tarjeta: 0, total: 0, gravado: 0, itbms: 0, exento: 0 }
    d.ventas += 1
    d[v.metodo_pago] = redondear2(d[v.metodo_pago] + v.total)
    d.total = redondear2(d.total + v.total)
    for (const l of v.lineas) {
      if (l.itbms > 0) {
        d.gravado = redondear2(d.gravado + l.subtotal)
        d.itbms = redondear2(d.itbms + itbmsIncluido(l.subtotal, l.itbms))
      } else {
        d.exento = redondear2(d.exento + l.subtotal)
      }
    }
    dias.set(fecha, d)
  }
  return [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function sumarDias(dias: DiaContador[]): Omit<DiaContador, 'fecha'> {
  const t = { ventas: 0, efectivo: 0, yappy: 0, tarjeta: 0, total: 0, gravado: 0, itbms: 0, exento: 0 }
  for (const d of dias) {
    for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] = redondear2(t[k] + d[k])
  }
  return t
}
