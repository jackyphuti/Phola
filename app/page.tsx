'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { LockScreen } from '@/components/lock-screen'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function HomePage() {
  const router = useRouter()
  const { user, isLoading, isLocked } = useAuth()

  useEffect(() => {
    if (!isLoading && user && !isLocked) {
      router.push('/dashboard')
    }
  }, [user, isLoading, isLocked, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show lock screen if user is logged in but locked
  if (user && isLocked) {
    return <LockScreen />
  }

  const handleQuickExit = () => {
    window.location.replace('https://www.google.com')
  }

  // Show landing page for unauthenticated users
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 safe-top safe-bottom">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed right-4 top-4 z-20 rounded-full border-border/70 bg-background/90 px-4 shadow-sm backdrop-blur"
        onClick={handleQuickExit}
      >
        Quick Exit
      </Button>
      <div className="w-full max-w-sm space-y-12">
        <div className="flex flex-col items-center space-y-6 text-center">
          <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center overflow-hidden shadow-sm">
            <Image
              src="/phola-icon.svg"
              alt="Phola"
              width={88}
              height={88}
              className="h-16 w-16"
              priority
            />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Phola</h1>
            <p className="text-muted-foreground mt-3 text-lg leading-relaxed">
              Your private space for thoughts and memories. Secure, simple, always with you.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <Button asChild className="w-full h-12 text-base">
            <Link href="/auth/sign-up">
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-12 text-base">
            <Link href="/auth/login">
              Sign In
            </Link>
          </Button>
        </div>

        {/* Features */}
        <div className="grid gap-4 text-center">
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="font-medium text-foreground">Private & Secure</p>
            <p className="text-sm text-muted-foreground">Your data is encrypted and only you can access it</p>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="font-medium text-foreground">Quick Access</p>
            <p className="text-sm text-muted-foreground">Use biometrics or PIN to unlock instantly</p>
          </div>
        </div>
      </div>
    </div>
  )
}
