import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <div className="rounded-3xl bg-emerald-100 p-5 text-emerald-700">
        <SearchX className="h-12 w-12" />
      </div>
      <h1 className="text-2xl font-black text-slate-900">Página no encontrada</h1>
      <p className="max-w-sm text-slate-600">Esta dirección no existe o no tienes acceso a esa tienda.</p>
      <Link href="/" className="rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white shadow">
        Volver a la caja
      </Link>
    </main>
  );
}
