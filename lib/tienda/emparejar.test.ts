import assert from "node:assert/strict";
import { test } from "node:test";
import { emparejar, palabras } from "@/lib/tienda/emparejar";

const inventario = [
  { id: "chokis", nombre: "Chokis rellena 42/90g", codigo_barras: "7501000604685" },
  { id: "maruchan", nombre: "Sopa Maruchan pollo 85g", codigo_barras: "041789002915" },
  { id: "bigcola", nombre: "Big Cola 1000ml", codigo_barras: null },
  { id: "bigginger", nombre: "Big Ginger Ale 3030ml", codigo_barras: null },
  { id: "papa", nombre: "Papa", codigo_barras: null },
];

test("une por código de barras aunque venga con un 0 de más", () => {
  assert.deepEqual(emparejar({ descripcion: "lo que sea", codigo_barras: "0041789002915" }, inventario), { producto_id: "maruchan", por: "codigo" });
});

test("sin código, sugiere por las palabras del nombre", () => {
  assert.deepEqual(
    emparejar({ descripcion: "BIG GINGER ALE PET NO RETORNABLE 3030 ML 6", codigo_barras: null }, inventario),
    { producto_id: "bigginger", por: "nombre" },
  );
  assert.deepEqual(
    emparejar({ descripcion: "CHOKIS RELLENA 42/90G", codigo_barras: "7509999999999" }, inventario),
    { producto_id: "chokis", por: "nombre" },
  );
});

test("no inventa cuando no hay suficientes palabras en común", () => {
  assert.equal(emparejar({ descripcion: "VOLT FRUIT PUNCH 360 ML 12", codigo_barras: null }, inventario), null);
  assert.equal(emparejar({ descripcion: "SOPA TIO CHAN MIXTA", codigo_barras: null }, inventario), null);
});

test("las palabras ignoran tildes, números sueltos y relleno", () => {
  assert.deepEqual(palabras("Néctar de Manzana 946 ML (12)"), ["nectar", "manzana"]);
});
