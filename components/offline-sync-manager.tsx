'use client'

import { useEffect, useState } from 'react'
import { syncQueuedIncidentSubmissions } from '@/lib/offline-queue'

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine)

    updateStatus()
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  return isOnline
}

function useBatteryLevel() {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [charging, setCharging] = useState(false)

  useEffect(() => {
    type BatteryLike = {
      level: number
      charging: boolean
      addEventListener: (type: 'levelchange' | 'chargingchange', listener: () => void) => void
      removeEventListener: (type: 'levelchange' | 'chargingchange', listener: () => void) => void
    }

    let battery: BatteryLike | null = null

    const attach = async () => {
      const batteryNavigator = navigator as Navigator & {
        getBattery?: () => Promise<BatteryLike>
      }

      if (typeof batteryNavigator.getBattery !== 'function') {
        return
      }

      battery = await batteryNavigator.getBattery()

      const update = () => {
        setBatteryLevel(battery?.level ?? null)
        setCharging(Boolean(battery?.charging))
      }

      update()
      battery.addEventListener('levelchange', update)
      battery.addEventListener('chargingchange', update)

      return () => {
        battery?.removeEventListener('levelchange', update)
        battery?.removeEventListener('chargingchange', update)
      }
    }

    let cleanup: (() => void) | undefined
    void attach().then((result) => {
      cleanup = result
    })

    return () => {
      cleanup?.()
    }
  }, [])

  return { batteryLevel, charging }
}

export function OfflineSyncManager() {
  const isOnline = useOnlineStatus()
  const { batteryLevel, charging } = useBatteryLevel()

  useEffect(() => {
    if (!isOnline) {
      return
    }

    const lowBattery = batteryLevel !== null && batteryLevel < 0.2 && !charging
    const delay = lowBattery ? 10 * 60 * 1000 : 0
    const timer = window.setTimeout(() => {
      void syncQueuedIncidentSubmissions()
    }, delay)

    return () => window.clearTimeout(timer)
  }, [batteryLevel, charging, isOnline])

  return null
}
