'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from 'react-i18next'
import { LockScreen } from '@/components/lock-screen'
import { ArrowRight, Loader2, ShieldCheck, MapPinned, Sparkles, MessageCircleMore } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
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

  // Show landing page for unauthenticated users
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.14),_transparent_36%),linear-gradient(180deg,#f6fffb_0%,#ffffff_48%,#f7fbf9_100%)] px-4 py-6 safe-top safe-bottom sm:px-6 lg:px-8">
      <div className="absolute left-[-7rem] top-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute right-[-5rem] top-8 h-52 w-52 rounded-full bg-emerald-200/40 blur-3xl" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed right-4 top-4 z-20 rounded-full border-emerald-200 bg-white/90 px-4 shadow-sm backdrop-blur"
        onClick={handleQuickExit}
      >
        {t('quickExit')}
      </Button>
      <main className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm">
            <Sparkles className="h-4 w-4" />
            Private safety tools for everyday life
          </div>

          <div className="flex flex-col items-start gap-6 text-left sm:max-w-2xl sm:items-start">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-[0_20px_60px_rgba(13,110,110,0.12)]">
            <Image
              src="/phola-icon.svg"
              alt="Phola"
              width={88}
              height={88}
              className="h-16 w-16"
              priority
            />
            </div>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Calm, secure support in a clean green-and-white space.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                {t('privateSecureBody')}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-full px-6 text-base shadow-lg shadow-emerald-500/20">
              <Link href="/auth/sign-up">
                {t('getStarted')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-full border-emerald-200 bg-white px-6 text-base text-emerald-900 hover:bg-emerald-50">
              <Link href="/auth/login">
                {t('signIn')}
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
              <p className="font-medium text-foreground">{t('privateSecure')}</p>
              <p className="mt-1 text-sm text-muted-foreground">Safer sessions, clearer control.</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <MapPinned className="mb-3 h-5 w-5 text-primary" />
              <p className="font-medium text-foreground">Nearby help</p>
              <p className="mt-1 text-sm text-muted-foreground">Find shops, taxis, and essential services fast.</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <MessageCircleMore className="mb-3 h-5 w-5 text-primary" />
              <p className="font-medium text-foreground">{t('quickAccess')}</p>
              <p className="mt-1 text-sm text-muted-foreground">One-tap access on mobile or desktop.</p>
            </div>
          </div>
        </section>

        <aside className="relative">
          <div className="rounded-[2rem] border border-emerald-100 bg-white p-4 shadow-[0_30px_90px_rgba(4,32,32,0.08)] sm:p-6">
            <div className="space-y-4">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">Emergency-ready layout</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800/80">Designed for fast reading, touch targets, and clean contrast on both phones and larger screens.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Fast access</p>
                  <p className="mt-2 text-sm text-muted-foreground">Login, sign up, or leave quickly from the top corner.</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Green theme</p>
                  <p className="mt-2 text-sm text-muted-foreground">Brand colors now match the logo and UI surface styles.</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
