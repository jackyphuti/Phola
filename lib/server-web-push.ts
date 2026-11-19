import webpush from 'web-push'

export const DEFAULT_VAPID_PUBLIC_KEY =
  'BOOUybTE1QlN-P9ypAn8XWeM7oscyJd81BhYib6SyVm-VjHiJrHOVSFbX7irisgWgYgbizikEC3s-tt_xQn8yj8'
const DEFAULT_VAPID_PRIVATE_KEY =
  '8Fqs614pekRV5Gja5S5M0aOPi0DjSzNbWPlrwBDm0TI'
const DEFAULT_VAPID_SUBJECT = 'mailto:safety@phola.co.za'

export type StoredPushSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  content_encoding?: string | null
}

type PushSendResult = {
  successIds: string[]
  staleIds: string[]
  failures: Array<{ id: string; reason: string }>
}

let vapidConfigured = false

function configureVapid() {
  if (vapidConfigured) return

  const subject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    DEFAULT_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

function toWebPushSubscription(subscription: StoredPushSubscription): webpush.PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  }
}

export async function sendWebPushBatch(
  subscriptions: StoredPushSubscription[],
  payload: Record<string, unknown>,
): Promise<PushSendResult> {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return { successIds: [], staleIds: [], failures: [] }
  }

  configureVapid()

  const successIds: string[] = []
  const staleIds: string[] = []
  const failures: Array<{ id: string; reason: string }> = []
  const payloadText = JSON.stringify(payload)

  // Deduplicate by endpoint so a user doesn't get duplicate pushes on the same device
  const seenEndpoints = new Set<string>()
  const uniqueSubs = subscriptions.filter((sub) => {
    if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) return false
    if (seenEndpoints.has(sub.endpoint)) return false
    seenEndpoints.add(sub.endpoint)
    return true
  })

  for (const subscription of uniqueSubs) {
    try {
      await webpush.sendNotification(toWebPushSubscription(subscription), payloadText, {
        TTL: 86400,
        urgency: 'high',
      })
      successIds.push(subscription.id)
    } catch (error) {
      const statusCode =
        typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 0

      const message = error instanceof Error ? error.message : 'Unknown push delivery failure'

      if (statusCode === 404 || statusCode === 410) {
        staleIds.push(subscription.id)
      } else {
        failures.push({ id: subscription.id, reason: message })
      }
    }
  }

  return { successIds, staleIds, failures }
}
