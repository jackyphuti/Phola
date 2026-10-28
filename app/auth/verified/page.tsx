'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle2, ArrowRight, Smartphone, Globe, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { safeExit } from '@/lib/safe-exit'
import { LanguageSelector } from '@/components/language-selector'
import { getAndroidIntentUrl, getNativeAppDeepLink } from '@/lib/auth-url'
import { playBiometricSuccessChime, triggerHapticFeedback } from '@/lib/biometric'

function VerifiedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [hasAttemptedAppLaunch, setHasAttemptedAppLaunch] = useState(false)

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
  const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent)

  const appDeepLink = getNativeAppDeepLink('/dashboard', { verified: 'true' })
  const androidIntentUrl = getAndroidIntentUrl('/dashboard', { verified: 'true' })
  const primaryLaunchUrl = isAndroid ? androidIntentUrl : appDeepLink

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Mark verified flag in session storage so modals on dashboard / app trigger immediately
    try {
      window.sessionStorage.setItem('phola_just_verified', 'true')
      window.localStorage.setItem('phola_account_verified', 'true')
      playBiometricSuccessChime()
      triggerHapticFeedback([40, 60])
    } catch {}

    // Auto-launch the native app on mobile devices after a 400ms tick
    if (isMobile && !hasAttemptedAppLaunch) {
      setHasAttemptedAppLaunch(true)
      const timer = setTimeout(() => {
        try {
          window.location.href = primaryLaunchUrl
        } catch {}
      }, 400)

      return () => clearTimeout(timer)
    }
  }, [isMobile, hasAttemptedAppLaunch, primaryLaunchUrl])

  const handleOpenApp = () => {
    triggerHapticFeedback([30])
    try {
      window.location.href = primaryLaunchUrl
    } catch {
      router.push('/dashboard?verified=true')
    }
  }

  const handleContinueInBrowser = () => {
    triggerHapticFeedback([20])
    router.push('/dashboard?verified=true')
  }

  const handleSignIn = () => {
    router.push('/auth/login?verified=true')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%),linear-gradient(180deg,#f8fcf9_0%,#ffffff_50%,#f0fdf4_100%)] p-6 safe-top safe-bottom">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed right-4 top-4 z-20 rounded-full border-border/70 bg-background/90 px-4 text-xs font-semibold shadow-2xs backdrop-blur"
        onClick={safeExit}
      >
        Quick Exit
      </Button>

      <div className="w-full max-w-sm space-y-6">
        <LanguageSelector compact />

        <div className="flex flex-col items-center space-y-3">
          <div className="w-18 h-18 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center overflow-hidden shadow-xs ring-4 ring-emerald-100">
            <Image
              src="/phola-icon.svg"
              alt="Phola"
              width={56}
              height={56}
              className="h-12 w-12"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Phola</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Zero-Knowledge Safety Companion</p>
          </div>
        </div>

        <Card className="text-center rounded-[2rem] border-2 border-emerald-200 shadow-xl overflow-hidden bg-white">
          <CardHeader className="pb-3 pt-6">
            <div className="relative w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center mx-auto mb-3 text-emerald-700 shadow-xs">
              <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
              <div className="absolute -top-1 -right-1 bg-amber-400 text-white rounded-full p-1">
                <Sparkles className="w-3.5 h-3.5 fill-white text-white" />
              </div>
            </div>
            
            <div className="flex justify-center mb-1">
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                Confirmed & Verified
              </Badge>
            </div>

            <CardTitle className="text-xl font-extrabold text-foreground">
              Account Verified!
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your email has been confirmed. You now have full access to Phola&apos;s protection network.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3.5 pb-6">
            {/* Primary Action: Open Native Mobile App */}
            {isMobile && (
              <Button
                onClick={handleOpenApp}
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open in Phola App</span>
              </Button>
            )}

            {/* Continue Exploring in Browser */}
            <Button
              onClick={handleContinueInBrowser}
              variant={isMobile ? 'outline' : 'default'}
              className={`w-full h-12 rounded-2xl font-bold text-sm shadow-xs flex items-center justify-center gap-2 ${
                isMobile 
                  ? 'border-emerald-300 text-emerald-900 hover:bg-emerald-50' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Continue Exploring in Browser</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            {/* Direct Sign In Fallback */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-muted-foreground">
              <span>Already have an active session?</span>
              <button
                type="button"
                onClick={handleSignIn}
                className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline"
              >
                Sign In Screen
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function VerifiedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <VerifiedContent />
    </Suspense>
  )
}
