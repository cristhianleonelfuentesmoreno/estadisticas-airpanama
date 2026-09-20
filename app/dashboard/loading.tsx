export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0A192F]/80 backdrop-blur-sm flex flex-col items-center justify-center">
      <div className="spinner mb-8">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <h2 className="text-white font-headline-md font-bold tracking-widest uppercase flex items-center gap-2">
        <span className="material-symbols-outlined text-[24px] text-red-600">flight_takeoff</span>
        Air Panama
      </h2>
      <p className="text-white/60 font-body-sm mt-2 animate-pulse">Cargando módulos...</p>
    </div>
  );
}
