'use client'

import { useEffect, useRef } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import {
  findMatchingHighRiskZone,
  evaluateLocationSafety,
  isAlertThrottled,
  dispatchHighRiskZoneNotification,
} from '@/lib/high-risk-zones'
import { watchReliableLocation } from '@/lib/geolocation'
import {
  subscribeForProductionPush,
  registerNotificationServiceWorker,
} from '@/lib/push-notifications'
import { initNativeNotificationChannels } from '@/lib/native-notifications'
import { broadcastLiveLocation } from '@/lib/location-sharing'
import { useAuth } from '@/lib/auth-context'

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

/**
 * Always-On Global Location Services, Background Watcher & Danger Zone Monitor.
 *
 * - When running natively on iOS & Android: Uses @capacitor-community/background-geolocation
 *   to continue tracking GPS, evaluating danger zones, and broadcasting live location to
 *   trusted circle buddies even when the app is backgrounded or device is locked.
 * - Dispatches native high-priority LocalNotifications on entry/exit of high-risk sectors.
 * - On Web/PWA: Falls back to browser geolocation watchPosition and Web Push service worker.
 */
export function HighRiskZoneMonitor() {
  const { user } = useAuth()
  const lastZoneIdRef = useRef<string | null>(null)
  const lastSafetyStateRef = useRef<'safe' | 'high_risk'>('safe')
  const lastBroadcastTimeRef = useRef<number>(0)
  const hasSubscribedPushRef = useRef(false)

  useEffect(() => {
    // 1. Initialize notification channels and service worker
    void registerNotificationServiceWorker()
    void initNativeNotificationChannels()

    // 2. Attempt push subscription on mount
    if (user && !hasSubscribedPushRef.current) {
      void subscribeForProductionPush().then((ok) => {
        if (ok) hasSubscribedPushRef.current = true
      })
    }

    // 3. User interaction gesture fallback
    const handleFirstInteraction = () => {
      if (!hasSubscribedPushRef.current) {
        void subscribeForProductionPush().then((ok) => {
          if (ok) hasSubscribedPushRef.current = true
        })
      }
    }

    window.addEventListener('click', handleFirstInteraction, { passive: true, once: true })
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true, once: true })

    return () => {
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('touchstart', handleFirstInteraction)
    }
  }, [user])

  useEffect(() => {
    let nativeWatcherId: string | null = null
    let stopWebWatcher: (() => void) | null = null

    const handleCoordsUpdate = async (lat: number, lng: number) => {
      const now = Date.now()

      // Broadcast live coordinates to Guardian Circle buddies (throttled to every 30s)
      if (user && now - lastBroadcastTimeRef.current >= 30000) {
        lastBroadcastTimeRef.current = now
        void broadcastLiveLocation({ lat, lng })
      }

      // Check if user entered or exited a high-risk danger zone
      const match = findMatchingHighRiskZone(lat, lng)

      if (match) {
        const { zone } = match
        const isNewZone = lastZoneIdRef.current !== zone.id
        const isTransition = lastSafetyStateRef.current !== 'high_risk'

        if ((isNewZone || isTransition) && !isAlertThrottled(zone.id)) {
          lastZoneIdRef.current = zone.id
          lastSafetyStateRef.current = 'high_risk'

          if (Capacitor.isNativePlatform()) {
            try {
              await Haptics.vibrate({ duration: 900 })
              await LocalNotifications.schedule({
                notifications: [
                  {
                    id: Math.floor(now % 1000000),
                    title: `HIGH-RISK ZONE ALERT: ${zone.name.toUpperCase()}`,
                    body: `You have entered a known safety hotspot (${zone.name}). Keep vehicle doors locked and stay alert.`,
                    channelId: 'phola_emergency',
                    extra: { href: '/sos', distress: true },
                  },
                ],
              })
            } catch {}
          } else {
            void dispatchHighRiskZoneNotification(zone)
          }
        }
      } else {
        // Exited high-risk zone back into safe patrol sector
        if (lastSafetyStateRef.current === 'high_risk') {
          lastSafetyStateRef.current = 'safe'
          lastZoneIdRef.current = null

          if (Capacitor.isNativePlatform()) {
            try {
              await Haptics.impact({ style: ImpactStyle.Light })
              await LocalNotifications.schedule({
                notifications: [
                  {
                    id: Math.floor(now % 1000000),
                    title: 'Area Safety Status: Normal Vigilance',
                    body: 'You have exited the high-risk zone into a standard patrol sector.',
                    channelId: 'phola_safety_updates',
                    extra: { href: '/sos', distress: false },
                  },
                ],
              })
            } catch {}
          }
        }
      }
    }

    if (Capacitor.isNativePlatform()) {
      BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: 'Phola Safety Active',
          backgroundMessage: 'Monitoring your area safety and trusted circle.',
          requestPermissions: true,
          stale: false,
          distanceFilter: 50,
        },
        (location, error) => {
          if (error) {
            console.warn('[BackgroundGeolocation] watcher callback error:', error)
            return
          }
          if (location) {
            void handleCoordsUpdate(location.latitude, location.longitude)
          }
        }
      )
        .then((watcherId) => {
          nativeWatcherId = watcherId
        })
        .catch((err) => {
          console.warn('[BackgroundGeolocation] addWatcher failed, falling back to web watcher:', err)
          stopWebWatcher = watchReliableLocation((coords) => {
            void handleCoordsUpdate(coords.lat, coords.lng)
          })
        })
    } else {
      stopWebWatcher = watchReliableLocation((coords) => {
        void handleCoordsUpdate(coords.lat, coords.lng)
      })
    }

    return () => {
      if (nativeWatcherId) {
        BackgroundGeolocation.removeWatcher({ id: nativeWatcherId }).catch(() => {})
      }
      if (stopWebWatcher) {
        stopWebWatcher()
      }
    }
  }, [user])

  return null
}
