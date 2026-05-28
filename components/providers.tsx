'use client'

import { useEffect } from 'react'
import '@/sentry.client.config'
import { I18nextProvider } from 'react-i18next'
import { AuthProvider } from '@/lib/auth-context'
import i18n, { initI18n } from '@/lib/i18n'
import { DEFAULT_LANGUAGE } from '@/lib/language-options'
import { loadLanguagePreference } from '@/lib/locale-storage'
import { OfflineBanner } from '@/components/offline-banner'
import { OfflineSyncManager } from '@/components/offline-sync-manager'
import { ShakeToExit } from '@/components/shake-to-exit'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initI18n()
    void loadLanguagePreference().then((language) => {
      void i18n.changeLanguage(language)
      document.documentElement.lang = language || DEFAULT_LANGUAGE
    })
  }, [])

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <OfflineSyncManager />
        <ShakeToExit />
        <OfflineBanner />
        {children}
      </AuthProvider>
    </I18nextProvider>
  )
}
