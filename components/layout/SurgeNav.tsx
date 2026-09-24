"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import "./SurgeNav.css";

// Navegación del header (solo web) con una barra "eléctrica" bajo la página activa.
// Al cambiar de página la barra viaja: el FRENTE avanza lineal y nunca se pasa;
// la COLA se congela un instante y luego lo alcanza al doble de velocidad,
// así la barra se estira y se recoge como una chispa.

const T_MOVE = 0.625;                  // segundos, fijo sin importar la distancia
const FREEZE = (d: number) => 0.00089 * d; // cuánto se congela la cola según la distancia

type NavItem = { name: string; path: string };

export function SurgeNav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const listRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const routeIndex = items.findIndex(i => i.path === pathname);
  // Se mueve en el clic, sin esperar a que cargue la página
  const [clicked, setClicked] = useState<{ index: number; from: string } | null>(null);
  // Al cambiar de página el clic ya cumplió: se olvida. Si no, al volver a la página de
  // origen por otro camino (p. ej. el logo) el menú marcaría la sección del clic viejo.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setClicked(null);
  }
  const active = clicked && clicked.from === pathname ? clicked.index : routeIndex;
  const shown = useRef(active); // sección donde está dibujada la barra
  const [live, setLive] = useState(false);
  const anim = useRef<number | null>(null); // frame de la animación en curso

  // Centro de cada etiqueta, relativo a la lista
  const centerOf = (i: number) => {
    const el = labelRefs.current[i];
    const list = listRef.current;
    if (!el || !list) return 0;
    const a = el.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    return a.left - b.left + a.width / 2;
  };

  const place = (tail: number, head: number, energy: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const left = Math.min(tail, head);
    bar.style.transform = `translateX(${left}px)`;
    bar.style.width = `${Math.abs(head - tail)}px`;
    bar.style.setProperty("--energy", energy.toFixed(3));
  };

  // Hasta que el script mide y coloca la barra, se muestra la versión CSS
  useEffect(() => {
    const id = requestAnimationFrame(() => setLive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const moveTo = (from: number, next: number) => {
    const bar = barRef.current;
    if (!bar || next === from || from < 0 || next < 0) return;
    const W = parseFloat(getComputedStyle(bar).getPropertyValue("--arc-w")) || 44;
    const x0 = centerOf(from);
    const x1 = centerOf(next);
    const D = Math.abs(x1 - x0);
    const dir = Math.sign(x1 - x0);

    if (anim.current !== null) cancelAnimationFrame(anim.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      anim.current = null;
      place(x1 - W / 2, x1 + W / 2, 0);
      return;
    }

    const v = D / T_MOVE;
    const P = Math.min(FREEZE(D), T_MOVE / 2);
    const half = T_MOVE / 2;
    let start = -1; // se toma del primer cuadro

    const tick = (now: number) => {
      if (start < 0) start = now;
      const t = Math.min((now - start) / 1000, T_MOVE);
      // tau: cuánto va la cola por detrás del frente, en SEGUNDOS.
      // Un triángulo con pendientes +1 y -1 centrado en la mitad del trayecto.
      const tau =
        t <= half - P ? 0
        : t <= half ? t - (half - P)
        : t <= half + P ? half + P - t
        : 0;
      const head = x0 + dir * (W / 2) + dir * v * t;
      const tail = head - dir * (W + v * tau);
      place(tail, head, P > 0 ? tau / P : 0);
      if (t < T_MOVE) anim.current = requestAnimationFrame(tick);
      else anim.current = null;
    };
    anim.current = requestAnimationFrame(tick);
  };

  // Posición inicial y al cambiar el tamaño de la ventana
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const W = parseFloat(getComputedStyle(bar).getPropertyValue("--arc-w")) || 44;
    const snap = () => {
      if (active < 0) return;
      const c = centerOf(active);
      place(c - W / 2, c + W / 2, 0);
    };
    if (anim.current === null) {
      // Cambio sin clic en el menú: la barra viaja igual desde donde estaba
      if (shown.current >= 0 && active >= 0 && shown.current !== active) moveTo(shown.current, active);
      else snap();
    }
    shown.current = active;
    window.addEventListener("resize", snap);
    return () => window.removeEventListener("resize", snap);
    // moveTo solo usa refs; se ejecuta únicamente cuando cambia la sección activa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <nav aria-label="Secciones" className={`surge ${live ? "surge--live" : ""}`}>
      <div ref={listRef} className="surge__list">
        {items.map((item, i) => (
          <Link
            key={item.path}
            href={item.path}
            className="surge__item"
            aria-current={i === active ? "page" : undefined}
            onClick={() => {
              moveTo(active, i);
              shown.current = i;
              setClicked({ index: i, from: pathname });
            }}
          >
            <span ref={el => { labelRefs.current[i] = el; }} className="surge__label">
              {item.name}
            </span>
          </Link>
        ))}
        <span
          ref={barRef}
          className="surge__arc"
          aria-hidden="true"
          style={{ opacity: active < 0 ? 0 : undefined }}
        />
      </div>
    </nav>
  );
}
