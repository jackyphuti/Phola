'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { 
  CheckCircle2, 
  ShieldCheck, 
  Car, 
  Siren, 
  ArrowRight,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { playBiometricSuccessChime, triggerHapticFeedback } from '@/lib/biometric'

const VERIFIED_STORAGE_KEY = 'phola_account_verified_celebrated'

export function AccountVerifiedModal() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Check if user just arrived via email verification redirect
    const qVerified = searchParams?.get('verified')
    const hasHashVerified = window.location.hash.includes('verified') || window.location.hash.includes('type=signup')
    const hasSessionVerified = window.sessionStorage.getItem('phola_just_verified') === 'true'
    const alreadyCelebrated = window.sessionStorage.getItem(VERIFIED_STORAGE_KEY) === 'true'

    const isVerifiedEvent = (
      qVerified === 'true' || 
      qVerified === '1' || 
      hasHashVerified || 
      hasSessionVerified
    )

    if (isVerifiedEvent && !alreadyCelebrated) {
      setIsOpen(true)
      window.sessionStorage.setItem(VERIFIED_STORAGE_KEY, 'true')
      window.sessionStorage.removeItem('phola_just_verified')
      
      // Friendly audio chime & gentle haptic feedback
      try {
        playBiometricSuccessChime()
        triggerHapticFeedback([40, 60])
      } catch {}

      // Clean URL params cleanly without reloading
      if (qVerified) {
        const url = new URL(window.location.href)
        url.searchParams.delete('verified')
        window.history.replaceState({}, '', url.pathname + url.search)
      }
    }
  }, [searchParams, pathname])

  const handleContinueExploring = () => {
    triggerHapticFeedback([20])
    setIsOpen(false)

    // If user is on an auth landing or verification screen, seamlessly take them to the main dashboard
    if (pathname.includes('/auth/')) {
      router.push('/dashboard')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg text-center space-y-4 animate-in zoom-in-95 duration-200">
        
        {/* Animated Checkmark with Pulsing Ring */}
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30" />
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
            <CheckCircle2 className="h-8 w-8 stroke-[2.2]" />
          </div>
        </div>

        {/* Title & Badges */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1.5">
            <Badge variant="secondary" className="bg-muted text-foreground border border-border text-[10px] uppercase font-bold tracking-wider">
              <ShieldCheck className="w-3 h-3 mr-1 text-primary" />
              Verified Account
            </Badge>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Account Verified!
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your email has been confirmed. Your Phola security profile and encrypted safety locker are now fully activated.
          </p>
        </div>

        {/* Feature unlocked badges */}
        <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-left space-y-2 text-xs">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span>Zero-Knowledge Encrypted Vault</span>
          </div>
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Car className="w-4 h-4 text-primary shrink-0" />
            <span>Safe Ride Watchdog & Transit Alerts</span>
          </div>
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Siren className="w-4 h-4 text-primary shrink-0" />
            <span>Instant Emergency SOS & Safe Havens</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            size="lg"
            onClick={handleContinueExploring}
            className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition"
          >
            <span>Continue to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
