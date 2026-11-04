// Formatos y cálculos de la caja. Un solo lugar para redondear y mostrar plata.

export function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function dinero(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `$${redondear2(n).toFixed(2)}`
}

export function cantidad(n: number, vendePor: 'unidad' | 'libra'): string {
  if (vendePor === 'libra') return `${Number(n.toFixed(3))} lb`
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))
}

// Ganancia sobre el precio de venta: (precio - costo) / precio
export function margen(precio: number | null, costo: number | null): number | null {
  if (!precio || costo === null || precio <= 0) return null
  return Math.round(((precio - costo) / precio) * 100)
}

// Inicio del día de hoy en hora de Panamá (UTC-5, sin horario de verano), en ISO
export function inicioDeHoyPanama(ahora = new Date()): string {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(ahora)
  return `${dia}T00:00:00-05:00`
}

export function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: 'numeric', month: 'short' }).format(new Date(iso))
}

// Un UPC-A (12 dígitos) se lee a veces como EAN-13 con un 0 adelante: los dos son el mismo producto
export function normalizarCodigo(codigo: string): string {
  const c = codigo.trim()
  return /^0\d{12}$/.test(c) ? c.slice(1) : c
}

// ---------- Avisos de "te queda poco" ----------

// Sin mínimo propio avisa cuando queda 1 o se acabó: en una tienda pequeña es normal tener 2 de muchas cosas
export const MINIMO_POR_DEFECTO = 1

type ConStock = { nombre: string; stock: number; stock_minimo: number | null; vende_por: 'unidad' | 'libra'; contado: boolean }

export function minimoDe(p: Pick<ConStock, 'stock_minimo'>): number {
  return p.stock_minimo ?? MINIMO_POR_DEFECTO
}

// Lo que nunca se contó no avisa: no se sabe cuánto hay
export function porAgotarse(p: Pick<ConStock, 'stock' | 'stock_minimo' | 'contado'>): boolean {
  return p.contado && p.stock <= minimoDe(p)
}

// Texto listo para mandar por WhatsApp al proveedor o a quien hace las compras
export function textoPedido(productos: ConStock[], tienda: string): string {
  const lineas = [...productos]
    .sort((a, b) => a.stock - b.stock)
    .map(p => `• ${p.nombre} (${p.stock <= 0 ? 'no hay' : `quedan ${cantidad(p.stock, p.vende_por)}`})`)
  return [`Pedido para ${tienda}:`, ...lineas].join('\n')
}
