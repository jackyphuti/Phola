'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { 
  isBiometricAvailable, 
  authenticateBiometric, 
  getCredentialId 
} from '@/lib/biometric'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Fingerprint, KeyRound, BookText, Loader2, X } from 'lucide-react'

export function LockScreen() {
  const { unlock, profile } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [showPinInput, setShowPinInput] = useState(false)

  useEffect(() => {
    const checkBiometric = async () => {
      const available = await isBiometricAvailable()
      setBiometricAvailable(available && !!getCredentialId())
    }
    checkBiometric()
  }, [])

  const handleBiometricAuth = useCallback(async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const credentialId = getCredentialId()
      const success = await authenticateBiometric(credentialId || undefined)
      
      if (success) {
        unlock()
      } else {
        setError('Authentication failed. Try again or use PIN.')
        setShowPinInput(true)
      }
    } catch {
      setError('Authentication failed. Please use your PIN.')
      setShowPinInput(true)
    } finally {
      setIsLoading(false)
    }
  }, [unlock])

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Simple PIN validation (in production, hash and compare with stored hash)
    // For demo purposes, we'll accept any 4+ digit PIN
    if (pin.length >= 4) {
      // In production: compare with profile.pin_hash using bcrypt
      unlock()
    } else {
      setError('PIN must be at least 4 digits')
    }
    
    setIsLoading(false)
  }

  const handlePinChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/\D/g, '').slice(0, 6)
    setPin(numericValue)
    setError('')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 safe-top safe-bottom">
      <div className="w-full max-w-sm space-y-8">
        {/* App icon - looks like a notes app */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookText className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">My Notes</h1>
            <p className="text-muted-foreground mt-1">
              {profile?.display_name ? `Welcome back` : 'Unlock to continue'}
            </p>
          </div>
        </div>

        {/* Biometric button */}
        {biometricAvailable && !showPinInput && (
          <div className="space-y-4">
            <Button
              onClick={handleBiometricAuth}
              disabled={isLoading}
              className="w-full h-14 text-lg"
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Fingerprint className="w-6 h-6 mr-2" />
                  Unlock with Biometrics
                </>
              )}
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => setShowPinInput(true)}
              className="w-full text-muted-foreground"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Use PIN instead
            </Button>
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
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                  maxLength={6}
                />
                {pin && (
                  <button
                    type="button"
                    onClick={() => setPin('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || pin.length < 4}
              className="w-full h-12"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Unlock'
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
                }}
                className="w-full text-muted-foreground"
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                Use Biometrics
              </Button>
            )}
          </form>
        )}

        {/* Safe exit hint */}
        <p className="text-xs text-center text-muted-foreground/60">
          Tap outside or close browser to lock
        </p>
      </div>
    </div>
  )
}
