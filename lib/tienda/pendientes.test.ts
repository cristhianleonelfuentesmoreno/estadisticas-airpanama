import assert from "node:assert/strict";
import { test } from "node:test";
import { agregarPendiente, esSinInternet, marcarError, quitarPendiente, type VentaPendiente } from "@/lib/tienda/pendientes";

const venta = (id: string): VentaPendiente => ({ id, tiendaId: 't', metodo: 'efectivo', lineas: [], total: 1, hecha_en: '2026-11-05T15:00:00Z' })

test('la cola de ventas sin internet no repite, quita y marca errores', () => {
  let l = agregarPendiente([], venta('a'))
  l = agregarPendiente(l, venta('a'))
  l = agregarPendiente(l, venta('b'))
  assert.deepEqual(l.map(v => v.id), ['a', 'b'])
  l = marcarError(l, 'b', 'sin precio')
  assert.equal(l[1].error, 'sin precio')
  assert.deepEqual(quitarPendiente(l, 'a').map(v => v.id), ['b'])
})

test('esSinInternet reconoce los errores de red', () => {
  assert.equal(esSinInternet(new TypeError('Failed to fetch')), true)
  assert.equal(esSinInternet(new Error('Load failed')), true)
  assert.equal(esSinInternet(new Error('No autorizado')), false)
})
