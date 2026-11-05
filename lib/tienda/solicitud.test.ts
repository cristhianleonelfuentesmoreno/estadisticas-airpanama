import assert from "node:assert/strict";
import { test } from "node:test";
import { limpiarSolicitud } from "@/lib/tienda/solicitud";

const base = { negocio: '  Mini   Super Lupita ', tipo: 'Minisúper', telefono: '6123-4567', vende_por_libra: true, porcentaje_ganancia: 30 }

test('limpiarSolicitud ordena los datos y rechaza lo que no sirve', () => {
  assert.deepEqual(limpiarSolicitud(base), { ...base, negocio: 'Mini Super Lupita' })
  assert.equal(limpiarSolicitud({ ...base, negocio: ' ' }), 'Escribe el nombre del negocio')
  assert.equal(limpiarSolicitud({ ...base, telefono: 'llámame' }), 'El teléfono no es válido')
  assert.equal(limpiarSolicitud({ ...base, porcentaje_ganancia: 100 }), 'El % de ganancia va de 0 a 99')
  assert.equal((limpiarSolicitud({ ...base, tipo: 'Casino' }) as { tipo: string }).tipo, 'Otro')
})
