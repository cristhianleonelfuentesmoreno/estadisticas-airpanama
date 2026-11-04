'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { claveValida, PRECIOS } from '@/lib/tienda/factura-ia'
import type { Resultado } from '@/lib/tienda/tipos'

// Inteligencia artificial desde el panel: una sola clave para todas las tiendas y el consumo de cada una.
// Solo el administrador. La clave nunca vuelve al navegador: solo sus últimos 4 caracteres.

export type ConfigIa = {
  modelo: string
  limite_diario: number
  clave_final: string | null
  clave_actualizada_en: string | null
  precio: { entrada: number; salida: number } | null
}

export async function obtenerConfigIa(): Promise<ConfigIa> {
  await requireAdmin()
  const { data } = await createAdminClient()
    .from('config_ia')
    .select('modelo, limite_diario, clave_final, clave_actualizada_en')
    .eq('id', 1)
    .single()
  const modelo = data?.modelo ?? 'claude-haiku-5-5'
  return {
    modelo,
    limite_diario: data?.limite_diario ?? 20,
    clave_final: data?.clave_final ?? null,
    clave_actualizada_en: data?.clave_actualizada_en ?? null,
    precio: PRECIOS[modelo] ?? null,
  }
}

export async function guardarClaveIa(clave: string): Promise<Resultado> {
  await requireAdmin()
  const limpia = typeof clave === 'string' ? clave.trim() : ''
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(limpia)) return { ok: false, error: 'Eso no parece una clave de Claude (empieza con sk-ant-)' }
  if (!(await claveValida(limpia))) return { ok: false, error: 'Anthropic no aceptó esa clave. Revisa que esté completa y activa.' }
  const { error } = await (await createClient()).rpc('guardar_clave_ia', { p_clave: limpia })
  if (error) return { ok: false, error: 'No se pudo guardar la clave' }
  revalidatePath('/admin')
  return { ok: true, data: null }
}

export async function quitarClaveIa(): Promise<Resultado> {
  await requireAdmin()
  const { error } = await (await createClient()).rpc('quitar_clave_ia')
  if (error) return { ok: false, error: 'No se pudo quitar la clave' }
  revalidatePath('/admin')
  return { ok: true, data: null }
}

export async function guardarLimiteIa(limite: number): Promise<Resultado> {
  await requireAdmin()
  if (!Number.isInteger(limite) || limite < 0 || limite > 500) return { ok: false, error: 'El límite debe ser un número entre 0 y 500' }
  const { error } = await (await createClient()).rpc('guardar_config_ia', { p_limite: limite })
  if (error) return { ok: false, error: 'No se pudo guardar el límite' }
  revalidatePath('/admin')
  return { ok: true, data: null }
}

// ---------- Consumo por tienda ----------

export type PeriodoConsumo = 'hoy' | 'mes' | 'mes-pasado' | 'todo'

export type LecturaIa = {
  id: number
  creado_en: string
  usuario: string
  modelo: string | null
  tokens_entrada: number
  tokens_salida: number
  costo_usd: number
  ok: boolean | null
  error: string | null
  lineas: number | null
  duracion_ms: number | null
}

export type ConsumoTienda = {
  tienda_id: string
  tienda: string
  negocio: string
  lecturas: number
  fallidas: number
  tokens_entrada: number
  tokens_salida: number
  costo_usd: number
  ultima: string | null
  detalle: LecturaIa[]
}

function inicioPeriodo(periodo: PeriodoConsumo): { desde: string | null; hasta: string | null } {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date())
  const [a, m] = hoy.split('-').map(Number)
  if (periodo === 'hoy') return { desde: `${hoy}T00:00:00-05:00`, hasta: null }
  if (periodo === 'mes') return { desde: `${hoy.slice(0, 8)}01T00:00:00-05:00`, hasta: null }
  if (periodo === 'mes-pasado') {
    const anterior = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`
    return { desde: `${anterior}-01T00:00:00-05:00`, hasta: `${hoy.slice(0, 8)}01T00:00:00-05:00` }
  }
  return { desde: null, hasta: null }
}

type FilaUso = Omit<LecturaIa, 'usuario' | 'costo_usd' | 'tokens_entrada' | 'tokens_salida'> & {
  tienda_id: string
  usuario_id: string | null
  costo_usd: number | string | null
  tokens_entrada: number | null
  tokens_salida: number | null
}

export async function consumoIa(periodo: PeriodoConsumo): Promise<ConsumoTienda[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const { desde, hasta } = inicioPeriodo(periodo)
  let consulta = admin
    .from('usos_ia')
    .select('id, tienda_id, usuario_id, creado_en, modelo, tokens_entrada, tokens_salida, costo_usd, ok, error, lineas, duracion_ms')
    .order('creado_en', { ascending: false })
    .limit(5000)
  if (desde) consulta = consulta.gte('creado_en', desde)
  if (hasta) consulta = consulta.lt('creado_en', hasta)

  const [{ data: usos }, { data: tiendas }, { data: perfiles }] = await Promise.all([
    consulta.returns<FilaUso[]>(),
    admin.from('tiendas').select('id, nombre, negocios(nombre)').order('nombre'),
    admin.from('perfiles').select('id, nombre'),
  ])
  const nombres = new Map((perfiles ?? []).map(p => [p.id as string, (p.nombre as string | null) ?? 'Usuario']))

  return (tiendas ?? []).map(t => {
    const propios = (usos ?? []).filter(u => u.tienda_id === t.id)
    const detalle: LecturaIa[] = propios.slice(0, 100).map(u => ({
      id: u.id, creado_en: u.creado_en, usuario: u.usuario_id ? nombres.get(u.usuario_id) ?? 'Usuario' : '—',
      modelo: u.modelo, tokens_entrada: u.tokens_entrada ?? 0, tokens_salida: u.tokens_salida ?? 0,
      costo_usd: Number(u.costo_usd ?? 0), ok: u.ok, error: u.error, lineas: u.lineas, duracion_ms: u.duracion_ms,
    }))
    const negocio = (t.negocios as unknown as { nombre: string } | null)?.nombre ?? ''
    return {
      tienda_id: t.id as string,
      tienda: t.nombre as string,
      negocio,
      lecturas: propios.length,
      fallidas: propios.filter(u => u.ok === false).length,
      tokens_entrada: propios.reduce((s, u) => s + (u.tokens_entrada ?? 0), 0),
      tokens_salida: propios.reduce((s, u) => s + (u.tokens_salida ?? 0), 0),
      costo_usd: propios.reduce((s, u) => s + Number(u.costo_usd ?? 0), 0),
      ultima: propios[0]?.creado_en ?? null,
      detalle,
    }
  })
}
