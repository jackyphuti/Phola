/**
 * Phola Service Worker - Web Push, Background Notifications & Network-First Caching
 */

const CACHE_NAME = 'phola-cache-v4'

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 1. NEVER intercept API routes, Supabase calls, OAuth/auth flows, or non-GET requests
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('overpass-api.de') ||
    url.hostname.includes('overpass.kumi.systems')
  ) {
    return
  }

  // 2. Network-First for HTML pages and Next.js scripts (falls back to cache if offline)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
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
