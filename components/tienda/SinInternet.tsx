'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { CloudOff, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/dialogs'
import { registrarVenta } from '@/app/actions/tienda'
import { dinero } from '@/lib/tienda/formato'
import {
  deTexto, esSinInternet, guardarPendientes, leerPendientes, marcarError, quitarPendiente, suscribirConexion, suscribirPendientes, textoPendientes,
} from '@/lib/tienda/pendientes'

// Vive en todas las pantallas de la tienda:
// - deja la caja guardada en el celular para abrirla sin internet (service worker);
// - sube solas las ventas hechas sin internet cuando vuelve la señal;
// - avisa arriba de la barra cuando no hay señal o quedan ventas por subir.
export default function SinInternet({ tiendaId }: { tiendaId: string }) {
  const router = useRouter()
  const enLinea = useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true)
  const crudo = useSyncExternalStore(suscribirPendientes, textoPendientes, () => '')
  const pendientes = useMemo(() => deTexto(crudo).filter(v => v.tiendaId === tiendaId), [crudo, tiendaId])
  const [viendo, setViendo] = useState(false)
  const subiendo = useRef(false)

  const subir = useCallback(async () => {
    if (subiendo.current || navigator.onLine === false) return
    const cola = leerPendientes().filter(v => v.tiendaId === tiendaId && !v.error)
    if (!cola.length) return
    subiendo.current = true
    let subidas = 0
    try {
      for (const v of cola) {
        try {
          const r = await registrarVenta(v.tiendaId, v.metodo, v.lineas, { id_cliente: v.id, hecha_en: v.hecha_en })
          guardarPendientes(r.ok ? quitarPendiente(leerPendientes(), v.id) : marcarError(leerPendientes(), v.id, r.error))
          if (r.ok) subidas++
        } catch (e) {
          if (esSinInternet(e)) break
          guardarPendientes(marcarError(leerPendientes(), v.id, 'No se pudo subir'))
        }
      }
    } finally {
      subiendo.current = false
    }
    if (subidas) {
      toast.success(subidas === 1 ? 'Volvió el internet: se subió la venta pendiente.' : `Volvió el internet: se subieron ${subidas} ventas pendientes.`)
      router.refresh()
    }
  }, [tiendaId, router])

  useEffect(() => {
    // La copia de la caja para abrirla sin internet (solo en la app publicada)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
        const recursos = performance.getEntriesByType('resource').map(r => r.name).filter(u => u.includes('/_next/static/'))
        reg.active?.postMessage({ tipo: 'guardar', urls: recursos, pagina: location.pathname })
      }).catch(() => {})
    }
    const volvio = () => void subir()
    void subir()
    const cada = setInterval(volvio, 30_000)
    window.addEventListener('online', volvio)
    return () => {
      clearInterval(cada)
      window.removeEventListener('online', volvio)
    }
  }, [subir])

  const conError = pendientes.filter(v => v.error)
  if (enLinea && !pendientes.length) return null

  return (
    <>
      <button
        onClick={() => setViendo(true)}
        className={`fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold shadow-lg lg:bottom-6 lg:left-64 ${conError.length ? 'bg-red-600 text-white' : enLinea ? 'bg-sky-600 text-white' : 'bg-slate-800 text-white'}`}
      >
        {conError.length ? <TriangleAlert className="h-4 w-4" /> : enLinea ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CloudOff className="h-4 w-4" />}
        {!enLinea ? 'Sin internet: la caja sigue funcionando' : conError.length ? `${conError.length} ${conError.length === 1 ? 'venta no se pudo subir' : 'ventas no se pudieron subir'}` : 'Subiendo ventas…'}
        {pendientes.length > 0 && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{pendientes.length}</span>}
      </button>

      {viendo && (
        <div onClick={() => setViendo(false)} className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center">
          <div onClick={e => e.stopPropagation()} className="flex max-h-[80dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{enLinea ? 'Ventas por subir' : 'Sin internet'}</p>
                <p className="text-sm text-slate-500">
                  {enLinea ? 'Se suben solas.' : 'Puedes seguir cobrando. Las ventas quedan en este celular y se suben solas cuando vuelva la señal. Mientras tanto no se pueden crear productos, cambiar precios ni registrar facturas.'}
                </p>
              </div>
              <button onClick={() => setViendo(false)} aria-label="Cerrar" className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
            </div>
            {pendientes.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">No hay ventas guardadas en este celular.</p>}
            <ul className="flex flex-col gap-2">
              {pendientes.map(v => (
                <li key={v.id} className={`flex items-center gap-3 rounded-2xl p-3 ${v.error ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{dinero(v.total)} · {v.metodo}</p>
                    <p className="text-xs text-slate-500">
                      {new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(v.hecha_en))}
                      {v.error ? ` · ${v.error}` : ''}
                    </p>
                  </div>
                  {v.error && (
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => { guardarPendientes(leerPendientes().map(x => (x.id === v.id ? { ...x, error: undefined } : x))); void subir() }} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Reintentar</button>
                      <button onClick={async () => { if (await confirmDialog({ title: '¿Descartar esta venta?', message: `La venta de ${dinero(v.total)} no se va a guardar ni a descontar del inventario.`, confirmText: 'Sí, descartar', tone: 'danger' })) guardarPendientes(quitarPendiente(leerPendientes(), v.id)) }} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-red-700">Descartar</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {enLinea && pendientes.some(v => !v.error) && (
              <button onClick={() => void subir()} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white">Subir ahora</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
