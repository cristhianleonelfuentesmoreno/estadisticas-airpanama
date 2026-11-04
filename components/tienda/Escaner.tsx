'use client'

import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { Keyboard, X } from 'lucide-react'

// Lee códigos de barras con la cámara trasera del celular.
// Siempre deja escribir el código a mano (o con un lector USB/Bluetooth, que "escribe" y da Enter).
export default function Escaner({
  titulo = 'Escanea el código',
  onCodigo,
  onCerrar,
}: {
  titulo?: string
  onCodigo: (codigo: string) => void
  onCerrar: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const yaLeyo = useRef(false)
  // El callback más reciente, sin reiniciar la cámara cada vez que el padre se vuelve a dibujar
  const alLeer = useRef(onCodigo)
  useEffect(() => {
    alLeer.current = onCodigo
  }, [onCodigo])
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    let controles: IScannerControls | null = null
    let cancelado = false
    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const lector = new BrowserMultiFormatReader()
        if (cancelado || !video.current) return
        controles = await lector.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          video.current,
          resultado => {
            if (!resultado || yaLeyo.current) return
            yaLeyo.current = true
            navigator.vibrate?.(80)
            controles?.stop()
            alLeer.current(resultado.getText())
          },
        )
        if (cancelado) controles.stop()
      } catch {
        setError('No se pudo abrir la cámara. Revisa el permiso o escribe el código abajo.')
      }
    })()
    return () => {
      cancelado = true
      controles?.stop()
    }
  }, [])

  function enviarManual(e: React.FormEvent) {
    e.preventDefault()
    const codigo = manual.trim()
    if (codigo.length >= 4) onCodigo(codigo)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-base font-semibold">{titulo}</p>
        <button onClick={onCerrar} aria-label="Cerrar" className="rounded-full bg-white/15 p-2">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={video} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-[80%] max-w-sm rounded-2xl border-4 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <p className="absolute inset-x-4 top-4 rounded-xl bg-red-600/90 p-3 text-sm text-white">{error}</p>
        )}
      </div>

      <form onSubmit={enviarManual} className="flex gap-2 bg-black p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/10 px-3">
          <Keyboard className="h-5 w-5 text-white/60" />
          <input
            value={manual}
            onChange={e => setManual(e.target.value)}
            inputMode="numeric"
            placeholder="O escribe el código"
            className="w-full bg-transparent py-3 text-white placeholder:text-white/50 focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-xl bg-emerald-500 px-4 font-semibold text-white">Listo</button>
      </form>
    </div>
  )
}
