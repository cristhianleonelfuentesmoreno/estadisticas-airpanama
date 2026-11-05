import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparPorProveedor, precioSugerido, textoCierre, cambioPorcentual, costoDe, diasParaVencer, sumarMeses, textoVence, vencePronto, venceQueda, porcentajeValido, totalDe, cantidad, dinero, gananciaPorUnidad, inicioDeHoyPanama, margen, precioParaGanar, MINIMO_POR_DEFECTO, minimoDe, normalizarCodigo, porAgotarse, rangoDe, redondear2, textoPedido } from "@/lib/tienda/formato";

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

test("porcentaje de ganancia: de 0 a menos de 100", () => {
  assert.equal(porcentajeValido("30"), 30);
  assert.equal(porcentajeValido("22,5"), 22.5);
  assert.equal(porcentajeValido("0"), 0);
  assert.equal(porcentajeValido("100"), null);
  assert.equal(porcentajeValido(""), null);
  assert.equal(porcentajeValido("abc"), null);
  assert.equal(porcentajeValido("-5"), null);
});

test("factura: total de la línea y costo del paquete", () => {
  assert.equal(totalDe("2", "9.70"), "19.40");
  assert.equal(costoDe("3", "10"), "3.3333");
  assert.equal(costoDe("2", "19.40"), "9.7");
  assert.equal(totalDe("", "9.70"), "");
  assert.equal(costoDe("0", "10"), "");
  assert.equal(costoDe("2", ""), "");
});

test("caducidad: días, avisos y botones rápidos", () => {
  assert.equal(diasParaVencer("2026-11-10", "2026-11-05"), 5);
  assert.equal(diasParaVencer("2026-11-01", "2026-11-05"), -4);
  assert.equal(vencePronto("2026-11-20", "2026-11-05"), true);
  assert.equal(vencePronto("2026-12-20", "2026-11-05"), false);
  assert.equal(vencePronto(null, "2026-11-05"), false);
  assert.equal(textoVence("2026-11-05", "2026-11-05"), "Vence hoy");
  assert.equal(textoVence("2026-11-04", "2026-11-05"), "Venció ayer");
  assert.equal(textoVence("2026-11-08", "2026-11-05"), "Vence en 3 días");
  assert.equal(sumarMeses("2026-11-05", 3), "2027-02-05");
  assert.equal(sumarMeses("2027-01-31", 1), "2027-02-28");
  assert.equal(sumarMeses("2026-11-05", 12), "2027-11-05");
});

test("caducidad: con mercancía nueva queda la fecha que vence primero", () => {
  assert.equal(venceQueda(null, "2027-01-01", "2026-11-05"), "2027-01-01");
  assert.equal(venceQueda("2026-12-01", "2027-01-01", "2026-11-05"), "2026-12-01");
  assert.equal(venceQueda("2027-02-01", "2027-01-01", "2026-11-05"), "2027-01-01");
  assert.equal(venceQueda("2026-10-01", "2027-01-01", "2026-11-05"), "2027-01-01");
});

test("pedido: con proveedor en el título y agrupado por proveedor", () => {
  assert.equal(textoPedido([{ nombre: "Papa", stock: 0, stock_minimo: 5, vende_por: "libra", contado: true }], "Mini Super", "Feduro"),
    "Pedido para Mini Super · Feduro:\n• Papa (no hay)");
  const g = agruparPorProveedor([{ id: "a" }, { id: "b" }, { id: "c" }], { a: "Feduro", c: "AJE" });
  assert.deepEqual(g.map(x => [x.proveedor, x.productos.map(p => p.id)]), [["AJE", ["c"]], ["Feduro", ["a"]], [null, ["b"]]]);
});

test("sube el costo: sugiere el precio para seguir ganando el %", () => {
  assert.equal(precioSugerido(0.5, 0.4, 0.42, 19), 0.55); // gana 16 %, quiere 19 %
  assert.equal(precioSugerido(0.5, 0.4, 0.38, 19), null); // bajó el costo
  assert.equal(precioSugerido(0.6, 0.4, 0.41, 30), null); // sigue ganando 32 %
  assert.equal(precioSugerido(null, 0.4, 0.5, 30), null); // sin precio lo pone la factura
  assert.equal(precioSugerido(1, null, 0.9, 30), 1.3); // primer costo y gana poco
});

test("resumen del cierre para WhatsApp", () => {
  const t = textoCierre({ tienda: "Mini Super", fecha: "2026-11-05", ventas: 5, total: 5.35, efectivo: 5.35, yappy: 0, tarjeta: 0, ganancia: 1.2, esperado: 25.35, contado: 25, diferencia: -0.35 });
  assert.match(t, /Vendiste \$5\.35 en 5 ventas/);
  assert.match(t, /faltan \$0\.35/);
});
