'use client'

import { useRef, useState } from 'react'
import { Camera, ImageUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { leerFacturaConFoto, type LineaFacturaFoto } from '@/app/actions/tienda'

export type FacturaDeFoto = { proveedor: string | null; numero_factura: string | null; lineas: LineaFacturaFoto[] }

// Achica la foto en el celular antes de mandarla: sube más rápido y la lectura es igual de buena
export async function prepararFoto(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error('foto'))
      i.src = url
    })
    const escala = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(img.naturalWidth * escala)
    lienzo.height = Math.round(img.naturalHeight * escala)
    lienzo.getContext('2d')?.drawImage(img, 0, 0, lienzo.width, lienzo.height)
    return lienzo.toDataURL('image/jpeg', 0.82).split(',')[1] ?? ''
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function LeerFacturaFoto({ tiendaId, onLeida }: { tiendaId: string; onLeida: (f: FacturaDeFoto) => void }) {
  // Dos entradas: la cámara directo, o elegir una foto que ya está en el celular (WhatsApp, galería)
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [leyendo, setLeyendo] = useState(false)

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setLeyendo(true)
    try {
      const base64 = await prepararFoto(archivo)
      const r = await leerFacturaConFoto(tiendaId, base64, 'image/jpeg')
      if (!r.ok) {
        toast.error(r.error, { duration: 7000 })
        return
      }
      onLeida(r.data)
      toast.success(`Leí ${r.data.lineas.length} productos. Revisa que todo esté bien antes de guardar.`, { duration: 6000 })
    } catch {
      toast.error('No se pudo abrir la foto. Prueba con otra.')
    } finally {
      setLeyendo(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 rounded-3xl bg-gradient-to-r from-emerald-700 to-emerald-500 p-3 shadow-lg">
        <p className="px-1 text-sm font-semibold text-emerald-50">Leer la factura con inteligencia artificial</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => camara.current?.click()}
            disabled={leyendo}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/15 py-4 text-base font-bold text-white disabled:opacity-60"
          >
            <Camera className="h-8 w-8" /> Tomar foto
          </button>
          <button
            onClick={() => galeria.current?.click()}
            disabled={leyendo}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/15 py-4 text-base font-bold text-white disabled:opacity-60"
          >
            <ImageUp className="h-8 w-8" /> Subir foto
          </button>
        </div>
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegir} className="hidden" />
      <input ref={galeria} type="file" accept="image/*" onChange={alElegir} className="hidden" />

      {leyendo && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-emerald-950/85 px-8 text-center text-white">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-300" />
          <p className="text-xl font-bold">Leyendo la factura…</p>
          <p className="text-emerald-100">Tarda unos 20 segundos. No cierres la app.</p>
        </div>
      )}
    </>
  )
}
