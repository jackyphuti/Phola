self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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
