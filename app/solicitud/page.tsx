import { redirect } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SolicitudForm from '@/components/solicitud/SolicitudForm'
import type { DatosSolicitud } from '@/lib/tienda/solicitud'

export const dynamic = 'force-dynamic'

// Se registró y espera que lo aprueben: aquí cuenta de su negocio. Quien ya está aprobado sigue de largo.
export default async function SolicitudPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')
  if (profile.status === 'aprobado') redirect('/')
  if (profile.status !== 'pendiente') redirect('/login?error=rejected')
  if (profile.role !== 'usuario') redirect('/login?status=pending')

  const supabase = await createClient()
  const { data } = await supabase
    .from('solicitudes_negocio')
    .select('negocio, tipo, telefono, vende_por_libra, porcentaje_ganancia')
    .eq('usuario_id', profile.id)
    .maybeSingle()
  const guardada: DatosSolicitud | null = data
    ? {
        negocio: data.negocio as string,
        tipo: (data.tipo as string | null) ?? 'Minisúper',
        telefono: (data.telefono as string | null) ?? '',
        vende_por_libra: data.vende_por_libra as boolean,
        porcentaje_ganancia: Number(data.porcentaje_ganancia),
      }
    : null

  return <SolicitudForm nombre={profile.nombre || profile.fullName || ''} guardada={guardada} />
}
