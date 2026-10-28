/**
 * Phola Service Worker - Web Push, Background Notifications & Network-First Caching
 * Version: phola-cache-v6
 */

const CACHE_NAME = 'phola-cache-v6'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key)
        })
      )
    ).then(() => self.clients.claim())
  )
})

// Listen for direct cache clear commands from the client
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.action === 'skipWaiting') {
      self.skipWaiting()
    }
    if (event.data.type === 'CLEAR_CACHE') {
      caches.keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true, timestamp: Date.now() })
          }
        })
        .catch(() => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: false })
          }
        })
    }
  }
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 1. NEVER intercept API routes, Supabase calls, OAuth/auth flows, Webpack HMR, or non-GET requests
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('overpass-api.de') ||
    url.hostname.includes('overpass.kumi.systems')
  ) {
    return
  }

  // 2. DO NOT cache dynamic Next.js chunks in Service Worker.
  // Next.js chunks are already content-hashed; letting the browser handle them directly
  // prevents stale chunk mismatches (ChunkLoadError) when new deployments go live.
  if (
    url.pathname.startsWith('/_next/static/chunks/') ||
    url.pathname.startsWith('/_next/data/')
  ) {
    return
  }

  // 3. For page navigations (HTML), use Network-First and avoid caching stale HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        return (await caches.match('/')) || new Response('Offline', { status: 503 })
      })
    )
    return
  }

  // 4. For static images/icons/fonts, use Cache-First / Stale-While-Revalidate
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // Default: pass through to network
})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Phola Alert',
    body: 'You have a new update.',
    href: '/dashboard',
  }

  if (event.data) {
    try {
      const parsed = event.data.json()
      payload = {
        title: parsed?.title || payload.title,
        body: parsed?.body || payload.body,
        href: parsed?.href || payload.href,
      }
    } catch {
      const text = event.data.text()
      if (text) {
        payload.body = text
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-light-32x32.png',
      badge: '/icon-light-32x32.png',
      data: {
        href: payload.href,
      },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const href = event.notification?.data?.href || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(href)
          return client.focus()
        }
      }
      return self.clients.openWindow(href)
    })
  )
})
