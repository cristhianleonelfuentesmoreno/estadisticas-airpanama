// Se ve al instante al tocar otro módulo, mientras llegan los datos: la barra de abajo y el encabezado no se mueven
export default function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex animate-pulse flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-slate-200/70" />)}
      </div>
      <div className="h-14 rounded-2xl bg-slate-200/70" />
      <div className="flex flex-col gap-px overflow-hidden rounded-3xl">
        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-slate-200/60" />)}
      </div>
    </div>
  )
}
