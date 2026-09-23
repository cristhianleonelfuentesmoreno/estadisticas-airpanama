const XLSX = require('xlsx');

const wb = XLSX.readFile('/Users/cristhianf3193/Library/CloudStorage/OneDrive-Personal/Desarrollo/AirPanama/estadisticas-airpanama/resources/registro_mensual_general.xlsx');
const ws = wb.Sheets['ENERO 2026'];

// === Simular el nuevo parser (raw: true) ===
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

const normalizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  return key.toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\.$/, '');
};

const HEADER_KEYWORDS = ['leg', 'tipo', 'operacion', 'airline', 'aerolinea', 'compania', 'flight', 'vuelo', 'arrival/departure'];
let headerRowIndex = -1;
let headers = [];

for (let i = 0; i < Math.min(30, rawData.length); i++) {
  const row = rawData[i];
  if (!row || row.length === 0) continue;
  const normalizedRow = row.map(cell => normalizeKey(cell));
  if (HEADER_KEYWORDS.some(kw => normalizedRow.includes(kw))) {
    headerRowIndex = i;
    headers = normalizedRow;
    break;
  }
}

console.log('Header row found at index:', headerRowIndex);
console.log('Headers:', headers.filter(h => h));

// Convertir serial de Excel
const excelSerialToDate = (serial) => {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(excelEpoch.getTime() + serial * 86400000);
};

const parseDateTimeCell = (cellValue) => {
  if (cellValue === null || cellValue === undefined || cellValue === '') return { fechaStr: '', timeStr: '' };
  if (typeof cellValue === 'number') {
    const d = excelSerialToDate(cellValue);
    return {
      fechaStr: `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`,
      timeStr: `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`
    };
  }
  return { fechaStr: '', timeStr: '' };
};

let arrivals = 0, departures = 0, skipped = 0;
const sample = [];

for (let i = headerRowIndex + 1; i < rawData.length; i++) {
  const row = rawData[i];
  if (!row || row.length === 0) continue;
  const obj = {};
  let hasData = false;
  for (let j = 0; j < headers.length; j++) {
    if (headers[j] && row[j] !== undefined && row[j] !== null && row[j] !== '') {
      obj[headers[j]] = row[j];
      hasData = true;
    }
  }
  if (!hasData) continue;

  const legRaw = (obj['leg'] || '').toString().trim().toLowerCase();
  const isArr = legRaw.startsWith('arr');
  const isDep = legRaw.startsWith('dep');
  if (!isArr && !isDep) { skipped++; continue; }

  const al = (obj['airline'] || '').toString().toLowerCase().replace(/\s+/g, '');
  if (!al.includes('copa') && !al.includes('airpanama')) { skipped++; continue; }

  const { fechaStr, timeStr } = parseDateTimeCell(obj['runway time']);
  if (sample.length < 5) {
    sample.push({ leg: obj['leg'], airline: obj['airline'], flight: obj['flight'], od: obj['o/d'], pax: obj['pax'], fecha: fechaStr, hora: timeStr });
  }
  if (isArr) arrivals++;
  else departures++;
}

console.log(`\n✅ Arrivals: ${arrivals}`);
console.log(`✅ Departures: ${departures}`);
console.log(`⚠️ Skipped: ${skipped}`);
console.log('\nSample records:');
console.table(sample);
