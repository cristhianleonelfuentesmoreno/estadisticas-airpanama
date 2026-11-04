import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { getSessionProfile } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { getMisTiendas } from '@/lib/tienda/servidor'
import BotonSalir from '@/components/tienda/BotonSalir'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')
  if (profile.status !== 'aprobado') redirect('/login?status=pending')
  if (!can.accessPanel(profile.role)) redirect('/')

  const [tienda] = await getMisTiendas()

  return (
    <div className="min-h-dvh bg-slate-50 pb-10">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-emerald-800 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">ValisVentas</p>
          <h1 className="truncate text-lg font-bold">{profile.role === 'administrador' ? 'Administración' : 'Supervisión'}</h1>
        </div>
        {tienda && (
          <Link href={`/t/${tienda.slug}/caja`} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4" /> Ir a la caja
          </Link>
        )}
        <BotonSalir />
      </header>
      <main className="mx-auto w-full max-w-5xl px-3 py-5">{children}</main>
    </div>
  )
}
