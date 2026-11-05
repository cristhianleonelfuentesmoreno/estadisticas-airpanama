// Se ve al instante al cambiar de pestaña en el panel, mientras llegan los datos
export default function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex animate-pulse flex-col gap-5 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:flex lg:flex-col">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-2xl bg-slate-200/70" />)}
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-28 rounded-3xl bg-slate-200/70" />
        {[0, 1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-200/60" />)}
      </div>
    </div>
  )
}
