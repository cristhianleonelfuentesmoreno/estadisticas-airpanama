import Link from "next/link";
import { NotFoundScene } from "@/components/errors/NotFoundScene";

export default function NotFound() {
  return (
    <main className="nf">
      <header className="nf__copy">
        <h1 className="nf__title">Página no encontrada</h1>
        <p className="nf__text">Esta ruta no está en nuestro itinerario.</p>
        <Link href="/" className="nf__cta">
          <span className="material-symbols-outlined" aria-hidden="true">flight_takeoff</span>
          Volver al inicio
        </Link>
      </header>
      <NotFoundScene />
    </main>
  );
}
