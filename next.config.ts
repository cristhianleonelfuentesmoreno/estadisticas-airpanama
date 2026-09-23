import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Permite abrir el servidor de desarrollo desde el celular en la red local
  allowedDevOrigins: ['192.168.1.13:3000', '192.168.1.13', 'localhost:3000'],
  serverExternalPackages: ['tesseract.js'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  }
};

export default nextConfig;
