'use client'

import { useEffect, useRef } from 'react'
import {
  findMatchingHighRiskZone,
  isAlertThrottled,
  dispatchHighRiskZoneNotification,
} from '@/lib/high-risk-zones'
import { watchReliableLocation } from '@/lib/geolocation'
import { requestNotificationPermission } from '@/lib/push-notifications'

/**
 * Background Danger Zone & Unsafe Places Geofencing Monitor.
 *
 * Requirements:
 * - Runs completely in the background across all pages.
 * - Does NOT alter or add anything to the visual UI (renders null).
 * - Keeps continuous GPS and map location service running.
 * - Automatically dispatches system notification and voice/vibration alert
 *   when entering high-risk hotspots in South Africa.
 */
export function HighRiskZoneMonitor() {
  const lastZoneIdRef = useRef<string | null>(null)

  useEffect(() => {
    // 1. Proactively request notification permission on mount if supported
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        void requestNotificationPermission().catch(() => {})
      }
    }

    // 2. Continuous background GPS geolocation service
    const stopWatcher = watchReliableLocation(
      (coords) => {
        const match = findMatchingHighRiskZone(coords.lat, coords.lng)

        if (match) {
          const { zone } = match

          // Check if alert is throttled or if user already alerted for this zone recently
          if (!isAlertThrottled(zone.id)) {
            lastZoneIdRef.current = zone.id
            void dispatchHighRiskZoneNotification(zone)
          }
        } else {
          // User exited any high-risk zone
          lastZoneIdRef.current = null
        }
      },
      (err) => {
        // Geolocation error fallback
        console.warn('[HighRiskZoneMonitor] Geolocation background watch warning:', err.message)
      }
    )

    return () => {
      stopWatcher()
    }
  }, [])

  // Zero UI modification: strictly operates as an invisible background service
  return null
}
