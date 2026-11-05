'use server'

import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { limpiarSolicitud, type DatosSolicitud } from '@/lib/tienda/solicitud'
import type { Resultado } from '@/lib/tienda/tipos'

// La llena la persona mientras su cuenta está pendiente. La base solo le deja tocar la suya.
export async function guardarSolicitud(datos: DatosSolicitud): Promise<Resultado> {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'pendiente' || profile.role !== 'usuario') return { ok: false, error: 'No autorizado' }
  const limpio = limpiarSolicitud(datos)
  if (typeof limpio === 'string') return { ok: false, error: limpio }
  const supabase = await createClient()
  const { error } = await supabase.from('solicitudes_negocio').upsert({
    usuario_id: profile.id, ...limpio, telefono: limpio.telefono || null, actualizado_en: new Date().toISOString(),
  }, { onConflict: 'usuario_id' })
  if (error) return { ok: false, error: 'No se pudo guardar. Prueba otra vez.' }
  return { ok: true, data: null }
}
