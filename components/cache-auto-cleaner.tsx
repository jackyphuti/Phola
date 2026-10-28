'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Safely purge all temporary browser/WebView network asset caches and Service Worker caches
 * without deleting critical user data (preserves localStorage, Supabase auth, PIN, and offline notes).
 */
export async function clearAppCacheAndReload(forceReload = true): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    // 1. Purge all CacheStorage caches (Service Worker / PWA caches)
    if ('caches' in window) {
      const cacheNames = await window.caches.keys()
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)))
    }

    // 2. Clear & unregister active Service Workers to force fresh fetch
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const registration of registrations) {
        try {
          registration.active?.postMessage({ type: 'CLEAR_CACHE' })
          await registration.unregister()
        } catch {
          // Ignore individual registration errors
        }
      }
    }

    // 3. Mark timestamp to prevent reload loops
    try {
      window.sessionStorage.setItem('phola_last_cache_purge', Date.now().toString())
    } catch {
      // Ignore storage errors
    }

    // 4. Force reload with cache-busting query parameter
    if (forceReload) {
      const url = new URL(window.location.href)
      url.searchParams.set('_sync', Date.now().toString())
      window.location.replace(url.toString())
    }
  } catch (err) {
    console.error('[Phola Cache Cleaner] Error purging cache:', err)
    if (forceReload) {
      window.location.reload()
    }
  }
}

export function CacheAutoCleaner() {
  const [showWatchdogBanner, setShowWatchdogBanner] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  // 1. ChunkLoadError / Dynamic Script Failure Auto-Healer
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleChunkError = (errorMessage?: string) => {
      const msg = errorMessage || ''
      const isChunkError =
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module') ||
        msg.includes('Importing a module script failed')

      if (isChunkError) {
        console.warn('[Phola Cache Watchdog] Chunk load error detected:', msg)

        // Prevent infinite reload loops (limit to 2 auto-reloads per 60 seconds)
        const lastReload = parseInt(window.sessionStorage.getItem('phola_chunk_reload_ts') || '0', 10)
        const reloadCount = parseInt(window.sessionStorage.getItem('phola_chunk_reload_count') || '0', 10)
        const now = Date.now()

        if (now - lastReload < 60000 && reloadCount >= 2) {
          console.error('[Phola Cache Watchdog] Maximum chunk recovery attempts reached.')
          return
        }

        window.sessionStorage.setItem('phola_chunk_reload_ts', now.toString())
        window.sessionStorage.setItem('phola_chunk_reload_count', (reloadCount + 1).toString())

        // Immediately purge outdated cached chunks and reload fresh
        void clearAppCacheAndReload(true)
      }
    }

    const onErrorListener = (event: ErrorEvent) => {
      handleChunkError(event.message || event.error?.message)
    }

    const onUnhandledRejectionListener = (event: PromiseRejectionEvent) => {
      const reasonMsg = event.reason?.message || (typeof event.reason === 'string' ? event.reason : '')
      handleChunkError(reasonMsg)
    }

    window.addEventListener('error', onErrorListener)
    window.addEventListener('unhandledrejection', onUnhandledRejectionListener)

    return () => {
      window.removeEventListener('error', onErrorListener)
      window.removeEventListener('unhandledrejection', onUnhandledRejectionListener)
    }
  }, [])

  // 2. Cold-Start Hang Watchdog (Triggers if the screen remains stuck for > 8 seconds)
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Show manual re-sync banner if screen is hanging after 8 seconds
    const hangTimeout = setTimeout(() => {
      setShowWatchdogBanner(true)
    }, 8000)

    // Optional 1-time automatic self-heal if hanging after 14 seconds
    const autoHealTimeout = setTimeout(() => {
      const hasAutoHealed = window.sessionStorage.getItem('phola_startup_auto_healed') === 'true'
      if (!hasAutoHealed) {
        window.sessionStorage.setItem('phola_startup_auto_healed', 'true')
        void clearAppCacheAndReload(true)
      }
    }, 14000)

    return () => {
      clearTimeout(hangTimeout)
      clearTimeout(autoHealTimeout)
    }
  }, [])

  const handleManualClean = async () => {
    setIsClearing(true)
    await clearAppCacheAndReload(true)
  }

  if (!showWatchdogBanner) return null

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RefreshCw className={`h-4 w-4 ${isClearing ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              Taking longer than usual to load?
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              Re-sync fresh assets without losing your data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="default"
            disabled={isClearing}
            onClick={handleManualClean}
            className="h-8 rounded-lg px-2.5 text-xs font-semibold shadow-xs"
          >
            {isClearing ? 'Re-syncing...' : 'Re-Sync'}
          </Button>
          <button
            type="button"
            onClick={() => setShowWatchdogBanner(false)}
            aria-label="Dismiss loading banner"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
