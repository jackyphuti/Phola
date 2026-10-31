'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LockScreen } from '@/components/lock-screen'
import { NearbyFinder } from '@/components/nearby-finder'
import { AppLoadingState } from '@/components/app-loading-state'
import { Button } from '@/components/ui/button'
import { LogIn } from 'lucide-react'

export default function NearbyPage() {
  const router = useRouter()
  const { user, isLoading, isLocked } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <AppLoadingState message="Locating nearby services..." />
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h2 className="text-base font-bold text-foreground">Sign in to search local directory</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Explore verified police stations, clinics, taxi ranks, and shopping malls across South Africa.
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

  return <NearbyFinder />
}
