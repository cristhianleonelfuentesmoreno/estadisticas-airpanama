"use server";

import { GoogleGenAI } from "@google/genai";
import { getApiConfigs } from "./apiConfig";
import { createWorker, PSM } from "tesseract.js";

export interface ParsedFlight {
  flightNumber: string;
  origin: string;
  destination: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  airline: string;
  flightDate?: string;
  aircraft?: string;
  aircraftReg?: string;
  paxCount?: number;
  pilot?: string;
  paxMax?: number;
}

// Diccionario de capacidades máximas de la flota de Air Panama
// Diccionario de capacidades máximas de la flota de Air Panama
const AIRCRAFT_CAPACITY_MAP: Record<string, number> = {
  'FK50': 50,
  'DH8D': 74,
  'C-208': 12,
  'C208': 12, // Por si el OCR se come el guión
};

// Diccionario de tiempos de ruta promedio en minutos para vuelos de Air Panama (Modo Offline)
const ROUTE_TIMES_MAP: Record<string, number> = {
  'PAC-DAV': 55,
  'DAV-PAC': 55,
  'PAC-BOC': 55,
  'BOC-PAC': 55,
  'PAC-CHX': 60,
  'CHX-PAC': 60,
  'BOC-DAV': 40,
  'DAV-BOC': 40,
  'CHX-BOC': 30,
  'BOC-CHX': 30,
};

// Fallback OCR parser for Air Panama itineraries
async function parseWithOCR(base64Data: string, targetDateStr: string): Promise<ParsedFlight[]> {
  console.log("Iniciando Tesseract OCR como respaldo local...");
  const buffer = Buffer.from(base64Data, 'base64');
  const worker = await createWorker('eng');
  
  const { data: { text } } = await worker.recognize(buffer);
  await worker.terminate();

  console.log("OCR completado, buscando patrones de vuelos y aviones...");
  console.log("TEXTO CRUDO OCR:", text);
  
  const flights: ParsedFlight[] = [];
  const lines = text.split('\n');
  
  let currentAircraft = '';
  let currentReg = '';
  let currentPaxMax = 0;

  for (const line of lines) {
    // Buscar modelo de avión al inicio (ej: DH8D, FK50, C-208) seguido por la hora
    const aircraftMatch = line.match(/^([A-Z0-9-]{4,6})\s+\d{1,2}:\d{2}/);
    if (aircraftMatch) {
      const val = aircraftMatch[1];
      if (val.startsWith('HP-')) {
        currentReg = val;
      } else {
        currentAircraft = val;
        currentReg = ''; // <-- Limpiar la matrícula vieja al cambiar de avión
        // Asignar capacidad de la flota si existe
        currentPaxMax = AIRCRAFT_CAPACITY_MAP[val] || 0;
      }
    } else {
      // Buscar matrícula (HP-XXXX) al inicio seguido por la hora
      const regMatch = line.match(/^(HP-\d{3,4})\s+\d{1,2}:\d{2}/);
      if (regMatch) {
        currentReg = regMatch[1];
      }
    }

    // Buscar el vuelo en sí en la línea
    const flightMatch = line.match(/\b(\d{1,2}:\d{2})\s+(\d{3,4})\s+([A-Z]{3}-[A-Z]{3})\b/);
    if (flightMatch) {
      const time = flightMatch[1];
      const flightNumber = flightMatch[2];
      const route = flightMatch[3];
      const [origin, dest] = route.split('-');

      // Obtener el resto de la línea después de la ruta para extraer la tripulación y los pasajeros
      const restOfLine = line.substring(flightMatch.index! + flightMatch[0].length).trim();

      // Intentar extraer los pasajeros buscando la última secuencia de números en la línea
      // Esto ignora puntos, basura, y letras rotas al final.
      const paxMatches = restOfLine.match(/\d+/g);
      let paxCount = undefined;
      
      if (paxMatches && paxMatches.length > 0) {
        const lastMatch = paxMatches[paxMatches.length - 1];
        paxCount = parseInt(lastMatch, 10);
      }
      
      // Lo que queda antes del último número (o todo si no hay número) es la tripulación
      let pilot = restOfLine;
      if (paxMatches && paxMatches.length > 0) {
        const lastMatchStr = paxMatches[paxMatches.length - 1];
        const lastIndex = restOfLine.lastIndexOf(lastMatchStr);
        pilot = restOfLine.substring(0, lastIndex).trim();
      }
      
      // Limpiar texto basura del final del piloto (a veces saca 'Si', 'No', etc.)
      pilot = pilot.replace(/\b(Si|No|Pax)\b.*$/i, '').replace(/[^a-zA-Z\s/]+$/, '').trim();

      // Calcular hora de llegada estimada basada en ROUTE_TIMES_MAP (Modo Offline)
      let arrivalTimeLocal = "00:00";
      try {
        const [hours, minutes] = time.split(':').map(Number);
        const dateObj = new Date();
        dateObj.setHours(hours, minutes, 0, 0);
        
        // Buscar tiempo estimado, default a 60 min si la ruta no está en el mapa
        const routeKey = `${origin}-${dest}`;
        const flightDurationMins = ROUTE_TIMES_MAP[routeKey] || 60;
        
        dateObj.setMinutes(dateObj.getMinutes() + flightDurationMins);
        
        const arrHours = String(dateObj.getHours()).padStart(2, '0');
        const arrMins = String(dateObj.getMinutes()).padStart(2, '0');
        arrivalTimeLocal = `${arrHours}:${arrMins}`;
      } catch (e) {
        // Fallback silently
      }

      flights.push({
        flightNumber,
        origin,
        destination: dest,
        departureTimeLocal: time,
        arrivalTimeLocal,
        airline: "Air Panama",
        flightDate: targetDateStr,
        aircraft: currentAircraft,
        aircraftReg: currentReg,
        paxCount,
        pilot: pilot || undefined,
        paxMax: currentPaxMax || undefined
      });
    }
  }
  
  if (flights.length === 0) {
    throw new Error("El motor OCR local no pudo encontrar ningún vuelo en la imagen. La calidad puede ser muy baja.");
  }

  return flights;
}

// --------------------------------------------------------------------------
// Helper: convert "06:30AM" or "06:30" -> "06:30" (24-hr, no seconds)
// --------------------------------------------------------------------------
function formatAmPmTo24h(timeStr: string): string {
  if (!timeStr) return "00:00";
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return "00:00";
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = (match[3] || "").toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

// --------------------------------------------------------------------------
// Copa Airlines: parse monthly itinerary image using Gemini Vision
// --------------------------------------------------------------------------
async function parseCopaMonthlyImage(base64Data: string, targetDateStr: string): Promise<ParsedFlight[]> {
  const { GoogleGenAI } = await import("@google/genai");
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("Falta la variable GEMINI_API_KEY en el entorno.");

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const COPA_PROMPT = `Eres un sistema experto en Visión por Computadora y extracción de datos tabulares de aviación. Tu objetivo es convertir la imagen de la programación mensual de vuelos en una estructura de datos JSON limpia y precisa.

Sigue estos pasos estrictamente para procesar la imagen:

PASO 1: LEER EL ENCABEZADO Y METADATOS
1. Extrae el título principal de la tabla (ej. "ITINERARIO DE VUELOS CM SEPTIEMBRE-RV00-2026").
2. Identifica los bloques de columnas. Cada bloque contiene:
   - Rotación (ej. "ROTACION DE 41 MIN")
   - Vuelos de Ida y Vuelta asociadas a esa columna:
     * Código de Vuelo (ej. CM13 y CM11)
     * Ruta (ej. PTY/DAV y DAV/PTY)
     * ETD (Hora estimada de salida) y ETA (Hora estimada de llegada)

PASO 2: MAQUETAR EL ESQUEMA DE DATOS
Asocia cada una de las columnas principales de vuelos a su par correspondiente.

PASO 3: RECORRER FILA POR FILA (DÍAS DEL MES)
Para cada fila desde el día 1 hasta el último día:
1. Registra el día de la semana y el número de día.
2. Para cada columna, verifica qué valor hay en la celda:
   - Si contiene un código de vuelo (ej. "CM11", "CM18"), regístralo.
   - Si contiene una "X", no lo incluyas en vuelos_programados (el vuelo no opera ese día).
3. En vuelos_programados incluye SOLAMENTE los vuelos que SÍ operan (no incluyas las X).

PASO 4: ESTRUCTURA DE SALIDA (JSON)
Devuelve ÚNICAMENTE este JSON, sin texto adicional ni bloques de código:

{
  "titulo": "ITINERARIO DE VUELOS CM SEPTIEMBRE-RV00-2026",
  "bloques_rotacion": [
    {
      "rotacion": "ROTACION DE 41 MIN",
      "vuelo_ida": {"codigo": "CM13", "ruta": "PTY/DAV", "etd": "06:30AM", "eta": "07:45AM"},
      "vuelo_vuelta": {"codigo": "CM11", "ruta": "DAV/PTY", "etd": "08:26AM", "eta": "09:39AM"}
    }
  ],
  "itinerario_diario": [
    {
      "dia_semana": "MA",
      "dia_numero": 1,
      "vuelos_programados": ["CM18", "CM30"],
      "total_vuelos_dia": 2
    }
  ],
  "total_vuelos_mes": 87
}`;

  // Retry up to 3 times on 503 overloaded
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          COPA_PROMPT,
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/png",
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      } as any);

      const rawText = (response as any).text?.trim() || "";
      const jsonText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      const data = JSON.parse(jsonText);

      // Build a lookup map: flightCode -> { ruta, etd, eta }
      const rotationMap: Record<string, { ruta: string; etd: string; eta: string; codigo: string }> = {};
      (data.bloques_rotacion || []).forEach((bloque: any) => {
        if (bloque.vuelo_ida?.codigo) {
          rotationMap[bloque.vuelo_ida.codigo] = bloque.vuelo_ida;
        }
        if (bloque.vuelo_vuelta?.codigo) {
          rotationMap[bloque.vuelo_vuelta.codigo] = bloque.vuelo_vuelta;
        }
      });

      // Derive the year-month from targetDateStr (e.g. "2026-09-21" → "2026-09-")
      const yearMonthPrefix = targetDateStr.substring(0, 8); // "2026-09-"

      const parsedFlights: ParsedFlight[] = [];

      (data.itinerario_diario || []).forEach((day: any) => {
        const dayNum = day.dia_numero;
        if (!dayNum) return;
        const dateStr = `${yearMonthPrefix}${String(dayNum).padStart(2, "0")}`;

        (day.vuelos_programados || []).forEach((flightCode: string) => {
          if (!flightCode || flightCode === "X" || flightCode === "NO OPERA") return;
          const info = rotationMap[flightCode];
          if (!info) return;

          const [ori, des] = (info.ruta || "/").split("/");
          parsedFlights.push({
            flightNumber: info.codigo,
            origin: ori || "PTY",
            destination: des || "DAV",
            departureTimeLocal: formatAmPmTo24h(info.etd),
            arrivalTimeLocal: formatAmPmTo24h(info.eta),
            airline: "Copa Airlines",
            flightDate: dateStr,
            aircraft: "B738",
            aircraftReg: "",
            paxCount: 0,
            pilot: "",
            paxMax: 160,
          });
        });
      });

      if (parsedFlights.length === 0) {
        throw new Error("Gemini analizó la imagen pero no encontró vuelos programados. Verifica que la imagen sea el itinerario mensual de Copa Airlines.");
      }

      return parsedFlights;
    } catch (err: any) {
      lastError = err;
      // Retry on 503 overloaded
      if (err?.status === 503 && attempt < 3) {
        console.warn(`Gemini 503 en intento ${attempt}. Reintentando en 4s...`);
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      break;
    }
  }

  throw new Error(lastError?.message || "Error al analizar la imagen de Copa Airlines con Gemini.");
}

export async function parseItineraryImage(base64Image: string, targetDateStr: string, airline: string = 'airpanama'): Promise<ParsedFlight[]> {
  try {
    const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    
    if (airline === 'copa') {
      console.log("Iniciando análisis de imagen mensual de Copa Airlines con Gemini Vision...");
      return await parseCopaMonthlyImage(base64Data, targetDateStr);
    }

    // Usamos exclusivamente el OCR local por ser más rápido, gratuito e independiente de internet para Air Panama
    console.log("Iniciando análisis de imagen con motor OCR interno para Air Panama...");
    return await parseWithOCR(base64Data, targetDateStr);
  } catch (error: any) {
    console.error("Error en parseItineraryImage:", error);
    throw new Error(error.message || "Error al procesar la imagen con el motor interno.");
  }
}

