// Ventas hechas sin internet: se guardan en este celular y se suben solas cuando vuelve la señal.
// Cada una lleva su propio id (id_cliente): si se manda dos veces, la base la cuenta una sola vez.
import type { LineaVenta, MetodoPago } from '@/lib/tienda/tipos'

export type VentaPendiente = {
  id: string
  tiendaId: string
  metodo: MetodoPago
  lineas: LineaVenta[]
  total: number
  // Cuándo se hizo de verdad (ISO)
  hecha_en: string
  // Si la base la rechazó por algo que no es el internet (ej. un producto sin precio)
  error?: string
}

const CLAVE = 'vv-ventas-pendientes'
export const EVENTO_PENDIENTES = 'vv-pendientes'

export function agregarPendiente(lista: VentaPendiente[], v: VentaPendiente): VentaPendiente[] {
  return lista.some(x => x.id === v.id) ? lista : [...lista, v]
}

export function quitarPendiente(lista: VentaPendiente[], id: string): VentaPendiente[] {
  return lista.filter(x => x.id !== id)
}

export function marcarError(lista: VentaPendiente[], id: string, error: string): VentaPendiente[] {
  return lista.map(x => (x.id === id ? { ...x, error } : x))
}

// ---------- En el celular (localStorage) ----------

// El texto guardado tal cual: sirve para que React note cuándo cambió (useSyncExternalStore)
export function textoPendientes(): string {
  try {
    return localStorage.getItem(CLAVE) ?? ''
  } catch {
    return ''
  }
}

export function deTexto(crudo: string): VentaPendiente[] {
  try {
    const lista: unknown = crudo ? JSON.parse(crudo) : []
    return Array.isArray(lista) ? (lista as VentaPendiente[]) : []
  } catch {
    return []
  }
}

export function leerPendientes(): VentaPendiente[] {
  return deTexto(textoPendientes())
}

export function suscribirPendientes(avisar: () => void): () => void {
  window.addEventListener(EVENTO_PENDIENTES, avisar)
  window.addEventListener('storage', avisar)
  return () => {
    window.removeEventListener(EVENTO_PENDIENTES, avisar)
    window.removeEventListener('storage', avisar)
  }
}

export function suscribirConexion(avisar: () => void): () => void {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

export function guardarPendientes(lista: VentaPendiente[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista))
  } catch {
    // Sin espacio: la venta igual queda en pantalla hasta que se suba
  }
  window.dispatchEvent(new Event(EVENTO_PENDIENTES))
}

// Error de red (sin internet, se cortó la señal): la venta se guarda para después
export function esSinInternet(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return e instanceof TypeError || (e instanceof Error && /fetch|network|load failed|conexi/i.test(e.message))
}
