"use client";

import { useEffect, useRef, useState } from "react";

// Botón de envío "en su gate": mientras el formulario no está listo, el botón
// esquiva el cursor sin salir del panel, unido a su puerta de embarque por una
// línea de rodaje elástica. Cuando todo está completo vuelve a su lugar y se puede usar.

const FLEE_RADIUS = 90;   // px desde el BORDE del botón (no su centro) en que empieza a huir
const FLEE_PUSH = 150;    // cuánto se aleja en cada empujón
const RETURN_RADIUS = 220; // si el cursor se aleja más que esto, regresa al gate
const EDGE_PAD = 10;      // margen contra los bordes del panel
const SPRING = 0.14;
const DAMPING = 0.72;

type Props = {
  label: string;
  loadingLabel: string;
  ready: boolean;       // el formulario está completo
  loading: boolean;
  active: boolean;      // el panel está visible (login vs registro)
  lockedHint: string;
};

export function DockButton({ label, loadingLabel, ready, loading, active, lockedHint }: Props) {
  const dockRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const bandRef = useRef<SVGPathElement>(null);
  const [shaking, setShaking] = useState(false);

  // El bucle de animación lee estos refs en vez de estado de React (sin re-renders por frame)
  const locked = !ready && !loading;
  const lockedRef = useRef(locked);
  const activeRef = useRef(active);
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    lockedRef.current = locked;
    activeRef.current = active;
    wakeRef.current();
  }, [locked, active]);

  useEffect(() => {
    const dock = dockRef.current;
    const btn = btnRef.current;
    const band = bandRef.current;
    if (!dock || !btn || !band) return;

    // En pantallas táctiles no hay cursor que "perseguir", y respetamos "reducir movimiento"
    const chaseQuery = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");

    const pos = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    const render = () => {
      const rot = Math.max(-14, Math.min(14, vel.x * 0.9)); // se "inclina" como un avión al virar
      btn.style.setProperty("--x", `${pos.x}px`);
      btn.style.setProperty("--y", `${pos.y}px`);
      btn.style.setProperty("--rot", `${rot}deg`);

      const w = dock.offsetWidth / 2;
      const h = dock.offsetHeight / 2;
      const dist = Math.hypot(pos.x, pos.y);
      // Punto de control rezagado respecto al movimiento: la línea parece estirarse
      const cx = w + pos.x / 2 - vel.x * 3;
      const cy = h + pos.y / 2 - vel.y * 3 + Math.min(dist, 120) * 0.15;
      band.setAttribute("d", `M ${w} ${h} Q ${cx} ${cy} ${w + pos.x} ${h + pos.y}`);
      band.style.strokeWidth = `${Math.max(1.5, 3.5 - dist / 120)}`;
      dock.classList.toggle("is-away", dist > 6);
    };

    const step = () => {
      frame = 0;
      const chasing = lockedRef.current && activeRef.current && chaseQuery.matches;
      let tx = chasing ? pos.x : 0;
      let ty = chasing ? pos.y : 0;

      if (chasing && pointer) {
        const home = dock.getBoundingClientRect();
        const panel = (dock.closest(".form") ?? dock.parentElement!).getBoundingClientRect();
        const hw = btn.offsetWidth / 2;
        const hh = btn.offsetHeight / 2;
        const cx = home.left + home.width / 2 + pos.x;
        const cy = home.top + home.height / 2 + pos.y;
        const dx = cx - pointer.x;
        const dy = cy - pointer.y;
        // Distancia al BORDE del botón: un botón ancho debe reaccionar antes por los lados
        const ex = Math.max(Math.abs(dx) - hw, 0);
        const ey = Math.max(Math.abs(dy) - hh, 0);
        const edgeDist = Math.hypot(ex, ey);

        if (edgeDist < FLEE_RADIUS) {
          const len = Math.hypot(dx, dy) || 1;
          const force = (FLEE_RADIUS - edgeDist) / FLEE_RADIUS;
          const rawX = pos.x + (dx / len) * force * FLEE_PUSH;
          const rawY = pos.y + (dy / len) * force * FLEE_PUSH;

          // Límites del panel, relativos a la posición del gate
          const minX = panel.left + EDGE_PAD - (home.left + home.width / 2 - hw);
          const maxX = panel.right - EDGE_PAD - (home.left + home.width / 2 + hw);
          const minY = panel.top + EDGE_PAD - (home.top + home.height / 2 - hh);
          const maxY = panel.bottom - EDGE_PAD - (home.top + home.height / 2 + hh);
          tx = Math.min(maxX, Math.max(minX, rawX));
          ty = Math.min(maxY, Math.max(minY, rawY));

          // ¿Acorralado? Lo que no pudo moverse en un eje se gasta en el otro,
          // así se desliza por la pared en vez de quedarse esperando el clic
          const spillX = Math.abs(rawX - tx);
          const spillY = Math.abs(rawY - ty);
          const awayY = dy !== 0 ? Math.sign(dy) : (ty > (minY + maxY) / 2 ? -1 : 1);
          const awayX = dx !== 0 ? Math.sign(dx) : (tx > (minX + maxX) / 2 ? -1 : 1);
          if (spillX > 0) ty = Math.min(maxY, Math.max(minY, ty + spillX * 0.9 * awayY));
          if (spillY > 0) tx = Math.min(maxX, Math.max(minX, tx + spillY * 0.9 * awayX));
        } else if (edgeDist > RETURN_RADIUS) {
          tx = 0;
          ty = 0;
        }
      }

      vel.x = (vel.x + (tx - pos.x) * SPRING) * DAMPING;
      vel.y = (vel.y + (ty - pos.y) * SPRING) * DAMPING;
      pos.x += vel.x;
      pos.y += vel.y;
      render();

      const settled = Math.abs(vel.x) < 0.05 && Math.abs(vel.y) < 0.05 && Math.abs(tx - pos.x) < 0.2 && Math.abs(ty - pos.y) < 0.2;
      if (!settled || (chasing && pointer)) frame = requestAnimationFrame(step);
    };

    const wake = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    wakeRef.current = wake;

    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      wake();
    };
    const onLeave = () => {
      pointer = null;
      wake();
    };

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    chaseQuery.addEventListener("change", wake);
    render();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      chaseQuery.removeEventListener("change", wake);
      wakeRef.current = () => {};
    };
  }, []);

  // Enter en el formulario también "hace clic" en el botón: si falta algo, lo bloqueamos aquí
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!locked) return;
    e.preventDefault();
    setShaking(true);
  };

  return (
    <div ref={dockRef} className={`dock ${locked ? "is-locked" : "is-ready"}`}>
      <svg className="dock__band" aria-hidden="true">
        <path ref={bandRef} />
      </svg>
      <span className="dock__socket" aria-hidden="true">
        <span className="dock__beacon" />
        {lockedHint}
      </span>
      <button
        ref={btnRef}
        className={`submit-btn cta ${shaking ? "is-shaking" : ""}`}
        type="submit"
        disabled={loading}
        aria-disabled={locked}
        title={locked ? lockedHint : undefined}
        onClick={handleClick}
        onAnimationEnd={() => setShaking(false)}
      >
        <span className="cta__icon material-symbols-outlined" aria-hidden="true">
          {locked ? "flight" : "flight_takeoff"}
        </span>
        {loading ? loadingLabel : label}
      </button>
    </div>
  );
}
