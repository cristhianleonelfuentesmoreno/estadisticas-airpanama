"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  rawFlights: any[];
  initialYear: number;
  initialMonth: number;
  initialRange: string;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

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

    const dailyDataMap: Record<string, { day: string, cm: number, p7: number }> = {};
    
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

      // Si hay filtro de aerolínea, saltar los cálculos de OTP/LoadFactor de la aerolínea excluida
      if (activeAirline === '7p' && !isAP) return;
      if (activeAirline === 'cm' && isAP) return;

      filteredTotal++;

      const estado = f.estado_final?.toUpperCase() || '';
      if (estado !== 'DEMORADO' && estado !== 'RETRASADO' && estado !== 'CANCELADO') {
        onTimeCount++;
      }

      if (f.capacidad_total > 0) {
        totalPax += (f.pasajeros_abordo || 0);
        totalCap += f.capacidad_total;
      }
    });

    const otp = filteredTotal > 0 ? (onTimeCount / filteredTotal) * 100 : 0;
    const loadFactor = totalCap > 0 ? (totalPax / totalCap) * 100 : 0;
    const dailyChart = Object.values(dailyDataMap).sort((a, b) => parseInt(a.day) - parseInt(b.day));

    return {
      total: rawFlights.length,
      filteredTotal,
      apCount,
      cmCount,
      otp,
      loadFactor,
      dailyChart
    };
  }, [rawFlights, activeAirline, initialYear, initialMonth]);

  const apPercent = metrics.total > 0 ? Math.round((metrics.apCount / metrics.total) * 100) : 0;
  const cmPercent = metrics.total > 0 ? Math.round((metrics.cmCount / metrics.total) * 100) : 0;

  const handleDateChange = (year: number, month: number, range: string) => {
    router.push(`/dashboard/mensual?year=${year}&month=${month}&range=${range}`);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-primary-container text-on-primary px-3 py-2 rounded-lg shadow-xl text-center pointer-events-none border border-white/10">
          <p className="font-label-sm text-label-sm font-bold text-secondary-fixed mb-1">{label} {MONTHS[initialMonth - 1].substring(0, 3)}</p>
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

        <div className="grid grid-cols-3 gap-space-xs pt-space-xs">
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
            <div className="flex justify-between font-label-sm text-[10px]">
              <span className={`text-secondary font-semibold ${activeAirline === 'cm' ? 'opacity-40' : ''}`}>Air Panama: {metrics.apCount}</span>
              <span className={`text-primary-container font-semibold ${activeAirline === '7p' ? 'opacity-40' : ''}`}>Copa: {metrics.cmCount}</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-sm rounded-xl shadow-sm flex flex-col justify-between space-y-space-xs border border-black/5">
          <div className="flex items-start justify-between">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">OTP {activeAirline !== 'all' && (activeAirline === '7p' ? '(Air Panama)' : '(Copa)')}</span>
            <span className={`inline-flex items-center font-label-sm text-[10px] font-bold px-1.5 py-0.5 rounded ${metrics.otp >= 90 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
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

      <section className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm border border-black/5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">Aerolíneas</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Pasajeros transportados por día (Air Panama vs Copa)</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-1 font-label-sm text-[11px] text-secondary font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> Air Panama
            </span>
            <span className="flex items-center gap-1 font-label-sm text-[11px] text-primary-container font-bold">
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
    </div>
  );
}
