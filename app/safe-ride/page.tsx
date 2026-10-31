'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LockScreen } from '@/components/lock-screen'
import { SafeRideMonitor } from '@/components/safe-ride-monitor'
import { AppLoadingState } from '@/components/app-loading-state'
import { Button } from '@/components/ui/button'
import { LogIn } from 'lucide-react'

function SafeRideContent() {
  const router = useRouter()
  const { user, isLoading, isLocked } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <AppLoadingState message="Loading Safe Ride Watchdog..." />
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h2 className="text-base font-bold text-foreground">Sign in to activate Safe Ride</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Safe Ride Watchdog tracks trip arrival times and sends alerts to your emergency contacts.
        </p>
        <Button
          onClick={() => router.push('/auth/login')}
          className="mt-4 rounded-xl text-xs font-semibold"
          size="sm"
        >
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          Continue to Sign In
        </Button>
      </div>
    )
  }

  if (isLocked) return <LockScreen />

  return <SafeRideMonitor />
}

export default function SafeRidePage() {
  return (
    <Suspense fallback={<AppLoadingState message="Loading Safe Ride..." />}>
      <SafeRideContent />
    </Suspense>
  )
}
