'use server'

import ExcelJS from 'exceljs'
import { revalidatePath } from 'next/cache'
import { requireApprovedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getMisTiendas, getProductos } from '@/lib/tienda/servidor'
import { precioParaGanar } from '@/lib/tienda/formato'
import { SIN_ITBMS } from '@/lib/tienda/categorias'
import { leerFilas, planear, type Paso } from '@/lib/tienda/importar'
import { anotar } from '@/lib/tienda/uso'
import type { Resultado, Tienda } from '@/lib/tienda/tipos'

// Subir el inventario desde Excel en dos pasos: revisar (no cambia nada) e importar.
// Al importar se vuelve a leer el archivo en el servidor: no se confía en lo que mande la pantalla.

async function tiendaParaImportar(tiendaId: string): Promise<Tienda> {
  await requireApprovedUser()
  const tienda = (await getMisTiendas()).find(t => t.id === tiendaId)
  if (!tienda || tienda.rol === 'contador') throw new Error('No autorizado')
  return tienda
}

// Lo que trae una celda de Excel, como texto o número
function valor(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? null
    if ('richText' in v) return v.richText.map(t => t.text).join('')
    if ('text' in v) return v.text
  }
  return null
}

async function planDelExcel(tienda: Tienda, base64: string): Promise<Paso[] | string> {
  if (typeof base64 !== 'string' || !base64 || base64.length > 8_000_000) return 'El archivo es muy grande. Divídelo en partes de hasta 1000 productos.'
  const libro = new ExcelJS.Workbook()
  // exceljs pide un ArrayBuffer (su tipo «Buffer»); JSZip lo abre igual
  const archivo = new Uint8Array(Buffer.from(base64, 'base64')).buffer
  try {
    await libro.xlsx.load(archivo)
  } catch {
    return 'No pude abrir el archivo. Guárdalo como Excel (.xlsx) y prueba otra vez.'
  }
  // Primero la hoja «Inventario» (la de la plantilla y la del Excel que se descarga); si no, la primera que sirva
  const hojas = [...libro.worksheets].sort((a, b) => Number(b.name.toLowerCase() === 'inventario') - Number(a.name.toLowerCase() === 'inventario'))
  let error = 'El Excel está vacío'
  for (const hoja of hojas) {
    const matriz: unknown[][] = []
    hoja.eachRow({ includeEmpty: true }, (fila, n) => {
      const celdas = Array.isArray(fila.values) ? fila.values.slice(1) : []
      matriz[n - 1] = celdas.map(c => valor(c as ExcelJS.CellValue))
    })
    const filas = leerFilas(Array.from(matriz, f => f ?? []))
    if (typeof filas === 'string') {
      error = filas
      continue
    }
    if (!filas.length) continue
    const productos = await getProductos(tienda, { conPausados: true })
    return planear(filas, productos)
  }
  return error
}

export async function revisarExcel(tiendaId: string, base64: string): Promise<Resultado<{ pasos: Paso[] }>> {
  const tienda = await tiendaParaImportar(tiendaId)
  const plan = await planDelExcel(tienda, base64)
  if (typeof plan === 'string') return { ok: false, error: plan }
  return { ok: true, data: { pasos: plan } }
}

export async function importarExcel(tiendaId: string, base64: string): Promise<Resultado<{ creados: number; actualizados: number; contados: number; fallaron: number }>> {
  const tienda = await tiendaParaImportar(tiendaId)
  const plan = await planDelExcel(tienda, base64)
  if (typeof plan === 'string') return { ok: false, error: plan }
  const user = await requireApprovedUser()
  const supabase = await createClient()
  const { data: negocio } = await supabase.from('negocios').select('porcentaje_ganancia').eq('id', tienda.negocio_id).maybeSingle()
  const pct = negocio ? Number(negocio.porcentaje_ganancia) : 30
  let fallaron = 0

  // 1. Los nuevos, de a 200
  const nuevos = plan.filter(p => p.accion === 'nuevo')
  const contar: { id: string; cantidad: number }[] = []
  for (let i = 0; i < nuevos.length; i += 200) {
    const parte = nuevos.slice(i, i + 200)
    const { data, error } = await supabase.from('productos').insert(parte.map(p => {
      const categoria = p.categoria ?? 'Otros'
      return {
        negocio_id: tienda.negocio_id,
        nombre: p.nombre,
        codigo_barras: p.codigo,
        categoria,
        vende_por: p.vende_por ?? 'unidad',
        costo: p.costo,
        precio_venta: p.precio ?? (p.costo !== null && p.costo > 0 ? precioParaGanar(p.costo, pct) : null),
        stock_minimo: p.minimo,
        itbms: SIN_ITBMS.has(categoria) ? 0 : 7,
        porcentaje_ganancia: pct,
        creado_por: user.id,
      }
    })).select('id')
    if (error || !data) {
      fallaron += parte.length
      continue
    }
    data.forEach((d, j) => { if (parte[j].disponible !== null) contar.push({ id: d.id as string, cantidad: parte[j].disponible as number }) })
  }
  const creados = nuevos.length - fallaron

  // 2. Los que ya existían: solo lo que cambió
  const actualizar = plan.filter(p => p.accion === 'actualizar' && p.producto_id)
  let actualizados = 0
  for (let i = 0; i < actualizar.length; i += 25) {
    const r = await Promise.all(actualizar.slice(i, i + 25).map(async p => {
      const fila: Record<string, string | number | null> = {}
      if (p.precio !== null) fila.precio_venta = p.precio
      if (p.costo !== null) fila.costo = p.costo
      if (p.categoria) fila.categoria = p.categoria
      if (p.minimo !== null) fila.stock_minimo = p.minimo
      if (p.codigo && p.cambios.includes('código de barras')) fila.codigo_barras = p.codigo
      if (p.disponible !== null && p.cambios.some(c => c.startsWith('contar'))) contar.push({ id: p.producto_id as string, cantidad: p.disponible })
      if (!Object.keys(fila).length) return true
      const { error } = await supabase.from('productos').update(fila).eq('id', p.producto_id as string).eq('negocio_id', tienda.negocio_id)
      return !error
    }))
    actualizados += r.filter(Boolean).length
    fallaron += r.filter(x => !x).length
  }

  // 3. Lo que hay en el estante: un conteo por producto (queda en la historia como «Subido desde Excel»)
  let contados = 0
  for (let i = 0; i < contar.length; i += 10) {
    const r = await Promise.all(contar.slice(i, i + 10).map(c => supabase.rpc('registrar_ajuste', {
      p_tienda: tienda.id, p_producto: c.id, p_motivo: 'conteo', p_cantidad: c.cantidad, p_costo: null, p_nota: 'Subido desde Excel',
    }).then(x => !x.error)))
    contados += r.filter(Boolean).length
  }

  anotar(supabase, tienda.id, 'importar_excel', { creados, actualizados, contados, fallaron })
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: { creados, actualizados, contados, fallaron } }
}
