const XLSX = require('xlsx');

const wb = XLSX.readFile('/Users/cristhianf3193/Library/CloudStorage/OneDrive-Personal/Desarrollo/AirPanama/estadisticas-airpanama/resources/registro_mensual_general.xlsx');

// Check the ENERO sheet with raw numbers
const ws = wb.Sheets['ENERO 2026'];

// Try with raw: true to see real cell values
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

console.log('\n=== RAW FIRST 5 ROWS ===');
for (let i = 0; i < Math.min(5, rawData.length); i++) {
  console.log(`Row ${i}:`, JSON.stringify(rawData[i]));
}

// Let's get cell range
const range = XLSX.utils.decode_range(ws['!ref']);
console.log('\n=== RANGE ===', ws['!ref']);
console.log('Columns:', range.e.c + 1, 'Rows:', range.e.r + 1);

// Check what column headers exist in the actual excel via cell names
console.log('\n=== CELLS A1-T5 ===');
for (let r = 0; r <= 5; r++) {
  for (let c = 0; c <= 19; c++) {
    const cellAddr = XLSX.utils.encode_cell({r, c});
    const cell = ws[cellAddr];
    if (cell) {
      console.log(`${cellAddr}: type=${cell.t}, v=${JSON.stringify(cell.v)}, w=${JSON.stringify(cell.w)}, f=${cell.f}`);
    }
  }
}
