import type { Producto } from '@/lib/tienda/tipos'

// Foto del producto (de Open Food Facts) o su inicial si no tiene
export default function FotoProducto({ producto, tamano = 'h-11 w-11' }: { producto: Pick<Producto, 'nombre' | 'imagen_url'>; tamano?: string }) {
  if (producto.imagen_url) {
    return <img src={producto.imagen_url} alt="" className={`${tamano} shrink-0 rounded-xl bg-white object-contain ring-1 ring-slate-100`} />
  }
  return (
    <div className={`${tamano} flex shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-700`}>
      {producto.nombre.charAt(0).toUpperCase()}
    </div>
  )
}
