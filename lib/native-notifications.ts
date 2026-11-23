import { Capacitor } from '@capacitor/core'
import { PushNotifications, type ActionPerformed, type PushNotificationSchema, type Token } from '@capacitor/push-notifications'
import { LocalNotifications, type Channel } from '@capacitor/local-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { getApiUrl } from '@/lib/api-client'
import { createClient } from '@/lib/supabase/client'

let channelsInitialized = false
let listenersAttached = false

/**
 * Initializes high-priority Android notification channels.
 * Required for Android 8+ heads-up display, sound, and lock-screen visibility.
 */
export async function initNativeNotificationChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform() || channelsInitialized) return

  if (Capacitor.getPlatform() === 'android') {
    try {
      const emergencyChannel: Channel = {
        id: 'phola_emergency',
        name: 'Urgent SOS & Distress',
        importance: 5, // MAX / HIGH
        sound: 'default',
        vibration: true,
        visibility: 1, // PUBLIC on lock screen
        description: 'Urgent SOS and buddy distress alarms',
      }

      const updatesChannel: Channel = {
        id: 'phola_safety_updates',
        name: 'Live Area Safety Updates',
        importance: 4, // HIGH
        sound: 'default',
        vibration: true,
        visibility: 1,
        description: 'Live area safety status and danger zone alerts',
      }

      await LocalNotifications.createChannel(emergencyChannel)
      await LocalNotifications.createChannel(updatesChannel)

      if ('createChannel' in PushNotifications) {
        await (PushNotifications as any).createChannel(emergencyChannel)
        await (PushNotifications as any).createChannel(updatesChannel)
      }

      channelsInitialized = true
    } catch (err) {
      console.warn('[native-notifications] Channel init warning:', err)
    }
  }
}

/**
 * Sends registered native push token to backend for database persistence.
 */
async function sendTokenToServer(token: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'

    const res = await fetch(getApiUrl('/api/push/register-device'), {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ token, platform }),
    })

    return res.ok
  } catch (err) {
    console.warn('[native-notifications] Token upload to backend failed:', err)
    return false
  }
}

/**
 * Registers the device for native push notifications (FCM on Android, APNs on iOS).
 */
export async function registerNativePush(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false

  try {
    await initNativeNotificationChannels()

    // 1. Request permissions for both Push Notifications and Local Notifications
    const pushPerm = await PushNotifications.requestPermissions()
    await LocalNotifications.requestPermissions()

    if (pushPerm.receive !== 'granted') {
      console.warn('[native-notifications] Push permission receive state:', pushPerm.receive)
      return false
    }

    // 2. Attach listeners if not already attached
    if (!listenersAttached) {
      listenersAttached = true

      // On successful token registration
      await PushNotifications.addListener('registration', async (token: Token) => {
        if (token?.value) {
          await sendTokenToServer(token.value)
        }
      })

      // On registration error
      await PushNotifications.addListener('registrationError', (err: any) => {
        console.warn('[native-notifications] Native push registration error:', err)
      })

      // Foreground push arrival: trigger strong haptics and pop visual local alert
      await PushNotifications.addListener(
        'pushNotificationReceived',
        async (notification: PushNotificationSchema) => {
          const isDistress =
            notification.data?.distress === 'true' ||
            notification.data?.distress === true ||
            (notification.title || '').includes('EMERGENCY')

          try {
            if (isDistress) {
              await Haptics.vibrate({ duration: 900 })
              setTimeout(() => {
                void Haptics.vibrate({ duration: 900 })
              }, 1200)
            } else {
              await Haptics.impact({ style: ImpactStyle.Heavy })
            }
          } catch {}

          // Schedule instant local notification so it displays visibly in foreground
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: Math.floor(Date.now() % 1000000),
                  title: notification.title || (isDistress ? 'EMERGENCY DISTRESS' : 'Safety Alert'),
                  body: notification.body || '',
                  channelId: isDistress ? 'phola_emergency' : 'phola_safety_updates',
                  extra: {
                    href: notification.data?.href || '/sos',
                    distress: isDistress,
                    shareId: notification.data?.shareId || '',
                  },
                },
              ],
            })
          } catch {}
        }
      )

      // When user taps a push notification
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          const href = action.notification?.data?.href || '/sos'
          if (typeof window !== 'undefined' && href) {
            window.location.href = href
          }
        }
      )

      // When user taps a local notification
      await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (action: any) => {
          const href = action.notification?.extra?.href || '/sos'
          if (typeof window !== 'undefined' && href) {
            window.location.href = href
          }
        }
      )
    }

    // 3. Register with Apple / Google push services
    await PushNotifications.register()
    return true
  } catch (err) {
    console.warn('[native-notifications] registerNativePush exception:', err)
    return false
  }
}

/**
 * Schedules a native local notification with sound, channel, and haptic feedback.
 */
export async function scheduleNativeLocalNotification(options: {
  id?: number
  title: string
  body: string
  href?: string
  distress?: boolean
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false

  try {
    await initNativeNotificationChannels()
    const isDistress = Boolean(options.distress)

    try {
      if (isDistress) {
        await Haptics.vibrate({ duration: 800 })
      } else {
        await Haptics.impact({ style: ImpactStyle.Medium })
      }
    } catch {}

    await LocalNotifications.schedule({
      notifications: [
        {
          id: options.id || Math.floor(Date.now() % 1000000),
          title: options.title,
          body: options.body,
          channelId: isDistress ? 'phola_emergency' : 'phola_safety_updates',
          extra: {
            href: options.href || '/sos',
            distress: isDistress,
          },
        },
      ],
    })
    return true
  } catch (err) {
    console.warn('[native-notifications] scheduleNativeLocalNotification error:', err)
    return false
  }
}
