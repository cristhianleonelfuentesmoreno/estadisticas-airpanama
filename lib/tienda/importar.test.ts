import assert from "node:assert/strict";
import { test } from "node:test";
import { leerFilas, planear } from "@/lib/tienda/importar";

test('leerFilas encuentra el encabezado aunque tenga otro nombre y salta filas vacías', () => {
  const r = leerFilas([
    ['Inventario de mi tienda'],
    ['Nombre', 'Código', 'Cantidad', 'Precio', 'Costo', 'Se vende por', 'Categoría'],
    ['Coca-Cola 2 L', '7501055303786', 12, '$2.30', '1,60', 'Unidad', 'bebidas'],
    [null, null, null],
    ['Papa', '', '25.5', 1.2, '', 'libra', ''],
  ])
  assert.ok(Array.isArray(r))
  assert.equal(r.length, 2)
  assert.deepEqual(r[0], { fila: 3, nombre: 'Coca-Cola 2 L', codigo: '7501055303786', disponible: 12, precio: 2.3, costo: 1.6, vende_por: 'unidad', categoria: 'Bebidas', minimo: null, error: null })
  assert.equal(r[1].vende_por, 'libra')
  assert.equal(r[1].codigo, null)
  assert.equal(r[1].disponible, 25.5)
})

test('leerFilas avisa si no hay columna de nombre', () => {
  assert.equal(leerFilas([['Precio', 'Costo'], [1, 2]]), 'No encontré la columna «Producto» o «Nombre» en el Excel')
})

test('leerFilas marca números malos y repetidos', () => {
  const r = leerFilas([
    ['Producto', 'Código de barras', 'Precio de venta'],
    ['Pan', '', 'gratis'],
    ['Leche', '123', 1],
    ['Arroz', '', 1],
    ['arroz', '', 1],
  ])
  assert.ok(Array.isArray(r))
  assert.equal(r[0].error, 'El precio no es un número')
  assert.equal(r[1].error, 'El código de barras no es válido')
  assert.equal(r[3].error, 'Está repetido (fila 4)')
})

test('planear: nuevo, actualizar e igual', () => {
  const filas = leerFilas([
    ['Producto', 'Código de barras', 'Precio de venta', 'Disponible'],
    ['Coca-Cola 2 L', '7501055303786', 2.5, 10],
    ['Pan', '', 0.25, null],
    ['Huevos', '', 3, null],
  ])
  assert.ok(Array.isArray(filas))
  const plan = planear(filas, [
    { id: 'a', nombre: 'Coca Cola grande', codigo_barras: '7501055303786', precio_venta: 2.3, costo: 1.6, categoria: null, stock_minimo: null },
    { id: 'b', nombre: 'pan', codigo_barras: null, precio_venta: 0.25, costo: null, categoria: null, stock_minimo: null },
  ])
  assert.equal(plan[0].accion, 'actualizar')
  assert.equal(plan[0].producto_id, 'a')
  assert.deepEqual(plan[0].cambios, ['precio $2.30 → $2.50', 'contar: 10'])
  assert.equal(plan[1].accion, 'igual')
  assert.equal(plan[2].accion, 'nuevo')
})

test('planear: la cantidad negativa del Excel descargado no da error si no cambió', () => {
  const filas = leerFilas([['Producto', 'Disponible'], ['Pan', -2], ['Leche', -1], ['Queso', -3]])
  assert.ok(Array.isArray(filas))
  const plan = planear(filas, [
    { id: 'p', nombre: 'Pan', codigo_barras: null, precio_venta: 0.25, costo: null, categoria: null, stock_minimo: null, stock: -2 },
    { id: 'l', nombre: 'Leche', codigo_barras: null, precio_venta: 1, costo: null, categoria: null, stock_minimo: null, stock: 4 },
  ])
  assert.equal(plan[0].accion, 'igual')
  assert.equal(plan[1].error, 'La cantidad no puede ser negativa')
  assert.equal(plan[2].accion, 'error')
})
