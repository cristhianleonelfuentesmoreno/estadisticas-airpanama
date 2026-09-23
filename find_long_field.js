const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });

const wb = XLSX.readFile('/Users/cristhianf3193/Library/CloudStorage/OneDrive-Personal/Desarrollo/AirPanama/estadisticas-airpanama/resources/registro_mensual_general.xlsx');
const ws = wb.Sheets['ENERO 2026'];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

// Simular el parser
const normalizeKey = (key) => {
  if (!key && key !== 0) return '';
  return key.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\.$/, '');
};

let headerRowIndex = -1, headers = [];
const KEYWORDS = ['leg', 'airline', 'flight', 'vuelo'];
for (let i = 0; i < 30; i++) {
  const row = rawData[i];
  if (!row || !row.length) continue;
  const norm = row.map(c => normalizeKey(c));
  if (KEYWORDS.some(k => norm.includes(k))) { headerRowIndex = i; headers = norm; break; }
}

// Analizar el campo "o/d" y "handler" y "service" - cuántos chars tienen
const odIdx = headers.indexOf('o/d');
const handlerIdx = headers.indexOf('handler');
const serviceIdx = headers.indexOf('service');
const flightIdx = headers.indexOf('flight');

console.log('Header indices: o/d=', odIdx, 'handler=', handlerIdx, 'service=', serviceIdx, 'flight=', flightIdx);
console.log('\nMax field lengths in first 20 data rows:');
const maxLens = {};
for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 25, rawData.length); i++) {
  const row = rawData[i];
  if (!row) continue;
  for (let j = 0; j < headers.length; j++) {
    const val = row[j]?.toString() || '';
    const h = headers[j] || `col_${j}`;
    if (!maxLens[h] || val.length > maxLens[h].len) {
      maxLens[h] = { len: val.length, val };
    }
  }
}

Object.entries(maxLens)
  .filter(([k, v]) => v.len > 4)
  .forEach(([k, v]) => console.log(`  "${k}": maxLen=${v.len}, example="${v.val}"`));
