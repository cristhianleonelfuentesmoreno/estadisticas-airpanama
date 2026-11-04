'use client'

import { useEffect, useRef, useState } from 'react'
import { dinero } from '@/lib/tienda/formato'

// Una cifra que cuenta desde cero (o desde su valor anterior) hasta el valor nuevo
export default function Cifra({ valor, formato = 'dinero', duracion = 900 }: { valor: number; formato?: 'dinero' | 'entero'; duracion?: number }) {
  const [mostrado, setMostrado] = useState(0)
  const desde = useRef(0)

  useEffect(() => {
    const inicio = desde.current
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || inicio === valor) {
      desde.current = valor
      const id = requestAnimationFrame(() => setMostrado(valor))
      return () => cancelAnimationFrame(id)
    }
    const t0 = performance.now()
    let id = 0
    const paso = (t: number) => {
      const p = Math.min((t - t0) / duracion, 1)
      const suave = 1 - Math.pow(1 - p, 3)
      setMostrado(inicio + (valor - inicio) * suave)
      if (p < 1) id = requestAnimationFrame(paso)
      else desde.current = valor
    }
    id = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(id)
  }, [valor, duracion])

  return <span className="tabular-nums">{formato === 'dinero' ? dinero(mostrado) : Math.round(mostrado)}</span>
}
