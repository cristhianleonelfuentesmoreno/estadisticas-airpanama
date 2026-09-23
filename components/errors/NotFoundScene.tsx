"use client";

import { useEffect, useRef } from "react";
import "./NotFoundScene.css";

// Un Dash 8 de Air Panama rueda por la pista sosteniendo una lupa desde la cabina.
// La lupa sigue al cursor; el avión la alcanza rodando. Dentro del cristal aparece
// el "404" iluminado con los letreros de pista que a simple vista no se ven.

const VIEW_W = 300;           // viewBox del avión
const VIEW_H = 110;
const ANCHOR = { x: 272, y: 47 }; // de dónde sale el brazo de la lupa (techo de cabina)
const WHEEL_R = 9;            // radio de la rueda principal en unidades del viewBox
const LENS_ZOOM = 1.3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function NotFoundScene() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const plane = stage.querySelector<HTMLDivElement>(".nf__plane")!;
    const runway = stage.querySelector<HTMLDivElement>(".nf__runway")!;
    const word = stage.querySelector<HTMLDivElement>(".nf__word")!;
    const arm = stage.querySelector<SVGLineElement>(".nf__arm-line")!;
    const joint = stage.querySelector<SVGCircleElement>(".nf__arm-joint")!;
    const wheels = stage.querySelectorAll<SVGGElement>("[data-wheel]");
    const blades = stage.querySelectorAll<SVGRectElement>("[data-blade]");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let box = stage.getBoundingClientRect();
    let px = box.width * 0.3;   // centro del avión en x
    let face = 1;               // hacia dónde quiere mirar
    let faceT = 1;              // giro en curso: de 1 (derecha) a -1 (izquierda)
    let wheelDeg = 0;
    let propDeg = 0;
    let lx = box.width * 0.5;
    let ly = box.height * 0.6;
    let pointer: { x: number; y: number; at: number } | null = null;
    let frame = 0;
    let t = 0;

    const measure = () => { box = stage.getBoundingClientRect(); };

    const step = () => {
      t += 1 / 60;
      const W = plane.offsetWidth;
      const H = plane.offsetHeight;
      const scale = W / VIEW_W;
      const runwayTop = runway.offsetTop;
      const planeTop = runwayTop + 30 - H; // las ruedas apoyan sobre el asfalto
      const R = clamp(box.width * 0.07, 52, 84);

      // Objetivo: el cursor, o un recorrido de búsqueda sobre el 404 si no hay cursor
      let tx: number, ty: number;
      if (pointer && performance.now() - pointer.at < 3000) {
        tx = pointer.x - box.left;
        ty = pointer.y - box.top;
      } else {
        const wx = word.offsetLeft + word.offsetWidth / 2;
        const wy = word.offsetTop + word.offsetHeight * 0.5;
        tx = wx + Math.sin(t * 0.35) * word.offsetWidth * 0.42;
        ty = wy + Math.sin(t * 0.8) * word.offsetHeight * 0.28;
      }

      // Mira hacia donde VA y no avanza hasta haber girado: así nunca rueda de reversa
      const gap = tx - px;
      if (Math.abs(gap) > 40) face = Math.sign(gap);
      faceT += (face - faceT) * 0.12;
      const go = Math.abs(gap) > 70 ? clamp(faceT * Math.sign(gap), 0, 1) : 0;
      const moved = clamp(gap * 0.035 * go, -6, 6);
      px = clamp(px + moved, W / 2 + 8, box.width - W / 2 - 8);

      // Las ruedas giran según la distancia recorrida, no según el reloj: no patinan
      wheelDeg += ((moved * face) / (WHEEL_R * scale)) * (180 / Math.PI);
      propDeg += 38 + Math.abs(moved) * 8;

      // Brazo desde la cabina hasta la lupa, con largo limitado
      const ax = px + (ANCHOR.x / VIEW_W - 0.5) * W * faceT;
      const ay = planeTop + ANCHOR.y * scale;
      // La lupa va en alto, por encima del avión y de la pista
      const maxY = Math.min(runwayTop - R * 0.4, planeTop - R * 0.9);
      let dx = tx - ax;
      let dy = Math.min(ty, maxY) - ay;
      const len = Math.hypot(dx, dy) || 1;
      const reach = clamp(len, R + 30, clamp(box.width * 0.32, 150, 260));
      dx = (dx / len) * reach;
      dy = (dy / len) * reach;
      // La lupa nunca sale de la pantalla
      const goalX = clamp(ax + dx, R + 8, box.width - R - 8);
      const goalY = clamp(ay + dy, R + 8, maxY);
      lx += (goalX - lx) * 0.22;
      ly += (goalY - ly) * 0.22;

      stage.style.setProperty("--px", `${px}px`);
      stage.style.setProperty("--py", `${planeTop}px`);
      stage.style.setProperty("--face", `${faceT}`);
      stage.style.setProperty("--lx", `${lx}px`);
      stage.style.setProperty("--ly", `${ly}px`);
      stage.style.setProperty("--lens-r", `${R}px`);
      // El círculo de recorte es el punto fijo del zoom: el disco no se sale del aro
      stage.style.setProperty("--clip-r", `${R / LENS_ZOOM}px`);

      const ldx = lx - ax;
      const ldy = ly - ay;
      const ll = Math.hypot(ldx, ldy) || 1;
      const ex = lx - (ldx / ll) * R;
      const ey = ly - (ldy / ll) * R;
      arm.setAttribute("x1", `${ax}`);
      arm.setAttribute("y1", `${ay}`);
      arm.setAttribute("x2", `${ex}`);
      arm.setAttribute("y2", `${ey}`);
      joint.setAttribute("cx", `${(ax + ex) / 2}`);
      joint.setAttribute("cy", `${(ay + ey) / 2}`);

      wheels.forEach(w => w.setAttribute("transform", `rotate(${wheelDeg} ${w.dataset.cx} ${w.dataset.cy})`));
      // Hélice vista de perfil: cada pala se estira y encoge con el coseno del giro
      blades.forEach((b, i) => {
        const s = Math.cos(((propDeg + i * 90) * Math.PI) / 180);
        b.setAttribute("transform", `translate(0 47) scale(1 ${s.toFixed(3)}) translate(0 -47)`);
      });

      if (!reduceMotion.matches && !document.hidden) frame = requestAnimationFrame(step);
      else frame = 0;
    };

    const wake = () => { if (!frame) frame = requestAnimationFrame(step); };
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY, at: performance.now() };
      wake();
    };
    const onResize = () => { measure(); wake(); };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onMove);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", measure, { passive: true });
    document.addEventListener("visibilitychange", wake);
    reduceMotion.addEventListener("change", wake);
    step(); // primer cuadro siempre, aunque haya "reducir movimiento"

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", measure);
      document.removeEventListener("visibilitychange", wake);
      reduceMotion.removeEventListener("change", wake);
    };
  }, []);

  return (
    <div ref={stageRef} className="nf__stage" aria-hidden="true">
      {/* La pista, dos veces: la base que se ve siempre... */}
      <div className="nf__word">
        <p className="nf__glyph nf__glyph--base">404</p>
      </div>

      {/* ...y la versión que solo el cristal puede leer */}
      <div className="nf__found">
        <div className="nf__word">
          <p className="nf__glyph nf__glyph--lit">404</p>
          <span className="nf__sign nf__sign--red" style={{ left: "6%", top: "38%" }}>VUELO DESVIADO</span>
          <span className="nf__sign nf__sign--navy" style={{ left: "37%", top: "54%" }}>PISTA 404 CERRADA</span>
          <span className="nf__sign nf__sign--red" style={{ left: "69%", top: "26%" }}>PUERTA SIN ASIGNAR</span>
        </div>
      </div>

      <svg className="nf__arm">
        <line className="nf__arm-line" />
        <circle className="nf__arm-joint" r="5" />
      </svg>
      <div className="nf__lens" />

      <div className="nf__runway" />

      <div className="nf__plane">
        <PlaneSvg />
      </div>
    </div>
  );
}

// Dash 8-400 de perfil con la librea de la foto de portada
function PlaneSvg() {
  const windows = Array.from({ length: 15 }, (_, i) => 108 + i * 9);
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%">
      <defs>
        <linearGradient id="nf-tail" x1="0" y1="1" x2="0.3" y2="0">
          <stop offset="0" stopColor="#bb001d" />
          <stop offset="1" stopColor="#ff5a1f" />
        </linearGradient>
        <linearGradient id="nf-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.75" stopColor="#f1f3f6" />
          <stop offset="1" stopColor="#d9dee5" />
        </linearGradient>
      </defs>

      {/* Tren principal (detrás del fuselaje) */}
      <path d="M186 58 L182 92" stroke="#5b6470" strokeWidth="4" strokeLinecap="round" />
      <g data-wheel data-cx="182" data-cy="96">
        <circle cx="182" cy="96" r={WHEEL_R} fill="#1d232b" />
        <circle cx="182" cy="96" r="3.5" fill="#9aa4b1" />
        <path d="M182 88 V92" stroke="#9aa4b1" strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Deriva en T con la estrella */}
      <path d="M26 50 L48 50 L52 14 L36 12 Z" fill="url(#nf-tail)" />
      <path d="M24 12 H62 L58 17 H28 Z" fill="#bb001d" />
      <circle cx="42" cy="33" r="7.5" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M42 27.5 L43.6 31.6 L48 31.8 L44.6 34.5 L45.8 38.8 L42 36.3 L38.2 38.8 L39.4 34.5 L36 31.8 L40.4 31.6 Z" fill="#fff" />

      {/* Fuselaje */}
      <path d="M26 50 L60 47 H236 C262 47 282 51 293 60 C285 68 264 73 236 73 H74 C58 73 42 66 26 50 Z" fill="url(#nf-body)" stroke="#cfd6de" strokeWidth="0.8" />
      {/* Barrido rojo en la cola, como en la librea */}
      <path d="M26 50 C42 66 58 73 74 73 H128 C100 71 70 64 48 52 Z" fill="url(#nf-tail)" />

      {/* Ventanas y puerta */}
      {windows.map(x => (
        <rect key={x} x={x} y="53" width="4.2" height="5" rx="2" fill="#0a2540" opacity="0.8" />
      ))}
      <rect x="244" y="51" width="8" height="15" rx="2" fill="none" stroke="#c4cbd4" strokeWidth="1" />
      <path d="M262 51 H277 L286 57 H266 Z" fill="#0a2540" />

      {/* AirPanama */}
      {/* Se vuelve a voltear junto con el avión, así siempre se lee al derecho */}
      <text className="nf__livery-text" x="150" y="68" fontSize="8.5" fontWeight="800" fontFamily="inherit" fontStyle="italic">
        <tspan fill="#0a2540">Air</tspan>
        <tspan fill="#bb001d">Panama</tspan>
      </text>

      {/* Ala alta y góndola del motor */}
      <path d="M112 44 H214 L210 48 H116 Z" fill="#dfe4ea" />
      <rect x="160" y="40" width="50" height="16" rx="8" fill="#ffffff" stroke="#cfd6de" strokeWidth="0.8" />
      <rect x="166" y="52" width="36" height="3" rx="1.5" fill="#bb001d" opacity="0.85" />

      {/* Hélice: disco borroso + palas que se ven de canto */}
      <ellipse cx="214" cy="47" rx="2.5" ry="25" fill="#0a2540" opacity="0.08" />
      <rect data-blade x="212.8" y="22" width="2.4" height="50" rx="1.2" fill="#1d232b" opacity="0.85" />
      <rect data-blade x="212.8" y="22" width="2.4" height="50" rx="1.2" fill="#1d232b" opacity="0.85" />
      <ellipse cx="214" cy="47" rx="6" ry="5" fill="#15191f" />

      {/* Tren de nariz */}
      <path d="M262 72 L262 90" stroke="#5b6470" strokeWidth="3" strokeLinecap="round" />
      <g data-wheel data-cx="262" data-cy="96">
        <circle cx="262" cy="96" r="6" fill="#1d232b" />
        <circle cx="262" cy="96" r="2.4" fill="#9aa4b1" />
        <path d="M262 91 V93.5" stroke="#9aa4b1" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}
