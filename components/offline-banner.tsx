'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getQueuedIncidentCount } from '@/lib/offline-queue'

export function OfflineBanner() {
  const { t } = useTranslation()
  const [isOnline, setIsOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)

  useEffect(() => {
    const update = () => {
      setIsOnline(navigator.onLine)
      setQueuedCount(getQueuedIncidentCount())
    }

    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)

    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (isOnline && queuedCount === 0) {
    return null
  }

  return (
    <div className="sticky top-0 z-[1500] border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-900 backdrop-blur">
      <div>{t('offlineBanner')}</div>
      {queuedCount > 0 && <div className="mt-0.5 text-[11px]">{t('syncWhenConnected')}</div>}
    </div>
  )
}
