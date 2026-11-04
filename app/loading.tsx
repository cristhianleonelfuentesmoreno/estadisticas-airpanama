export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
      <div className="spinner mb-8">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <h2 className="text-white font-headline-md font-bold tracking-widest uppercase flex items-center gap-2">
        <span className="material-symbols-outlined text-[24px] text-emerald-400">shopping_cart</span>
        ValisVentas
      </h2>
      <p className="text-white/60 font-body-sm mt-2 animate-pulse">Cargando…</p>
    </div>
  );
}
