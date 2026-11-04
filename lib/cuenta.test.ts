import assert from "node:assert/strict";
import { test } from "node:test";
import { correoDeUsuario, DOMINIO_INTERNO, limpiarUsuario, usuarioVisible } from "@/lib/cuenta";

test("un usuario simple se vuelve la dirección interna", () => {
  assert.equal(correoDeUsuario("Jeremias"), `jeremias@${DOMINIO_INTERNO}`);
  assert.equal(correoDeUsuario("  jeremias.perez "), `jeremias.perez@${DOMINIO_INTERNO}`);
});

test("un correo real se usa tal cual", () => {
  assert.equal(correoDeUsuario("Dueno@Gmail.com"), "dueno@gmail.com");
  assert.equal(correoDeUsuario("malo@correo"), null);
});

test("rechaza usuarios demasiado cortos o vacíos", () => {
  assert.equal(correoDeUsuario("ab"), null);
  assert.equal(correoDeUsuario("   "), null);
});

test("limpia tildes, espacios y signos raros", () => {
  assert.equal(limpiarUsuario("Jeremías Pérez"), "jeremias.perez");
  assert.equal(limpiarUsuario("¡Ña Ñeco!"), "na.neco");
});

test("muestra solo el usuario de las cuentas internas", () => {
  assert.equal(usuarioVisible(`jeremias@${DOMINIO_INTERNO}`), "jeremias");
  assert.equal(usuarioVisible("dueno@gmail.com"), "dueno@gmail.com");
});
