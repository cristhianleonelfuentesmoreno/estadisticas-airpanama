import * as XLSX from 'xlsx';

// Definición de las interfaces para los datos extraídos
export interface DiarioRow {
  fecha: string;
  numero_vuelo: string;
  origen: string;
  destino: string;
  pasajeros_embarcados: number;
  pasajeros_desembarcados: number;
}

export interface MensualRow {
  mes: number;
  anio: number;
  aerolinea: string;
  tipo_vuelo: string;
  total_pasajeros: number;
  total_operaciones: number;
}

/**
 * Lee un archivo .xlsx y lo convierte en un array de objetos JSON brutos
 */
export async function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Asumimos que los datos están en la primera hoja por defecto
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir la hoja a JSON
        // header: 1 devuelve un array de arrays (filas y columnas)
        // defval: "" rellena celdas vacías
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        resolve(jsonData);
      } catch (error) {
        reject(new Error("Error al procesar el archivo Excel. Asegúrate de que sea un archivo válido."));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error de lectura del archivo."));
    };
    
    reader.readAsBinaryString(file);
  });
}
