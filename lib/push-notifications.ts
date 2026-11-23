import { createClient } from '@/lib/supabase/client'
import { getApiUrl } from '@/lib/api-client'
import { Capacitor } from '@capacitor/core'
import { registerNativePush, scheduleNativeLocalNotification } from '@/lib/native-notifications'

const DEFAULT_VAPID_PUBLIC_KEY =
  'BOOUybTE1QlN-P9ypAn8XWeM7oscyJd81BhYib6SyVm-VjHiJrHOVSFbX7irisgWgYgbizikEC3s-tt_xQn8yj8'

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  await fetch(getApiUrl(path), {
    method: 'POST',
    headers,
    credentials: 'include',
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

  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    // Activate background guardian sync inside service worker
    if (reg.active) {
      reg.active.postMessage({ type: 'START_GUARDIAN_BACKGROUND_SYNC' })
    }
    // Register Periodic Background Sync if supported by browser/PWA
    try {
      const anyReg = reg as any
      if (anyReg.periodicSync && typeof anyReg.periodicSync.register === 'function') {
        await anyReg.periodicSync.register('phola-guardian-sync', {
          minInterval: 60 * 1000,
        })
      }
    } catch {}
    return reg
  } catch {
    return null
  }
}

export async function subscribeForProductionPush(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // On Native Android & iOS: delegate to native push registration & notification channels
  if (Capacitor.isNativePlatform()) {
    return await registerNativePush()
  }

  if (!('serviceWorker' in navigator)) return false

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return false

  const registration = await registerNotificationServiceWorker()
  if (!registration) return false

  if (!('PushManager' in window) || !registration.pushManager) {
    return true
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY

  try {
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
    }

    const subJson = subscription.toJSON()

    // 1. Register in push_subscriptions table
    await authedPushPost('/api/push/subscribe', {
      subscription: subJson,
    }).catch(() => {})

    // 2. Also attach subscription to user's active/pending location_shares rows so buddies can push directly without RLS block
    await fetch(getApiUrl('/api/location-share'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'sync_push',
        subscription: subJson,
      }),
    }).catch(() => {})

    return true
  } catch (err) {
    console.warn('[PushNotifications] subscribe warning:', err)
    return false
  }
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

export async function showSystemNotification(
  title: string,
  body: string,
  options?: {
    href?: string
    tag?: string
    distress?: boolean
  }
) {
  // On Native Android & iOS: delegate to high-priority local notifications & channels
  if (Capacitor.isNativePlatform()) {
    return await scheduleNativeLocalNotification({
      title,
      body,
      href: options?.href,
      distress: options?.distress,
    })
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return

  const isDistress = Boolean(options?.distress)
  const notifOptions: any = {
    body,
    icon: '/icon-light-32x32.png',
    badge: '/icon-light-32x32.png',
    vibrate: isDistress ? [600, 250, 600, 250, 1000, 400, 1000] : [250, 150, 250],
    tag: options?.tag || (isDistress ? 'phola-emergency-distress' : 'phola-notification'),
    renotify: true,
    requireInteraction: isDistress,
    data: {
      href: options?.href || '/sos',
      distress: isDistress,
    },
  }

  const registration = await registerNotificationServiceWorker()
  if (registration && registration.showNotification) {
    await registration.showNotification(title, notifOptions)
    return
  }

  new Notification(title, notifOptions)
}

export async function notifySOSActivated() {
  await showSystemNotification('SOS Activated', 'Trusted circle alert initiated. Keep your location on.', {
    href: '/sos',
    distress: true,
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
    href: '/reports',
    metadata: input,
  })
}
