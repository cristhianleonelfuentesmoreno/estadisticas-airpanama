"use server";

import { GoogleGenAI } from "@google/genai";
import { getApiConfigs } from "./apiConfig";
import { createWorker } from "tesseract.js";

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
}

// Fallback OCR parser for Air Panama itineraries
async function parseWithOCR(base64Data: string, targetDateStr: string): Promise<ParsedFlight[]> {
  console.log("Iniciando Tesseract OCR como respaldo local...");
  const buffer = Buffer.from(base64Data, 'base64');
  const worker = await createWorker('eng');
  
  const { data: { text } } = await worker.recognize(buffer);
  await worker.terminate();

  console.log("OCR completado, buscando patrones de vuelos y aviones...");
  
  const flights: ParsedFlight[] = [];
  const lines = text.split('\n');
  
  let currentAircraft = '';
  let currentReg = '';

  for (const line of lines) {
    // Buscar modelo de avión al inicio (ej: DH8D, FK50, C-208) seguido por la hora
    const aircraftMatch = line.match(/^([A-Z0-9-]{4,6})\s+\d{1,2}:\d{2}/);
    if (aircraftMatch) {
      const val = aircraftMatch[1];
      if (val.startsWith('HP-')) {
        currentReg = val;
      } else {
        currentAircraft = val;
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

      // Intentar extraer los pasajeros al final de la línea
      const paxMatch = line.match(/\b(\d{1,3})\s*$/);
      const paxCount = paxMatch ? parseInt(paxMatch[1], 10) : undefined;
      
      // Calcular hora de llegada estimada (Salida + 1 hora) dado que la tabla física solo tiene salida
      let arrivalTimeLocal = "00:00";
      try {
        const [hours, minutes] = time.split(':').map(Number);
        const dateObj = new Date();
        dateObj.setHours(hours, minutes, 0, 0);
        // Sumar 1 hora
        dateObj.setHours(dateObj.getHours() + 1);
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
        paxCount
      });
    }
  }
  
  if (flights.length === 0) {
    throw new Error("El motor OCR local no pudo encontrar ningún vuelo en la imagen. La calidad puede ser muy baja.");
  }

  return flights;
}

export async function parseItineraryImage(base64Image: string, targetDateStr: string): Promise<ParsedFlight[]> {
  try {
    const configs = await getApiConfigs();
    const geminiConfig = configs.gemini;

    if (!geminiConfig?.is_active || !geminiConfig?.api_key) {
      throw new Error("La API de Google Gemini no está configurada o está desactivada en la Gestión de APIs.");
    }

    const ai = new GoogleGenAI({ apiKey: geminiConfig.api_key.trim() });

    const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    const prompt = `
      Actúa como un analista de datos aeronáuticos experto. 
      Analiza la imagen adjunta, que contiene un itinerario de vuelos.
      Extrae los vuelos y devuélvelos en formato JSON puro (sin formato markdown \`\`\`json) que consista en un array de objetos con esta estructura exacta:
      [{
        "flightNumber": "El número de vuelo (ej: 013, 018)",
        "origin": "Código IATA de origen de 3 letras (ej: PTY, DAV, PAC, BOC)",
        "destination": "Código IATA de destino de 3 letras",
        "departureTimeLocal": "Hora de salida en formato HH:mm (24 horas)",
        "arrivalTimeLocal": "Hora de llegada en formato HH:mm (24 horas)",
        "airline": "Nombre de la aerolínea deducido de la imagen (ej: 'Copa Airlines', 'Air Panama')",
        "flightDate": "Fecha del vuelo en formato YYYY-MM-DD",
        "aircraft": "Modelo del avión si aparece (ej: DH8D, FK50, C-208)",
        "aircraftReg": "Matrícula del avión si aparece (ej: HP-1997, HP-1891)",
        "paxCount": "Número de pasajeros si aparece bajo la columna INFORMACION u otra, solo el número"
      }]
      Reglas:
      1. Ignora vuelos que no tengan sentido o sean puro texto de relleno.
      2. Siempre devuelve SOLO un JSON válido, ningún texto adicional antes o después.
      3. Asegúrate de formatear la hora en HH:mm (ejemplo: "06:30", "19:15").
      4. Si no puedes detectar el código IATA, trata de inferirlo por la ciudad (ej: Tocumen = PTY, Albrook = PAC, David = DAV, Bocas = BOC).
      5. IMPORTANTE: Si la imagen NO indica explícitamente una fecha clara para una fila, usa la siguiente fecha por defecto: "${targetDateStr}". Si la imagen es un itinerario mensual y especifica el día del mes, calcula la fecha completa asumiendo que el mes y año son los más cercanos a hoy, y pon esa fecha exacta en 'flightDate'.

    `;

    // Función para ejecutar con timeout
    const withTimeout = (promise: Promise<any>, ms: number) => {
      let timeoutId: any;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`TIMEOUT_${ms}`)), ms);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
    };

    try {
      let response;
      try {
        console.log("Intentando con gemini-3.5-flash...");
        response = await withTimeout(ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [
                prompt,
                { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]
        }), 10000); // 10 segundos máximo
      } catch (primaryError: any) {
        console.warn("Fallo en gemini-3.5-flash:", primaryError.message);
        
        // Si hay timeout, 503, 504 o cualquier error de demanda, pasamos a 3.6
        console.log("Intentando con gemini-3.6-flash...");
        response = await withTimeout(ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: [
                prompt,
                { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]
        }), 10000); // 10 segundos máximo
      }

      if (!response || !response.text) {
        throw new Error("La IA no devolvió ningún contenido");
      }

      const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        const flights: ParsedFlight[] = JSON.parse(jsonStr);
        return flights;
      } catch (parseError) {
        console.error("JSON inválido de IA:", jsonStr);
        throw new Error("La IA devolvió un formato inválido. Por favor intenta de nuevo.");
      }
    } catch (e: any) {
      console.warn("Fallo total de las IAs o Timeout excedido. Activando Plan de Respaldo Local OCR...", e.message);
      // Fallback a OCR Local
      try {
        return await parseWithOCR(base64Data, targetDateStr);
      } catch (ocrError: any) {
        console.error("Fallo también el OCR Local:", ocrError);
        throw new Error(`Los servidores de Google están saturados y el sistema OCR local no pudo leer la imagen correctamente. Asegúrate de que la imagen sea nítida, o sube un Excel.`);
      }
    }
  } catch (error: any) {
    console.error("Error en parseItineraryImage:", error);
    throw new Error(error.message || "Error al procesar la imagen con inteligencia artificial.");
  }
}
