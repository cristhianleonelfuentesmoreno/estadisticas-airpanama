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

// Los códigos de barras (EAN-8, UPC-A, EAN-13, GTIN-14) traen al final un dígito de control:
// de derecha a izquierda, los demás dígitos se multiplican por 3, 1, 3, 1… y el control es lo que
// le falta a la suma para llegar a la siguiente decena. Así se nota un número mal copiado.
export function revisarCodigo(codigo: string): { valido: boolean; debia: string | null } {
  const c = codigo.trim()
  if (!/^(\d{8}|\d{12,14})$/.test(c)) return { valido: false, debia: null }
  const cuerpo = c.slice(0, -1)
  let suma = 0
  for (let i = 0; i < cuerpo.length; i++) suma += Number(cuerpo[cuerpo.length - 1 - i]) * (i % 2 === 0 ? 3 : 1)
  const control = String((10 - (suma % 10)) % 10)
  return control === c.slice(-1) ? { valido: true, debia: null } : { valido: false, debia: control }
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
export function textoPedido(productos: ConStock[], tienda: string, proveedor?: string): string {
  const lineas = [...productos]
    .sort((a, b) => a.stock - b.stock)
    .map(p => `• ${p.nombre} (${p.stock <= 0 ? 'no hay' : `quedan ${cantidad(p.stock, p.vende_por)}`})`)
  return [`Pedido para ${tienda}${proveedor ? ` · ${proveedor}` : ''}:`, ...lineas].join('\n')
}

// La lista de pedido separada por el último proveedor que trajo cada producto; sin proveedor, al final
export function agruparPorProveedor<T extends { id: string }>(productos: T[], proveedorDe: Record<string, string>): { proveedor: string | null; productos: T[] }[] {
  const grupos = new Map<string | null, T[]>()
  for (const p of productos) {
    const prov = proveedorDe[p.id] ?? null
    grupos.set(prov, [...(grupos.get(prov) ?? []), p])
  }
  return [...grupos.entries()]
    .map(([proveedor, ps]) => ({ proveedor, productos: ps }))
    .sort((a, b) => (a.proveedor === null ? 1 : b.proveedor === null ? -1 : a.proveedor.localeCompare(b.proveedor, 'es')))
}

// ---------- Períodos de "Mi negocio" (fechas de Panamá, AAAA-MM-DD) ----------

export type Periodo = 'hoy' | 'semana' | 'mes'

function diaPanama(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(fecha)
}

export function rangoDe(periodo: Periodo, ahora = new Date()): { desde: string; hasta: string } {
  const hasta = diaPanama(ahora)
  if (periodo === 'hoy') return { desde: hasta, hasta }
  if (periodo === 'mes') return { desde: `${hasta.slice(0, 8)}01`, hasta }
  const hace6 = new Date(`${hasta}T12:00:00-05:00`)
  hace6.setUTCDate(hace6.getUTCDate() - 6)
  return { desde: diaPanama(hace6), hasta }
}

// "Vas 12 % arriba" / "Vas 5 % abajo"; null si no hay con qué comparar
export function cambioPorcentual(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null
  return Math.round(((actual - anterior) / anterior) * 100)
}

// ---------- Lo que gana la tienda en cada producto ----------

export function gananciaPorUnidad(precio: number | null, costo: number | null): number | null {
  if (precio === null || costo === null) return null
  return redondear2(precio - costo)
}

// Lo que busca ganar cada producto si el dueño no le pone otro porcentaje
export const GANANCIA_POR_DEFECTO = 30

// De 0 a menos de 100: con 100 % el precio sería infinito
export function porcentajeValido(texto: string): number | null {
  const n = Number(texto.replace(',', '.'))
  return texto.trim() !== '' && Number.isFinite(n) && n >= 0 && n < 100 ? n : null
}

// Precio para ganar cierto porcentaje del precio de venta, redondeado hacia arriba a 5 centavos
// (costo $0.21 y ganar 40% -> $0.35, como lo calculan en la tienda sobre la factura)
export function precioParaGanar(costo: number, porcentaje: number): number {
  const exacto = costo / (1 - porcentaje / 100)
  return redondear2(Math.ceil(redondear2(exacto) * 20 - 1e-9) / 20)
}

// ---------- Facturas: costo del paquete y total de la línea van amarrados ----------

// Total de la línea a partir de paquetes × costo del paquete ('' si falta algo)
export function totalDe(paquetes: string, costoPaquete: string): string {
  const p = Number(paquetes)
  const c = Number(costoPaquete)
  return paquetes.trim() !== '' && costoPaquete.trim() !== '' && p > 0 && c >= 0 ? redondear2(p * c).toFixed(2) : ''
}

// Costo de cada paquete a partir del total de la línea ('' si falta algo)
export function costoDe(paquetes: string, totalLinea: string): string {
  const p = Number(paquetes)
  const t = Number(totalLinea)
  return paquetes.trim() !== '' && totalLinea.trim() !== '' && p > 0 && t >= 0 ? String(Number((t / p).toFixed(4))) : ''
}

// ---------- Caducidad (fechas AAAA-MM-DD de Panamá) ----------

// Avisa desde 15 días antes: alcanza para venderlo o devolverlo al proveedor
export const VENCE_PRONTO_DIAS = 15

export function hoyPanama(ahora = new Date()): string {
  return diaPanama(ahora)
}

export function diasParaVencer(vence: string, hoy: string): number {
  return Math.round((Date.parse(`${vence}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000)
}

export function vencePronto(vence: string | null, hoy: string): boolean {
  return vence !== null && diasParaVencer(vence, hoy) <= VENCE_PRONTO_DIAS
}

// "Vencido hace 3 días", "Vence hoy", "Vence en 5 días", "Vence el 12 dic"
export function textoVence(vence: string, hoy: string): string {
  const d = diasParaVencer(vence, hoy)
  if (d < 0) return d === -1 ? 'Venció ayer' : `Venció hace ${-d} días`
  if (d === 0) return 'Vence hoy'
  if (d === 1) return 'Vence mañana'
  if (d <= VENCE_PRONTO_DIAS) return `Vence en ${d} días`
  const f = new Intl.DateTimeFormat('es-PA', { timeZone: 'UTC', day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined }).format(new Date(`${vence}T12:00:00Z`))
  return `Vence el ${f}`
}

// Botones rápidos del calendario: hoy + n meses (el 31 de enero + 1 mes queda en el último día de febrero)
export function sumarMeses(hoy: string, meses: number): string {
  const [a, m, d] = hoy.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate()
  return new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimo))).toISOString().slice(0, 10)
}

// Al llegar mercancía nueva se guarda la fecha que vence primero, salvo que la anterior ya pasó
// (lo viejo ya se vendió o se botó)
export function venceQueda(actual: string | null, nuevo: string, hoy: string): string {
  if (actual === null || actual < hoy) return nuevo
  return actual < nuevo ? actual : nuevo
}

// ---------- Cuando sube el costo: precio para seguir ganando lo mismo ----------

// Si con el costo nuevo el producto ya no deja su %, devuelve el precio para volver a ganarlo; si no, null
export function precioSugerido(precio: number | null, costoAntes: number | null, costoNuevo: number, porcentaje: number): number | null {
  if (precio === null || precio <= 0 || costoNuevo <= 0) return null
  if (costoAntes !== null && costoNuevo <= costoAntes) return null
  if ((margen(precio, costoNuevo) ?? 0) >= porcentaje) return null
  const sugerido = precioParaGanar(costoNuevo, porcentaje)
  return sugerido > precio ? sugerido : null
}

// ---------- Resumen del cierre para mandar por WhatsApp ----------

export function textoCierre(d: {
  tienda: string; fecha: string; ventas: number; total: number; efectivo: number; yappy: number; tarjeta: number
  ganancia: number; esperado: number; contado: number; diferencia: number
}): string {
  const cuadre = Math.abs(d.diferencia) < 0.005 ? 'cuadra perfecto' : d.diferencia > 0 ? `sobran ${dinero(d.diferencia)}` : `faltan ${dinero(-d.diferencia)}`
  return [
    `Cierre de ${d.tienda} · ${d.fecha}`,
    `Vendiste ${dinero(d.total)} en ${d.ventas} ${d.ventas === 1 ? 'venta' : 'ventas'}`,
    `• Efectivo ${dinero(d.efectivo)} · Yappy ${dinero(d.yappy)} · Tarjeta ${dinero(d.tarjeta)}`,
    `Ganaste más o menos ${dinero(d.ganancia)}`,
    `Caja: debía haber ${dinero(d.esperado)}, contaste ${dinero(d.contado)} (${cuadre})`,
  ].join('\n')
}
