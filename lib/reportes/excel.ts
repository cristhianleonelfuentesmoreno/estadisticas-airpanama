// Exportación de Reportes a Excel: la tabla completa de vuelos + un resumen.
// Se ejecuta en el navegador (xlsx genera el archivo y lo descarga).
import * as XLSX from 'xlsx';
import {
  AIRLINE_LABEL, isAirPanama, isLlegada, matchesAirline, periodLabel,
  type ReportAirline, type ReportMetrics, type ReportRange, type ReporteVuelo,
} from './metrics';

export const STATION = 'Estación Aeropuerto Internacional Enrique Malek';

type Opts = { year: number; month: number; range: ReportRange; airline: ReportAirline; generatedAt: string };

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

export function buildReportWorkbook(rows: ReporteVuelo[], metrics: ReportMetrics, o: Opts) {
  const period = periodLabel(o.year, o.month, o.range);
  const header = [
    ['AirPanama · Reporte de operaciones'],
    [STATION],
    [`Periodo: ${period}  ·  Aerolínea: ${AIRLINE_LABEL[o.airline]}  ·  Generado: ${o.generatedAt}`],
    [],
  ];

  // --- Hoja 1: vuelos -------------------------------------------------------
  const flights = rows
    .filter(f => matchesAirline(f, o.airline))
    .sort((a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      Number(isLlegada(b)) - Number(isLlegada(a)) ||
      (a.numero_vuelo ?? '').localeCompare(b.numero_vuelo ?? '')
    );

  const columns = ['Fecha', 'Tipo', 'Aerolínea', 'Vuelo', 'Origen', 'Destino', 'Matrícula', 'Avión',
    'Pasajeros', 'Capacidad', 'Ocupación %', 'Estado', 'Handler', 'Stand', 'Servicio', 'Notas'];
  const body = flights.map(f => {
    const llegada = isLlegada(f);
    const pax = f.pasajeros_abordo ?? 0;
    return [
      f.fecha,
      llegada ? 'Llegada' : 'Salida',
      isAirPanama(f) ? 'Air Panama' : 'Copa Airlines',
      f.numero_vuelo ?? '',
      llegada ? f.origen ?? '' : 'DAV',
      llegada ? 'DAV' : f.destino ?? '',
      f.matricula ?? '',
      f.avion ?? '',
      pax,
      f.capacidad_total ?? 0,
      pct(pax, f.capacidad_total ?? 0),
      f.estado_final ?? '',
      f.handler ?? '',
      f.stand ?? '',
      f.servicio ?? '',
      f.notas ?? '',
    ];
  });
  const totalPax = flights.reduce((s, f) => s + (f.pasajeros_abordo ?? 0), 0);
  const totalCap = flights.reduce((s, f) => s + (f.capacidad_total ?? 0), 0);
  const totals = ['TOTAL', `${flights.length} vuelos`, '', '', '', '', '', '', totalPax, totalCap, pct(totalPax, totalCap)];

  const vuelos = XLSX.utils.aoa_to_sheet([...header, columns, ...body, [], totals]);
  const headerRow = header.length; // índice 0 de la fila de títulos
  vuelos['!cols'] = [12, 9, 14, 11, 8, 8, 11, 8, 10, 10, 12, 11, 24, 7, 9, 40].map(wch => ({ wch }));
  vuelos['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + body.length, c: columns.length - 1 } }),
  };
  vuelos['!merges'] = [0, 1, 2].map(r => ({ s: { r, c: 0 }, e: { r, c: 7 } }));

  // --- Hoja 2: resumen ------------------------------------------------------
  const m = metrics;
  const resumenRows: (string | number)[][] = [
    ...header,
    ['Indicador', 'Valor'],
    ['Total de vuelos', m.filteredTotal],
    ['Llegadas', m.llegadas],
    ['Salidas', m.salidas],
    ['Pasajeros transportados', m.totalPax],
    ['Asientos ofertados', m.totalCap],
    ['Ocupación promedio (Load factor) %', Math.round(m.loadFactor * 10) / 10],
    ['Puntualidad (OTP) %', m.otpBase > 0 ? Math.round(m.otp * 10) / 10 : 'Sin horas registradas'],
    [],
    ['Aerolínea', 'Vuelos', 'Pasajeros', 'Asientos', 'Ocupación %'],
  ];
  if (o.airline !== 'cm') resumenRows.push(['Air Panama', m.apCount, m.totalPaxAP, m.totalCapAP, pct(m.totalPaxAP, m.totalCapAP)]);
  if (o.airline !== '7p') resumenRows.push(['Copa Airlines', m.cmCount, m.totalPaxCM, m.totalCapCM, pct(m.totalPaxCM, m.totalCapCM)]);
  resumenRows.push([], [m.byMonth ? 'Mes' : 'Día', 'Pasajeros Air Panama', 'Pasajeros Copa']);
  for (const p of m.dailyChart) {
    resumenRows.push([
      p.tip,
      o.airline === 'cm' ? '' : p.p7,
      o.airline === '7p' ? '' : p.cm,
    ]);
  }
  resumenRows.push([], ['Ruta', 'Aerolínea', 'Vuelos', 'Pasajeros', 'Ocupación %']);
  for (const r of m.routesChart) resumenRows.push([r.route, r.airline, r.flights, r.pax, Math.round(r.lf * 10) / 10]);

  const resumen = XLSX.utils.aoa_to_sheet(resumenRows);
  resumen['!cols'] = [36, 20, 16, 12, 12].map(wch => ({ wch }));
  resumen['!merges'] = [0, 1, 2].map(r => ({ s: { r, c: 0 }, e: { r, c: 4 } }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, vuelos, 'Vuelos');
  XLSX.utils.book_append_sheet(wb, resumen, 'Resumen');
  wb.Props = { Title: `Reporte AirPanama ${period}`, Author: 'AirPanama · Ops BI' };
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(wb, fileName, { compression: true });
}
