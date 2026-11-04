import { Store } from 'lucide-react'
import BotonSalir from '@/components/tienda/BotonSalir'

export default function SinTienda() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="rounded-3xl bg-emerald-100 p-5 text-emerald-700">
        <Store className="h-12 w-12" />
      </div>
      <h1 className="text-2xl font-black text-slate-900">Tu cuenta todavía no tiene tienda</h1>
      <p className="max-w-sm text-slate-600">Pídele al dueño de la tienda o al equipo de Valis Digital que te agregue.</p>
      <BotonSalir className="bg-emerald-600 text-white" />
    </main>
  )
}
