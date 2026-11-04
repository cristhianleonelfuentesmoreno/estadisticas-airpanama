import assert from "node:assert/strict";
import { test } from "node:test";
import { cantidad, dinero, inicioDeHoyPanama, margen, normalizarCodigo, redondear2 } from "@/lib/tienda/formato";

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
