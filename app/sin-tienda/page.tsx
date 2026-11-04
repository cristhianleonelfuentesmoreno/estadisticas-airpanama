import Image from 'next/image'
import { Boxes, Camera, ScanBarcode, TrendingUp } from 'lucide-react'
import BotonSalir from '@/components/tienda/BotonSalir'

// Se registró pero todavía nadie lo agregó a una tienda: le decimos qué sigue y qué va a poder hacer
const LO_QUE_VIENE = [
  { Icono: ScanBarcode, texto: 'Cobrar con la cámara del celular' },
  { Icono: Boxes, texto: 'Ver tu inventario al día, sin cuaderno' },
  { Icono: Camera, texto: 'Registrar facturas con una foto' },
  { Icono: TrendingUp, texto: 'Saber cuánto ganas cada día' },
]

export default function SinTienda() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-emerald-900 to-emerald-950 px-6 py-10 text-center text-white">
      <div className="escalonado flex w-full max-w-sm flex-col items-center gap-4">
        <Image src="/icono-app.png" alt="ValisVentas" width={88} height={88} priority className="h-[88px] w-[88px] drop-shadow-xl" />
        <h1 className="text-2xl font-black">¡Ya tienes tu cuenta!</h1>
        <p className="text-emerald-100/90">
          Falta un paso: que el equipo de Valis Digital o el dueño de la tienda te agregue. Cuando lo hagan, entras directo a tu caja.
        </p>
        <ul className="flex w-full flex-col gap-2 rounded-3xl bg-white/10 p-4 text-left">
          {LO_QUE_VIENE.map(({ Icono, texto }) => (
            <li key={texto} className="flex items-center gap-3 font-semibold">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-300 text-emerald-950"><Icono className="h-4 w-4" /></span>
              {texto}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 text-sm text-emerald-100/80">
          Salir de la cuenta <BotonSalir className="bg-white/15 text-white" />
        </div>
      </div>
    </main>
  )
}
