import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Permite abrir el servidor de desarrollo desde el celular en la red local
  allowedDevOrigins: ['192.168.1.13:3000', '192.168.1.13', 'localhost:3000'],
  serverExternalPackages: ['tesseract.js'],
  // El OCR corre en un worker_thread que carga su motor (WASM) con require dinámico;
  // el trazado no lo ve y sin esto el worker se cae en Vercel y la lectura queda colgada
  outputFileTracingIncludes: Object.fromEntries(['/dashboard', '/dashboard/**/*'].map(route => [route, [
    './node_modules/tesseract.js/package.json',
    './node_modules/tesseract.js/src/**/*',
    './node_modules/{bmp-js,zlibjs,is-url,regenerator-runtime,node-fetch,whatwg-url,tr46,webidl-conversions}/**/*',
    './node_modules/tesseract.js-core/**/*',
    './node_modules/wasm-feature-detect/**/*',
  ]])),
  // Cabeceras de seguridad en todas las respuestas
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        // Nadie puede mostrar la app dentro de un marco de otro sitio (clickjacking)
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        // El navegador no reinterpreta el tipo de los archivos
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // Al salir a otro sitio no se envía la dirección completa de la página
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Solo la app puede pedir ubicación; cámara y micrófono desactivados
        { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
        // Siempre por HTTPS
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ],
    }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  }
};

export default nextConfig;
