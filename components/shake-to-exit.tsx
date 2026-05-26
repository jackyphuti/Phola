'use client'

import { useEffect, useRef } from 'react'
import { safeExit } from '@/lib/safe-exit'

export function ShakeToExit() {
  const lastTriggerRef = useRef(0)

  useEffect(() => {
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

    window.addEventListener('devicemotion', handleMotion)
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [])

  return null
}
