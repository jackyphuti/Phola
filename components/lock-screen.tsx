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
  getBiometricLabel,
  getPreferredBiometricMethod,
  setPreferredBiometricMethod,
  playBiometricSuccessChime,
  playBiometricScanPulse,
  triggerHapticFeedback,
  BiometricType
} from '@/lib/biometric'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { verifyPin, hasConfiguredPin } from '@/lib/pin'
import { safeExit } from '@/lib/safe-exit'
import { 
  Fingerprint, 
  ScanFace, 
  KeyRound, 
  Loader2, 
  X, 
  LogOut, 
  ShieldCheck, 
  Check, 
  Sparkles,
  Lock
} from 'lucide-react'

export function LockScreen() {
  const router = useRouter()
  const { unlock, signOut, profile, user } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(true)
  const [showPinInput, setShowPinInput] = useState(false)
  const [selectedModality, setSelectedModality] = useState<BiometricType>(() => {
    const pref = getPreferredBiometricMethod()
    if (pref === 'faceID' || pref === 'fingerprint') return pref
    return getBiometricType()
  })
  const [isScanning, setIsScanning] = useState(false)
  const [scanSuccess, setScanSuccess] = useState(false)
  const hasAutoPromptedBiometric = useRef(false)

  const bioLabel = getBiometricLabel(selectedModality)
  const hasPin = hasConfiguredPin(profile)
  const hasBiometric = Boolean(profile?.biometric_enabled) || Boolean(getCredentialId())

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

  const handleModalityChange = (modality: BiometricType) => {
    setSelectedModality(modality)
    setPreferredBiometricMethod(modality === 'faceID' ? 'faceID' : 'fingerprint')
    triggerHapticFeedback([15])
    setError('')
  }

  const handleBiometricAuth = useCallback(async () => {
    setIsLoading(true)
    setIsScanning(true)
    setError('')
    playBiometricScanPulse()
    triggerHapticFeedback([25, 30])

    try {
      const credentialId = getCredentialId()
      const success = await authenticateBiometric(credentialId || undefined)

      if (success) {
        setScanSuccess(true)
        playBiometricSuccessChime()
        triggerHapticFeedback([40, 60])
        setTimeout(() => {
          unlock()
        }, 360)
      } else {
        setIsScanning(false)
        setError(`${bioLabel} verification failed. Please try again or use your PIN.`)
        if (hasPin) setShowPinInput(true)
      }
    } catch {
      setIsScanning(false)
      setError(`${bioLabel} verification error. Please use your PIN code.`)
      if (hasPin) setShowPinInput(true)
    } finally {
      setIsLoading(false)
    }
  }, [unlock, bioLabel, hasPin])

  // Check biometric availability and auto-trigger on mount
  useEffect(() => {
    let isMounted = true

    const checkAndTriggerBiometrics = async () => {
      const available = await isBiometricAvailable()
      const hasCred = Boolean(getCredentialId()) || hasBiometric
      if (isMounted) {
        setBiometricAvailable(available || hasCred)
      }

      // Auto-prompt Face ID (iOS) or Fingerprint (Android) immediately on mount if enabled
      if (available && hasBiometric && !hasAutoPromptedBiometric.current && isMounted) {
        hasAutoPromptedBiometric.current = true
        setTimeout(() => {
          if (isMounted) {
            void handleBiometricAuth()
          }
        }, 220)
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
          playBiometricSuccessChime()
          triggerHapticFeedback([40, 60])
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%),linear-gradient(180deg,#f8fcf9_0%,#ffffff_50%,#f0fdf4_100%)] p-6 safe-top safe-bottom dark:bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15),_transparent_55%),linear-gradient(180deg,#0b1512_0%,#0f1715_50%,#09120e_100%)]">
      {/* Emergency Quick Exit Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed right-4 top-4 z-20 rounded-full border-border/70 bg-background/90 px-4 text-xs font-semibold shadow-2xs backdrop-blur hover:bg-destructive hover:text-destructive-foreground transition-all"
        onClick={safeExit}
      >
        Quick Exit
      </Button>

      <div className="w-full max-w-sm space-y-6">
        {/* App Logo & User Welcome */}
        <div className="flex flex-col items-center space-y-3">
          <div className="relative w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center overflow-hidden shadow-sm ring-4 ring-emerald-200/60 dark:ring-emerald-800/40">
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
            <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 shadow-xs">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center gap-1.5">
              Phola
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/60 dark:border-emerald-700/60">
                Encrypted
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {profile?.display_name || user?.user_metadata?.full_name
                ? `Welcome back, ${displayName}`
                : 'Encrypted Vault & App Lock'}
            </p>
          </div>
        </div>

        {/* Biometric Unlock Mode */}
        {biometricAvailable && !showPinInput && (
          <div className="space-y-5">
            {/* Modality Switcher (Face ID vs Fingerprint) */}
            <div className="flex items-center justify-center p-1 rounded-xl bg-muted/70 dark:bg-muted/40 border border-border/60">
              <button
                type="button"
                onClick={() => handleModalityChange('faceID')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                  selectedModality === 'faceID'
                    ? 'bg-background text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ScanFace className="w-3.5 h-3.5" />
                <span>Face ID</span>
              </button>
              <button
                type="button"
                onClick={() => handleModalityChange('fingerprint')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                  selectedModality === 'fingerprint'
                    ? 'bg-background text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>Fingerprint</span>
              </button>
            </div>

            {/* Interactive Biometric Sensor Pad */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative flex items-center justify-center">
                {/* Outer Ripple Rings when scanning */}
                {isScanning && (
                  <>
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-400 dark:border-emerald-500 animate-ping opacity-40 -m-3 pointer-events-none" />
                    <div className="absolute inset-0 rounded-full border border-emerald-300 dark:border-emerald-600 animate-pulse opacity-60 -m-6 pointer-events-none" />
                  </>
                )}

                {/* Circular Sensor Pad */}
                <button
                  type="button"
                  onClick={() => void handleBiometricAuth()}
                  disabled={isLoading || isSigningOut}
                  aria-label={`Scan ${bioLabel}`}
                  className={`group relative w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-md ${
                    scanSuccess
                      ? 'bg-emerald-600 text-white scale-105 shadow-emerald-500/30'
                      : isScanning
                      ? 'bg-emerald-100 text-emerald-700 ring-4 ring-emerald-500/50 scale-102 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/90 hover:scale-105 border-2 border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {scanSuccess ? (
                    <Check className="w-12 h-12 stroke-[2.5] animate-scale-in" />
                  ) : isScanning ? (
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-600 dark:text-emerald-400" />
                  ) : selectedModality === 'faceID' ? (
                    <ScanFace className="w-12 h-12 stroke-[1.8] group-hover:scale-110 transition-transform" />
                  ) : (
                    <Fingerprint className="w-12 h-12 stroke-[1.8] group-hover:scale-110 transition-transform" />
                  )}

                  <span className="text-[10px] font-semibold mt-1 tracking-wider uppercase opacity-80">
                    {scanSuccess ? 'Verified' : isScanning ? 'Scanning...' : 'Tap Sensor'}
                  </span>
                </button>
              </div>

              {/* Status / Feedback message */}
              <div className="mt-3 text-center min-h-[20px]">
                {error ? (
                  <p className="text-xs text-destructive font-medium">{error}</p>
                ) : scanSuccess ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Identity verified! Unlocking...
                  </p>
                ) : isScanning ? (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    Verifying biometric enclave token...
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Tap the sensor pad to scan {bioLabel}
                  </p>
                )}
              </div>
            </div>

            {/* Direct 1-Tap Biometric Action Button */}
            <Button
              onClick={() => void handleBiometricAuth()}
              disabled={isLoading || isSigningOut}
              className="w-full h-13 text-sm font-semibold rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center justify-center gap-2.5"
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {selectedModality === 'faceID' ? (
                    <ScanFace className="w-5 h-5 shrink-0" />
                  ) : (
                    <Fingerprint className="w-5 h-5 shrink-0" />
                  )}
                  <span>Unlock with {bioLabel}</span>
                </>
              )}
            </Button>

            {/* Fallback to PIN Code */}
            <Button
              variant="ghost"
              onClick={() => {
                setShowPinInput(true)
                setError('')
              }}
              className="w-full text-muted-foreground hover:text-foreground text-xs font-medium rounded-xl h-10 border border-border/50 hover:bg-muted/50"
            >
              <KeyRound className="w-3.5 h-3.5 mr-2" />
              Use Security PIN Code Instead
            </Button>
          </div>
        )}

        {/* PIN input */}
        {(showPinInput || !biometricAvailable) && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">Enter Security PIN Code</p>
              <p className="text-xs text-muted-foreground">Enter your 4-6 digit confidential passkey</p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  className="h-14 text-center text-3xl tracking-[0.4em] font-mono rounded-2xl border-emerald-300 dark:border-emerald-700 bg-background shadow-2xs focus-visible:ring-emerald-500"
                  autoFocus
                  maxLength={6}
                />
                {pin && (
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="w-4 h-4" />
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
              className="w-full h-12 text-sm font-semibold rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Unlock Vault'
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
                className="w-full text-muted-foreground hover:text-foreground text-xs font-medium rounded-xl border border-border/40"
              >
                {selectedModality === 'faceID' ? (
                  <ScanFace className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                ) : (
                  <Fingerprint className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                )}
                Use {bioLabel} Instead
              </Button>
            )}
          </form>
        )}

        {/* Explicit Sign Out & Vault Security Footer */}
        <div className="pt-3 border-t border-border/50 text-center space-y-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLockScreenSignOut}
            disabled={isLoading || isSigningOut}
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full px-4 h-8 gap-1.5 transition-colors"
          >
            {isSigningOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            Log out / Switch Account
          </Button>

          <p className="text-[11px] text-muted-foreground/70 flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Hybrid WebAuthn + Web Crypto Enclave
          </p>
        </div>
      </div>
    </div>
  )
}
