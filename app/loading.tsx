import Image from "next/image";

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
        <Image src="/icono-app.png" alt="" width={32} height={32} className="h-8 w-8" />
        ValisVentas
      </h2>
      <p className="text-white/60 font-body-sm mt-2 animate-pulse">Cargando…</p>
    </div>
  );
}
