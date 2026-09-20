"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface MensualData {
  total: number;
  apCount: number;
  cmCount: number;
  otp: number;
  loadFactor: number;
  dailyChart: { day: string; cm: number; p7: number }[];
}

interface Props {
  initialData: MensualData;
  initialYear: number;
  initialMonth: number;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function MensualClient({ initialData, initialYear, initialMonth }: Props) {
  const router = useRouter();
  const [data] = useState<MensualData>(initialData);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const apPercent = data.total > 0 ? Math.round((data.apCount / data.total) * 100) : 0;
  const cmPercent = data.total > 0 ? Math.round((data.cmCount / data.total) * 100) : 0;

  const handleMonthChange = (offset: number) => {
    let newMonth = month + offset;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    router.push(`/dashboard/mensual?year=${newYear}&month=${newMonth}`);
  };

  const handleToday = () => {
    const t = new Date();
    router.push(`/dashboard/mensual?year=${t.getFullYear()}&month=${t.getMonth() + 1}`);
  };

  // Custom tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-primary-container text-on-primary px-3 py-2 rounded-lg shadow-xl text-center pointer-events-none border border-white/10">
          <p className="font-label-sm text-label-sm font-bold text-secondary-fixed mb-1">{label} {MONTHS[month - 1].substring(0, 3)}</p>
          <div className="flex flex-col gap-0.5 text-left">
             <p className="font-label-sm text-label-sm leading-tight text-white flex items-center gap-1">
               <span className="w-2 h-2 rounded-full bg-secondary"></span> Air Panama: {payload[1]?.value || 0}
             </p>
             <p className="font-label-sm text-label-sm leading-tight text-white flex items-center gap-1">
               <span className="w-2 h-2 rounded-full bg-[#1e40af]"></span> Copa: {payload[0]?.value || 0}
             </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col w-full space-y-space-md animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Slicer & Temporal Drilldown Panel */}
      <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm border border-black/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
            <span className="material-symbols-outlined text-base text-secondary-container">insights</span>
            <span>OPS BI ANALYTICS • COMPARATIVO MENSUAL</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold border border-black/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            SYNC LIVE
          </span>
        </div>

        {/* Slicers Row */}
        <div className="grid grid-cols-3 gap-space-xs pt-space-xs">
          <button 
            onClick={() => handleMonthChange(-12)}
            className="flex items-center justify-between px-space-sm py-2 bg-surface-container-low rounded-lg text-left hover:bg-surface-container transition-colors border border-black/5"
          >
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Año</p>
              <p className="font-label-md text-label-md font-bold text-on-surface">{year}</p>
            </div>
            <span className="material-symbols-outlined text-lg text-on-surface-variant">unfold_more</span>
          </button>
          
          <div className="flex items-center justify-between px-space-sm py-2 bg-surface-container-low rounded-lg text-left border border-black/5">
            <button onClick={() => handleMonthChange(-1)} className="text-on-surface-variant hover:text-black">
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <div className="text-center">
              <p className="font-label-sm text-label-sm text-on-surface-variant">Mes</p>
              <p className="font-label-md text-label-md font-bold text-on-surface">{MONTHS[month - 1]}</p>
            </div>
            <button onClick={() => handleMonthChange(1)} className="text-on-surface-variant hover:text-black">
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>

          <button className="flex items-center justify-between px-space-sm py-2 bg-surface-container-low rounded-lg text-left hover:bg-surface-container transition-colors border border-black/5">
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Rango</p>
              <p className="font-label-md text-label-md font-bold text-on-surface">1 - {new Date(year, month, 0).getDate()} {MONTHS[month - 1].substring(0, 3)}</p>
            </div>
            <span className="material-symbols-outlined text-lg text-on-surface-variant">calendar_today</span>
          </button>
        </div>

        {/* Quick filter chips */}
        <div className="flex items-center gap-space-xs overflow-x-auto pb-1 pt-1 scrollbar-none">
          <button onClick={handleToday} className="px-3 py-1 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm font-bold whitespace-nowrap shadow-sm hover:scale-105 transition-transform">
            Mes Actual
          </button>
          <button className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap hover:bg-surface-container-highest transition-colors">
            Año Completo
          </button>
          <button className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap hover:bg-surface-container-highest transition-colors">
            Últimos 6M
          </button>
        </div>

        {/* Airline Filter Toggles */}
        <div className="flex items-center gap-space-xs pt-space-xs">
          <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-surface-container text-on-surface rounded-lg font-label-sm text-label-sm font-semibold border border-black/5">
            <span className="material-symbols-outlined text-sm text-secondary-container">done_all</span>
            Todas (2)
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-secondary/10 text-secondary rounded-lg font-label-sm text-label-sm font-bold border border-secondary/20">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            AirPanama (7P)
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-primary-container/10 text-primary-container rounded-lg font-label-sm text-label-sm font-bold border border-primary-container/20">
            <span className="w-2 h-2 rounded-full bg-primary-container"></span>
            Copa (CM)
          </button>
        </div>
      </section>

      {/* Executive KPI Bento Grid */}
      <section className="grid grid-cols-2 gap-space-sm">
        {/* Card 1: Total Vuelos */}
        <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between space-y-space-xs border border-black/5">
          <div className="flex items-start justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">TOTAL VUELOS</span>
          </div>
          <div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">{data.total.toLocaleString()}</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Operaciones Registradas</p>
          </div>
          <div className="pt-space-xs space-y-1">
            <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex">
              <div className="bg-secondary h-full transition-all duration-1000" style={{ width: `${apPercent}%` }}></div>
              <div className="bg-primary-container h-full transition-all duration-1000" style={{ width: `${cmPercent}%` }}></div>
            </div>
            <div className="flex justify-between font-label-sm text-[10px]">
              <span className="text-secondary font-semibold">7P: {data.apCount} ({apPercent}%)</span>
              <span className="text-primary-container font-semibold">CM: {data.cmCount} ({cmPercent}%)</span>
            </div>
          </div>
        </div>

        {/* Card 2: OTP Operativa */}
        <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between space-y-space-xs border border-black/5">
          <div className="flex items-start justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">OTP GENERAL</span>
            <span className={`inline-flex items-center font-label-sm text-[10px] font-bold px-1.5 py-0.5 rounded ${data.otp >= 90 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
              {data.otp >= 90 ? '▲ Óptimo' : '▼ Riesgo'}
            </span>
          </div>
          <div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">{data.otp.toFixed(1)}%</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Meta corporativa: 90.0%</p>
          </div>
          <div className="pt-space-xs">
            <div className="relative h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-1000 ${data.otp >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(data.otp, 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 3: Factor de Ocupación */}
        <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between space-y-space-xs border border-black/5">
          <div className="flex items-start justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">LOAD FACTOR</span>
          </div>
          <div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">{data.loadFactor.toFixed(1)}%</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Ocupación Promedio</p>
          </div>
          <div className="pt-space-xs">
             <div className="relative h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(data.loadFactor, 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 4: Resolución de Demoras (MOCK) */}
        <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between space-y-space-xs border border-black/5 opacity-80">
          <div className="flex items-start justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">TURNAROUND</span>
            <span className="inline-flex items-center text-emerald-700 font-label-sm text-[10px] font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
              Óptimo
            </span>
          </div>
          <div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">32 min</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Tiempo en rampa est.</p>
          </div>
          <div className="flex items-center gap-1 font-label-sm text-[10px] text-emerald-600 font-semibold mt-2">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span>Dentro de la meta (40m)</span>
          </div>
        </div>
      </section>

      {/* Chart 1: Curva Comparativa Línea Temporal */}
      <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm border border-black/5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Vuelos & Incidencias Diarias</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Distribución del mes (7P vs CM)</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-1 font-label-sm text-[11px] text-secondary font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> 7P
            </span>
            <span className="flex items-center gap-1 font-label-sm text-[11px] text-primary-container font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-container"></span> CM
            </span>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="w-full h-48 mt-4 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dailyChart} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
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
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#74777e', fontWeight: 600 }}
                tickMargin={10}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#c4c6ce', strokeWidth: 1, strokeDasharray: '4 4' }} />
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
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
