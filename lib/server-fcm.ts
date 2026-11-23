import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getMessaging, type MulticastMessage, type BatchResponse } from 'firebase-admin/messaging'

function getFirebaseApp() {
  const apps = getApps()
  if (apps.length > 0) {
    return apps[0]
  }

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountRaw) {
    return null
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountRaw)
    return initializeApp({
      credential: cert(serviceAccount),
    })
  } catch (err) {
    console.warn('[server-fcm] Failed to parse or initialize Firebase Admin:', err)
    return null
  }
}

export interface NativePushPayload {
  title: string
  body: string
  href?: string
  distress?: boolean
  shareId?: string
}

/**
 * Dispatches high-priority native notifications via Firebase Cloud Messaging (FCM/APNs).
 * Configured with emergency notification channels, heads-up priority, and lock screen visibility.
 */
export async function sendNativePushBatch(
  tokens: string[],
  payload: NativePushPayload,
  onInvalidTokens?: (invalidTokens: string[]) => Promise<void> | void
): Promise<{ successCount: number; failureCount: number }> {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0 }
  }

  const app = getFirebaseApp()
  if (!app) {
    console.warn('[server-fcm] FIREBASE_SERVICE_ACCOUNT_JSON is not configured. Native push dispatch skipped.')
    return { successCount: 0, failureCount: 0 }
  }

  const messaging = getMessaging(app)
  const isDistress = Boolean(payload.distress)
  const channelId = isDistress ? 'phola_emergency' : 'phola_safety_updates'

  const message: MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      href: payload.href || '/sos',
      distress: String(isDistress),
      shareId: payload.shareId || '',
      title: payload.title,
      body: payload.body,
    },
    android: {
      priority: 'high',
      notification: {
        channelId,
        sound: 'default',
        defaultVibrateTimings: false,
        vibrateTimingsMillis: [0, 600, 250, 600, 250, 1000],
        priority: 'max',
        visibility: 'public',
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: 'default',
          'interruption-level': isDistress ? 'time-sensitive' : 'active',
          'content-available': 1,
        },
      },
    },
  }

  try {
    const response: BatchResponse = await messaging.sendEachForMulticast(message)
    const invalidTokens: string[] = []

    response.responses.forEach((resp, idx: number) => {
      if (!resp.success && resp.error) {
        const errCode = resp.error.code
        if (
          errCode === 'messaging/registration-token-not-registered' ||
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/invalid-argument'
        ) {
          invalidTokens.push(tokens[idx])
        }
      }
    })

    if (invalidTokens.length > 0 && onInvalidTokens) {
      try {
        await onInvalidTokens(invalidTokens)
      } catch (err) {
        console.warn('[server-fcm] onInvalidTokens callback error:', err)
      }
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    }
  } catch (err) {
    console.warn('[server-fcm] sendEachForMulticast error:', err)
    return { successCount: 0, failureCount: tokens.length }
  }
}
