'use client'

import { useEffect, Suspense } from 'react'
import '@/sentry.client.config'
import { I18nextProvider } from 'react-i18next'
import { AuthProvider } from '@/lib/auth-context'
import i18n, { initI18n } from '@/lib/i18n'
import { DEFAULT_LANGUAGE } from '@/lib/language-options'
import { loadLanguagePreference } from '@/lib/locale-storage'
import { OfflineBanner } from '@/components/offline-banner'
import { OfflineSyncManager } from '@/components/offline-sync-manager'
import { HighRiskZoneMonitor } from '@/components/high-risk-zone-monitor'
import { SafetyOnboardingModal } from '@/components/safety-onboarding-modal'
import { AccountVerifiedModal } from '@/components/account-verified-modal'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initI18n()
    void loadLanguagePreference().then((language) => {
      void i18n.changeLanguage(language)
      document.documentElement.lang = language || DEFAULT_LANGUAGE
    })

    // Listen for Capacitor native deep links (phola:// or https://phola-beta.vercel.app/auth/...)
    if (typeof window !== 'undefined') {
      import('@capacitor/app')
        .then(({ App }) => {
          App.addListener('appUrlOpen', (event) => {
            try {
              if (event?.url) {
                if (event.url.includes('verified')) {
                  window.sessionStorage.setItem('phola_just_verified', 'true')
                }
                // Handle phola:// scheme URLs
                if (event.url.startsWith('phola://')) {
                  const pathWithQuery = event.url.replace(/^phola:\/\//, '')
                  window.location.href = `/${pathWithQuery}`
                  return
                }
                const url = new URL(event.url)
                const route = url.pathname || '/dashboard'
                const search = url.search || ''
                window.location.href = `${route}${search}`
              }
            } catch {
              window.location.href = '/dashboard?verified=true'
            }
          })
        })
        .catch(() => {})
    }
  }, [])

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <OfflineSyncManager />
        <OfflineBanner />
        <HighRiskZoneMonitor />
        <SafetyOnboardingModal />
        <Suspense fallback={null}>
          <AccountVerifiedModal />
        </Suspense>
        {children}
      </AuthProvider>
    </I18nextProvider>
  )
}
