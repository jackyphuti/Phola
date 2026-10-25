'use client'

import { useEffect, useRef } from 'react'
import { safeExit } from '@/lib/safe-exit'

export function ShakeToExit() {
  const lastTriggerRef = useRef(0)
  const isListeningRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const threshold = 18

    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity
      if (!acceleration) return

      const magnitude = Math.sqrt(
        Math.pow(acceleration.x ?? 0, 2) +
        Math.pow(acceleration.y ?? 0, 2) +
        Math.pow(acceleration.z ?? 0, 2)
      )

      if (magnitude < threshold) return

      const now = Date.now()
      if (now - lastTriggerRef.current < 2000) return

      lastTriggerRef.current = now
      safeExit()
    }

    const startListening = () => {
      if (isListeningRef.current) return
      window.addEventListener('devicemotion', handleMotion)
      isListeningRef.current = true
    }

    // Check for iOS 13+ permission API
    const maybeDeviceMotionEvent = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }

    if (typeof maybeDeviceMotionEvent?.requestPermission === 'function') {
      const requestIOSPermission = async () => {
        try {
          const response = await maybeDeviceMotionEvent.requestPermission!()
          if (response === 'granted') {
            startListening()
          }
        } catch {
          // Permission dismissed or unavailable
        }
      }

      // Request on first user interaction to comply with iOS security requirements
      window.addEventListener('click', requestIOSPermission, { once: true })
      window.addEventListener('touchstart', requestIOSPermission, { once: true })
    } else {
      // Standard Android / Desktop / non-iOS platforms
      startListening()
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion)
      isListeningRef.current = false
    }
  }, [])

  return null
}
