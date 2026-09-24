import type { MetadataRoute } from "next";

// Herramienta interna con acceso restringido: no debe aparecer en buscadores.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
