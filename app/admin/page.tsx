import { ExternalLink } from 'lucide-react'
import { fetchAllUsers } from '@/app/actions/admin'
import { getSessionProfile } from '@/lib/auth'
import { AdminPanel, type User } from '@/components/admin/AdminPanel'

export default async function AdminPage() {
  // El layout ya verificó la sesión y el rol
  const profile = await getSessionProfile()
  if (!profile) return null
  const { users } = await fetchAllUsers()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-slate-600">
          {profile.role === 'administrador'
            ? 'Cambia la página de inicio de sesión, acepta cuentas nuevas y revisa la actividad.'
            : 'Acepta cuentas nuevas y revisa la actividad.'}
        </p>
        <a
          href="/login?vista=1"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm"
        >
          <ExternalLink className="h-4 w-4" /> Ver la página de login
        </a>
      </div>
      <AdminPanel initialUsers={(users as User[] | undefined) ?? []} role={profile.role} currentUserId={profile.id} />
    </div>
  )
}
