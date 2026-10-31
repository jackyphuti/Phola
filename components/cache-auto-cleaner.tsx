'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'

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

    // 4. Force reload with cache-busting query parameter if requested
    if (forceReload) {
      const url = new URL(window.location.href)
      url.searchParams.set('_sync', Date.now().toString())
      window.location.replace(url.toString())
    }
  } catch (err) {
    console.error('[Phola Cache Service] Error purging cache:', err)
    if (forceReload) {
      window.location.reload()
    }
  }
}

/**
 * Headless background cache maintenance service.
 * Performs silent self-healing in the background without rendering any UI popups or toasts:
 * 1. Automatically catches ChunkLoadErrors / outdated deployment bundles and purges stale caches.
 * 2. If initial load hangs past 8 seconds, quietly flushes stale Service Worker caches without UI disruption.
 * 3. Never renders anything on the DOM (returns null).
 */
export function CacheAutoCleaner() {
  const { isLoading } = useAuth()
  const didSilentPurgeRef = useRef(false)

  // 1. Silent ChunkLoadError / Dynamic Script Failure Auto-Healer
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
        console.warn('[Phola Cache Service] Background healing chunk mismatch:', msg)

        // Throttle auto-reloads (max 2 attempts per 60 seconds)
        const lastReload = parseInt(window.sessionStorage.getItem('phola_chunk_reload_ts') || '0', 10)
        const reloadCount = parseInt(window.sessionStorage.getItem('phola_chunk_reload_count') || '0', 10)
        const now = Date.now()

        if (now - lastReload < 60000 && reloadCount >= 2) {
          console.error('[Phola Cache Service] Maximum auto-recovery attempts reached.')
          return
        }

        window.sessionStorage.setItem('phola_chunk_reload_ts', now.toString())
        window.sessionStorage.setItem('phola_chunk_reload_count', (reloadCount + 1).toString())

        // Silently clear stale chunk cache and reload with fresh bundle
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

  // 2. Silent Cold-Start Hang Watchdog (Background only - NO UI)
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!isLoading) {
      didSilentPurgeRef.current = false
      return
    }

    // If loading remains stuck past 8 seconds, quietly refresh background caches
    const hangTimeout = setTimeout(() => {
      if (isLoading && !didSilentPurgeRef.current) {
        didSilentPurgeRef.current = true
        console.warn('[Phola Cache Service] Cold start delayed; executing silent background cache sync.')
        // Purge caches silently without forcing a hard page reload
        void clearAppCacheAndReload(false).then(() => {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
              for (const reg of registrations) {
                void reg.update()
              }
            }).catch(() => {})
          }
        })
      }
    }, 8000)

    return () => {
      clearTimeout(hangTimeout)
    }
  }, [isLoading])

  // Headless background worker: render nothing to the UI
  return null
}
