import 'server-only'
import ExcelJS from 'exceljs'

// Hojas de Excel con el verde de ValisVentas: encabezado fijo, columnas de plata con formato y filtros
export type Columna = { titulo: string; clave: string; ancho: number; tipo?: 'dinero' | 'numero' | 'porcentaje' | 'texto' }

const VERDE = 'FF047857'
const FORMATO = { dinero: '"$"#,##0.00', numero: '#,##0.###', porcentaje: '0"%"', texto: '@' } as const

export function nuevoLibro(): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook()
  libro.creator = 'ValisVentas'
  libro.created = new Date()
  return libro
}

export function agregarTabla(libro: ExcelJS.Workbook, nombre: string, columnas: Columna[], filas: Record<string, unknown>[]) {
  const hoja = libro.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] })
  hoja.columns = columnas.map(c => ({ header: c.titulo, key: c.clave, width: c.ancho, style: c.tipo ? { numFmt: FORMATO[c.tipo] } : undefined }))
  const encabezado = hoja.getRow(1)
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } }
  encabezado.alignment = { vertical: 'middle' }
  encabezado.height = 22
  hoja.addRows(filas)
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } }
  return hoja
}

// Hoja de resumen: dos columnas, "qué es" y "cuánto"
export function agregarResumen(libro: ExcelJS.Workbook, titulo: string, filas: [string, number | string, ('dinero' | 'numero')?][]) {
  const hoja = libro.addWorksheet('Resumen')
  hoja.columns = [{ width: 44 }, { width: 20 }]
  const t = hoja.addRow([titulo])
  t.font = { bold: true, size: 14, color: { argb: VERDE } }
  hoja.addRow([])
  for (const [que, valor, tipo] of filas) {
    const r = hoja.addRow([que, valor])
    if (tipo) r.getCell(2).numFmt = FORMATO[tipo]
    if (que === '') continue
    r.getCell(1).font = { color: { argb: 'FF475569' } }
    r.getCell(2).font = { bold: true }
  }
  return hoja
}

export async function respuestaExcel(libro: ExcelJS.Workbook, archivo: string): Promise<Response> {
  const datos = await libro.xlsx.writeBuffer()
  return new Response(datos, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${archivo}"; filename*=UTF-8''${encodeURIComponent(archivo)}`,
      'Cache-Control': 'no-store',
    },
  })
}

// "Mini Super San Judas" -> "mini-super-san-judas" para el nombre del archivo
export const nombreArchivo = (texto: string) =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
