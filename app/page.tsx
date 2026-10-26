'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LockScreen } from '@/components/lock-screen'
import { AuthScreen } from '@/components/auth-screen'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading, isLocked } = useAuth()

  useEffect(() => {
    if (!isLoading && user && !isLocked) {
      router.push('/dashboard')
    }
  }, [user, isLoading, isLocked, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Show lock screen if user is logged in but locked
  if (user && isLocked) {
    return <LockScreen />
  }

  // If already logged in, redirecting to dashboard
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Unauthenticated user -> Unified, professional enterprise-grade Auth experience
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthScreen initialMode="login" />
    </Suspense>
  )
}
