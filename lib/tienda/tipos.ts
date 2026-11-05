// Tipos compartidos entre el servidor y las pantallas de la tienda

export type RolTienda = 'dueno' | 'cajero' | 'contador'

export type Tienda = {
  id: string
  negocio_id: string
  nombre: string
  slug: string
  // El contador solo ve sus reportes; dueño y cajero usan la app completa
  rol: RolTienda
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
  stock_minimo: number | null
  // En pausa: ya no se vende; no sale en la caja ni en los pedidos, pero se guarda su historia
  activo: boolean
  // Cuánto busca ganar, en % del precio de venta (30 si nadie lo cambió)
  porcentaje_ganancia: number
  stock: number
  // false si nunca se contó ni entró nada: su stock 0 no significa que se acabó
  contado: boolean
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

export type ProductoVendido = { nombre: string; vende_por: VendePor; cantidad: number; importe: number; ganancia: number | null }

export type Estadisticas = {
  total: number
  ventas: number
  ganancia: number
  ventas_sin_costo: number
  total_anterior: number
  por_dia: { dia: string; total: number }[]
  metodos: Partial<Record<MetodoPago, number>>
  mas_vendidos: ProductoVendido[]
  mas_ganancia: ProductoVendido[]
  quietos: { nombre: string; vende_por: VendePor; cantidad: number; valor: number }[]
  quietos_cantidad: number
  quietos_valor: number
  perdidas: number
  primera_venta: string | null
  // Días desde la primera venta con ValisVentas (para no llamar "quieto" a todo al empezar)
  dias_vendiendo: number
}
