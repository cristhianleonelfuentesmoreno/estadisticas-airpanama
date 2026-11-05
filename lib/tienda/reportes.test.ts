import assert from "node:assert/strict";
import { test } from "node:test";
import { filaInventario, itbmsIncluido, leFalta, rangoMes, sumarDias, ultimosMeses, ventasPorDia, type VentaMes } from "@/lib/tienda/reportes";
import type { Producto } from "@/lib/tienda/tipos";

const base: Producto = {
  id: "1", nombre: "Coca-Cola 2L", marca: null, presentacion: null, categoria: "Bebidas", activo: true, porcentaje_ganancia: 30, codigo_barras: "7441001600065",
  vende_por: "unidad", precio_venta: 2.5, costo: 1.9, itbms: 0, imagen_url: null, stock_minimo: 3, stock: 10, contado: true,
};

test("dice qué le falta a cada producto", () => {
  assert.deepEqual(leFalta(base), []);
  assert.deepEqual(leFalta({ ...base, precio_venta: null, costo: null, codigo_barras: null, contado: false }), ["precio", "costo", "código de barras", "contarlo"]);
});

test("la fila del inventario calcula ganancia y valor de lo que hay", () => {
  const f = filaInventario(base);
  assert.equal(f.ganas, 0.6);
  assert.equal(f.valor_costo, 19);
  assert.equal(f.valor_venta, 25);
  assert.equal(f.le_falta, "");
});

test("lo que nunca se contó queda sin disponible ni valor", () => {
  const f = filaInventario({ ...base, contado: false, stock: 0 });
  assert.equal(f.disponible, null);
  assert.equal(f.valor_costo, null);
  assert.equal(f.le_falta, "contarlo");
});

test("saca el ITBMS que ya viene dentro del precio", () => {
  assert.equal(itbmsIncluido(1.07, 7), 0.07);
  assert.equal(itbmsIncluido(10.7, 7), 0.7);
  assert.equal(itbmsIncluido(5, 0), 0);
});

test("el rango del mes va del día 1 al día 1 del mes siguiente, en hora de Panamá", () => {
  assert.deepEqual(rangoMes("2026-11"), { desde: "2026-11-01T00:00:00-05:00", hasta: "2026-12-01T00:00:00-05:00" });
  assert.deepEqual(rangoMes("2026-12"), { desde: "2026-12-01T00:00:00-05:00", hasta: "2027-01-01T00:00:00-05:00" });
  assert.equal(rangoMes("2026-13"), null);
  assert.equal(rangoMes("noviembre"), null);
});

test("agrupa las ventas por día de Panamá, separa ITBMS y no cuenta las anuladas", () => {
  const ventas: VentaMes[] = [
    // 11:30 p. m. del 1 en Panamá = 2 de noviembre en UTC: debe quedar en el día 1
    { creado_en: "2026-11-02T04:30:00Z", total: 3.57, metodo_pago: "efectivo", anulada: false, lineas: [{ subtotal: 1.07, itbms: 7 }, { subtotal: 2.5, itbms: 0 }] },
    { creado_en: "2026-11-01T15:00:00Z", total: 2, metodo_pago: "yappy", anulada: false, lineas: [{ subtotal: 2, itbms: 0 }] },
    { creado_en: "2026-11-01T16:00:00Z", total: 9, metodo_pago: "tarjeta", anulada: true, lineas: [{ subtotal: 9, itbms: 7 }] },
  ];
  const dias = ventasPorDia(ventas);
  assert.equal(dias.length, 1);
  assert.deepEqual(dias[0], { fecha: "2026-11-01", ventas: 2, efectivo: 3.57, yappy: 2, tarjeta: 0, total: 5.57, gravado: 1.07, itbms: 0.07, exento: 4.5 });
  assert.equal(sumarDias(dias).total, 5.57);
});

test("los últimos meses cruzan el año y usan la hora de Panamá", () => {
  // 1 de enero 3:00 a. m. UTC = 31 de diciembre en Panamá
  const meses = ultimosMeses(3, new Date("2027-01-01T03:00:00Z"));
  assert.deepEqual(meses.map(m => m.id), ["2026-12", "2026-11", "2026-10"]);
  assert.match(meses[0].nombre, /^Diciembre.*2026 \(va en curso\)$/);
});
