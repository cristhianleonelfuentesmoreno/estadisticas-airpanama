import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'

// Lee la foto de una factura de proveedor con Claude y devuelve sus líneas y lo que costó leerla.
// La persona siempre revisa el resultado antes de guardar: esto solo llena el formulario.

export type LineaLeida = {
  descripcion: string
  codigo_barras: string | null
  paquetes: number
  unidades_por_paquete: number
  costo_por_paquete: number
}

export type FacturaLeida = { proveedor: string | null; numero_factura: string | null; lineas: LineaLeida[] }

export type Consumo = { modelo: string; tokens_entrada: number; tokens_salida: number; costo_usd: number; duracion_ms: number }

// Dólares por millón de tokens (precios de la API de Anthropic, prompts de hasta 100K tokens)
export const PRECIOS: Record<string, { entrada: number; salida: number }> = {
  'claude-haiku-5-5': { entrada: 0.1, salida: 0.5 },
}

export function costoDe(modelo: string, entrada: number, salida: number): number {
  const p = PRECIOS[modelo]
  if (!p) return 0
  return (entrada * p.entrada + salida * p.salida) / 1_000_000
}

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
  '- proveedor: el nombre comercial de quien vende (no el cliente). numero_factura: el número de la factura si aparece.',
  '- No inventes: si algo no se lee, deja el mejor valor que veas.',
].join('\n')

const Esquema = z.object({
  proveedor: z.string().nullable(),
  numero_factura: z.string().nullable(),
  lineas: z.array(z.object({
    descripcion: z.string(),
    codigo_barras: z.string().nullable(),
    paquetes: z.number(),
    unidades_por_paquete: z.number(),
    costo_por_paquete: z.number(),
  })),
})

export class FacturaIaError extends Error {
  constructor(public motivo: 'sin-clave' | 'clave-invalida' | 'ocupado' | 'ilegible', public consumo: Consumo | null = null) {
    super(motivo)
  }
}

type TipoImagen = 'image/jpeg' | 'image/png' | 'image/webp'

function limpiar(d: z.infer<typeof Esquema>): FacturaLeida {
  const texto = (v: string | null, max: number) => (v && v.trim() ? v.trim().slice(0, max) : null)
  const lineas = d.lineas
    .map(l => {
      const codigo = (l.codigo_barras ?? '').replace(/\D/g, '')
      return {
        descripcion: texto(l.descripcion, 120) ?? '',
        codigo_barras: /^\d{8,14}$/.test(codigo) ? codigo : null,
        paquetes: Number.isFinite(l.paquetes) && l.paquetes > 0 ? l.paquetes : 0,
        unidades_por_paquete: Number.isFinite(l.unidades_por_paquete) ? Math.max(1, Math.round(l.unidades_por_paquete)) : 1,
        costo_por_paquete: Number.isFinite(l.costo_por_paquete) && l.costo_por_paquete >= 0 ? l.costo_por_paquete : 0,
      }
    })
    .filter(l => l.descripcion && l.paquetes > 0)
    .slice(0, 60)
  return { proveedor: texto(d.proveedor, 80), numero_factura: texto(d.numero_factura, 40), lineas }
}

export async function leerFactura(
  clave: string, modelo: string, imagenBase64: string, mime: TipoImagen,
): Promise<{ factura: FacturaLeida; consumo: Consumo }> {
  const cliente = new Anthropic({ apiKey: clave, maxRetries: 2, timeout: 90_000 })
  const inicio = Date.now()
  let respuesta
  try {
    respuesta = await cliente.messages.parse({
      model: modelo,
      max_tokens: 16000,
      output_config: { effort: 'medium', format: zodOutputFormat(Esquema) },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: imagenBase64 } },
          { type: 'text', text: INSTRUCCIONES },
        ],
      }],
    })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new FacturaIaError('clave-invalida')
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      throw new FacturaIaError('ocupado')
    }
    throw new FacturaIaError('ilegible')
  }

  const entrada = respuesta.usage.input_tokens + (respuesta.usage.cache_read_input_tokens ?? 0) + (respuesta.usage.cache_creation_input_tokens ?? 0)
  const salida = respuesta.usage.output_tokens
  const consumo: Consumo = {
    modelo, tokens_entrada: entrada, tokens_salida: salida, costo_usd: costoDe(modelo, entrada, salida), duracion_ms: Date.now() - inicio,
  }
  if (respuesta.stop_reason === 'refusal' || !respuesta.parsed_output) throw new FacturaIaError('ilegible', consumo)
  const factura = limpiar(respuesta.parsed_output)
  if (!factura.lineas.length) throw new FacturaIaError('ilegible', consumo)
  return { factura, consumo }
}

// Comprueba una clave nueva antes de guardarla (no gasta tokens)
export async function claveValida(clave: string): Promise<boolean> {
  try {
    await new Anthropic({ apiKey: clave, maxRetries: 1, timeout: 15_000 }).models.list({ limit: 1 })
    return true
  } catch {
    return false
  }
}
