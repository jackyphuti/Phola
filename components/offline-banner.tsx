'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getQueuedIncidentCount, syncQueuedIncidentSubmissions } from '@/lib/offline-queue'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'

export function OfflineBanner() {
  const { t } = useTranslation()
  const [isOnline, setIsOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const verifyOnlineStatus = useCallback(async () => {
    const rawOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    const currentQueue = getQueuedIncidentCount()
    setQueuedCount(currentQueue)

    if (rawOnline) {
      setIsOnline(true)
      return
    }

    // Double check with a fast ping to prevent false-alarm offline warnings
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
      const res = await fetch('/phola-icon.svg', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (res.ok) {
        setIsOnline(true)
        return
      }
    } catch {
      // Confirmed offline
    }

    setIsOnline(false)
  }, [])

  useEffect(() => {
    void verifyOnlineStatus()

    const onOnline = () => {
      setIsOnline(true)
      setQueuedCount(getQueuedIncidentCount())
      void syncQueuedIncidentSubmissions().then(() => {
        setQueuedCount(getQueuedIncidentCount())
      })
    }

    const onOffline = () => {
      void verifyOnlineStatus()
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Periodic queue check every 15s
    const interval = setInterval(() => {
      setQueuedCount(getQueuedIncidentCount())
    }, 15000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(interval)
    }
  }, [verifyOnlineStatus])

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      await syncQueuedIncidentSubmissions()
      setQueuedCount(getQueuedIncidentCount())
    } finally {
      setIsSyncing(false)
    }
  }

  // 1. Fully online and no queued items: Render nothing
  if (isOnline && queuedCount === 0) {
    return null
  }

  // 2. Online with pending unsynced records: Informative sync pill, NOT an alarming offline warning
  if (isOnline && queuedCount > 0) {
    return (
      <aside
        aria-label="Pending Reports Sync Banner"
        className="sticky top-0 z-30 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-center text-xs font-medium text-emerald-950 backdrop-blur-md"
      >
        <div className="flex items-center justify-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            Online • {queuedCount} saved report{queuedCount > 1 ? 's' : ''} queued for cloud sync.
          </span>
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleManualSync}
            className="ml-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </aside>
    )
  }

  // 3. Genuine offline mode: Warning banner positioned at z-30 (below drawer z-50 and header z-40)
  return (
    <aside
      aria-label="Offline Mode Warning Banner"
      className="sticky top-0 z-30 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-xs font-semibold text-amber-950 backdrop-blur-md"
    >
      <div className="flex items-center justify-center gap-1.5">
        <WifiOff className="h-3.5 w-3.5 text-amber-800 shrink-0" />
        <span>{t('offlineBanner') || 'Offline mode — emergency reports will sync when reconnected.'}</span>
      </div>
      {queuedCount > 0 && (
        <div className="mt-0.5 text-[11px] font-normal text-amber-900/90">
          {queuedCount} report{queuedCount > 1 ? 's' : ''} stored safely in your encrypted device vault.
        </div>
      )}
    </aside>
  )
}
