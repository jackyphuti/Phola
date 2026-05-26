import webpush from 'web-push'

type StoredPushSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  content_encoding: string | null
}

type PushSendResult = {
  successIds: string[]
  staleIds: string[]
  failures: Array<{ id: string; reason: string }>
}

let vapidConfigured = false

function configureVapid() {
  if (vapidConfigured) return

  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!subject || !publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured')
  }

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
  if (subscriptions.length === 0) {
    return { successIds: [], staleIds: [], failures: [] }
  }

  configureVapid()

  const successIds: string[] = []
  const staleIds: string[] = []
  const failures: Array<{ id: string; reason: string }> = []
  const payloadText = JSON.stringify(payload)

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(toWebPushSubscription(subscription), payloadText)
      successIds.push(subscription.id)
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
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
