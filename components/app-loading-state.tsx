'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, AlertCircle, Home, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clearAppCacheAndReload } from '@/components/cache-auto-cleaner'

interface AppLoadingStateProps {
  message?: string
  timeoutSeconds?: number
  onContinueAnyway?: () => void
}

export function AppLoadingState({
  message = 'Securing your encrypted connection...',
  timeoutSeconds = 5,
  onContinueAnyway,
}: AppLoadingStateProps) {
  const router = useRouter()
  const [hasTimedOut, setHasTimedOut] = useState(false)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => {
        const next = prev + 1
        if (next >= timeoutSeconds) {
          setHasTimedOut(true)
        }
        return next
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeoutSeconds])

  const handleReload = async () => {
    setIsRefreshing(true)
    await clearAppCacheAndReload(true)
  }

  if (!hasTimedOut) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center select-none"
      >
        <div className="relative mb-4 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 animate-ping absolute opacity-60" />
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground tracking-tight">{message}</p>
        <p className="text-xs text-muted-foreground mt-1">Phola Emergency Network</p>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 text-center animate-in fade-in duration-300"
    >
      <div className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-6 shadow-xl dark:border-border dark:bg-card">
        <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h2 className="text-base font-bold text-foreground">
          Taking longer than usual to connect
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
          Your connection may be slow or offline. Phola protects your saved notes, offline reports, and security PIN regardless.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {onContinueAnyway ? (
            <Button
              onClick={onContinueAnyway}
              className="w-full rounded-xl bg-primary hover:bg-primary/95 text-white font-semibold text-xs h-10 shadow-xs"
            >
              Continue Anyway
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/dashboard')}
              className="w-full rounded-xl bg-primary hover:bg-primary/95 text-white font-semibold text-xs h-10 shadow-xs"
            >
              <Home className="mr-1.5 h-4 w-4" />
              Go to Dashboard
            </Button>
          )}

          <Button
            variant="outline"
            disabled={isRefreshing}
            onClick={handleReload}
            className="w-full rounded-xl border-emerald-200 hover:bg-emerald-50 text-emerald-950 font-semibold text-xs h-10"
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Re-syncing...' : 'Re-sync Fresh Assets'}
          </Button>

          <Button
            variant="ghost"
            onClick={() => router.push('/auth/login')}
            className="w-full rounded-xl text-xs text-muted-foreground hover:text-foreground h-9"
          >
            <LogIn className="mr-1.5 h-3.5 w-3.5" />
            Sign in with Account
          </Button>
        </div>
      </div>
    </div>
  )
}
