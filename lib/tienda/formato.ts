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
