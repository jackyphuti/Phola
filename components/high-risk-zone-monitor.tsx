'use client'

import { useEffect, useRef } from 'react'
import {
  findMatchingHighRiskZone,
  isAlertThrottled,
  dispatchHighRiskZoneNotification,
} from '@/lib/high-risk-zones'
import { watchReliableLocation } from '@/lib/geolocation'
import {
  subscribeForProductionPush,
  registerNotificationServiceWorker,
} from '@/lib/push-notifications'
import { broadcastLiveLocation } from '@/lib/location-sharing'
import { useAuth } from '@/lib/auth-context'

/**
 * Always-On Global Location Services, Buddy GPS Broadcaster & Danger Zone Monitor.
 *
 * - Keeps continuous GPS location tracking active across the entire application.
 * - Continuously broadcasts live coordinates to accepted Guardian Circle buddies.
 * - Automatically registers the Service Worker and subscribes the device for
 *   background Web Push notifications (on mount and on first user interaction).
 * - Dispatches system notifications and audio/vibration alerts when entering high-risk zones.
 */
export function HighRiskZoneMonitor() {
  const { user } = useAuth()
  const lastZoneIdRef = useRef<string | null>(null)
  const hasSubscribedPushRef = useRef(false)

  useEffect(() => {
    // 1. Always register the Service Worker immediately
    void registerNotificationServiceWorker()

    // 2. Attempt push subscription on mount
    if (user && !hasSubscribedPushRef.current) {
      void subscribeForProductionPush().then((ok) => {
        if (ok) hasSubscribedPushRef.current = true
      })
    }

    // 3. Also subscribe on first user touch/click (in case browser blocked permission prompt before gesture)
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
    // 4. Continuous Always-On GPS Watcher + Live Buddy Coordinate Broadcaster
    const stopWatcher = watchReliableLocation(
      (coords) => {
        // Broadcast live coordinates to Guardian Circle buddies whenever logged in
        if (user) {
          void broadcastLiveLocation({ lat: coords.lat, lng: coords.lng })
        }

        // Check if user entered a high-risk danger zone
        const match = findMatchingHighRiskZone(coords.lat, coords.lng)
        if (match) {
          const { zone } = match
          if (!isAlertThrottled(zone.id)) {
            lastZoneIdRef.current = zone.id
            void dispatchHighRiskZoneNotification(zone)
          }
        } else {
          lastZoneIdRef.current = null
        }
      },
      (err) => {
        console.warn('[HighRiskZoneMonitor] Geolocation background watch warning:', err.message)
      }
    )

    return () => {
      stopWatcher()
    }
  }, [user])

  return null
}
