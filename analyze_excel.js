const XLSX = require('xlsx');

const wb = XLSX.readFile('/Users/cristhianf3193/Library/CloudStorage/OneDrive-Personal/Desarrollo/AirPanama/estadisticas-airpanama/resources/registro_mensual_general.xlsx');
console.log('=== SHEETS ===');
console.log(wb.SheetNames);

const ws = wb.Sheets[wb.SheetNames[0]];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

console.log('\n=== FIRST 10 ROWS ===');
for (let i = 0; i < Math.min(10, rawData.length); i++) {
  console.log(`Row ${i}:`, rawData[i]);
}

console.log('\n=== TOTAL ROWS ===', rawData.length);
