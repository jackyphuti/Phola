'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle2, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { safeExit } from '@/lib/safe-exit'
import { LanguageSelector } from '@/components/language-selector'

function VerifiedContent() {
  const router = useRouter()

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.close()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 safe-top safe-bottom">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed right-4 top-4 z-20 rounded-full border-border/70 bg-background/90 px-4 shadow-sm backdrop-blur"
        onClick={safeExit}
      >
        Quick Exit
      </Button>

      <div className="w-full max-w-sm space-y-6">
        <LanguageSelector compact />

        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden shadow-sm">
            <Image
              src="/phola-icon.svg"
              alt="Phola"
              width={56}
              height={56}
              className="h-11 w-11"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">Phola</h1>
          </div>
        </div>

        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <CardTitle className="text-xl">Email Verified!</CardTitle>
            <CardDescription className="text-sm mt-1">
              Your email address has been confirmed successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              You can now safely close this window and sign in, or click below to continue in this browser.
            </p>

            <div className="space-y-2 pt-2">
              <Button
                className="w-full h-11"
                onClick={() => router.push('/auth/login')}
              >
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10"
                onClick={handleClose}
              >
                <X className="w-4 h-4 mr-2" />
                Close This Window
              </Button>
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
