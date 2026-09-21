"use server";

import { GoogleGenAI } from "@google/genai";
import { getApiConfigs } from "./apiConfig";

export interface ParsedFlight {
  flightNumber: string;
  origin: string;
  destination: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  airline: string;
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
        "flightDate": "Fecha del vuelo en formato YYYY-MM-DD"
      }]
      Reglas:
      1. Ignora vuelos que no tengan sentido o sean puro texto de relleno.
      2. Siempre devuelve SOLO un JSON válido, ningún texto adicional antes o después.
      3. Asegúrate de formatear la hora en HH:mm (ejemplo: "06:30", "19:15").
      4. Si no puedes detectar el código IATA, trata de inferirlo por la ciudad (ej: Tocumen = PTY, Albrook = PAC, David = DAV, Bocas = BOC).
      5. IMPORTANTE: Si la imagen NO indica explícitamente una fecha clara para una fila, usa la siguiente fecha por defecto: "${targetDateStr}". Si la imagen es un itinerario mensual y especifica el día del mes, calcula la fecha completa asumiendo que el mes y año son los más cercanos a hoy, y pon esa fecha exacta en 'flightDate'.

    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg" // Mime Type generico para envio
                }
            }
        ]
    });

    const text = response.text || "[]";
    // Limpiar posible formato markdown que a veces los LLMs devuelven a pesar de pedirles que no lo hagan
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let flights: ParsedFlight[] = [];
    try {
      flights = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Error parseando respuesta JSON de Gemini:", cleanedText);
      throw new Error("Gemini devolvió un formato irreconocible.");
    }

    return flights;
  } catch (error: any) {
    console.error("Error en parseItineraryImage:", error);
    throw new Error(error.message || "Error al procesar la imagen con inteligencia artificial.");
  }
}
