/**
 * Phola Service Worker - Web Push, Background Guardian Sync & Network-First Caching
 * Version: phola-cache-v8
 */

const CACHE_NAME = 'phola-cache-v8'

// Track notified IDs in Service Worker scope to prevent duplicate OS notifications
const notifiedDistressMap = new Map()
const notifiedInviteSet = new Set()
let bgTimerId = null

async function checkGuardianUpdatesInBackground() {
  try {
    const res = await fetch('/api/location-share', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    if (!res.ok) return

    const data = await res.json()

    // 1. Check for active distress pings from buddies
    if (Array.isArray(data.active)) {
      const now = Date.now()
      for (const buddy of data.active) {
        if (buddy.buddyDistress && buddy.buddyDistressAt) {
          const ageMs = now - new Date(buddy.buddyDistressAt).getTime()
          if (ageMs < 30 * 60 * 1000) {
            const lastNotifiedAt = notifiedDistressMap.get(buddy.shareId)
            if (lastNotifiedAt !== buddy.buddyDistressAt) {
              notifiedDistressMap.set(buddy.shareId, buddy.buddyDistressAt)
              await self.registration.showNotification(
                `EMERGENCY: ${buddy.buddyName || 'Your Buddy'} Feels Unsafe!`,
                {
                  body: buddy.buddyDistressMessage || 'Distress ping triggered! Tap to track live GPS location on map.',
                  icon: '/icon-light-32x32.png',
                  badge: '/icon-light-32x32.png',
                  vibrate: [600, 250, 600, 250, 1000, 400, 1000],
                  tag: `phola-distress-${buddy.shareId}`,
                  renotify: true,
                  requireInteraction: true,
                  data: {
                    href: `/sos?focusBuddy=${buddy.shareId}`,
                    distress: true,
                  },
                  actions: [
                    { action: 'track', title: 'Track Live on Map' },
                    { action: 'saps', title: 'Call SAPS (10111)' },
                  ],
                }
              )
            }
          }
        }
      }
    }

    // 2. Check for incoming location share invites
    if (Array.isArray(data.incoming)) {
      for (const inv of data.incoming) {
        if (inv.shareId && !notifiedInviteSet.has(inv.shareId)) {
          notifiedInviteSet.add(inv.shareId)
          await self.registration.showNotification(
            `New Guardian Circle Invite`,
            {
              body: `${inv.fromName || inv.fromEmail} invited you to share live locations on Phola. Tap to accept.`,
              icon: '/icon-light-32x32.png',
              badge: '/icon-light-32x32.png',
              vibrate: [300, 150, 300],
              tag: `phola-invite-${inv.shareId}`,
              renotify: true,
              data: {
                href: '/sos?openBuddies=true',
                distress: false,
              },
              actions: [
                { action: 'accept', title: 'Open & Accept' },
              ],
            }
          )
        }
      }
    }
  } catch {
    // Offline or unauthenticated
  }
}

function startBackgroundPollLoop() {
  if (bgTimerId) return
  void checkGuardianUpdatesInBackground()
  bgTimerId = setInterval(() => {
    void checkGuardianUpdatesInBackground()
  }, 12000)
}

self.addEventListener('install', () => {
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
     .then(() => startBackgroundPollLoop())
  )
})

// Periodic Background Sync (fires even when app is closed on supported browsers)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'phola-guardian-sync') {
    event.waitUntil(checkGuardianUpdatesInBackground())
  }
})

self.addEventListener('sync', (event) => {
  if (event.tag === 'phola-guardian-sync') {
    event.waitUntil(checkGuardianUpdatesInBackground())
  }
})

// Listen for commands from the client
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.action === 'skipWaiting') {
      self.skipWaiting()
    }
    if (event.data.type === 'START_GUARDIAN_BACKGROUND_SYNC') {
      startBackgroundPollLoop()
      void checkGuardianUpdatesInBackground()
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

  // 2. DO NOT cache dynamic Next.js chunks in Service Worker
  if (
    url.pathname.startsWith('/_next/static/chunks/') ||
    url.pathname.startsWith('/_next/data/')
  ) {
    return
  }

  // 3. For page navigations (HTML), use Network-First with a 3-second network race
  if (event.request.mode === 'navigate') {
    event.respondWith(
      Promise.race([
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {})
          }
          return networkResponse
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Navigation network timeout')), 3000)
        ),
      ]).catch(async () => {
        const cached = await caches.match(event.request)
        if (cached) return cached
        const rootCached = await caches.match('/')
        if (rootCached) return rootCached
        return new Response('Offline', { status: 503 })
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
})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Phola Safety Alert',
    body: 'You have a new safety update.',
    href: '/sos',
    distress: false,
    eventType: 'update',
  }

  if (event.data) {
    try {
      const parsed = event.data.json()
      payload = {
        title: parsed?.title || payload.title,
        body: parsed?.body || payload.body,
        href: parsed?.href || payload.href,
        distress: Boolean(parsed?.distress || parsed?.eventType === 'sos'),
        eventType: parsed?.eventType || 'update',
      }
    } catch {
      const text = event.data.text()
      if (text) {
        payload.body = text
      }
    }
  }

  const isDistress =
    payload.distress ||
    payload.title.includes('EMERGENCY') ||
    payload.title.includes('Unsafe')

  const isInvite = payload.eventType === 'invite'

  const notificationOptions = {
    body: payload.body,
    icon: '/icon-light-32x32.png',
    badge: '/icon-light-32x32.png',
    vibrate: isDistress
      ? [600, 250, 600, 250, 1000, 400, 1000]
      : [300, 150, 300],
    tag: isDistress
      ? 'phola-emergency-distress'
      : isInvite
      ? 'phola-guardian-invite'
      : `phola-${payload.eventType}-${Date.now()}`,
    renotify: true,
    requireInteraction: isDistress || isInvite,
    data: {
      href: payload.href || (isDistress ? '/sos' : '/dashboard'),
      distress: isDistress,
    },
    actions: isDistress
      ? [
          { action: 'track', title: 'Track Live on Map' },
          { action: 'saps', title: 'Call SAPS (10111)' },
        ]
      : isInvite
      ? [
          { action: 'accept', title: 'Open & Accept' },
        ]
      : [],
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'saps') {
    event.waitUntil(
      self.clients.openWindow('tel:10111')
    )
    return
  }

  const href = event.notification?.data?.href || '/sos'

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
