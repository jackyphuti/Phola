'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LockScreen } from '@/components/lock-screen'
import { AuthScreen } from '@/components/auth-screen'
import { AppLoadingState } from '@/components/app-loading-state'

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading, isLocked } = useAuth()

  useEffect(() => {
    if (!isLoading && user && !isLocked) {
      router.push('/dashboard')
    }
  }, [user, isLoading, isLocked, router])

  if (isLoading) {
    return <AppLoadingState message="Connecting to Phola..." />
  }

  // Show lock screen if user is logged in but locked
  if (user && isLocked) {
    return <LockScreen />
  }

  // If already logged in, redirecting to dashboard
  if (user) {
    return (
      <AppLoadingState
        message="Opening Phola dashboard..."
        onContinueAnyway={() => router.push('/dashboard')}
      />
    )
  }

  // Unauthenticated user -> Unified, professional enterprise-grade Auth experience
  return (
    <Suspense fallback={<AppLoadingState message="Preparing secure login..." />}>
      <AuthScreen initialMode="login" />
    </Suspense>
  )
}
