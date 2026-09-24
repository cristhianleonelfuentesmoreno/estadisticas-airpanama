"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LabelList } from "recharts";
import { STATION } from "@/lib/reportes/excel";
import type { ReportAirline, ReportMetrics } from "@/lib/reportes/metrics";

// Documento del PDF: páginas A4 verticales (794 × 1123 px a 96 ppp) que luego se
// capturan como imagen. Cada sección se mide y se reparte en páginas: si todo cabe
// queda en una sola; si no, lo que sobra pasa a la siguiente.

export const PAGE_W = 794;
export const PAGE_H = 1123;
const PAD_X = 44;
const PAD_Y = 36;
const GAP = 16;
const CONTENT_W = PAGE_W - PAD_X * 2;

const NAVY = "#0a2540";
const RED = "#bb001d";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

type Props = {
  metrics: ReportMetrics;
  airline: ReportAirline;
  airlineLabel: string;
  period: string;
  generatedAt: string;
  onReady: (pages: HTMLElement[]) => void;
};

const fmt = (n: number) => Math.round(n).toLocaleString("es-PA");
const pct = (n: number) => `${n.toFixed(1)}%`;

function Header({ generatedAt }: { generatedAt: string }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- se captura como imagen, next/image no aplica */}
          <img src="/logo.png" alt="" width={42} height={42} style={{ objectFit: "contain" }} />
          <span style={{ fontSize: 26, fontWeight: 800, fontStyle: "italic", letterSpacing: "-0.03em", color: NAVY }}>AirPanama</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>Fecha del reporte</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginTop: 2 }}>{generatedAt}</div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 13.5, fontWeight: 700, color: NAVY, marginTop: 10, letterSpacing: "0.01em" }}>
        {STATION}
      </div>
      <div style={{ height: 3, borderRadius: 3, marginTop: 10, background: `linear-gradient(90deg, ${RED} 0%, ${RED} 22%, ${NAVY} 22%, ${NAVY} 100%)` }} />
    </div>
  );
}

function Footer({ page, pages }: { page: number; pages: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${LINE}`, paddingTop: 8, fontSize: 9.5, color: MUTED }}>
      <span>AirPanama · Ops BI · Datos del Registro Histórico</span>
      <span>Página {page} de {pages}</span>
    </div>
  );
}

function Card({ title, subtitle, aside, children, style }: { title: string; subtitle?: string; aside?: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: "14px 16px", background: "#fff", ...style }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: NAVY }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {aside}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function Legend({ airline }: { airline: ReportAirline }) {
  const pill = (color: string, label: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: `${color}14`, color, fontSize: 10.5, fontWeight: 700 }}>
      <span style={{ width: 7, height: 7, borderRadius: 7, background: color }} /> {label}
    </span>
  );
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {airline !== "cm" && pill(RED, "Air Panama")}
      {airline !== "7p" && pill(NAVY, "Copa")}
    </div>
  );
}

// Secciones del reporte, en orden. Cada una es un bloque que no se parte entre páginas.
function buildSections({ metrics: m, airline }: Props): { id: string; node: ReactNode }[] {
  const kpi = (label: string, value: string, sub: string, accent: string) => (
    <div style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 14, padding: "12px 14px", background: "#fff", borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, marginTop: 4, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{sub}</div>
    </div>
  );

  const sections: { id: string; node: ReactNode }[] = [];

  sections.push({
    id: "kpis",
    node: (
      <div style={{ display: "flex", gap: 10 }}>
        {kpi("Vuelos", fmt(m.filteredTotal), `${fmt(m.llegadas)} llegadas · ${fmt(m.salidas)} salidas`, NAVY)}
        {kpi("Pasajeros", fmt(m.totalPax), airline === "all" ? `7P ${fmt(m.totalPaxAP)} · CM ${fmt(m.totalPaxCM)}` : `${fmt(m.totalCap)} asientos ofertados`, RED)}
        {kpi("Ocupación", pct(m.loadFactor), "Load factor promedio", "#2563eb")}
        {kpi("Puntualidad", m.otpBase > 0 ? pct(m.otp) : "—", m.otpBase > 0 ? `${fmt(m.otpBase)} vuelos con hora` : "Sin horas registradas", "#10b981")}
      </div>
    ),
  });

  const chartW = CONTENT_W - 34;
  sections.push({
    id: "trend",
    node: (
      <Card title="Pasajeros transportados" subtitle={`Por ${m.byMonth ? "mes" : "día"}`} aside={<Legend airline={airline} />}>
        <AreaChart width={chartW} height={210} data={m.dailyChart} margin={{ top: m.byMonth ? 20 : 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pdfP7" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={RED} stopOpacity={0.28} />
              <stop offset="95%" stopColor={RED} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pdfCM" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={NAVY} stopOpacity={0.2} />
              <stop offset="95%" stopColor={NAVY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={LINE} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9.5, fill: MUTED, fontWeight: 600 }} tickMargin={8} padding={{ left: 10, right: 10 }} interval={m.byMonth ? 0 : 1} />
          <YAxis axisLine={false} tickLine={false} width={40} tickCount={5} tick={{ fontSize: 9.5, fill: "#94a3b8", fontWeight: 600 }}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${v}`)} />
          {airline !== "7p" && (
            <Area type="monotone" dataKey="cm" stroke={NAVY} strokeWidth={2.2} fill="url(#pdfCM)" isAnimationActive={false}
              dot={m.byMonth ? { r: 3, fill: NAVY, stroke: "#fff", strokeWidth: 1.5 } : false}>
              {m.byMonth && <LabelList dataKey="cm" position="top" offset={8} formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 9.5, fontWeight: 800, fill: NAVY }} />}
            </Area>
          )}
          {airline !== "cm" && (
            <Area type="monotone" dataKey="p7" stroke={RED} strokeWidth={2.2} fill="url(#pdfP7)" isAnimationActive={false}
              dot={m.byMonth ? { r: 3, fill: RED, stroke: "#fff", strokeWidth: 1.5 } : false}>
              {m.byMonth && <LabelList dataKey="p7" position="top" offset={8} formatter={(v: unknown) => fmt(Number(v))} style={{ fontSize: 9.5, fontWeight: 800, fill: RED }} />}
            </Area>
          )}
        </AreaChart>
      </Card>
    ),
  });

  // Los números del gráfico en una tabla: en el PDF no se puede pasar el mouse para verlos.
  // Por día (hasta 31 filas) se reparte en dos columnas para que quepa.
  {
    const showAP = airline !== "cm";
    const showCM = airline !== "7p";
    const rows = m.dailyChart.map(p => ({ label: m.byMonth ? p.tip : p.tip.replace(/ \d{4}$/, ""), ap: p.p7, cm: p.cm }));
    const tot = rows.reduce((t, r) => ({ ap: t.ap + r.ap, cm: t.cm + r.cm }), { ap: 0, cm: 0 });
    const cols = m.byMonth || rows.length <= 12 ? [rows] : [rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))];
    const cell = { padding: "3px 6px", fontSize: 10, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const };
    const table = (list: typeof rows, withTotal: boolean) => (
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1.5px solid ${LINE}` }}>
            <th style={{ ...cell, textAlign: "left", color: MUTED, fontWeight: 700 }}>{m.byMonth ? "Mes" : "Día"}</th>
            {showAP && <th style={{ ...cell, color: RED, fontWeight: 800 }}>Air Panama</th>}
            {showCM && <th style={{ ...cell, color: NAVY, fontWeight: 800 }}>Copa</th>}
            {showAP && showCM && <th style={{ ...cell, color: NAVY, fontWeight: 800 }}>Total</th>}
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.label} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
              <td style={{ ...cell, textAlign: "left", color: NAVY, fontWeight: 600 }}>{r.label}</td>
              {showAP && <td style={{ ...cell, color: "#334155" }}>{fmt(r.ap)}</td>}
              {showCM && <td style={{ ...cell, color: "#334155" }}>{fmt(r.cm)}</td>}
              {showAP && showCM && <td style={{ ...cell, color: NAVY, fontWeight: 700 }}>{fmt(r.ap + r.cm)}</td>}
            </tr>
          ))}
          {withTotal && (
            <tr style={{ borderTop: `1.5px solid ${LINE}` }}>
              <td style={{ ...cell, textAlign: "left", color: NAVY, fontWeight: 800 }}>Total</td>
              {showAP && <td style={{ ...cell, color: RED, fontWeight: 800 }}>{fmt(tot.ap)}</td>}
              {showCM && <td style={{ ...cell, color: NAVY, fontWeight: 800 }}>{fmt(tot.cm)}</td>}
              {showAP && showCM && <td style={{ ...cell, color: NAVY, fontWeight: 800 }}>{fmt(tot.ap + tot.cm)}</td>}
            </tr>
          )}
        </tbody>
      </table>
    );
    sections.push({
      id: "trend-table",
      node: (
        <Card title={`Pasajeros por ${m.byMonth ? "mes" : "día"}`} subtitle="Los mismos números del gráfico">
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: 16 }}>
            {cols.map((list, i) => <div key={i}>{table(list, i === cols.length - 1)}</div>)}
          </div>
        </Card>
      ),
    });
  }

  // Capacidad vs ocupación (barras propias: más nítidas que un gráfico para dos filas)
  const capRows = [
    ...(airline !== "cm" ? [{ name: "Air Panama", color: RED, pax: m.totalPaxAP, cap: m.totalCapAP }] : []),
    ...(airline !== "7p" ? [{ name: "Copa Airlines", color: NAVY, pax: m.totalPaxCM, cap: m.totalCapCM }] : []),
  ];
  const capacity = (
    <Card title="Capacidad vs ocupación" subtitle="Asientos ofertados vs pasajeros" style={{ flex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
        {capRows.map(r => {
          const lf = r.cap > 0 ? (r.pax / r.cap) * 100 : 0;
          return (
            <div key={r.name}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: NAVY }}>
                <span>{r.name}</span>
                <span style={{ color: r.color }}>{pct(lf)}</span>
              </div>
              <div style={{ height: 12, borderRadius: 12, background: "#eef2f6", marginTop: 5, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(lf, 100)}%`, height: "100%", borderRadius: 12, background: r.color }} />
              </div>
              <div style={{ fontSize: 9.5, color: MUTED, marginTop: 4 }}>{fmt(r.pax)} pasajeros de {fmt(r.cap)} asientos</div>
            </div>
          );
        })}
      </div>
    </Card>
  );

  if (airline === "all") {
    const total = m.totalPaxAP + m.totalPaxCM;
    const share = [
      { name: "Air Panama", value: m.totalPaxAP, color: RED },
      { name: "Copa Airlines", value: m.totalPaxCM, color: NAVY },
    ];
    sections.push({
      id: "share",
      node: (
        <div style={{ display: "flex", gap: 12 }}>
          <Card title="Cuota de mercado" subtitle="Participación en pasajeros" style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ position: "relative", width: 132, height: 132 }}>
                <PieChart width={132} height={132}>
                  <Pie data={share} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={62} stroke="none" paddingAngle={2} isAnimationActive={false}>
                    {share.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{fmt(total)}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: MUTED, letterSpacing: "0.08em" }}>PAX</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {share.map(s => (
                  <div key={s.name}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: NAVY }}>
                      <span style={{ width: 8, height: 8, borderRadius: 8, background: s.color }} /> {s.name}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginTop: 2 }}>{total > 0 ? pct((s.value / total) * 100) : "—"}</div>
                    <div style={{ fontSize: 9.5, color: MUTED }}>{fmt(s.value)} pasajeros</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          {capacity}
        </div>
      ),
    });
  } else {
    sections.push({ id: "capacity", node: capacity });
  }

  const routes = m.routesChart.slice(0, 12);
  if (routes.length > 0) {
    sections.push({
      id: "routes",
      node: (
        <Card title="Rendimiento por ruta" subtitle={`Ocupación por corredor aéreo${m.routesChart.length > routes.length ? ` · ${routes.length} principales` : ""}`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {routes.map(r => (
              <div key={r.route} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#f8fafc", border: `1px solid ${LINE}` }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9.5, fontWeight: 800, background: r.airline === "Air Panama" ? RED : NAVY }}>
                  {r.airline === "Air Panama" ? "7P" : "CM"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: NAVY }}>{r.route}</div>
                  <div style={{ fontSize: 9.5, color: MUTED }}>{fmt(r.flights)} vuelos · {fmt(r.pax)} pax</div>
                </div>
                <div style={{ width: 70 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#047857", textAlign: "right" }}>{pct(r.lf)}</div>
                  <div style={{ height: 5, borderRadius: 5, background: "#e2e8f0", marginTop: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(r.lf, 100)}%`, height: "100%", background: "#10b981" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ),
    });
  }

  // Densidad por hora: solo si hay vuelos con hora (los importados del Excel no la tienen)
  if (m.hasHourlyData) {
    sections.push({
      id: "heatmap",
      node: (
        <Card title="Densidad de tráfico" subtitle="Pasajeros por hora del día (vuelos con hora registrada)">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 3 }}>
            {m.heatmapChart.map(h => (
              <div key={h.hour} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", height: 30, borderRadius: 5, background: h.pax > 0 ? `rgba(187, 0, 29, ${0.12 + h.intensity * 0.88})` : "#f1f5f9" }} />
                <span style={{ fontSize: 7.5, color: MUTED, fontWeight: 600 }}>{h.hour.slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </Card>
      ),
    });
  }

  return sections;
}

function Page({ children, header, footer, pageRef }: { children: ReactNode; header: ReactNode; footer: ReactNode; pageRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={pageRef}
      style={{
        width: PAGE_W, height: PAGE_H, padding: `${PAD_Y}px ${PAD_X}px`, boxSizing: "border-box",
        background: "#fff", display: "flex", flexDirection: "column", gap: GAP,
        fontFamily: "inherit", color: NAVY,
      }}
    >
      {header}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: GAP }}>{children}</div>
      {footer}
    </div>
  );
}

export function ReportPdfDocument(props: Props) {
  const { period, airlineLabel, generatedAt, onReady } = props;
  const sections = buildSections(props);
  const [plan, setPlan] = useState<string[][] | null>(null);

  // Fase 1: medir cada bloque. Fase 2: repartir en páginas y avisar cuando estén listas.
  const measureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const title = (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em" }}>Reporte de operaciones</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Llegadas y salidas registradas en David (DAV)</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ padding: "4px 10px", borderRadius: 999, background: NAVY, color: "#fff", fontSize: 10.5, fontWeight: 700 }}>{period}</span>
        <span style={{ padding: "4px 10px", borderRadius: 999, background: "#f1f5f9", color: NAVY, fontSize: 10.5, fontWeight: 700 }}>{airlineLabel}</span>
      </div>
    </div>
  );

  // Se llama cuando el contenedor de medición ya está montado (las referencias de los
  // hijos se asignan antes que la del padre, así que todas las alturas están disponibles)
  const planPages = (root: HTMLDivElement | null) => {
    if (!root || plan) return;
    const chrome = chromeRef.current?.offsetHeight ?? 0; // encabezado + pie + márgenes de una página
    const titleH = measureRefs.current.__title?.offsetHeight ?? 0;
    const available = PAGE_H - chrome;
    const pages: string[][] = [[]];
    let used = titleH;
    for (const s of sections) {
      const h = measureRefs.current[s.id]?.offsetHeight ?? 0;
      const current = pages[pages.length - 1];
      if (current.length > 0 && used + GAP + h > available) {
        pages.push([s.id]);
        used = h;
      } else {
        current.push(s.id);
        used += (used > 0 ? GAP : 0) + h;
      }
    }
    setPlan(pages);
  };

  useLayoutEffect(() => {
    if (!plan) return;
    // Dos cuadros de animación: los SVG de los gráficos ya están pintados
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => onReady(pageRefs.current.filter((p): p is HTMLDivElement => !!p)));
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [plan, onReady]);

  const header = <Header generatedAt={generatedAt} />;
  const byId = Object.fromEntries(sections.map(s => [s.id, s.node]));

  if (!plan) {
    return (
      <div ref={planPages}>
        {/* Página vacía para medir encabezado + pie + márgenes */}
        <div ref={chromeRef} style={{ width: PAGE_W, padding: `${PAD_Y}px ${PAD_X}px`, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: GAP }}>
          {header}
          <Footer page={1} pages={1} />
        </div>
        <div style={{ width: CONTENT_W }}>
          <div ref={el => { measureRefs.current.__title = el; }}>{title}</div>
          {sections.map(s => (
            <div key={s.id} ref={el => { measureRefs.current[s.id] = el; }}>{s.node}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {plan.map((ids, i) => (
        <Page
          key={i}
          pageRef={el => { pageRefs.current[i] = el; }}
          header={header}
          footer={<Footer page={i + 1} pages={plan.length} />}
        >
          {i === 0 && title}
          {ids.map(id => <div key={id}>{byId[id]}</div>)}
        </Page>
      ))}
    </div>
  );
}
