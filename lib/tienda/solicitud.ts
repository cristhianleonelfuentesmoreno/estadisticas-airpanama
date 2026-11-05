// Lo que llena quien quiere abrir su negocio en ValisVentas (y el administrador puede corregir)
export const TIPOS_NEGOCIO = ['Minisúper', 'Abarrotería', 'Kiosco', 'Panadería', 'Otro'] as const

export type DatosSolicitud = {
  negocio: string
  tipo: string
  telefono: string
  vende_por_libra: boolean
  porcentaje_ganancia: number
}

// Lo que se pesa en casi todo minisúper: se crean sin precio y el dueño lo pone al pesar
export const POR_LIBRA_INICIALES = ['Papa', 'Cebolla', 'Tomate', 'Zanahoria', 'Ají'] as const

export function limpiarSolicitud(d: DatosSolicitud): DatosSolicitud | string {
  const negocio = typeof d.negocio === 'string' ? d.negocio.trim().replace(/\s+/g, ' ').slice(0, 80) : ''
  if (negocio.length < 2) return 'Escribe el nombre del negocio'
  const telefono = typeof d.telefono === 'string' ? d.telefono.trim() : ''
  if (telefono && !/^[0-9 +()-]{7,20}$/.test(telefono)) return 'El teléfono no es válido'
  const pct = Number(d.porcentaje_ganancia)
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) return 'El % de ganancia va de 0 a 99'
  const tipo = TIPOS_NEGOCIO.find(t => t === d.tipo) ?? 'Otro'
  return { negocio, tipo, telefono, vende_por_libra: d.vende_por_libra === true, porcentaje_ganancia: Math.round(pct * 100) / 100 }
}
