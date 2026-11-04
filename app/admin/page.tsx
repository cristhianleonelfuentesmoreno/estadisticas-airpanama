import Link from 'next/link'
import { Activity, ExternalLink, ImageIcon, Sparkles, Store, Users } from 'lucide-react'
import { fetchAllUsers } from '@/app/actions/admin'
import { obtenerConfigIa } from '@/app/actions/ia'
import { listarRegistrados, listarTiendas } from '@/app/actions/tiendas'
import { getSessionProfile } from '@/lib/auth'
import { AdminPanel, type User } from '@/components/admin/AdminPanel'
import { AuditoriaPanel } from '@/components/admin/AuditoriaPanel'
import { DispositivosPanel } from '@/components/admin/DispositivosPanel'
import { IaPanel } from '@/components/admin/IaPanel'
import { SettingsWidget } from '@/components/admin/SettingsWidget'
import { TiendasPanel } from '@/components/admin/TiendasPanel'
import { VelocidadPanel } from '@/components/admin/VelocidadPanel'

// Una pestaña, una tarea. El administrador abre en Tiendas; el supervisor, en Personas.
const SECCIONES = [
  { id: 'tiendas', nombre: 'Tiendas', Icono: Store, soloAdmin: true },
  { id: 'personas', nombre: 'Personas', Icono: Users, soloAdmin: false },
  { id: 'ia', nombre: 'Inteligencia artificial', Icono: Sparkles, soloAdmin: true },
  { id: 'login', nombre: 'Página de inicio', Icono: ImageIcon, soloAdmin: true },
  { id: 'actividad', nombre: 'Actividad', Icono: Activity, soloAdmin: false },
] as const
type Seccion = (typeof SECCIONES)[number]['id']

export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  // El layout ya verificó la sesión y que sea del equipo Valis
  const profile = await getSessionProfile()
  if (!profile) return null
  const esAdmin = profile.role === 'administrador'
  const visibles = SECCIONES.filter(s => esAdmin || !s.soloAdmin)
  const { seccion: pedida } = await searchParams
  const seccion: Seccion = visibles.find(s => s.id === pedida)?.id ?? (esAdmin ? 'tiendas' : 'personas')

  const { users } = await fetchAllUsers()
  const usuarios = (users as User[] | undefined) ?? []
  const pendientes = usuarios.filter(u => u.status === 'pendiente').length

  return (
    <div className="flex flex-col gap-5">
      <nav className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {visibles.map(({ id, nombre, Icono }) => (
          <Link
            key={id}
            href={`/admin?seccion=${id}`}
            className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 font-bold ${
              id === seccion ? 'bg-emerald-700 text-white shadow' : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            <Icono className="h-5 w-5" />
            {nombre}
            {id === 'personas' && pendientes > 0 && (
              <span className="rounded-full bg-amber-400 px-2 text-xs text-amber-950">{pendientes}</span>
            )}
          </Link>
        ))}
      </nav>

      {seccion === 'tiendas' && <TiendasPanel tiendas={await listarTiendas()} registrados={await listarRegistrados()} />}

      {seccion === 'personas' && <AdminPanel initialUsers={usuarios} role={profile.role} currentUserId={profile.id} />}

      {seccion === 'ia' && <IaPanel config={await obtenerConfigIa()} />}

      {seccion === 'login' && (
        <div className="flex flex-col gap-4">
          <a
            href="/login?vista=1"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 self-start rounded-2xl bg-white px-4 py-3 font-semibold text-emerald-800 shadow-sm"
          >
            <ExternalLink className="h-5 w-5" /> Ver cómo se ve la página de inicio
          </a>
          <SettingsWidget />
        </div>
      )}

      {seccion === 'actividad' && (
        <div className="flex flex-col gap-6">
          <DispositivosPanel />
          <AuditoriaPanel />
          <VelocidadPanel />
        </div>
      )}
    </div>
  )
}
