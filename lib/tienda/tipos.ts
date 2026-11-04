// Tipos compartidos entre el servidor y las pantallas de la tienda

export type Tienda = {
  id: string
  negocio_id: string
  nombre: string
  slug: string
}

export type VendePor = 'unidad' | 'libra'

export type Producto = {
  id: string
  nombre: string
  marca: string | null
  presentacion: string | null
  categoria: string | null
  codigo_barras: string | null
  vende_por: VendePor
  precio_venta: number | null
  costo: number | null
  itbms: number
  imagen_url: string | null
  stock: number
}

// Lo que devuelve Open Food Facts para llenar un producto nuevo
export type SugerenciaProducto = {
  nombre: string | null
  marca: string | null
  presentacion: string | null
  imagen_url: string | null
}

export type MetodoPago = 'efectivo' | 'yappy' | 'tarjeta'

export type LineaVenta = {
  producto_id: string
  cantidad: number
  precio_unitario: number | null
}

export type LineaEntrada = {
  producto_id: string
  cantidad: number
  costo_unitario: number
}

export type Resultado<T = null> = { ok: true; data: T } | { ok: false; error: string }

export type MotivoAjuste = 'regalia' | 'compra_sin_factura' | 'danado' | 'consumo' | 'conteo'

export type ResumenDia = {
  fecha: string
  base_caja: number
  ventas_cantidad: number
  total_ventas: number
  efectivo: number
  yappy: number
  tarjeta: number
  ganancia: number
  ventas_sin_costo: number
}

export type VentaDelDia = {
  id: string
  total: number
  metodo_pago: MetodoPago
  creado_en: string
  anulada_en: string | null
  motivo_anulacion: string | null
  lineas: { nombre: string; cantidad: number; subtotal: number; vende_por: VendePor }[]
}

export type CierreDia = {
  fecha: string
  efectivo_esperado: number
  efectivo_contado: number
  diferencia: number
  total_ventas: number
  ganancia: number
  creado_en: string
}
