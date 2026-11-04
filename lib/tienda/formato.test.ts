import assert from "node:assert/strict";
import { test } from "node:test";
import { cambioPorcentual, cantidad, dinero, gananciaPorUnidad, inicioDeHoyPanama, margen, precioParaGanar, MINIMO_POR_DEFECTO, minimoDe, normalizarCodigo, porAgotarse, rangoDe, redondear2, textoPedido } from "@/lib/tienda/formato";

test("redondea la plata a centavos sin errores de coma flotante", () => {
  assert.equal(redondear2(0.1 + 0.2), 0.3);
  assert.equal(redondear2(1.005), 1.01);
  assert.equal(redondear2(0.65 * 1.2), 0.78); // 0.650 lb de papa a $1.20
});

test("muestra la plata con dos decimales y guion si no hay precio", () => {
  assert.equal(dinero(1.5), "$1.50");
  assert.equal(dinero(null), "—");
});

test("muestra libras con hasta tres decimales", () => {
  assert.equal(cantidad(0.65, "libra"), "0.65 lb");
  assert.equal(cantidad(12, "unidad"), "12");
});

test("calcula la ganancia sobre el precio de venta", () => {
  assert.equal(margen(0.35, 0.21), 40); // Marshmallow de Feduro
  assert.equal(margen(null, 0.21), null);
  assert.equal(margen(1, null), null);
});

test("el día empieza a medianoche de Panamá aunque en UTC ya sea mañana", () => {
  // 3 nov 2026, 9:30 p. m. en Panamá = 4 nov 02:30 UTC
  assert.equal(inicioDeHoyPanama(new Date("2026-11-04T02:30:00Z")), "2026-11-03T00:00:00-05:00");
});

test("un UPC leído con 13 dígitos es el mismo producto que con 12", () => {
  assert.equal(normalizarCodigo("0041789002915"), "041789002915"); // Maruchan
  assert.equal(normalizarCodigo("041789002915"), "041789002915");
  assert.equal(normalizarCodigo("7451011301106"), "7451011301106"); // EAN-13 de Panamá no cambia
});

test("avisa cuando el stock llega al mínimo; sin mínimo propio avisa con 1 o menos", () => {
  assert.equal(porAgotarse({ stock: 1, stock_minimo: null, contado: true }), true);
  assert.equal(porAgotarse({ stock: 2, stock_minimo: null, contado: true }), false);
  assert.equal(porAgotarse({ stock: 10, stock_minimo: 12, contado: true }), true);
  assert.equal(porAgotarse({ stock: 1, stock_minimo: 0, contado: true }), false);
  assert.equal(minimoDe({ stock_minimo: null }), MINIMO_POR_DEFECTO);
});

test("lo que nunca se contó no avisa aunque su stock sea 0", () => {
  assert.equal(porAgotarse({ stock: 0, stock_minimo: null, contado: false }), false);
});

test("arma la lista de pedido con lo que más falta primero", () => {
  const texto = textoPedido([
    { nombre: "Coca-Cola 2L", stock: 2, stock_minimo: null, vende_por: "unidad", contado: true },
    { nombre: "Papa", stock: 0, stock_minimo: 5, vende_por: "libra", contado: true },
  ], "Mini Super");
  assert.equal(texto, "Pedido para Mini Super:\n• Papa (no hay)\n• Coca-Cola 2L (quedan 2)");
});

test("los períodos usan el día de Panamá", () => {
  const ahora = new Date("2026-11-05T03:00:00Z"); // 4 nov, 10 p. m. en Panamá
  assert.deepEqual(rangoDe("hoy", ahora), { desde: "2026-11-04", hasta: "2026-11-04" });
  assert.deepEqual(rangoDe("semana", ahora), { desde: "2026-10-29", hasta: "2026-11-04" });
  assert.deepEqual(rangoDe("mes", ahora), { desde: "2026-11-01", hasta: "2026-11-04" });
});

test("compara contra el período anterior solo si hubo ventas", () => {
  assert.equal(cambioPorcentual(112, 100), 12);
  assert.equal(cambioPorcentual(95, 100), -5);
  assert.equal(cambioPorcentual(50, 0), null);
});

test("lo que gana la tienda por unidad", () => {
  assert.equal(gananciaPorUnidad(0.35, 0.21), 0.14);
  assert.equal(gananciaPorUnidad(0.35, null), null);
});

test("precio para ganar un porcentaje, redondeado a 5 centavos hacia arriba", () => {
  assert.equal(precioParaGanar(0.21, 40), 0.35); // Marshmallow de Feduro
  assert.equal(precioParaGanar(0.7, 25), 0.95);
  assert.equal(precioParaGanar(0.81, 20), 1.05); // Big Cola 1L
  assert.equal((margen(precioParaGanar(0.7, 25), 0.7) ?? 0) >= 25, true);
});
