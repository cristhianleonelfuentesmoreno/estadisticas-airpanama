import * as XLSX from 'xlsx';
import fs from 'fs';

const filePath = '/Users/cristhianf3193/Library/CloudStorage/OneDrive-Personal/Desarrollo/AirPanama/estadisticas-airpanama/resources/Agosto 2026.xlsx';

try {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { raw: false });
  
  console.log(`Leidas ${data.length} filas.`);
  console.log("Muestra de los primeros vuelos AP/CM encontrados:");
  
  let count = 0;
  for (const r of data) {
    const aerolinea = (r as any)['Airline']?.toString().trim() || (r as any)['Aerolínea']?.toString().trim();
    if (aerolinea === 'Air Panama' || aerolinea === 'Copa Airlines') {
      console.log(r);
      count++;
      if (count >= 5) break;
    }
  }

} catch (e) {
  console.error("Failed to read", e);
}
