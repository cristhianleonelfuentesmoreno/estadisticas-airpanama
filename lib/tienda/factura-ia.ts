import 'server-only'

// Lee la foto de una factura de proveedor con Gemini y devuelve sus líneas.
// La persona siempre revisa el resultado antes de guardar: esto solo llena el formulario.

export type LineaLeida = {
  descripcion: string
  codigo_barras: string | null
  paquetes: number
  unidades_por_paquete: number
  costo_por_paquete: number
}

export type FacturaLeida = { proveedor: string | null; numero_factura: string | null; lineas: LineaLeida[] }

// En orden: si uno está saturado (Google responde 503/429) se prueba el siguiente
const MODELOS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest']
const ESPERA_MS = [0, 2500]

const INSTRUCCIONES = [
  'Eres el asistente de una abarrotería de Panamá. Lee esta factura o nota de un proveedor y devuelve SOLO los productos que llegaron.',
  'Reglas:',
  '- paquetes: la cantidad que llegó, tal como dice la columna cantidad de la línea.',
  '- unidades_por_paquete: cuántas unidades para vender suelto trae cada una de esas cantidades. Mira la columna de unidad de medida:',
  '  * Si dice UND, UN, UNID o similar, cada cantidad es UNA unidad: usa 1. Excepción: si el producto en sí es un multipack (6PACK, 6-PACK, DUO PACK, 2X60G), usa cuántas trae ese pack (6, 2...).',
  "  * Si dice CAJA, CJ, PAQ, BULTO, FARDO o la columna de paquetes indica paquetes, usa cuántas unidades trae la caja según la descripción ('X 24 U', '12 MC', '6 MC', '24', '(30)').",
  "  * Números como '(24)', 'X 24 U', '12/946 ML' o '60X22grs' en una línea medida en UND describen la caja grande del proveedor, NO lo que llegó: ignóralos.",
  '- costo_por_paquete: lo que costó esa misma cantidad DESPUÉS de descuentos y SUMANDO el ITBMS si la línea lo cobra. Si solo ves el total de la línea, divídelo entre paquetes.',
  '- codigo_barras: solo si en la línea aparece un código EAN/UPC de 8 a 14 dígitos. No pongas códigos internos cortos del proveedor.',
  '- Ignora líneas de bonificación con valor 0, envases, cajillas, totales y notas escritas a mano al margen.',
  '- No inventes: si algo no se lee, deja el mejor valor que veas.',
].join('\n')

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    proveedor: { type: 'STRING', nullable: true },
    numero_factura: { type: 'STRING', nullable: true },
    lineas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          descripcion: { type: 'STRING' },
          codigo_barras: { type: 'STRING', nullable: true },
          paquetes: { type: 'NUMBER' },
          unidades_por_paquete: { type: 'NUMBER' },
          costo_por_paquete: { type: 'NUMBER' },
        },
        required: ['descripcion', 'paquetes', 'unidades_por_paquete', 'costo_por_paquete'],
      },
    },
  },
  required: ['lineas'],
}

export class FacturaIaError extends Error {
  constructor(public motivo: 'sin-clave' | 'ocupado' | 'ilegible') {
    super(motivo)
  }
}

function numero(v: unknown, minimo: number): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= minimo ? n : null
}

function limpiar(crudo: unknown): FacturaLeida {
  const d = (crudo ?? {}) as Record<string, unknown>
  const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const lineas = (Array.isArray(d.lineas) ? d.lineas : [])
    .map((l: Record<string, unknown>) => {
      const codigo = texto(l.codigo_barras, 20)?.replace(/\D/g, '') ?? ''
      return {
        descripcion: texto(l.descripcion, 120) ?? '',
        codigo_barras: /^\d{8,14}$/.test(codigo) ? codigo : null,
        paquetes: numero(l.paquetes, 0) ?? 0,
        unidades_por_paquete: Math.max(1, Math.round(numero(l.unidades_por_paquete, 1) ?? 1)),
        costo_por_paquete: numero(l.costo_por_paquete, 0) ?? 0,
      }
    })
    .filter(l => l.descripcion && l.paquetes > 0)
    .slice(0, 60)
  return { proveedor: texto(d.proveedor, 80), numero_factura: texto(d.numero_factura, 40), lineas }
}

export async function leerFactura(imagenBase64: string, mime: string): Promise<FacturaLeida> {
  const clave = process.env.GEMINI_API_KEY
  if (!clave) throw new FacturaIaError('sin-clave')

  const cuerpo = JSON.stringify({
    contents: [{ parts: [{ text: INSTRUCCIONES }, { inline_data: { mime_type: mime, data: imagenBase64 } }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0 },
  })

  for (const modelo of MODELOS) {
    for (const espera of ESPERA_MS) {
      if (espera) await new Promise(r => setTimeout(r, espera))
      let r: Response
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
          body: cuerpo,
          signal: AbortSignal.timeout(60_000),
          cache: 'no-store',
        })
      } catch {
        continue
      }
      if (r.status === 503 || r.status === 429 || r.status >= 500) continue
      if (r.status === 404) break
      if (!r.ok) throw new FacturaIaError('ilegible')
      const d = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const texto = d.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
      try {
        const leida = limpiar(JSON.parse(texto))
        if (!leida.lineas.length) throw new FacturaIaError('ilegible')
        return leida
      } catch (e) {
        if (e instanceof FacturaIaError) throw e
        throw new FacturaIaError('ilegible')
      }
    }
  }
  throw new FacturaIaError('ocupado')
}
