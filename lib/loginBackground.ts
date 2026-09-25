// Encuadre del fondo del login: zoom relativo a "llenar" + punto de encuadre (X/Y en %).
// zoom 1 = la imagen llena justo el panel; < 1 = se aleja (el hueco se rellena con la
// misma imagen desenfocada); > 1 = se acerca. X/Y funcionan como background-position en %.
// El tamaño se calcula con unidades de contenedor (cqw/cqh), así la vista previa del
// editor y el login real encuadran igual sin importar el tamaño de la pantalla.

export type BgDevice = "desktop" | "mobile";
export type BgFrame = { zoom: number; x: number; y: number };

export type LoginBgSettings = {
  bgUrl?: string;
  bgAspect?: number; // ancho / alto de la imagen
  bgZoom?: number;
  bgX?: number;
  bgY?: number;
  bgZoomMobile?: number;
  bgXMobile?: number;
  bgYMobile?: number;
  // Formato anterior (cuadrícula de 9 posiciones + tamaño CSS)
  bgSize?: string;
  bgPosition?: string;
  bgSizeMobile?: string;
  bgPositionMobile?: string;
};

export const BG_ZOOM_MIN = 0.3;
export const BG_ZOOM_MAX = 3;
// Imagen por defecto (/bg-plane.webp, 1024×539)
export const DEFAULT_BG_ASPECT = 1024 / 539;
// Tamaño del panel de imagen: mitad de la tarjeta en computadora, encabezado de 220 px en celular
export const BG_PANEL = { desktop: { w: 542, h: 484 }, mobile: { w: 390, h: 220 } } as const;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Zoom en el que la imagen se ve completa dentro del panel
export function fitZoom(aspect: number, device: BgDevice) {
  const { w, h } = BG_PANEL[device];
  return Math.min(w, h * aspect) / Math.max(w, h * aspect);
}

const KEYWORD: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };

// "top left" / "center" / "30% 60%" → { x, y }
function positionToXY(pos?: string) {
  const parts = (pos || "center").trim().split(/\s+/);
  let x = 50, y = 50;
  for (const p of parts) {
    if (p.endsWith("%")) continue;
    if (p === "left" || p === "right") x = KEYWORD[p];
    if (p === "top" || p === "bottom") y = KEYWORD[p];
  }
  const pct = parts.filter(p => p.endsWith("%")).map(p => parseFloat(p));
  if (pct.length === 2) [x, y] = pct;
  return { x, y };
}

// Convierte el formato anterior al nuevo (para abrir el editor cerca de lo que se ve hoy)
function legacyFrame(size: string | undefined, pos: string | undefined, aspect: number, device: BgDevice): BgFrame {
  const { x, y } = positionToXY(pos);
  const { w, h } = BG_PANEL[device];
  let zoom = 1;
  if (size === "contain") zoom = fitZoom(aspect, device);
  else if (size?.endsWith("%")) zoom = (parseFloat(size) / 100) * w / Math.max(w, h * aspect);
  return { zoom: clamp(zoom, BG_ZOOM_MIN, BG_ZOOM_MAX), x, y };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function frameFor(s: LoginBgSettings | null | undefined, device: BgDevice): BgFrame {
  const aspect = s?.bgAspect || DEFAULT_BG_ASPECT;
  if (device === "mobile" && isNum(s?.bgZoomMobile)) return { zoom: s.bgZoomMobile, x: s.bgXMobile ?? 50, y: s.bgYMobile ?? 50 };
  if (device === "desktop" && isNum(s?.bgZoom)) return { zoom: s.bgZoom, x: s.bgX ?? 50, y: s.bgY ?? 50 };
  return device === "desktop"
    ? legacyFrame(s?.bgSize, s?.bgPosition, aspect, device)
    : legacyFrame(s?.bgSizeMobile || s?.bgSize, s?.bgPositionMobile || s?.bgPosition, aspect, device);
}

// Valores CSS para una capa de fondo dentro de un contenedor con `container-type: size`
export function frameCss(f: BgFrame, aspect: number) {
  return {
    size: `calc(${f.zoom} * max(100cqw, ${aspect} * 100cqh)) auto`,
    position: `${f.x}% ${f.y}%`,
    // Al alejar, la imagen deja huecos: se rellenan con la misma imagen desenfocada
    backdrop: f.zoom < 0.999,
  };
}

// Mismo cálculo en píxeles, para arrastrar en el editor
export function renderedSize(f: BgFrame, aspect: number, panelW: number, panelH: number) {
  const w = f.zoom * Math.max(panelW, aspect * panelH);
  return { w, h: w / aspect };
}
