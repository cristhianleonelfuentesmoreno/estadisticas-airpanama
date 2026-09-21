import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore: Propiedad válida en la versión actual de Next.js para permitir acceso desde el celular
  allowedDevOrigins: ['192.168.1.13:3000', '192.168.1.13', 'localhost:3000'],
  serverExternalPackages: ['tesseract.js'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  }
};

export default nextConfig;
