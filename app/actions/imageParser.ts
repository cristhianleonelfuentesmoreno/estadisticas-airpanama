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

export async function parseItineraryImage(base64Image: string, targetDateStr: string, airline: string = 'airpanama'): Promise<ParsedFlight[]> {
  try {
    const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    
    if (airline === 'copa') {
      throw new Error("El motor OCR para imágenes de Copa Airlines está en desarrollo. Por favor sube el itinerario mensual de Copa usando un archivo Excel.");
    }

    // Usamos exclusivamente el OCR local por ser más rápido, gratuito e independiente de internet para Air Panama
    console.log("Iniciando análisis de imagen con motor OCR interno para Air Panama...");
    return await parseWithOCR(base64Data, targetDateStr);
  } catch (error: any) {
    console.error("Error en parseItineraryImage:", error);
    throw new Error(error.message || "Error al procesar la imagen con el motor interno.");
  }
}
