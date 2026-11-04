'use client'

import { useEffect, useRef, useState } from 'react'
import { Keyboard, X } from 'lucide-react'
import type { DecodeHintType as TipoPista } from '@zxing/library'

// Lector nativo del navegador (Chrome en Android). Safari no lo tiene: ahí se usa ZXing.
type Detectado = { rawValue: string }
type DetectorNativo = { detect: (fuente: HTMLVideoElement) => Promise<Detectado[]> }
type ClaseDetector = new (opciones: { formats: string[] }) => DetectorNativo

const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
const INTERVALO_MS = 80

// Baja el código del lector antes de que el cajero toque "Escanear"
export function precargarEscaner() {
  void import('@zxing/browser')
  void import('@zxing/library')
}

// Pitido corto al leer (en iPhone no hay vibración)
let audio: AudioContext | null = null
function pitido() {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const vol = audio.createGain()
    osc.frequency.value = 1800
    vol.gain.value = 0.08
    osc.connect(vol).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + 0.08)
  } catch {
    // sin audio: queda la vibración o el aviso en pantalla
  }
}

function detectorNativo(): ClaseDetector | null {
  const clase = (globalThis as { BarcodeDetector?: ClaseDetector }).BarcodeDetector
  return typeof clase === 'function' ? clase : null
}

const CAMARA: MediaStreamConstraints = {
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
}

// Lee códigos de barras con la cámara trasera del celular.
// continuo: la cámara sigue abierta y avisa cada código nuevo (caja); si no, se cierra al primero.
// Siempre deja escribir el código a mano (o con un lector USB/Bluetooth, que "escribe" y da Enter).
export default function Escaner({
  titulo = 'Escanea el código',
  continuo = false,
  pie,
  onCodigo,
  onCerrar,
}: {
  titulo?: string
  continuo?: boolean
  pie?: React.ReactNode
  onCodigo: (codigo: string) => void
  onCerrar: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const yaLeyo = useRef(false)
  const esContinuo = useRef(continuo)
  // Último código leído: en modo continuo evita sumar dos veces el mismo producto por un solo paso
  const ultimo = useRef<{ codigo: string; t: number } | null>(null)
  // El callback más reciente, sin reiniciar la cámara cada vez que el padre se vuelve a dibujar
  const alLeer = useRef(onCodigo)
  useEffect(() => {
    alLeer.current = onCodigo
  }, [onCodigo])
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    let cancelado = false
    let detener: (() => void) | null = null

    function leido(codigo: string) {
      if (yaLeyo.current || cancelado) return
      if (esContinuo.current) {
        const ahora = Date.now()
        const previo = ultimo.current
        if (previo && ((previo.codigo === codigo && ahora - previo.t < 1500) || ahora - previo.t < 600)) return
        ultimo.current = { codigo, t: ahora }
        pitido()
        navigator.vibrate?.(60)
        alLeer.current(codigo)
        return
      }
      yaLeyo.current = true
      pitido()
      navigator.vibrate?.(80)
      detener?.()
      alLeer.current(codigo)
    }

    async function conNativo(Detector: ClaseDetector, elemento: HTMLVideoElement) {
      const flujo = await navigator.mediaDevices.getUserMedia(CAMARA)
      let temporizador: ReturnType<typeof setTimeout> | undefined
      detener = () => {
        clearTimeout(temporizador)
        flujo.getTracks().forEach(t => t.stop())
      }
      if (cancelado) return detener()
      elemento.srcObject = flujo
      await elemento.play()
      const detector = new Detector({ formats: FORMATOS_NATIVOS })
      const buscar = async () => {
        if (cancelado || yaLeyo.current) return
        try {
          const [primero] = await detector.detect(elemento)
          if (primero?.rawValue) leido(primero.rawValue)
        } catch {
          // cuadro sin imagen todavía: se intenta en el siguiente
        }
        temporizador = setTimeout(buscar, INTERVALO_MS)
      }
      void buscar()
    }

    async function conZxing(elemento: HTMLVideoElement) {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ])
      const pistas = new Map<TipoPista, unknown>([[DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128,
      ]]])
      const lector = new BrowserMultiFormatReader(pistas, { delayBetweenScanAttempts: INTERVALO_MS, delayBetweenScanSuccess: INTERVALO_MS })
      if (cancelado) return
      const controles = await lector.decodeFromConstraints(CAMARA, elemento, resultado => {
        if (resultado) leido(resultado.getText())
      })
      detener = () => controles.stop()
      if (cancelado || yaLeyo.current) controles.stop()
    }

    ;(async () => {
      const elemento = video.current
      if (!elemento) return
      try {
        const Detector = detectorNativo()
        if (Detector) await conNativo(Detector, elemento)
        else await conZxing(elemento)
      } catch {
        if (!cancelado) setError('No se pudo abrir la cámara. Revisa el permiso o escribe el código abajo.')
      }
    })()

    return () => {
      cancelado = true
      detener?.()
    }
  }, [])

  function enviarManual(e: React.FormEvent) {
    e.preventDefault()
    const codigo = manual.trim()
    if (codigo.length >= 4) {
      onCodigo(codigo)
      setManual('')
    }
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
        <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm text-white/80">
          Acerca el código a unos 15 cm y mantenlo quieto
        </p>
        {error && (
          <p className="absolute inset-x-4 top-4 rounded-xl bg-red-600/90 p-3 text-sm text-white">{error}</p>
        )}
      </div>

      {pie}

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
