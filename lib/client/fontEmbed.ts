// Fuentes para capturar HTML como imagen (PDF de Reportes).
// html-to-image, si no se le dan, recorre TODAS las hojas de estilo; las de otro dominio
// (Google Fonts de los íconos) no se pueden leer y el navegador lanza un SecurityError.
// Aquí se arma el CSS solo con la fuente de la app, desde hojas propias, y se incrusta.

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// ¿El unicode-range incluye las letras a-z? Acepta "U+0-FF", "U+0000-00FF", "U+61", "U+0??"
function coversLatin(range: string) {
  return range.split(",").some(part => {
    const m = part.trim().toUpperCase().match(/^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/);
    if (!m) return false;
    const [, start, end] = m;
    const lo = parseInt(start.replace(/\?/g, "0"), 16);
    const hi = end ? parseInt(end, 16) : parseInt(start.replace(/\?/g, "F"), 16);
    return lo <= 0x61 && hi >= 0x7a;
  });
}

let cached: Promise<string> | null = null;

export function buildFontEmbedCSS(): Promise<string> {
  cached ??= build().catch(() => {
    cached = null; // si falla, que se pueda reintentar; el PDF usa la fuente del sistema
    return "";
  });
  return cached;
}

async function build(): Promise<string> {
  // Familias que usa la página (la de la app va primero)
  const families = getComputedStyle(document.body).fontFamily
    .split(",")
    .map(f => f.trim().replace(/["']/g, "").toLowerCase());

  const faces: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    // Solo hojas del mismo dominio: las demás no se pueden leer
    if (sheet.href && new URL(sheet.href, location.href).origin !== location.origin) continue;
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim().toLowerCase();
      if (!families.includes(family)) continue;
      // Solo la variante que cubre el alfabeto latino básico (letras, acentos y ñ)
      const range = rule.style.getPropertyValue("unicode-range");
      if (range && !coversLatin(range)) continue;
      faces.push(rule);
    }
  }

  const css = await Promise.all(faces.map(async rule => {
    let text = rule.cssText;
    const base = rule.parentStyleSheet?.href ?? location.href;
    for (const [, url] of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (url.startsWith("data:")) continue;
      const blob = await fetch(new URL(url, base).href).then(r => r.blob());
      text = text.replace(url, await toDataUrl(blob));
    }
    return text;
  }));
  return css.join("\n");
}
