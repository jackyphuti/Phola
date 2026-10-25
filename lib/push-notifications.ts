import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/lib/api-client'

type PushEventType = 'sos' | 'incident'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  } catch {
    return null
  }
}

async function authedPushPost(path: string, payload: Record<string, unknown>) {
  const token = await getAccessToken()
  if (!token) return

  await fetch(getApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  return Notification.requestPermission()
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function subscribeForProductionPush() {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) return false

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return false

  const registration = await registerNotificationServiceWorker()
  if (!registration) return false

  const existingSubscription = await registration.pushManager.getSubscription()
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  await authedPushPost('/api/push/subscribe', {
    subscription: subscription.toJSON(),
  })

  return true
}

export async function triggerServerPushEvent(input: {
  eventType: PushEventType
  title?: string
  message?: string
  href?: string
  metadata?: Record<string, unknown>
}) {
  await authedPushPost('/api/push/trigger', input)
}

async function showNotification(title: string, body: string, data?: Record<string, unknown>) {
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return

  const registration = await registerNotificationServiceWorker()
  if (registration) {
    await registration.showNotification(title, {
      body,
      icon: '/icon-light-32x32.png',
      badge: '/icon-light-32x32.png',
      data,
    })
    return
  }

  new Notification(title, {
    body,
    icon: '/icon-light-32x32.png',
  })
}

export async function notifySOSActivated() {
  await showNotification('SOS Activated', 'Trusted circle alert initiated. Keep your location on.', {
    href: '/sos',
  })

  await triggerServerPushEvent({
    eventType: 'sos',
    title: 'SOS Activated',
    message: 'Emergency mode is active. Open SOS for live support actions.',
    href: '/sos',
  })
}

export async function triggerIncidentPushEvent(input: {
  crimeType: string
  location?: string
}) {
  await triggerServerPushEvent({
    eventType: 'incident',
    title: 'Report submitted',
    message: input.location
      ? `${input.crimeType} report recorded for ${input.location}.`
      : `${input.crimeType} report recorded successfully.`,
    href: '/notes',
    metadata: input,
  })
}
