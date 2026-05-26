'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, ArrowRight, Check, Info, Fingerprint } from 'lucide-react'
import Link from 'next/link'
import { registerPasskey, savePasskeyToDatabase, isPasskeyAvailable } from '@/lib/passkey'
import { safeExit } from '@/lib/safe-exit'
import { LanguageSelector } from '@/components/language-selector'
import { getAuthCallbackUrl } from '@/lib/auth-url'
import { PrivacyConsent } from '@/components/privacy-consent'
import InstallPrompt from '@/components/install-prompt'

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslation()
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false)
  const [showConsent, setShowConsent] = useState(true)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showPasskeyOption, setShowPasskeyOption] = useState(false)

  const resizePhoto = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        const image = new window.Image()

        image.onload = () => {
          const maxSize = 320
          const scale = Math.min(maxSize / image.width, maxSize / image.height, 1)
          const width = Math.round(image.width * scale)
          const height = Math.round(image.height * scale)

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const context = canvas.getContext('2d')
          if (!context) {
            reject(new Error('Unable to process photo'))
            return
          }

          context.drawImage(image, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }

        image.onerror = () => reject(new Error('Unable to load photo'))
        image.src = reader.result as string
      }

      reader.onerror = () => reject(new Error('Unable to read photo'))
      reader.readAsDataURL(file)
    })
  }

  const handlePhotoPick = async (file?: File) => {
    if (!file) return

    try {
      const compressedPhoto = await resizePhoto(file)
      setPhotoDataUrl(compressedPhoto)
      setError('')
    } catch {
      setError('Please take a clear photo or choose another image.')
    }
  }

  const handleQuickExit = () => {
    safeExit()
  }

  const handleOAuthSignUp = async (provider: 'google' | 'apple') => {
    setIsOAuthLoading(provider)
    setError('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthCallbackUrl('/dashboard'),
        },
      })

      if (error) {
        setError(error.message)
      }
    } catch {
      setError('OAuth sign-up failed. Try again or use email.')
    } finally {
      setIsOAuthLoading('')
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showConsent) {
      setError('Please review and accept the consent screen before continuing.')
      return
    }
    setIsLoading(true)
    setError('')

    if (!fullName.trim()) {
      setError('Please enter your real name')
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? 
            getAuthCallbackUrl('/auth/login'),
          data: {
            display_name: fullName.trim(),
            full_name: fullName.trim(),
            consent_to_processing: true,
            consent_at: new Date().toISOString(),
          },
        },
      })

      if (error) {
        setError(error.message)
      } else {
        if (data.user?.id && photoDataUrl) {
          const response = await fetch('/api/profile-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              email,
              fullName: fullName.trim(),
              photoDataUrl,
            }),
          })

          if (!response.ok) {
            const { error: uploadError } = await response.json().catch(() => ({ error: 'Photo upload failed' }))
            setError(uploadError || 'Photo upload failed')
            setIsLoading(false)
            return
          }
        }

        if (data.user?.id) {
          setUserId(data.user.id)
          const passkeysAvailable = await isPasskeyAvailable()
          setPasskeySupported(passkeysAvailable)
          setShowPasskeyOption(passkeysAvailable)
        }

        setSuccess(true)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePasskey = async () => {
    if (!userId) return
    setIsLoading(true)
    setError('')

    try {
      const passkey = await registerPasskey(userId, email)
      if (passkey) {
        const saved = await savePasskeyToDatabase(userId, email, passkey)
        if (saved) {
          setShowPasskeyOption(false)
          // Continue to verify email
          setSuccess(true)
        } else {
          setError('Failed to save passkey. You can set it up later.')
        }
      } else {
        setError('Passkey registration failed. You can set it up later.')
      }
    } catch {
      setError('An unexpected error occurred while saving passkey.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 safe-top safe-bottom">
      <InstallPrompt />
      {success && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-6 shadow-2xl space-y-5">
            {showPasskeyOption && passkeySupported ? (
              <>
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Fingerprint className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground">Save a Passkey?</h1>
                    <p className="text-muted-foreground mt-2">
                      Save a passkey to sign in faster without passwords on your devices.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPasskeyOption(false)}
                    disabled={isLoading}
                  >
                    Skip
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSavePasskey}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Save Passkey
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground">Confirm your email address</h1>
                    <p className="text-muted-foreground mt-2">
                      We&apos;ve sent a confirmation link to <strong>{email}</strong>. Open your inbox to finish creating your account.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push('/auth/login')}
                  >
                    {t('signIn')}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setSuccess(false)}
                  >
                    Keep Open
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed right-4 top-4 z-20 rounded-full border-border/70 bg-background/90 px-4 shadow-sm backdrop-blur"
        onClick={handleQuickExit}
      >
        {t('quickExit')}
      </Button>
      <div className="w-full max-w-sm space-y-8">
        <LanguageSelector dropdown />
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
            <p className="text-muted-foreground mt-1">{t('createSecureAccount')}</p>
          </div>
        </div>

        {showConsent && (
          <PrivacyConsent
            onAccept={() => setShowConsent(false)}
          />
        )}

        {/* Sign Up Form */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t('getStarted')}</CardTitle>
            <CardDescription className="space-y-2">
              <div>{t('privateSecureBody')}</div>
              <button
                type="button"
                onClick={() => setShowPrivacyInfo((current) => !current)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Info className="w-3.5 h-3.5" />
                {t('howWeProtectYou')}
              </button>
              {showPrivacyInfo && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Phola asks for your real name to keep your account secure. A photo is optional and helps personalize your profile. Your data stays private and is stored securely.
                </p>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
                onClick={() => handleOAuthSignUp('google')}
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
                    Sign up with Google
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 flex items-center justify-center gap-2"
                onClick={() => handleOAuthSignUp('apple')}
                disabled={isOAuthLoading !== ''}
              >
                {isOAuthLoading === 'apple' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 13.5c-.91 0-1.42.55-2.15.55-.73 0-1.22-.55-2.05-.55-1.06 0-2.29.92-2.29 1.77 0 .9.64 1.43 1.68 2.59.68.77 1.23 1.48 1.23 2.41 0 1.13-.73 1.77-1.77 1.77-.91 0-1.62-.36-2.24-1.08-.62-.72-1.06-1.72-1.06-2.77 0-4.29 3.26-6.64 5.25-7.59 1.15-.58 2.34-.58 3.37-.58 1.03 0 2.22 0 3.37.58 1.99.95 5.25 3.3 5.25 7.59 0 1.05-.44 2.05-1.06 2.77-.62.72-1.33 1.08-2.24 1.08-1.04 0-1.77-.64-1.77-1.77 0-.93.55-1.64 1.23-2.41 1.04-1.16 1.68-1.69 1.68-2.59 0-.85-1.23-1.77-2.29-1.77z"/>
                    </svg>
                    Sign up with Apple
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or email</span>
                </div>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your real name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Take Your Photo <span className="text-xs text-muted-foreground font-normal">(Optional)</span></Label>
                  <div className="rounded-2xl border border-border p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                        {photoDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photoDataUrl} alt="Your photo" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-muted-foreground text-center px-2">No photo yet</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Camera or gallery</p>
                        <p className="text-xs text-muted-foreground">Please take a clear photo for your profile.</p>
                      </div>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(e) => handlePhotoPick(e.target.files?.[0])}
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => photoInputRef.current?.click()}>
                        Take Photo
                      </Button>
                      <Button type="button" variant="ghost" className="flex-1" onClick={() => photoInputRef.current?.click()}>
                        Upload
                      </Button>
                    </div>
                  </div>
                </div>

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
                  <p className="text-xs text-muted-foreground">
                    Use an address you can safely access and keep.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || isOAuthLoading !== ''}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
