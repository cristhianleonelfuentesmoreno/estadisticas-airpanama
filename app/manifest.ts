import type { MetadataRoute } from 'next'

// Permite instalar ValisVentas en el celular como una app; al abrirla entra directo a la caja
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ValisVentas',
    short_name: 'ValisVentas',
    description: 'Caja, inventario y escáner para tu tienda',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#047857',
    lang: 'es-PA',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
