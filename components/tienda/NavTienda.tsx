'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { anotarUso } from '@/app/actions/uso'
import { BarChart3, Boxes, FileText, ShoppingCart } from 'lucide-react'

const SECCIONES = [
  { ruta: 'caja', nombre: 'Caja', Icono: ShoppingCart },
  { ruta: 'inventario', nombre: 'Inventario', Icono: Boxes },
  { ruta: 'facturas', nombre: 'Mercancía', Icono: FileText },
  { ruta: 'negocio', nombre: 'Mi negocio', Icono: BarChart3 },
] as const

// En el celular: barra abajo, al alcance del pulgar. En la computadora: menú a la izquierda.
export default function NavTienda({ slug, tienda, tiendaId }: { slug: string; tienda: string; tiendaId: string }) {
  const ruta = usePathname()
  // Qué pantallas se abren y cuántas veces
  useEffect(() => {
    anotarUso(tiendaId, 'pantalla', { ruta: ruta.replace(`/t/${slug}`, '') || '/' }).catch(() => {})
  }, [ruta, slug, tiendaId])
  const secciones = SECCIONES.map(s => ({ ...s, href: `/t/${slug}/${s.ruta}`, activa: ruta.startsWith(`/t/${slug}/${s.ruta}`) }))

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid max-w-3xl grid-cols-4">
          {secciones.map(({ ruta: r, nombre, Icono, href, activa }) => (
            <li key={r}>
              <Link href={href} className={`flex flex-col items-center gap-1 pb-2 pt-2 text-xs font-semibold ${activa ? 'text-emerald-700' : 'text-slate-500'}`}>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-300 ${activa ? 'bg-emerald-100' : ''}`}>
                  <Icono className={`h-6 w-6 transition-transform duration-300 ${activa ? 'scale-110' : ''}`} strokeWidth={activa ? 2.4 : 2} />
                </span>
                {nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-gradient-to-b from-emerald-900 to-emerald-950 p-4 text-white lg:flex">
        <div className="flex items-center gap-3 px-2 pb-6 pt-2">
          <Image src="/icono-app.png" alt="" width={44} height={44} priority className="h-11 w-11" />
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight">ValisVentas</p>
            <p className="truncate text-xs text-emerald-200/80">{tienda}</p>
          </div>
        </div>
        <ul className="flex flex-col gap-1">
          {secciones.map(({ ruta: r, nombre, Icono, href, activa }) => (
            <li key={r}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold ${activa ? 'bg-white text-emerald-900 shadow-lg shadow-emerald-950/30' : 'text-emerald-100 hover:bg-white/10'}`}
              >
                <Icono className="h-5 w-5" strokeWidth={activa ? 2.4 : 2} />
                {nombre}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-auto px-2 text-xs text-emerald-200/60">Hecho en Panamá por Valis Digital</p>
      </aside>
    </>
  )
}
