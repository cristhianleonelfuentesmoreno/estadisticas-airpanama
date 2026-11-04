'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Boxes, FileText, ShoppingCart } from 'lucide-react'

const SECCIONES = [
  { ruta: 'caja', nombre: 'Caja', Icono: ShoppingCart },
  { ruta: 'inventario', nombre: 'Inventario', Icono: Boxes },
  { ruta: 'facturas', nombre: 'Mercancía', Icono: FileText },
] as const

export default function NavTienda({ slug }: { slug: string }) {
  const ruta = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-3xl grid-cols-3">
        {SECCIONES.map(({ ruta: r, nombre, Icono }) => {
          const href = `/t/${slug}/${r}`
          const activa = ruta.startsWith(href)
          return (
            <li key={r}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${activa ? 'text-emerald-700' : 'text-slate-500'}`}
              >
                <Icono className="h-6 w-6" />
                {nombre}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
