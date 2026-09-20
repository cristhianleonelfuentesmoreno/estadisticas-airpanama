import * as XLSX from 'xlsx';
import fs from 'fs';

const data = [];

// Generar vuelos para el mes de agosto 2026 (1 al 31)
for (let day = 1; day <= 31; day++) {
  const dateStr = `2026-08-${day.toString().padStart(2, '0')}`;
  
  // Agregar un vuelo basura para probar el filtro
  if (day === 15) {
    data.push({
      "Tipo": "Llegada", "Fecha": dateStr, "Aerolínea": "American Airlines",
      "Vuelo": "AA-1122", "Origen": "MIA", "Destino": "DAV", "Hora Itinerario": "14:00",
      "Hora Real": "14:00", "Pasajeros": 100, "Capacidad": 150, "Estado": "LLEGÓ"
    });
  }

  // Air Panama Llegada
  data.push({
    "Tipo": "Llegada", "Fecha": dateStr, "Aerolínea": "Air Panama",
    "Vuelo": "7P-972", "Origen": "PAC", "Destino": "DAV", "Hora Itinerario": "09:45",
    "Hora Real": day % 3 === 0 ? "10:15" : "09:45", 
    "Pasajeros": 45 + (day % 20), "Capacidad": 78, "Estado": day % 3 === 0 ? "DEMORADO" : "LLEGÓ"
  });

  // Copa Airlines Salida
  data.push({
    "Tipo": "Salida", "Fecha": dateStr, "Aerolínea": "Copa Airlines",
    "Vuelo": "CM-012", "Origen": "DAV", "Destino": "PTY", "Hora Itinerario": "10:15",
    "Hora Real": "10:15", 
    "Pasajeros": 120 + (day % 30), "Capacidad": 160, "Estado": "LLEGÓ"
  });
}

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Agosto");
XLSX.writeFile(wb, "Prueba_Agosto_2026.xlsx");

console.log("Archivo Prueba_Agosto_2026.xlsx generado exitosamente!");
