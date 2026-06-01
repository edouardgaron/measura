// public/sw.js — Service worker Measura (PWA installable + offline shell)
const CACHE = 'measura-v1'
const CORE = ['/offline', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Navigations : réseau d'abord, repli page hors-ligne
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/offline'))
    )
    return
  }

  // Actifs statiques : stale-while-revalidate
  const isStatic =
    url.pathname.startsWith('/_next/static') ||
    /\.(svg|png|jpg|jpeg|webp|ico|woff2?|css|js)$/.test(url.pathname)

  if (isStatic) {
    event.respondWith(
      caches.open(CACHE).then(async (c) => {
        const cached = await c.match(req)
        const network = fetch(req)
          .then((res) => { if (res && res.status === 200) c.put(req, res.clone()); return res })
          .catch(() => cached)
        return cached || network
      })
    )
  }
})
