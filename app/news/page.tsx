'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LockScreen } from '@/components/lock-screen'
import { NewsFeed } from '@/components/news-feed'
import { AppLoadingState } from '@/components/app-loading-state'
import { Button } from '@/components/ui/button'
import { LogIn } from 'lucide-react'

export default function NewsPage() {
  const router = useRouter()
  const { user, isLoading, isLocked } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <AppLoadingState message="Fetching live Mzansi news..." />
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h2 className="text-base font-bold text-foreground">Sign in to view live South Africa news</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Stay informed with breaking community alerts and South African headlines.
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

  return <NewsFeed />
}
