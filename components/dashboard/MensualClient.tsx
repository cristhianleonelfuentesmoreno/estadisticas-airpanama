"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, YAxis } from 'recharts';
import { computeReportMetrics, MONTHS, type ChartPoint, type ReporteVuelo, type ReportRange } from "@/lib/reportes/metrics";
import { ExportReportButton } from "./export/ExportReportButton";

export type { ReporteVuelo } from "@/lib/reportes/metrics";

interface Props {
  rawFlights: ReporteVuelo[];
  initialYear: number;
  initialMonth: number;
  initialRange: string;
}



type DailyTooltipProps = {
  active?: boolean;
  payload?: { value?: number; dataKey?: string; payload?: ChartPoint }[];
};

// Recharts inyecta active/payload al clonar el elemento pasado en `content`
const CustomTooltip = ({ active, payload }: DailyTooltipProps) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const value = (key: 'p7' | 'cm') => payload.find(p => p.dataKey === key)?.value;
  const ap = value('p7');
  const cm = value('cm');
  return (
    <div className="bg-primary-container text-on-primary px-3 py-2 rounded-lg shadow-xl text-center pointer-events-none border border-white/10">
      <p className="font-label-sm text-label-sm font-bold text-secondary-fixed mb-1">{point?.tip}</p>
      <div className="flex flex-col gap-0.5 text-left">
        {ap !== undefined && (
          <p className="font-label-sm text-label-sm leading-tight text-white flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary"></span> Air Panama: {ap.toLocaleString('es-PA')} pax
          </p>
        )}
        {cm !== undefined && (
          <p className="font-label-sm text-label-sm leading-tight text-white flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#1e40af]"></span> Copa: {cm.toLocaleString('es-PA')} pax
          </p>
        )}
      </div>
    </div>
  );
};

export default function MensualClient({ rawFlights, initialYear, initialMonth, initialRange }: Props) {
  const router = useRouter();
  
  const [activeAirline, setActiveAirline] = useState<'all' | '7p' | 'cm'>('all');

  const reportRange: ReportRange = initialRange === 'year' || initialRange === '6m' ? initialRange : 'month';
  // Mismas métricas que la exportación (lib/reportes/metrics)
  const metrics = useMemo(
    () => computeReportMetrics(rawFlights, activeAirline, initialYear, initialMonth, reportRange),
    [rawFlights, activeAirline, initialYear, initialMonth, reportRange]
  );

  const apPercent = metrics.total > 0 ? Math.round((metrics.apCount / metrics.total) * 100) : 0;
  const cmPercent = metrics.total > 0 ? Math.round((metrics.cmCount / metrics.total) * 100) : 0;

  const handleDateChange = (year: number, month: number, range: string) => {
    window.dispatchEvent(new CustomEvent("start-navigation"));
    router.push(`/dashboard/mensual?year=${year}&month=${month}&range=${range}`);
  };


  // Periodo: mes, año completo o últimos 6 meses (que terminan en el mes elegido)
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const range: 'month' | 'year' | '6m' = initialRange === 'year' || initialRange === '6m' ? initialRange : 'month';
  const RANGES = [
    { id: 'month', label: 'Mes', icon: 'calendar_view_month' },
    { id: 'year', label: 'Año', icon: 'calendar_today' },
    { id: '6m', label: '6 meses', icon: 'date_range' },
  ] as const;
  const rangeIdx = RANGES.findIndex(r => r.id === range);

  const isFuture = (y: number, m: number) => y > curYear || (y === curYear && m > curMonth);
  // Un paso atrás o adelante: por año en "Año", por mes en los demás
  const stepTo = (dir: -1 | 1) => {
    if (range === 'year') return { y: initialYear + dir, m: initialMonth };
    const m = initialMonth + dir;
    return m < 1 ? { y: initialYear - 1, m: 12 } : m > 12 ? { y: initialYear + 1, m: 1 } : { y: initialYear, m };
  };
  const next = stepTo(1);
  const nextDisabled = range === 'year' ? next.y > curYear : isFuture(next.y, next.m);
  const isToday = initialYear === curYear && (range === 'year' || initialMonth === curMonth);

  const start6 = new Date(initialYear, initialMonth - 6, 1);
  const periodTitle =
    range === 'year' ? `${initialYear}` :
    range === '6m' ? `${MONTHS[start6.getMonth()].slice(0, 3)} – ${MONTHS[initialMonth - 1].slice(0, 3)} ${initialYear}` :
    `${MONTHS[initialMonth - 1]} ${initialYear}`;
  const periodSubtitle =
    range === 'year' ? (initialYear === curYear ? `Enero – ${MONTHS[curMonth - 1]} (en curso)` : 'Enero – Diciembre') :
    range === '6m' ? `Últimos 6 meses · desde ${MONTHS[start6.getMonth()].toLowerCase()} ${start6.getFullYear()}` :
    `1 – ${new Date(initialYear, initialMonth, 0).getDate()} de ${MONTHS[initialMonth - 1].toLowerCase()}`;

  const AIRLINES = [
    { id: 'all', label: 'Todas', count: metrics.apCount + metrics.cmCount, dot: 'bg-gradient-to-br from-secondary to-primary-container', active: 'text-on-surface' },
    { id: '7p', label: 'Air Panama', count: metrics.apCount, dot: 'bg-secondary', active: 'text-secondary' },
    { id: 'cm', label: 'Copa', count: metrics.cmCount, dot: 'bg-primary-container', active: 'text-primary-container' },
  ] as const;
  const airlineIdx = AIRLINES.findIndex(a => a.id === activeAirline);

  return (
    <div className="flex flex-col w-full space-y-space-md animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <section className="relative overflow-hidden bg-surface-container-lowest rounded-2xl p-4 md:p-5 shadow-sm border border-black/5 flex flex-col gap-4">
        {/* Brillo decorativo */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-secondary/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 w-64 h-64 rounded-full bg-primary-container/10 blur-3xl" aria-hidden="true" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
            <span className="material-symbols-outlined text-base text-secondary-container">insights</span>
            <span>OPS BI Analytics · Comparativo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 font-label-sm text-[12px] font-bold ring-1 ring-emerald-500/20">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </span>
              SYNC LIVE
            </span>
            <ExportReportButton rawFlights={rawFlights} year={initialYear} month={initialMonth} range={reportRange} airline={activeAirline} />
          </div>
        </div>

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Selector de periodo con pastilla deslizante */}
          <div role="tablist" aria-label="Periodo" className="relative grid grid-cols-3 p-1 rounded-xl bg-surface-container-low ring-1 ring-black/5 lg:w-[340px] shrink-0">
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 ease-out"
              style={{ transform: `translateX(${rangeIdx * 100}%)` }}
            />
            {RANGES.map(r => (
              <button
                key={r.id}
                role="tab"
                aria-selected={range === r.id}
                onClick={() => r.id !== range && handleDateChange(initialYear, initialMonth, r.id)}
                className={`relative z-10 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-bold transition-colors ${range === r.id ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[18px]">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          {/* Navegador del periodo */}
          <div className="flex-1 flex items-center gap-2 rounded-xl bg-gradient-to-r from-surface-container-low to-surface-container-low/40 ring-1 ring-black/5 px-2 py-1.5">
            <button
              onClick={() => { const p = stepTo(-1); handleDateChange(p.y, p.m, range); }}
              aria-label="Periodo anterior"
              className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-white hover:text-on-surface hover:shadow-sm active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <div key={periodTitle} className="flex-1 min-w-0 text-center animate-in fade-in slide-in-from-bottom-1 duration-300">
              <p className="font-headline-sm text-lg md:text-xl font-black tracking-tight text-on-surface truncate">{periodTitle}</p>
              <p className="text-[12px] text-on-surface-variant truncate">{periodSubtitle}</p>
            </div>
            <button
              onClick={() => handleDateChange(next.y, next.m, range)}
              disabled={nextDisabled}
              aria-label="Periodo siguiente"
              className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-white hover:text-on-surface hover:shadow-sm active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            {!isToday && (
              <button
                onClick={() => handleDateChange(curYear, curMonth, range)}
                className="shrink-0 h-8 px-3 rounded-full bg-primary-container text-on-primary text-[12px] font-bold shadow-sm hover:shadow-md active:scale-95 transition-all"
              >
                Hoy
              </button>
            )}
          </div>
        </div>

        {/* Salto directo a un mes del año elegido */}
        {range !== 'year' && (
          <div className="relative flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
            {MONTHS.map((name, i) => {
              const m = i + 1;
              const selected = m === initialMonth;
              const future = isFuture(initialYear, m);
              return (
                <button
                  key={name}
                  onClick={() => handleDateChange(initialYear, m, range)}
                  disabled={future}
                  aria-current={selected ? 'date' : undefined}
                  className={`shrink-0 min-w-[52px] h-8 px-3 rounded-full text-[12px] font-bold transition-all active:scale-95 ${
                    selected
                      ? 'bg-primary-container text-on-primary shadow-md shadow-primary-container/30'
                      : 'bg-surface-container-low text-on-surface-variant ring-1 ring-black/5 hover:bg-white hover:text-on-surface hover:shadow-sm'
                  } disabled:opacity-30 disabled:pointer-events-none`}
                >
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        )}

        {/* Aerolínea: control segmentado con el color de cada una */}
        <div role="tablist" aria-label="Aerolínea" className="relative grid grid-cols-3 p-1 rounded-xl bg-surface-container-low ring-1 ring-black/5">
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-white shadow-md ring-1 ring-black/5 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${airlineIdx * 100}%)` }}
          />
          {AIRLINES.map(a => {
            const selected = activeAirline === a.id;
            return (
              <button
                key={a.id}
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveAirline(a.id)}
                className={`relative z-10 flex items-center justify-center gap-2 py-2 px-1 rounded-lg text-[13px] font-bold transition-colors ${selected ? a.active : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${a.dot} ${selected ? 'ring-4 ring-current/15' : ''}`} />
                <span className="truncate">{a.label}</span>
                <span className={`hidden sm:inline-flex min-w-[26px] justify-center px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${selected ? 'bg-current/10' : 'bg-black/5'}`}>
                  {a.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-space-sm">
        <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between space-y-space-xs border border-black/5">
          <div className="flex items-start justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">TOTAL VUELOS</span>
          </div>
          <div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">{metrics.filteredTotal.toLocaleString()}</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Operaciones Registradas</p>
          </div>
          <div className="pt-space-xs space-y-1">
            <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex">
              <div className={`bg-secondary h-full transition-all duration-1000 ${activeAirline === 'cm' ? 'opacity-20' : ''}`} style={{ width: `${apPercent}%` }}></div>
              <div className={`bg-primary-container h-full transition-all duration-1000 ${activeAirline === '7p' ? 'opacity-20' : ''}`} style={{ width: `${cmPercent}%` }}></div>
            </div>
            <div className="flex justify-between font-label-sm text-[11px]">
              <span className={`text-secondary font-semibold ${activeAirline === 'cm' ? 'opacity-40' : ''}`}>Air Panama: {metrics.apCount}</span>
              <span className={`text-primary-container font-semibold ${activeAirline === '7p' ? 'opacity-40' : ''}`}>Copa: {metrics.cmCount}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between space-y-space-xs border border-black/5">
          <div className="flex items-start justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">OTP {activeAirline !== 'all' && (activeAirline === '7p' ? '(Air Panama)' : '(Copa)')}</span>
            {metrics.otpBase > 0 && (
              <span className={`inline-flex items-center font-label-sm text-[11px] font-bold px-1.5 py-0.5 rounded ${metrics.otp >= 90 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                {metrics.otp >= 90 ? '▲ Óptimo' : '▼ Riesgo'}
              </span>
            )}
          </div>
          <div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">{metrics.otpBase > 0 ? `${metrics.otp.toFixed(1)}%` : '—'}</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              {metrics.otpBase > 0 ? `A tiempo vs demorados · ${metrics.otpBase} vuelos con hora` : 'Sin horas registradas en este periodo'}
            </p>
          </div>
          <div className="pt-space-xs">
            <div className="relative h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${metrics.otp >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(metrics.otp, 100)}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between space-y-space-xs border border-black/5">
          <div className="flex items-start justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">LOAD FACTOR {activeAirline !== 'all' && (activeAirline === '7p' ? '(Air Panama)' : '(Copa)')}</span>
          </div>
          <div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">{metrics.loadFactor.toFixed(1)}%</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Ocupación Promedio</p>
          </div>
          <div className="pt-space-xs">
             <div className="relative h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(metrics.loadFactor, 100)}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between space-y-space-xs border border-black/5 opacity-80">
          <div className="flex items-start justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">TURNAROUND</span>
            <span className="inline-flex items-center text-emerald-700 font-label-sm text-[11px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
              Óptimo
            </span>
          </div>
          <div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">32 min</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Tiempo en rampa est.</p>
          </div>
          <div className="flex items-center gap-1 font-label-sm text-[11px] text-emerald-600 font-semibold mt-2">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span>Dentro de la meta (40m)</span>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl p-4 md:p-6 shadow-sm border border-black/5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Aerolíneas</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Pasajeros transportados por {initialRange === 'year' || initialRange === '6m' ? 'mes' : 'día'} (Air Panama vs Copa)
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary font-label-sm text-[12px] font-bold transition-opacity ${activeAirline === 'cm' ? 'opacity-40' : ''}`}>
              <span className="w-2 h-2 rounded-full bg-secondary"></span> Air Panama
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-container/10 text-primary-container font-label-sm text-[12px] font-bold transition-opacity ${activeAirline === '7p' ? 'opacity-40' : ''}`}>
              <span className="w-2 h-2 rounded-full bg-primary-container"></span> Copa
            </span>
          </div>
        </div>

        <div className="w-full h-60 md:h-72 mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.dailyChart} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="colorP7" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#bb001d" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#bb001d" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0a2540" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#0a2540" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e3e5" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#74777e', fontWeight: 600 }}
                tickMargin={12}
                padding={{ left: 16, right: 16 }}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={44}
                tickCount={5}
                tick={{ fontSize: 11, fill: '#9a9da3', fontWeight: 600 }}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${v}`)}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#c4c6ce', strokeWidth: 1, strokeDasharray: '4 4' }} />
              {(activeAirline === 'all' || activeAirline === 'cm') && (
                <Area 
                  type="monotone" 
                  dataKey="cm" 
                  stroke="#0a2540" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorCM)" 
                  activeDot={{ r: 4, fill: '#0a2540', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={1500}
                />
              )}
              {(activeAirline === 'all' || activeAirline === '7p') && (
                <Area 
                  type="monotone" 
                  dataKey="p7" 
                  stroke="#bb001d" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorP7)" 
                  activeDot={{ r: 4, fill: '#bb001d', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={1500}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* --- NUEVAS VISUALIZACIONES BI --- */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-space-sm">
        
        {/* 1. Market Share (Donut) */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-black/5 flex flex-col items-center">
          <div className="w-full flex items-start justify-between mb-4">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Cuota de Mercado</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Total pax transportados</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">pie_chart</span>
          </div>
          
          <div className="w-full h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Air Panama', value: metrics.totalPaxAP, fill: '#bb001d' },
                    { name: 'Copa Airlines', value: metrics.totalPaxCM, fill: '#0a2540' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  stroke="none"
                  paddingAngle={2}
                  dataKey="value"
                >
                  <Cell key="cell-ap" fill="#bb001d" />
                  <Cell key="cell-cm" fill="#0a2540" />
                </Pie>
                <Tooltip 
                  formatter={(value) => [`${Number(value).toLocaleString()} pax`, 'Total']} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-headline-md text-headline-md font-bold text-on-surface">
                {metrics.totalPax.toLocaleString()}
              </span>
              <span className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">Pax Totales</span>
            </div>
          </div>
        </div>

        {/* 2. Capacidad vs Pax Real (Stacked Bar) */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-black/5 flex flex-col">
          <div className="w-full flex items-start justify-between mb-4">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Capacidad vs Realidad</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Asientos ofertados vs ocupados</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">stacked_bar_chart</span>
          </div>

          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={[
                  { 
                    name: 'Air Panama', 
                    pax: metrics.totalPaxAP, 
                    empty: Math.max(0, metrics.totalCapAP - metrics.totalPaxAP),
                    fill: '#bb001d'
                  },
                  { 
                    name: 'Copa', 
                    pax: metrics.totalPaxCM, 
                    empty: Math.max(0, metrics.totalCapCM - metrics.totalPaxCM),
                    fill: '#0a2540'
                  }
                ]}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e0e3e5" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#444' }} width={80} />
                <Tooltip cursor={{ fill: '#f1f3f4' }} formatter={(val) => Math.round(Number(val)).toLocaleString()} />
                <Bar dataKey="pax" stackId="a" fill="#0a2540" name="Ocupados" radius={[0, 0, 0, 0]}>
                  { [0, 1].map((_, i) => <Cell key={`cell-${i}`} fill={i === 0 ? '#bb001d' : '#0a2540'} />) }
                </Bar>
                <Bar dataKey="empty" stackId="a" fill="#e0e3e5" name="Vacíos" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Load Factor por Ruta (Horizontal Bar) */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-black/5 flex flex-col lg:col-span-2">
          <div className="w-full flex items-start justify-between mb-4">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Rendimiento por Corredor Aéreo</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Factor de ocupación por ruta</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">grid_view</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
            {metrics.routesChart.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-black/5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-white text-xs ${r.airline === 'Air Panama' ? 'bg-secondary' : 'bg-primary-container'}`}>
                    {r.airline === 'Air Panama' ? '7P' : 'CM'}
                  </div>
                  <div>
                    <p className="font-label-md text-label-md font-bold text-on-surface">{r.route}</p>
                    <p className="font-label-sm text-[12px] text-on-surface-variant">{r.flights} Vuelos • {r.pax.toLocaleString()} pax</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-label-md text-label-md font-bold text-emerald-700">{r.lf.toFixed(1)}% LF</p>
                  </div>
                  <div className="w-1.5 h-8 bg-surface-container rounded-full overflow-hidden">
                    <div className="w-full bg-emerald-500 rounded-full" style={{ height: `${r.lf}%`, marginTop: `${100 - r.lf}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
            {metrics.routesChart.length === 0 && (
              <p className="text-sm text-on-surface-variant py-4 col-span-2">No hay datos de rutas suficientes en este rango.</p>
            )}
          </div>
        </div>

        {/* 4. Heatmap de Tráfico */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-black/5 flex flex-col lg:col-span-2">
          <div className="w-full flex items-start justify-between mb-4">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Densidad de Tráfico (Heatmap)</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Volumen de pasajeros por hora del día</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">view_comfy_alt</span>
          </div>

          <div className="w-full overflow-x-auto scrollbar-none pb-2">
            <div className="flex gap-1 min-w-max">
              {metrics.heatmapChart.map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-1 group">
                  <div 
                    className="w-8 h-12 rounded-md transition-all group-hover:scale-110 flex items-center justify-center cursor-pointer"
                    style={{ 
                      backgroundColor: h.pax > 0 ? `rgba(10, 37, 64, ${Math.max(0.1, h.intensity)})` : '#f1f3f4',
                      border: h.pax > 0 ? '1px solid rgba(10, 37, 64, 0.2)' : 'none'
                    }}
                    title={`${h.hour} - ${h.pax} pasajeros`}
                  >
                  </div>
                  <span className="font-label-sm text-[11px] text-on-surface-variant">{h.hour.split(':')[0]}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

    </div>
  );
}
