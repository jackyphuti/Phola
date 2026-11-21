'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

/**
 * LockScreen has been replaced by native device-level app lock (iOS / Android Face ID / Passcode).
 * If rendered, it immediately releases any lock state and renders null.
 */
export function LockScreen() {
  const { unlock } = useAuth()

  useEffect(() => {
    unlock()
  }, [unlock])

  return null
}
