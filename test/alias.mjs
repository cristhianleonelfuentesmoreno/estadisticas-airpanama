import { registerHooks } from "node:module";

// Resuelve el alias @/ a archivos TypeScript para ejecutar las pruebas con Node (patrón de atino-web).
const root = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});
