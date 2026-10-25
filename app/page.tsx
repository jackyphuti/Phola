'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from 'react-i18next'
import { LockScreen } from '@/components/lock-screen'
import { 
  ArrowRight, 
  Loader2, 
  ShieldCheck, 
  MapPinned, 
  MessageCircleMore, 
  Car, 
  ShieldAlert, 
  Phone, 
  LogOut, 
  CheckCircle2, 
  Sparkles,
  Lock,
  ChevronRight,
  Radio
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { safeExit } from '@/lib/safe-exit'

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading, isLocked } = useAuth()
  const { t } = useTranslation()

  useEffect(() => {
    if (!isLoading && user && !isLocked) {
      router.push('/dashboard')
    }
  }, [user, isLoading, isLocked, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_38%),linear-gradient(180deg,#f8fffc_0%,#ffffff_100%)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Show lock screen if user is logged in but locked
  if (user && isLocked) {
    return <LockScreen />
  }

  const handleQuickExit = () => {
    safeExit()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.12),_transparent_40%),linear-gradient(180deg,#f6fffb_0%,#ffffff_48%,#f7fbf9_100%)] px-4 py-4 safe-top safe-bottom sm:px-6 lg:px-8">
      
      {/* Background Ambience Glows */}
      <div className="pointer-events-none absolute left-[-6rem] top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-[-4rem] top-8 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />

      {/* ========================================================================= */}
      {/* TOP NAVBAR                                                                */}
      {/* ========================================================================= */}
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-2xs">
            <Image
              src="/phola-icon.svg"
              alt="Phola"
              width={36}
              height={36}
              className="h-7 w-7"
              priority
            />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-foreground">Phola</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Mzansi Safety
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs font-semibold text-emerald-950 hover:bg-emerald-50 h-8 px-3 rounded-full"
          >
            <Link href="/auth/login">
              {t('signIn') || 'Sign In'}
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleQuickExit}
            className="rounded-full border-emerald-200 bg-white/90 text-xs font-semibold text-emerald-900 shadow-2xs hover:bg-emerald-50 h-8 px-3.5 backdrop-blur"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5 text-primary" />
            {t('quickExit') || 'Quick Exit'}
          </Button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* HERO SECTION                                                              */}
      {/* ========================================================================= */}
      <main className="relative mx-auto flex w-full max-w-5xl flex-col items-center justify-center pt-8 sm:pt-14 pb-12 text-center space-y-6">
        
        {/* National Badge */}
        <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900 px-3.5 py-1 text-xs font-semibold shadow-2xs">
          <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
          Mzansi’s Trusted Personal Safety & Community Companion
        </Badge>

        {/* Hero Title */}
        <div className="space-y-3 max-w-3xl">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.15]">
            Safety, dignity, and real-time support in your hands.
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base lg:text-lg leading-relaxed text-muted-foreground">
            From automated <strong>Safe Ride monitoring</strong> for Uber & Bolt, to confidential encrypted GBV reporting, local police station radar, and instant emergency SOS.
          </p>
        </div>

        {/* Dual Primary CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full max-w-md justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto h-12 rounded-full px-8 text-sm sm:text-base font-bold shadow-md shadow-primary/20 bg-primary hover:bg-primary/95 text-white">
            <Link href="/auth/sign-up">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-12 rounded-full border-emerald-200 bg-white px-7 text-sm sm:text-base font-semibold text-emerald-950 hover:bg-emerald-50 shadow-2xs">
            <Link href="/auth/login">
              Sign In to Your Vault
            </Link>
          </Button>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE FEATURE SHOWCASES                                             */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-8 w-full text-left">
          
          {/* Feature 1: Safe Ride */}
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xs hover:border-emerald-300 transition space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-primary">
              <Car className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Safe Ride Watchdog</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Monitors Uber, Bolt, and taxi trips with arrival countdowns and emergency dispatch.
            </p>
          </div>

          {/* Feature 2: GBV Vault */}
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xs hover:border-emerald-300 transition space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-primary">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Confidential GBV Vault</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Structured reporting with police docket auto-linking and tamper-proof evidence storage.
            </p>
          </div>

          {/* Feature 3: Community Radar */}
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xs hover:border-emerald-300 transition space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-primary">
              <MapPinned className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Local Services Radar</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Locates verified police stations, trauma clinics, Gautrain stops, and taxi ranks near you.
            </p>
          </div>

          {/* Feature 4: 1-Tap SOS */}
          <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-2xs hover:border-emerald-300 transition space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-primary">
              <Phone className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Emergency Lifeline</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Press and hold to alert your trusted circle and 1-tap call 24/7 GBV Command Centre.
            </p>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* SOUTH AFRICA TRUST & COMPLIANCE BAR                                       */}
        {/* ========================================================================= */}
        <section className="w-full pt-4">
          <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-white p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-xs">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Private, Secure & Local</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Offline-ready PWA & Android APK with fast local storage and one-touch Quick Exit.
                </p>
              </div>
            </div>

            <Button asChild size="sm" className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-5 rounded-full shrink-0 h-9">
              <Link href="/auth/sign-up">
                Start Now Free
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </section>

      </main>

      {/* Simple Footer */}
      <footer className="relative mx-auto max-w-5xl py-6 text-center text-xs text-muted-foreground border-t border-emerald-100">
        <p>Phola • Built with care for South African communities • Emergency Services: 10111 / 0800 428 428</p>
      </footer>

    </div>
  )
}
