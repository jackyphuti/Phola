'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, ArrowRight, Fingerprint } from 'lucide-react'
import Link from 'next/link'
import { authenticateBiometric, getCredentialId, isBiometricAvailable } from '@/lib/biometric'
import { authenticateWithPasskey, isPasskeyAvailable } from '@/lib/passkey'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [isBiometricLoading, setIsBiometricLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState('')

  useEffect(() => {
    const checkAuthMethods = async () => {
      const biometric = await isBiometricAvailable()
      setBiometricSupported(biometric)
      const passkey = await isPasskeyAvailable()
      setPasskeySupported(passkey)
    }

    checkAuthMethods()
  }, [])

  const handleQuickExit = () => {
    window.location.replace('https://www.google.com')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true)
    setError('')

    try {
      const credentialId = getCredentialId()
      const success = await authenticateBiometric(credentialId || undefined)

      if (success) {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          router.push('/dashboard')
          router.refresh()
          return
        }

        setError('Biometrics are ready on this device, but you still need to sign in once with email and password.')
      } else {
        setError('Biometric authentication failed. Try again or use email and password.')
      }
    } catch {
      setError('Biometric authentication failed. Try again or use email and password.')
    } finally {
      setIsBiometricLoading(false)
    }
  }

  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true)
    setError('')

    try {
      const success = await authenticateWithPasskey()

      if (success) {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          router.push('/dashboard')
          router.refresh()
          return
        }

        setError('Passkey authentication succeeded, but session setup failed. Please try email sign-in.')
      } else {
        setError('Passkey authentication failed. Try again or use another method.')
      }
    } catch {
      setError('Passkey authentication failed. Try again or use another method.')
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    setIsOAuthLoading(provider)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
      }
    } catch {
      setError('OAuth sign-in failed. Try again or use another method.')
    } finally {
      setIsOAuthLoading('')
    }
  }

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
      <div className="w-full max-w-sm space-y-8">
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
            <p className="text-muted-foreground mt-1">Sign in to continue</p>
          </div>
        </div>

        {/* OAuth & Quick Sign-In */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Welcome back</CardTitle>
            <CardDescription>
              Sign in with your preferred method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* OAuth Buttons */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 flex items-center justify-center gap-2"
                onClick={() => handleOAuthSignIn('google')}
                disabled={isOAuthLoading !== ''}
              >
                {isOAuthLoading === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 flex items-center justify-center gap-2"
                onClick={() => handleOAuthSignIn('apple')}
                disabled={isOAuthLoading !== ''}
              >
                {isOAuthLoading === 'apple' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 13.5c-.91 0-1.42.55-2.15.55-.73 0-1.22-.55-2.05-.55-1.06 0-2.29.92-2.29 1.77 0 .9.64 1.43 1.68 2.59.68.77 1.23 1.48 1.23 2.41 0 1.13-.73 1.77-1.77 1.77-.91 0-1.62-.36-2.24-1.08-.62-.72-1.06-1.72-1.06-2.77 0-4.29 3.26-6.64 5.25-7.59 1.15-.58 2.34-.58 3.37-.58 1.03 0 2.22 0 3.37.58 1.99.95 5.25 3.3 5.25 7.59 0 1.05-.44 2.05-1.06 2.77-.62.72-1.33 1.08-2.24 1.08-1.04 0-1.77-.64-1.77-1.77 0-.93.55-1.64 1.23-2.41 1.04-1.16 1.68-1.69 1.68-2.59 0-.85-1.23-1.77-2.29-1.77z"/>
                    </svg>
                    Apple
                  </>
                )}
              </Button>

              {(biometricSupported || passkeySupported) && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {passkeySupported && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={handlePasskeyLogin}
                        disabled={isPasskeyLoading || isBiometricLoading || isOAuthLoading !== ''}
                      >
                        {isPasskeyLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Fingerprint className="w-4 h-4 mr-2" />
                            Passkey
                          </>
                        )}
                      </Button>
                    )}

                    {biometricSupported && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={handleBiometricLogin}
                        disabled={isBiometricLoading || isPasskeyLoading || isOAuthLoading !== ''}
                      >
                        {isBiometricLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Fingerprint className="w-4 h-4 mr-2" />
                            Biometric
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or email</span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || isPasskeyLoading || isBiometricLoading || isOAuthLoading !== ''}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/sign-up" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
