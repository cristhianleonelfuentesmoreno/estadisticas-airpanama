"use server";

import { requireApprovedUser } from "@/lib/auth";

interface TafForecast {
  timeFrom: number;
  timeTo: number;
  wdir: number | string | null;
  wspd: number | null;
  wgst: number | null;
  wxString: string | null;
  clouds: Array<{ cover: string; base: number; type: string | null }>;
}

interface TafResponse {
  icaoId: string;
  name: string;
  rawTAF: string;
  fcsts: TafForecast[];
}

export type StatusColor = 'green' | 'yellow' | 'red';

export interface ProcessedForecast {
  period: string; // e.g. "07:00 - 13:00"
  shortPeriod: string; // e.g. "07 - 13h"
  text: string;   // e.g. "Vto 300°/6kt • Nubes T..."
  color: StatusColor;
  isCritical: boolean;
}

export interface FlightDecision {
  icao: string;
  name: string;
  fullName: string;
  statusColor: StatusColor;
  statusText: string;
  shortAlert: string; // e.g. "ALERTA TSRA" o "VFR ÓPTIMO"
  criticalWindow: string | null; // e.g. "13:00 - 17:00"
  forecasts: ProcessedForecast[];
  rawTAF: string;
}

function translateWeather(wx: string | null): string {
  if (!wx) return '';
  const translations: Record<string, string> = {
    'TSRA': 'Tormenta con Lluvia',
    'TS': 'Tormenta Eléctrica',
    'RA': 'Lluvia',
    'SHRA': 'Lluvia Aislada (Chubascos)',
    'VCTS': 'Tormentas en la Cercanía',
    'BR': 'Visibilidad Reducida (Bruma)',
    'FG': 'Niebla Densa',
    'HZ': 'Calima',
    'DZ': 'Llovizna'
  };
  
  if (translations[wx]) return translations[wx];
  
  let translated = wx;
  Object.keys(translations).forEach(key => {
    translated = translated.replace(key, translations[key]);
  });
  return translated !== wx ? translated : wx;
}

function determineColor(fcst: TafForecast): StatusColor {
  const wx = fcst.wxString || '';
  const wind = fcst.wspd || 0;
  const gust = fcst.wgst || 0;
  const maxWind = Math.max(wind, gust);

  if (wx.includes('TS') || wx.includes('FG') || maxWind > 25) return 'red';
  if (wx.includes('RA') || wx.includes('BR') || maxWind >= 15) return 'yellow';
  return 'green';
}

function getShortAlert(colors: StatusColor[], fcsts: TafForecast[]): string {
  if (colors.includes('red')) {
    const worst = fcsts.find(f => determineColor(f) === 'red');
    if (worst?.wxString?.includes('TS')) return 'RIESGO ALTO: TORMENTAS';
    if (worst?.wxString?.includes('FG')) return 'RIESGO ALTO: NIEBLA';
    return 'RIESGO ALTO: VIENTOS FUERTES';
  }
  if (colors.includes('yellow')) {
    const warn = fcsts.find(f => determineColor(f) === 'yellow');
    if (warn?.wxString?.includes('BR')) return 'PRECAUCIÓN: BRUMA';
    if (warn?.wxString?.includes('RA')) return 'PRECAUCIÓN: PISTA MOJADA';
    return 'PRECAUCIÓN OPERATIVA';
  }
  return 'OPERACIÓN NORMAL';
}

function getOverallStatus(colors: StatusColor[]): { color: StatusColor, text: string } {
  if (colors.includes('red')) return { color: 'red', text: 'Alerta: Posibles demoras por clima' };
  if (colors.includes('yellow')) return { color: 'yellow', text: 'Precaución: Condiciones marginales' };
  return { color: 'green', text: 'Condiciones favorables para el vuelo' };
}

export async function getFlightDecisions(): Promise<FlightDecision[]> {
  await requireApprovedUser();
  try {
    const res = await fetch("https://aviationweather.gov/api/data/taf?ids=MPDA,MPMG,MPTO,MPBO,MPCE&format=json", {
      next: { revalidate: 300 }
    });
    
    if (!res.ok) throw new Error("Fallo al obtener TAF");
    
    const data: TafResponse[] = await res.json();
    const now = Math.floor(Date.now() / 1000);
    const eightHoursLater = now + (8 * 3600);

    const decisions: FlightDecision[] = data.map(station => {
      const relevantFcsts = station.fcsts.filter(f => f.timeTo > now && f.timeFrom < eightHoursLater);
      
      const processedForecasts: ProcessedForecast[] = relevantFcsts.map(f => {
        const dFrom = new Date(f.timeFrom * 1000);
        const dTo = new Date(f.timeTo * 1000);
        const formatOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
        const period = `${dFrom.toLocaleTimeString('es-PA', formatOptions)} - ${dTo.toLocaleTimeString('es-PA', formatOptions)}`;
        const shortPeriod = `${dFrom.toLocaleTimeString('es-PA', {hour: '2-digit', hour12:false})} - ${dTo.toLocaleTimeString('es-PA', {hour: '2-digit', hour12:false})}h`;
        
        const windText = f.wdir === 'VRB' ? `Viento variable a ${f.wspd} nudos` : `Viento a ${f.wspd} nudos`;
        const wxText = translateWeather(f.wxString);
        
        let text = windText;
        if (f.wgst) text += ` con ráfagas de ${f.wgst} nudos`;
        
        const scaryClouds = f.clouds?.filter(c => c.type === 'CB' || c.type === 'TCU') || [];
        if (wxText) {
          text += ` • ${wxText}`;
          if (scaryClouds.length > 0) text += ` • Riesgo de Turbulencia/Rayos`;
        } else {
          if (scaryClouds.length > 0) {
            text += ` • Riesgo de Turbulencia/Rayos`;
          } else {
            text += ` • Cielo Despejado (Óptimo)`;
          }
        }

        const color = determineColor(f);
        return { period, shortPeriod, text, color, isCritical: color === 'red' || color === 'yellow' };
      });

      const colors = processedForecasts.map(f => f.color);
      const overall = getOverallStatus(colors);
      const shortAlert = getShortAlert(colors, relevantFcsts);
      
      // Buscar la ventana crítica
      const criticalBlock = processedForecasts.find(f => f.isCritical);
      const criticalWindow = criticalBlock ? criticalBlock.period : null;

      let nombreCorto = station.name;
      let fullName = station.name;
      if (station.icaoId === 'MPDA') { nombreCorto = 'David, Chiriquí'; fullName = 'Enrique Malek'; }
      if (station.icaoId === 'MPMG') { nombreCorto = 'Panamá Albrook'; fullName = 'Marcos A. Gelabert'; }
      if (station.icaoId === 'MPTO') { nombreCorto = 'Panamá Tocumen'; fullName = 'Aeropuerto Internacional'; }
      if (station.icaoId === 'MPBO') { nombreCorto = 'Bocas del Toro'; fullName = 'Isla Colón'; }
      if (station.icaoId === 'MPCE') { nombreCorto = 'Chitré'; fullName = 'Alonso Valderrama'; }

      return {
        icao: station.icaoId,
        name: nombreCorto,
        fullName,
        statusColor: overall.color,
        statusText: overall.text,
        shortAlert,
        criticalWindow,
        forecasts: processedForecasts,
        rawTAF: station.rawTAF
      };
    });

    const order = ['MPMG', 'MPTO', 'MPDA', 'MPBO', 'MPCE'];
    return decisions.sort((a, b) => order.indexOf(a.icao) - order.indexOf(b.icao));

  } catch (error) {
    console.error("Error en getFlightDecisions:", error);
    return [];
  }
}
