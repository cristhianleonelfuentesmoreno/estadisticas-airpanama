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

  // El contador no usa la caja ni el inventario: solo su pantalla de reportes, sin menú
  if (tienda.rol === 'contador') {
    return (
      <div className="min-h-dvh bg-slate-50 pb-10">
        <header className="sticky top-0 z-30 flex items-center gap-2 bg-gradient-to-r from-emerald-800 to-emerald-700 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-md lg:px-8">
          <Image src="/icono-app.png" alt="" width={40} height={40} priority className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">ValisVentas · Contador</p>
            <h1 className="truncate text-lg font-bold">{tienda.nombre}</h1>
          </div>
          <BotonSalir />
        </header>
        <main className="mx-auto w-full max-w-5xl px-3 py-5 lg:px-8 lg:py-8">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-28 lg:pb-10 lg:pl-64">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-gradient-to-r from-emerald-800 to-emerald-700 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-md lg:from-white lg:to-white lg:px-8 lg:py-4 lg:text-slate-900 lg:shadow-sm">
        <Image src="/icono-app.png" alt="" width={40} height={40} priority className="h-10 w-10 shrink-0 lg:hidden" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200 lg:text-emerald-700">ValisVentas</p>
          <h1 className="truncate text-lg font-bold">{tienda.nombre}</h1>
        </div>
        {can.accessPanel(profile.role) && (
          <Link href="/admin" aria-label="Administración" className="rounded-full bg-white/15 p-2 lg:bg-slate-100 lg:text-slate-600">
            <Settings className="h-5 w-5" />
          </Link>
        )}
        <BotonSalir className="lg:bg-slate-100 lg:text-slate-600" />
      </header>
      <main className="mx-auto w-full max-w-3xl px-3 py-4 lg:max-w-5xl lg:px-8 lg:py-8">{children}</main>
      <NavTienda slug={tienda.slug} tienda={tienda.nombre} tiendaId={tienda.id} />
    </div>
  )
}
