// Métricas de Reportes. Funciones puras: las usan la página, la exportación a Excel
// y el PDF, así los tres muestran exactamente los mismos números.

// Fila de llegadas_malek_historico / salidas_malek_historico
export interface ReporteVuelo {
  id?: string;
  fecha: string;
  aerolinea: string | null;
  numero_vuelo: string | null;
  origen?: string | null;   // solo llegadas
  destino?: string | null;  // solo salidas
  estado_final: string | null;
  pasajeros_abordo: number | null;
  capacidad_total: number;
  hora_itinerario: string | null;
  hora_real_llegada?: string | null;
  hora_real_salida?: string | null;
  matricula?: string | null;
  avion?: string | null;
  handler?: string | null;
  stand?: string | null;
  servicio?: string | null;
  notas?: string | null;
}

export type ReportRange = 'month' | 'year' | '6m';
export type ReportAirline = 'all' | '7p' | 'cm';

export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const AIRLINE_LABEL: Record<ReportAirline, string> = {
  all: 'Todas las aerolíneas',
  '7p': 'Air Panama',
  cm: 'Copa Airlines',
};

export type ChartPoint = { key: string; label: string; tip: string; cm: number; p7: number };

export const isAirPanama = (f: ReporteVuelo) => f.aerolinea === 'Air Panama' || !!f.numero_vuelo?.startsWith('7P');
// Las llegadas tienen origen; las salidas, destino
export const isLlegada = (f: ReporteVuelo) => !!f.origen;

export const matchesAirline = (f: ReporteVuelo, airline: ReportAirline) =>
  airline === 'all' || (airline === '7p') === isAirPanama(f);

// Hora (0-23) en Panamá de un timestamp ISO; acepta también "HH:MM" por si hay datos viejos
function horaPanama(value: string): number {
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return Number(d.toLocaleString('en-US', { timeZone: 'America/Panama', hour: '2-digit', hourCycle: 'h23' }));
  }
  return parseInt(value.split(':')[0], 10);
}

// "Septiembre 2026" · "2026" · "Abr – Sep 2026"
export function periodLabel(year: number, month: number, range: ReportRange) {
  if (range === 'year') return `${year}`;
  if (range === '6m') {
    const start = new Date(year, month - 6, 1);
    return `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getFullYear() !== year ? start.getFullYear() + ' ' : ''}– ${MONTHS[month - 1].slice(0, 3)} ${year}`;
  }
  return `${MONTHS[month - 1]} ${year}`;
}

export function computeReportMetrics(
  rawFlights: ReporteVuelo[],
  airline: ReportAirline,
  year: number,
  month: number,
  range: ReportRange,
) {
  let apCount = 0;
  let cmCount = 0;
  let filteredTotal = 0;
  let llegadas = 0;
  let salidas = 0;
  let onTimeCount = 0;
  let otpBase = 0; // vuelos con los que se puede medir puntualidad
  let totalPax = 0;
  let totalCap = 0;
  let totalPaxAP = 0;
  let totalPaxCM = 0;
  let totalCapAP = 0;
  let totalCapCM = 0;

  // Por día en la vista de un mes; por mes en año y 6 meses (si no, se sumaría
  // el "día 5" de todos los meses en un solo punto)
  const byMonth = range === 'year' || range === '6m';
  const dailyDataMap: Record<string, ChartPoint> = {};
  const routeDataMap: Record<string, { route: string; airline: string; pax: number; cap: number; flights: number }> = {};
  const hourlyDataMap: Record<number, number> = {};
  for (let i = 0; i < 24; i++) hourlyDataMap[i] = 0;

  if (byMonth) {
    const count = range === 'year' ? 12 : 6;
    const first = range === 'year' ? new Date(year, 0, 1) : new Date(year, month - 6, 1);
    for (let i = 0; i < count; i++) {
      const d = new Date(first.getFullYear(), first.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      dailyDataMap[key] = { key, label: MONTHS[d.getMonth()].slice(0, 3), tip: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, cm: 0, p7: 0 };
    }
  } else {
    const daysInMonth = new Date(year, month, 0).getDate();
    const abbr = MONTHS[month - 1].slice(0, 3);
    for (let i = 1; i <= daysInMonth; i++) {
      const key = String(i).padStart(2, '0');
      dailyDataMap[key] = { key, label: key, tip: `${i} ${abbr} ${year}`, cm: 0, p7: 0 };
    }
  }

  rawFlights.forEach(f => {
    const isAP = isAirPanama(f);

    // Contar siempre los totales para las barras de progreso
    if (isAP) apCount++;
    else cmCount++;

    const pax = f.pasajeros_abordo || 0;
    const point = dailyDataMap[byMonth ? f.fecha.slice(0, 7) : f.fecha.split('-')[2]];
    if (point) {
      if (isAP) point.p7 += pax;
      else point.cm += pax;
    }

    // Si hay filtro de aerolínea, saltar los cálculos posteriores si no aplica
    if (!matchesAirline(f, airline)) return;

    filteredTotal++;
    if (isLlegada(f)) llegadas++;
    else salidas++;

    // Puntualidad: solo vuelos con hora real registrada (los importados del Excel no
    // tienen hora) o con un estado que ya dice que no fue puntual
    const estado = f.estado_final?.toUpperCase() || '';
    const late = estado === 'DEMORADO' || estado === 'RETRASADO' || estado === 'CANCELADO';
    if (late || f.hora_real_llegada || f.hora_real_salida) {
      otpBase++;
      if (!late) onTimeCount++;
    }

    if (f.capacidad_total > 0) {
      totalPax += pax;
      totalCap += f.capacidad_total;
      if (isAP) { totalPaxAP += pax; totalCapAP += f.capacidad_total; }
      else { totalPaxCM += pax; totalCapCM += f.capacidad_total; }
    }

    // Agrupar por ruta
    const remoteNode = isLlegada(f) ? f.origen : f.destino;
    if (remoteNode) {
      const routeKey = `DAV ⇄ ${remoteNode}`;
      if (!routeDataMap[routeKey]) routeDataMap[routeKey] = { route: routeKey, airline: isAP ? 'Air Panama' : 'Copa', pax: 0, cap: 0, flights: 0 };
      routeDataMap[routeKey].pax += pax;
      routeDataMap[routeKey].cap += f.capacidad_total;
      routeDataMap[routeKey].flights += 1;
    }

    // Heatmap (franja horaria real o itinerario)
    const timeStr = f.hora_real_llegada || f.hora_real_salida || f.hora_itinerario;
    if (timeStr) {
      const hour = horaPanama(timeStr);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) hourlyDataMap[hour] += pax;
    }
  });

  const otp = otpBase > 0 ? (onTimeCount / otpBase) * 100 : 0;
  const loadFactor = totalCap > 0 ? (totalPax / totalCap) * 100 : 0;
  const dailyChart = Object.values(dailyDataMap).sort((a, b) => a.key.localeCompare(b.key));

  const routesChart = Object.values(routeDataMap).map(r => ({
    route: r.route,
    airline: r.airline,
    lf: r.cap > 0 ? (r.pax / r.cap) * 100 : 0,
    pax: r.pax,
    flights: r.flights,
  })).sort((a, b) => b.lf - a.lf);

  const maxHourPax = Math.max(1, ...Object.values(hourlyDataMap));
  const heatmapChart = Object.entries(hourlyDataMap).map(([hour, pax]) => ({
    hour: `${hour.padStart(2, '0')}:00`,
    pax,
    intensity: pax / maxHourPax,
  }));

  return {
    total: rawFlights.length,
    filteredTotal,
    llegadas,
    salidas,
    apCount,
    cmCount,
    otp,
    otpBase,
    loadFactor,
    dailyChart,
    byMonth,
    totalPaxAP,
    totalPaxCM,
    totalCapAP,
    totalCapCM,
    totalCap,
    totalPax,
    routesChart,
    heatmapChart,
    hasHourlyData: heatmapChart.some(h => h.pax > 0),
  };
}

export type ReportMetrics = ReturnType<typeof computeReportMetrics>;
