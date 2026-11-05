// ValisVentas: guarda la caja en el celular para poder abrirla sin internet.
// - Los archivos de la app (/_next/static) se guardan la primera vez y salen del celular después.
// - Las pantallas de la tienda (/t/...) se piden siempre a internet; si no hay, sale la última copia.
// - Nada más se toca: ventas, login y acciones siempre van al servidor.
const ESTATICOS = 'vv-estaticos-v1'
const PAGINAS = 'vv-paginas-v1'
const ULTIMA_CAJA = '/__ultima-caja'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    for (const nombre of await caches.keys()) {
      if (nombre !== ESTATICOS && nombre !== PAGINAS) await caches.delete(nombre)
    }
    await self.clients.claim()
  })())
})

const esCaja = ruta => /^\/t\/[^/]+\/caja\/?$/.test(ruta)

async function guardarPagina(peticion, respuesta) {
  const ruta = new URL(peticion.url).pathname
  if (!respuesta.ok || respuesta.redirected || !ruta.startsWith('/t/')) return
  const cache = await caches.open(PAGINAS)
  await cache.put(ruta, respuesta.clone())
  if (esCaja(ruta)) await cache.put(ULTIMA_CAJA, respuesta.clone())
}

// La pantalla abre la app y avisa qué archivos ya cargó (antes de que existiera este service worker)
self.addEventListener('message', evento => {
  const datos = evento.data
  if (!datos || datos.tipo !== 'guardar') return
  evento.waitUntil((async () => {
    const estaticos = await caches.open(ESTATICOS)
    const urls = (Array.isArray(datos.urls) ? datos.urls : []).filter(u => typeof u === 'string' && new URL(u).origin === location.origin)
    await Promise.all(urls.map(u => estaticos.match(u).then(ya => ya || estaticos.add(u)).catch(() => {})))
    // Cada versión nueva de la app trae archivos nuevos: se borran los más viejos para no llenar el celular
    const guardados = await estaticos.keys()
    await Promise.all(guardados.slice(0, Math.max(0, guardados.length - 600)).map(k => estaticos.delete(k)))
    if (typeof datos.pagina === 'string' && datos.pagina.startsWith('/t/')) {
      const r = await fetch(datos.pagina, { credentials: 'include' }).catch(() => null)
      if (r) await guardarPagina(new Request(new URL(datos.pagina, location.origin)), r)
    }
  })())
})

self.addEventListener('fetch', evento => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return
  const url = new URL(peticion.url)
  if (url.origin !== location.origin) return

  if (url.pathname.startsWith('/_next/static/')) {
    evento.respondWith((async () => {
      const cache = await caches.open(ESTATICOS)
      const ya = await cache.match(peticion)
      if (ya) return ya
      const r = await fetch(peticion)
      if (r.ok) await cache.put(peticion, r.clone())
      return r
    })())
    return
  }

  if (peticion.mode === 'navigate') {
    evento.respondWith((async () => {
      try {
        const r = await fetch(peticion)
        await guardarPagina(peticion, r)
        return r
      } catch {
        const cache = await caches.open(PAGINAS)
        const copia = (await cache.match(url.pathname)) || (await cache.match(ULTIMA_CAJA))
        if (copia) return copia
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin internet</title>' +
          '<body style="font-family:system-ui;padding:2rem;text-align:center;color:#065f46"><h1>Sin internet</h1>' +
          '<p>Abre la caja una vez con internet y después funcionará sin señal.</p></body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
      }
    })())
  }
})
