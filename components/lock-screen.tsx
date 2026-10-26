'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getProfilePhotoUrl } from '@/lib/profile-photo'
import { 
  isBiometricAvailable, 
  authenticateBiometric, 
  getCredentialId,
  getBiometricType,
  getBiometricLabel
} from '@/lib/biometric'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { verifyPin, hasConfiguredPin } from '@/lib/pin'
import { safeExit } from '@/lib/safe-exit'
import { Fingerprint, ScanFace, KeyRound, Loader2, X, LogOut, ShieldCheck } from 'lucide-react'

export function LockScreen() {
  const router = useRouter()
  const { unlock, signOut, profile, user } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [showPinInput, setShowPinInput] = useState(false)
  const hasAutoPromptedBiometric = useRef(false)

  const bioType = getBiometricType()
  const bioLabel = getBiometricLabel()
  const hasPin = hasConfiguredPin(profile)
  const hasBiometric = Boolean(profile?.biometric_enabled)

  // Safety: If the user never configured a PIN and never enabled biometrics, never trap them
  useEffect(() => {
    if (!hasPin && !hasBiometric) {
      unlock()
    }
  }, [hasPin, hasBiometric, unlock])

  // If user only configured PIN and not biometric, default to showing PIN input
  useEffect(() => {
    if (hasPin && !hasBiometric) {
      setShowPinInput(true)
    }
  }, [hasPin, hasBiometric])

  const handleBiometricAuth = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const credentialId = getCredentialId()
      const success = await authenticateBiometric(credentialId || undefined)

      if (success) {
        unlock()
      } else {
        setError(`${bioLabel} authentication failed. Please retry or enter your PIN.`)
        if (hasPin) setShowPinInput(true)
      }
    } catch {
      setError(`${bioLabel} authentication failed. Please enter your PIN.`)
      if (hasPin) setShowPinInput(true)
    } finally {
      setIsLoading(false)
    }
  }, [unlock, bioLabel, hasPin])

  // Check biometric availability and auto-trigger on mount for Face ID (iOS) / Fingerprint (Android)
  useEffect(() => {
    let isMounted = true

    const checkAndTriggerBiometrics = async () => {
      const available = await isBiometricAvailable()
      const hasCred = Boolean(getCredentialId()) || hasBiometric
      if (isMounted) {
        setBiometricAvailable(available && hasCred)
      }

      // Auto-prompt Face ID (iOS) or Fingerprint (Android) immediately on mount if enabled
      if (available && hasBiometric && !hasAutoPromptedBiometric.current && isMounted) {
        hasAutoPromptedBiometric.current = true
        // Small delay to ensure smooth native transition
        setTimeout(() => {
          if (isMounted) {
            void handleBiometricAuth()
          }
        }, 150)
      }
    }

    void checkAndTriggerBiometrics()

    return () => {
      isMounted = false
    }
  }, [hasBiometric, handleBiometricAuth])

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (pin.length < 4) {
        setError('PIN must be at least 4 digits')
        return
      }

      if (hasPin && profile?.pin_hash && user?.id) {
        const isValid = await verifyPin(pin, user.id, profile.pin_hash)
        if (isValid) {
          unlock()
        } else {
          setError('Incorrect PIN. Please try again.')
        }
      } else {
        // No PIN has been set
        unlock()
      }
    } catch {
      setError('Failed to verify PIN. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePinChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 6)
    setPin(numericValue)
    setError('')
  }

  // Handle explicit Log Out from lock screen
  const handleLockScreenSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      router.replace('/auth/login')
    } finally {
      setIsSigningOut(false)
    }
  }

  const displayName = profile?.display_name || user?.user_metadata?.full_name || 'there'
  const profilePhoto = getProfilePhotoUrl(profile?.profile_photo_path || user?.user_metadata?.profile_photo_path)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_38%),linear-gradient(180deg,#f7fffc_0%,#ffffff_50%,#f5fbf8_100%)] p-6 safe-top safe-bottom">
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
        <div className="flex flex-col items-center space-y-3.5">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden shadow-sm ring-4 ring-emerald-100/60 dark:ring-emerald-950/40">
            {profilePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profilePhoto} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <Image
                src="/phola-icon.svg"
                alt="Phola"
                width={72}
                height={72}
                className="h-14 w-14"
                priority
              />
            )}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Phola</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {profile?.display_name || user?.user_metadata?.full_name
                ? `Welcome back, ${displayName}`
                : 'Unlock to continue'}
            </p>
          </div>
        </div>

        {/* Biometric Unlock Option (Face ID on iOS / Fingerprint on Android) */}
        {biometricAvailable && !showPinInput && (
          <div className="space-y-3.5">
            <Button
              onClick={handleBiometricAuth}
              disabled={isLoading || isSigningOut}
              className="w-full h-14 text-base font-semibold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all flex items-center justify-center gap-3"
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {bioType === 'faceID' ? (
                    <ScanFace className="w-6 h-6 shrink-0" />
                  ) : (
                    <Fingerprint className="w-6 h-6 shrink-0" />
                  )}
                  <span>Unlock with {bioLabel}</span>
                </>
              )}
            </Button>

            {hasPin && (
              <Button
                variant="ghost"
                onClick={() => setShowPinInput(true)}
                className="w-full text-muted-foreground hover:text-foreground text-sm font-medium rounded-xl h-11"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Use PIN code instead
              </Button>
            )}
          </div>
        )}

        {/* PIN input */}
        {(showPinInput || !biometricAvailable) && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  className="h-14 text-center text-3xl tracking-[0.4em] font-mono rounded-2xl border-emerald-200/80 bg-background/80 shadow-2xs focus-visible:ring-emerald-500"
                  autoFocus
                  maxLength={6}
                />
                {pin && (
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              {error && (
                <p className="text-xs text-destructive text-center font-medium">{error}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || pin.length < 4 || isSigningOut}
              className="w-full h-12 text-sm font-semibold rounded-2xl shadow-sm"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Unlock Phola'
              )}
            </Button>

            {biometricAvailable && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowPinInput(false)
                  setPin('')
                  setError('')
                  void handleBiometricAuth()
                }}
                className="w-full text-muted-foreground hover:text-foreground text-sm font-medium rounded-xl"
              >
                {bioType === 'faceID' ? (
                  <ScanFace className="w-4 h-4 mr-2" />
                ) : (
                  <Fingerprint className="w-4 h-4 mr-2" />
                )}
                Use {bioLabel} instead
              </Button>
            )}
          </form>
        )}

        {/* Explicit Sign Out Button — user can ALWAYS sign out without being blocked by a PIN */}
        <div className="pt-4 border-t border-border/50 text-center space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLockScreenSignOut}
            disabled={isLoading || isSigningOut}
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full px-4 h-9 gap-1.5 transition-colors"
          >
            {isSigningOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            Log out / Sign in with another account
          </Button>

          <p className="text-[11px] text-muted-foreground/60 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Protected by Phola Zero-Knowledge Security
          </p>
        </div>
      </div>
    </div>
  )
}
