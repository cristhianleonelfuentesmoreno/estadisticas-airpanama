import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { getSessionProfile } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { getTienda } from '@/lib/tienda/servidor'
import NavTienda from '@/components/tienda/NavTienda'
import BotonSalir from '@/components/tienda/BotonSalir'

export const dynamic = 'force-dynamic'

export default async function TiendaLayout({ children, params }: LayoutProps<'/t/[slug]'>) {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')
  if (profile.status !== 'aprobado') redirect('/login?status=pending')

  const { slug } = await params
  const tienda = await getTienda(slug)
  if (!tienda) notFound()

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-emerald-700 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow">
        <Image src="/icono-app.png" alt="" width={40} height={40} priority className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">ValisVentas</p>
          <h1 className="truncate text-lg font-bold">{tienda.nombre}</h1>
        </div>
        {can.accessPanel(profile.role) && (
          <Link href="/admin" aria-label="Administración" className="rounded-full bg-white/15 p-2">
            <Settings className="h-5 w-5" />
          </Link>
        )}
        <BotonSalir />
      </header>
      <main className="mx-auto w-full max-w-3xl px-3 py-4">{children}</main>
      <NavTienda slug={tienda.slug} />
    </div>
  )
}
