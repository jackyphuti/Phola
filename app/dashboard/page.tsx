'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LockScreen } from '@/components/lock-screen'
import { SuperHome } from '@/components/super-home'
import { AppLoadingState } from '@/components/app-loading-state'
import { Button } from '@/components/ui/button'
import { LogIn } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const { user, profile, isLoading, isLocked } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <AppLoadingState message="Loading Phola community dashboard..." />
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h2 className="text-base font-bold text-foreground">Sign in to access Phola Dashboard</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Redirecting to authentication. If you are not redirected, click below.
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

  if (isLocked) {
    return <LockScreen />
  }

  const name = profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'friend'

  return <SuperHome name={name} />
}
