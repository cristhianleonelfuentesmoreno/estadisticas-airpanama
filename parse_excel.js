const XLSX = require('xlsx');

const normalizeKey = (key) => {
  return key.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
};

const wb = XLSX.readFile('/Users/cristhianf3193/Library/CloudStorage/OneDrive-Personal/Desarrollo/AirPanama/estadisticas-airpanama/resources/registro_mensual_general.xlsx');
const ws = wb.Sheets['ENERO 2026'];
const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

let headerRowIndex = 2;
let headers = [
  'leg',         'airline',
  'flight',      'o/d',
  'reg.',        'ac',
  'runway time', 'actual time (ata/atad)',
  'stand',       'service',
  'pax',         'handler'
];

const data = [];
for (let i = headerRowIndex + 1; i < rawData.length; i++) {
  const row = rawData[i];
  if (!row || row.length === 0) continue;
  const obj = {};
  for (let j = 0; j < headers.length; j++) {
     if (headers[j] && row[j] !== undefined && row[j] !== null && row[j] !== '') {
       obj[headers[j]] = row[j];
     }
  }
  data.push(obj);
}

for (const row of data) {
  let fechaStr = "FALLBACK";
  const rawRunway = (row['runway time'] || row['hora itinerario'] || row['std'] || row['sta'] || row['hora programada'] || '').toString().trim();
  let runwayTimeStr = "12:00";
  if (rawRunway.includes(' ')) {
    const parts = rawRunway.split(' ');
    const dParts = parts[0].split('/'); // MM/DD/YYYY o DD/MM/YYYY
    if (dParts.length === 3) {
      // Asumimos YYYY al final
      const year = dParts[2].length === 2 ? `20${dParts[2]}` : dParts[2];
      if (Number(dParts[0]) > 12) {
        fechaStr = `${year}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
      } else {
        fechaStr = `${year}-${dParts[0].padStart(2, '0')}-${dParts[1].padStart(2, '0')}`;
      }
    }
    runwayTimeStr = parts[1];
  }

  // console just the first one
  console.log("Raw:", rawRunway, "-> Fecha:", fechaStr, "Time:", runwayTimeStr);
  break;
}
