"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, YAxis } from 'recharts';

// Fila de llegadas_malek_historico / salidas_malek_historico
export interface ReporteVuelo {
  fecha: string;
  aerolinea: string | null;
  numero_vuelo: string | null;
  origen?: string | null;
  destino?: string | null;
  estado_final: string | null;
  pasajeros_abordo: number | null;
  capacidad_total: number;
  hora_itinerario: string | null;
  hora_real_llegada?: string | null;
  hora_real_salida?: string | null;
}

// Hora (0-23) en Panamá de un timestamp ISO; acepta también "HH:MM" por si hay datos viejos
function horaPanama(value: string): number {
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return Number(d.toLocaleString('en-US', { timeZone: 'America/Panama', hour: '2-digit', hourCycle: 'h23' }));
  }
  return parseInt(value.split(':')[0], 10);
}

interface Props {
  rawFlights: ReporteVuelo[];
  initialYear: number;
  initialMonth: number;
  initialRange: string;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

type DailyTooltipProps = {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string | number;
  monthLabel: string;
};

// Recharts inyecta active/payload/label al clonar el elemento pasado en `content`
const CustomTooltip = ({ active, payload, label, monthLabel }: DailyTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-primary-container text-on-primary px-3 py-2 rounded-lg shadow-xl text-center pointer-events-none border border-white/10">
        <p className="font-label-sm text-label-sm font-bold text-secondary-fixed mb-1">{label} {monthLabel}</p>
        <div className="flex flex-col gap-0.5 text-left">
           <p className="font-label-sm text-label-sm leading-tight text-white flex items-center gap-1">
             <span className="w-2 h-2 rounded-full bg-secondary"></span> Air Panama: {payload[1]?.value || 0} pax
           </p>
           <p className="font-label-sm text-label-sm leading-tight text-white flex items-center gap-1">
             <span className="w-2 h-2 rounded-full bg-[#1e40af]"></span> Copa: {payload[0]?.value || 0} pax
           </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function MensualClient({ rawFlights, initialYear, initialMonth, initialRange }: Props) {
  const router = useRouter();
  
  const [activeAirline, setActiveAirline] = useState<'all' | '7p' | 'cm'>('all');

  // Calcular métricas dinámicamente según el filtro de aerolínea
  const metrics = useMemo(() => {
    let apCount = 0;
    let cmCount = 0;
    let filteredTotal = 0;
    let onTimeCount = 0;
    let totalPax = 0;
    let totalCap = 0;
    
    let totalPaxAP = 0;
    let totalPaxCM = 0;

    const dailyDataMap: Record<string, { day: string, cm: number, p7: number }> = {};
    const routeDataMap: Record<string, { route: string, airline: string, pax: number, cap: number, flights: number }> = {};
    const hourlyDataMap: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlyDataMap[i] = 0;
    
    // Preparar mapa de días (simplificado para el chart)
    const daysInMonth = new Date(initialYear, initialMonth, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = String(i).padStart(2, '0');
      dailyDataMap[dStr] = { day: dStr, cm: 0, p7: 0 };
    }

    rawFlights.forEach(f => {
      const isAP = f.aerolinea === 'Air Panama' || f.numero_vuelo?.startsWith('7P');
      
      // Contar siempre los totales para las barras de progreso
      if (isAP) apCount++;
      else cmCount++;

      // Poblado del gráfico: acumular pasajeros por día
      const dayStr = f.fecha.split('-')[2];
      if (dailyDataMap[dayStr]) {
        const pax = f.pasajeros_abordo || 0;
        if (isAP) dailyDataMap[dayStr].p7 += pax;
        else dailyDataMap[dayStr].cm += pax;
      }

      // Si hay filtro de aerolínea, saltar los cálculos posteriores si no aplica
      if (activeAirline === '7p' && !isAP) return;
      if (activeAirline === 'cm' && isAP) return;

      filteredTotal++;

      const estado = f.estado_final?.toUpperCase() || '';
      if (estado !== 'DEMORADO' && estado !== 'RETRASADO' && estado !== 'CANCELADO') {
        onTimeCount++;
      }

      const pax = f.pasajeros_abordo || 0;
      if (f.capacidad_total > 0) {
        totalPax += pax;
        totalCap += f.capacidad_total;
        if (isAP) totalPaxAP += pax;
        else totalPaxCM += pax;
      }

      // Agrupar por ruta
      const isLlegada = f.origen && !f.origen.toLowerCase().includes('dav'); // Si el origen NO es David, es llegada
      const remoteNode = isLlegada ? f.origen : f.destino;
      if (remoteNode) {
        const routeKey = `DAV ⇄ ${remoteNode}`;
        if (!routeDataMap[routeKey]) routeDataMap[routeKey] = { route: routeKey, airline: isAP ? 'Air Panama' : 'Copa', pax: 0, cap: 0, flights: 0 };
        routeDataMap[routeKey].pax += pax;
        routeDataMap[routeKey].cap += f.capacidad_total;
        routeDataMap[routeKey].flights += 1;
      }

      // Heatmap (Franja horaria real o itinerario)
      const timeStr = f.hora_real_llegada || f.hora_real_salida || f.hora_itinerario;
      if (timeStr) {
        const hour = horaPanama(timeStr);
        if (!isNaN(hour) && hour >= 0 && hour <= 23) {
          hourlyDataMap[hour] += pax; // Volumen de tráfico por pasajeros
        }
      }
    });

    const otp = filteredTotal > 0 ? (onTimeCount / filteredTotal) * 100 : 0;
    const loadFactor = totalCap > 0 ? (totalPax / totalCap) * 100 : 0;
    const dailyChart = Object.values(dailyDataMap).sort((a, b) => parseInt(a.day) - parseInt(b.day));
    
    // Procesar rutas para gráfico
    const routesChart = Object.values(routeDataMap).map(r => ({
      route: r.route,
      airline: r.airline,
      lf: r.cap > 0 ? (r.pax / r.cap) * 100 : 0,
      pax: r.pax,
      flights: r.flights
    })).sort((a, b) => b.lf - a.lf);

    // Heatmap array
    const maxHourPax = Math.max(1, ...Object.values(hourlyDataMap));
    const heatmapChart = Object.entries(hourlyDataMap).map(([hour, pax]) => ({
      hour: `${hour.padStart(2, '0')}:00`,
      pax,
      intensity: pax / maxHourPax
    }));

    return {
      total: rawFlights.length,
      filteredTotal,
      apCount,
      cmCount,
      otp,
      loadFactor,
      dailyChart,
      totalPaxAP,
      totalPaxCM,
      totalCap,
      totalPax,
      routesChart,
      heatmapChart
    };
  }, [rawFlights, activeAirline, initialYear, initialMonth]);

  const apPercent = metrics.total > 0 ? Math.round((metrics.apCount / metrics.total) * 100) : 0;
  const cmPercent = metrics.total > 0 ? Math.round((metrics.cmCount / metrics.total) * 100) : 0;

  const handleDateChange = (year: number, month: number, range: string) => {
    window.dispatchEvent(new CustomEvent("start-navigation"));
    router.push(`/dashboard/mensual?year=${year}&month=${month}&range=${range}`);
  };


  const isCurrentMonth = initialRange === 'month' && initialMonth === new Date().getMonth() + 1 && initialYear === new Date().getFullYear();

  return (
    <div className="flex flex-col w-full space-y-space-md animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs pt-space-xs">
          <button 
            onClick={() => handleDateChange(initialYear - 1, initialMonth, initialRange)}
            className="flex items-center justify-between px-space-sm py-2 bg-surface-container-low rounded-lg text-left hover:bg-surface-container transition-colors border border-black/5"
          >
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Año</p>
              <p className="font-label-md text-label-md font-bold text-on-surface">{initialYear}</p>
            </div>
            <span className="material-symbols-outlined text-lg text-on-surface-variant">unfold_more</span>
          </button>
          
          <div className="flex items-center justify-between px-space-sm py-2 bg-surface-container-low rounded-lg text-left border border-black/5">
            <button 
              onClick={() => handleDateChange(initialMonth === 1 ? initialYear - 1 : initialYear, initialMonth === 1 ? 12 : initialMonth - 1, 'month')} 
              className="text-on-surface-variant hover:text-black"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <div className="text-center">
              <p className="font-label-sm text-label-sm text-on-surface-variant">Mes</p>
              <p className="font-label-md text-label-md font-bold text-on-surface">{MONTHS[initialMonth - 1]}</p>
            </div>
            <button 
              onClick={() => handleDateChange(initialMonth === 12 ? initialYear + 1 : initialYear, initialMonth === 12 ? 1 : initialMonth + 1, 'month')} 
              className="text-on-surface-variant hover:text-black"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>

          <button className="flex items-center justify-between px-space-sm py-2 bg-surface-container-low rounded-lg text-left hover:bg-surface-container transition-colors border border-black/5">
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Rango</p>
              <p className="font-label-md text-label-md font-bold text-on-surface">
                {initialRange === 'year' ? `Todo ${initialYear}` : 
                 initialRange === '6m' ? 'Últimos 6M' : 
                 `1 - ${new Date(initialYear, initialMonth, 0).getDate()} ${MONTHS[initialMonth - 1].substring(0, 3)}`}
              </p>
            </div>
            <span className="material-symbols-outlined text-lg text-on-surface-variant">calendar_today</span>
          </button>
        </div>

        <div className="flex items-center gap-space-xs overflow-x-auto pb-1 pt-1 scrollbar-none">
          <button 
            onClick={() => handleDateChange(new Date().getFullYear(), new Date().getMonth() + 1, 'month')} 
            className={`px-3 py-1 rounded-full font-label-sm text-label-sm whitespace-nowrap shadow-sm hover:scale-105 transition-transform ${isCurrentMonth ? 'bg-primary-container text-on-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            Mes Actual
          </button>
          <button 
            onClick={() => handleDateChange(initialYear, initialMonth, 'year')}
            className={`px-3 py-1 rounded-full font-label-sm text-label-sm whitespace-nowrap transition-colors ${initialRange === 'year' ? 'bg-primary-container text-on-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            Año Completo
          </button>
          <button 
            onClick={() => handleDateChange(new Date().getFullYear(), new Date().getMonth() + 1, '6m')}
            className={`px-3 py-1 rounded-full font-label-sm text-label-sm whitespace-nowrap transition-colors ${initialRange === '6m' ? 'bg-primary-container text-on-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
          >
            Últimos 6M
          </button>
        </div>

        <div className="flex items-center gap-space-xs pt-space-xs">
          <button 
            onClick={() => setActiveAirline('all')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-label-sm text-label-sm font-semibold border transition-all ${activeAirline === 'all' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-surface-container text-on-surface border-black/5 hover:bg-surface-container-highest'}`}
          >
            <span className="material-symbols-outlined text-sm">done_all</span>
            Todas
          </button>
          <button 
            onClick={() => setActiveAirline('7p')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-label-sm text-label-sm font-bold border transition-all ${activeAirline === '7p' ? 'bg-secondary/10 text-secondary border-secondary/30 ring-2 ring-secondary/20' : 'bg-surface-container-lowest text-on-surface-variant border-black/5 opacity-60 hover:opacity-100'}`}
          >
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            AirPanama (7P)
          </button>
          <button 
            onClick={() => setActiveAirline('cm')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-label-sm text-label-sm font-bold border transition-all ${activeAirline === 'cm' ? 'bg-primary-container/10 text-primary-container border-primary-container/30 ring-2 ring-primary-container/20' : 'bg-surface-container-lowest text-on-surface-variant border-black/5 opacity-60 hover:opacity-100'}`}
          >
            <span className="w-2 h-2 rounded-full bg-primary-container"></span>
            Copa (CM)
          </button>
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
            <span className={`inline-flex items-center font-label-sm text-[11px] font-bold px-1.5 py-0.5 rounded ${metrics.otp >= 90 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
              {metrics.otp >= 90 ? '▲ Óptimo' : '▼ Riesgo'}
            </span>
          </div>
          <div>
            <div className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight">{metrics.otp.toFixed(1)}%</div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">A tiempo vs demorados</p>
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

      <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm border border-black/5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Aerolíneas</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Pasajeros transportados por día (Air Panama vs Copa)</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-1 font-label-sm text-[12px] text-secondary font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> Air Panama
            </span>
            <span className="flex items-center gap-1 font-label-sm text-[12px] text-primary-container font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-container"></span> Copa
            </span>
          </div>
        </div>

        <div className="w-full h-48 mt-4 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.dailyChart} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
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
              <Tooltip content={<CustomTooltip monthLabel={MONTHS[initialMonth - 1].substring(0, 3)} />} cursor={{ stroke: '#c4c6ce', strokeWidth: 1, strokeDasharray: '4 4' }} />
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
                    empty: Math.max(0, (metrics.totalCap * (metrics.apCount / metrics.total)) - metrics.totalPaxAP), // Approx max cap per airline
                    fill: '#bb001d'
                  },
                  { 
                    name: 'Copa', 
                    pax: metrics.totalPaxCM, 
                    empty: Math.max(0, (metrics.totalCap * (metrics.cmCount / metrics.total)) - metrics.totalPaxCM), 
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
