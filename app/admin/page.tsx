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
  { id: 'tiendas', nombre: 'Tiendas', corto: 'Tiendas', Icono: Store, soloAdmin: true },
  { id: 'personas', nombre: 'Personas', corto: 'Personas', Icono: Users, soloAdmin: false },
  { id: 'ia', nombre: 'Inteligencia artificial', corto: 'IA', Icono: Sparkles, soloAdmin: true },
  { id: 'login', nombre: 'Página de inicio', corto: 'Inicio', Icono: ImageIcon, soloAdmin: true },
  { id: 'actividad', nombre: 'Actividad', corto: 'Actividad', Icono: Activity, soloAdmin: false },
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
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* En el celular: botones en cuadrícula, todos a la vista. En la computadora: menú a la izquierda */}
      <nav className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:sticky lg:top-24 lg:flex lg:flex-col">
        {visibles.map(({ id, nombre, corto, Icono }) => (
          <Link
            key={id}
            href={`/admin?seccion=${id}`}
            className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-xs font-bold lg:flex-row lg:justify-start lg:gap-2 lg:px-4 lg:py-3 lg:text-base ${
              id === seccion ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/30' : 'bg-white text-slate-600 shadow-sm hover:bg-emerald-50 lg:bg-transparent lg:shadow-none'
            }`}
          >
            <Icono className="h-5 w-5 shrink-0" />
            <span className="lg:hidden">{corto}</span>
            <span className="hidden lg:inline">{nombre}</span>
            {id === 'personas' && pendientes > 0 && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] text-amber-950 lg:static lg:px-2 lg:text-xs">{pendientes}</span>
            )}
          </Link>
        ))}
      </nav>

      <div key={seccion} className="pagina flex min-w-0 flex-col gap-5">
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
    </div>
  )
}
