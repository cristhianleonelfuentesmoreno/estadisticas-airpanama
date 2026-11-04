import { notFound, redirect } from 'next/navigation'
import { getSessionProfile } from '@/lib/auth'
import { getTienda } from '@/lib/tienda/servidor'
import NavTienda from '@/components/tienda/NavTienda'

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
      <header className="sticky top-0 z-30 bg-emerald-700 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">ValisVentas</p>
        <h1 className="truncate text-lg font-bold">{tienda.nombre}</h1>
      </header>
      <main className="mx-auto w-full max-w-3xl px-3 py-4">{children}</main>
      <NavTienda slug={tienda.slug} />
    </div>
  )
}
