"use server";

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
  period: string; // e.g. "07:00 AM - 12:00 PM"
  text: string;   // e.g. "Viento 10 nudos, Lluvia ligera"
  color: StatusColor;
}

export interface FlightDecision {
  icao: string;
  name: string;
  statusColor: StatusColor;
  statusText: string;
  forecasts: ProcessedForecast[];
  rawTAF: string;
}

function translateWeather(wx: string | null): string {
  if (!wx) return '';
  const translations: Record<string, string> = {
    'TSRA': 'Tormenta con lluvia',
    'TS': 'Tormentas',
    'RA': 'Lluvia',
    'SHRA': 'Chubascos',
    'VCTS': 'Tormentas en cercanías',
    'BR': 'Bruma',
    'FG': 'Niebla densa',
    'HZ': 'Calima',
    'DZ': 'Llovizna'
  };
  
  // Buscar coincidencia exacta
  if (translations[wx]) return translations[wx];
  
  // Buscar parcial si es muy compuesto
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

  if (wx.includes('TS') || wx.includes('FG') || maxWind > 25) {
    return 'red';
  }
  if (wx.includes('RA') || wx.includes('BR') || maxWind >= 15) {
    return 'yellow';
  }
  return 'green';
}

function getOverallStatus(colors: StatusColor[]): { color: StatusColor, text: string } {
  if (colors.includes('red')) return { color: 'red', text: 'Alerta: Posibles demoras por clima' };
  if (colors.includes('yellow')) return { color: 'yellow', text: 'Precaución: Condiciones marginales' };
  return { color: 'green', text: 'Condiciones favorables para el vuelo' };
}

export async function getFlightDecisions(): Promise<FlightDecision[]> {
  try {
    const res = await fetch("https://aviationweather.gov/api/data/taf?ids=MPDA,MPMG,MPTO,MPBO,MPCE&format=json", {
      next: { revalidate: 300 } // Caché por 5 minutos
    });
    
    if (!res.ok) throw new Error("Fallo al obtener TAF");
    
    const data: TafResponse[] = await res.json();
    const now = Math.floor(Date.now() / 1000);
    const eightHoursLater = now + (8 * 3600);

    const decisions: FlightDecision[] = data.map(station => {
      // Filtrar pronósticos dentro de las próximas 8 horas
      // timeTo > now && timeFrom < eightHoursLater
      const relevantFcsts = station.fcsts.filter(f => f.timeTo > now && f.timeFrom < eightHoursLater);
      
      const processedForecasts: ProcessedForecast[] = relevantFcsts.map(f => {
        // Formatear periodo de tiempo
        const dFrom = new Date(f.timeFrom * 1000);
        const dTo = new Date(f.timeTo * 1000);
        const formatOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
        const period = `${dFrom.toLocaleTimeString('es-PA', formatOptions)} - ${dTo.toLocaleTimeString('es-PA', formatOptions)}`;
        
        // Formatear texto
        const windText = f.wdir === 'VRB' ? `Viento Variable a ${f.wspd}kt` : `Viento ${f.wdir}°/${f.wspd}kt`;
        const wxText = translateWeather(f.wxString);
        
        let text = windText;
        if (f.wgst) text += ` ráfagas ${f.wgst}kt`;
        if (wxText) text += ` • ${wxText}`;
        
        // Nubes (opcional, si es TCU o CB lo destacamos)
        const scaryClouds = f.clouds?.filter(c => c.type === 'CB' || c.type === 'TCU') || [];
        if (scaryClouds.length > 0) {
           text += ` • Nubes de desarrollo (${scaryClouds.map(c => c.type).join(', ')})`;
        }

        return {
          period,
          text,
          color: determineColor(f)
        };
      });

      const overall = getOverallStatus(processedForecasts.map(f => f.color));

      let nombreCorto = station.name;
      if (station.icaoId === 'MPDA') nombreCorto = 'DAVID';
      if (station.icaoId === 'MPMG') nombreCorto = 'PANAMÁ ALBROOK';
      if (station.icaoId === 'MPTO') nombreCorto = 'PANAMÁ TOCUMEN';
      if (station.icaoId === 'MPBO') nombreCorto = 'BOCAS DEL TORO';
      if (station.icaoId === 'MPCE') nombreCorto = 'CHITRÉ';

      return {
        icao: station.icaoId,
        name: nombreCorto,
        statusColor: overall.color,
        statusText: overall.text,
        forecasts: processedForecasts,
        rawTAF: station.rawTAF
      };
    });

    // Ordenar para mostrar de forma consistente (ej. Panamá primero, luego David, etc.)
    const order = ['MPMG', 'MPTO', 'MPDA', 'MPBO', 'MPCE'];
    return decisions.sort((a, b) => order.indexOf(a.icao) - order.indexOf(b.icao));

  } catch (error) {
    console.error("Error en getFlightDecisions:", error);
    return [];
  }
}
