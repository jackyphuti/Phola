'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Loader2, 
  AlertCircle, 
  ArrowRight, 
  Check, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Phone, 
  ShieldCheck, 
  Sparkles,
  LogOut,
  CheckCircle2
} from 'lucide-react'
import { safeExit } from '@/lib/safe-exit'
import { LanguageSelector } from '@/components/language-selector'
import { getAuthCallbackUrl } from '@/lib/auth-url'
import { saveStoredEmergencyContacts } from '@/lib/emergency-contacts-storage'

interface AuthScreenProps {
  initialMode?: 'login' | 'signup'
}

export function AuthScreen({ initialMode = 'login' }: AuthScreenProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [supabase] = useState(() => createClient())
  const { t } = useTranslation()

  // Tab State: 'login' | 'signup'
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)

  // Form Fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [hasConsented, setHasConsented] = useState(true)

  // UI State
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [error, setError] = useState('')
  const [successEmailSent, setSuccessEmailSent] = useState(false)
  const [verified, setVerified] = useState(false)

  // Sync mode with URL or query params
  useEffect(() => {
    const qMode = searchParams.get('mode')
    if (qMode === 'signup' || qMode === 'login') {
      setMode(qMode)
    }

    if (
      searchParams.get('verified') === '1' || 
      searchParams.get('verified') === 'true' || 
      (typeof window !== 'undefined' && (window.location.hash.includes('type=signup') || window.location.hash.includes('access_token')))
    ) {
      setVerified(true)
    }
  }, [searchParams])

  const handleQuickExit = () => {
    safeExit()
  }

  // Google OAuth
  const handleGoogleAuth = async () => {
    setIsOAuthLoading(true)
    setError('')

    try {
      const { error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthCallbackUrl('/dashboard'),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          scopes: 'openid email profile',
        },
      })

      if (oAuthError) {
        setError(oAuthError.message)
      }
    } catch {
      setError('Google sign-in encountered an issue. Please try email sign-in.')
    } finally {
      setIsOAuthLoading(false)
    }
  }

  // Sign In Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(signInError.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred during sign in. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Sign Up Submission
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim()) {
      setError('Please enter your full name')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!hasConsented) {
      setError('Please accept the safety and confidentiality terms to continue')
      return
    }

    setIsLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: getAuthCallbackUrl('/auth/verified'),
          data: {
            display_name: fullName.trim(),
            full_name: fullName.trim(),
            consent_to_processing: true,
            consent_at: new Date().toISOString(),
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsLoading(false)
        return
      }

      // If user filled in emergency phone, save it locally & attempt DB sync
      if (emergencyPhone.trim()) {
        const newContact = {
          id: `contact-${Date.now()}`,
          user_id: data.user?.id || 'local-user',
          name: 'Primary Contact',
          phone: emergencyPhone.trim(),
          relationship: 'Emergency',
          is_primary: true,
          created_at: new Date().toISOString(),
        }
        saveStoredEmergencyContacts([newContact], data.user?.id)

        if (data.user?.id) {
          try {
            await supabase.from('emergency_contacts').insert([
              {
                user_id: data.user.id,
                name: 'Primary Contact',
                phone: emergencyPhone.trim(),
                relationship: 'Emergency',
                is_primary: true,
              },
            ])
          } catch {
            // Local fallback already saved
          }
        }
      }

      // Check if session exists immediately or email confirmation is needed
      if (data.session) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setSuccessEmailSent(true)
      }
    } catch {
      setError('Account creation encountered an error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Password Strength Score (0 to 3)
  const passwordStrength = (() => {
    if (!password) return 0
    let score = 0
    if (password.length >= 6) score++
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) score++
    if (password.length >= 10 && /[^A-Za-z0-9]/.test(password)) score++
    return score
  })()

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.1),_transparent_45%),linear-gradient(180deg,#f8fcfb_0%,#ffffff_100%)] px-4 py-8 safe-top safe-bottom">
      
      {/* Top Header Bar: Clean Minimal Language Selector & Quick Exit */}
      <header className="fixed top-3 left-4 right-4 z-30 max-w-5xl mx-auto flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          <LanguageSelector minimal />
        </div>

        <div className="pointer-events-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleQuickExit}
            className="rounded-full border-emerald-200 bg-white/95 text-xs font-semibold text-emerald-950 shadow-2xs hover:bg-emerald-50 h-8 px-3.5 backdrop-blur"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5 text-primary" />
            {t('quickExit') || 'Quick Exit'}
          </Button>
        </div>
      </header>

      {/* Main Authentication Card Container */}
      <div className="w-full max-w-[420px] space-y-5 pt-8 sm:pt-4">
        
        {/* Brand Logo & Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center shadow-xs overflow-hidden">
            <Image
              src="/phola-icon.svg"
              alt="Phola"
              width={48}
              height={48}
              className="h-9 w-9"
              priority
            />
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-2xl font-black text-foreground tracking-tight">Phola</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Mzansi
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your confidential personal safety & travel watchdog
            </p>
          </div>
        </div>

        {/* Big Company Segmented Control (Sign In | Create Account) */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100/80 border border-slate-200/70 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError('')
            }}
            className={`py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('signIn') || 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError('')
            }}
            className={`py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
              mode === 'signup'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Auth Form Card */}
        <Card className="rounded-3xl border border-emerald-100/80 bg-white shadow-xl shadow-emerald-950/5 overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-4">
            
            {/* Verified Email Banner */}
            {verified && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-900 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Email confirmed successfully! You can now sign in.</span>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-red-900 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Official Google 1-Tap Auth Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-xs sm:text-sm text-slate-800 shadow-2xs flex items-center justify-center gap-2.5 transition-all"
              onClick={handleGoogleAuth}
              disabled={isOAuthLoading || isLoading}
            >
              {isOAuthLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}</span>
                </>
              )}
            </Button>

            {/* Clean Divider */}
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                or continue with email
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* ============================================================= */}
            {/* SIGN IN FORM                                                  */}
            {/* ============================================================= */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div className="space-y-1">
                  <Label htmlFor="signin-email" className="text-xs font-semibold text-slate-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="pl-10 h-11 rounded-xl border-slate-200 text-sm focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password" className="text-xs font-semibold text-slate-700">
                      Password
                    </Label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pl-10 pr-10 h-11 rounded-xl border-slate-200 text-sm focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-slate-700 p-0.5 rounded"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 mt-2"
                  disabled={isLoading || isOAuthLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Phola</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              /* ============================================================= */
              /* CREATE ACCOUNT (SIGN UP) FORM                                 */
              /* ============================================================= */
              <form onSubmit={handleSignUp} className="space-y-3.5">
                
                {/* Full Name */}
                <div className="space-y-1">
                  <Label htmlFor="signup-name" className="text-xs font-semibold text-slate-700">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="e.g. Lerato Ndlovu"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoComplete="name"
                      className="pl-10 h-11 rounded-xl border-slate-200 text-sm focus:border-primary"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <Label htmlFor="signup-email" className="text-xs font-semibold text-slate-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="pl-10 h-11 rounded-xl border-slate-200 text-sm focus:border-primary"
                    />
                  </div>
                </div>

                {/* Password & Strength Meter */}
                <div className="space-y-1">
                  <Label htmlFor="signup-password" className="text-xs font-semibold text-slate-700">
                    Password (Min. 6 characters)
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create secure password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="pl-10 pr-10 h-11 rounded-xl border-slate-200 text-sm focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-slate-700 p-0.5 rounded"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {password.length > 0 && (
                    <div className="pt-1 flex items-center gap-1.5">
                      <div className={`h-1 flex-1 rounded-full ${password.length >= 6 ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <div className={`h-1 flex-1 rounded-full ${passwordStrength >= 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      <div className={`h-1 flex-1 rounded-full ${passwordStrength >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      <span className="text-[10px] text-muted-foreground font-medium pl-1">
                        {password.length < 6 ? 'Too short' : passwordStrength >= 3 ? 'Strong' : 'Good'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <Label htmlFor="signup-confirm-password" className="text-xs font-semibold text-slate-700">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="pl-10 pr-10 h-11 rounded-xl border-slate-200 text-sm focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-slate-700 p-0.5 rounded"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password === confirmPassword && (
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 pt-0.5">
                      <Check className="w-3 h-3 text-emerald-600" /> Passwords match
                    </p>
                  )}
                </div>

                {/* Primary Emergency Contact (Optional Quick Setup) */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signup-emergency-phone" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      <span>Trusted Emergency Contact</span>
                    </Label>
                    <span className="text-[10px] text-muted-foreground">Optional</span>
                  </div>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="signup-emergency-phone"
                      type="tel"
                      placeholder="e.g. 082 123 4567 (Mom, Partner)"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="pl-10 h-11 rounded-xl border-slate-200 text-sm focus:border-primary"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Your GPS will be shared with this contact during 1-Tap SOS or Safe Ride deviations.
                  </p>
                </div>

                {/* POPIA Privacy & Consent Agreement */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                    <Checkbox
                      checked={hasConsented}
                      onCheckedChange={(checked) => setHasConsented(checked === true)}
                      className="mt-0.5"
                    />
                    <span className="leading-snug">
                      I consent to confidential safety monitoring, emergency alerts, and secure POPIA data protection.
                    </span>
                  </label>
                </div>

                {/* Submit Sign Up Button */}
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 mt-2"
                  disabled={isLoading || isOAuthLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Create Free Account</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </form>
            )}

          </CardContent>
        </Card>

        {/* Footer info note */}
        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          Phola protects thousands of commuters & citizens across South Africa • 24/7 Police & GBV Command Line: 10111 / 0800 428 428
        </p>

      </div>

      {/* ========================================================================= */}
      {/* EMAIL CONFIRMATION MODAL OVERLAY                                          */}
      {/* ========================================================================= */}
      {successEmailSent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl border border-emerald-100 bg-white p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-primary">
              <Mail className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-slate-900">Confirm your email</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We sent a confirmation link to <strong className="text-slate-900">{email}</strong>. Tap the link in your inbox to activate your account.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-primary text-white font-bold text-xs h-10 rounded-xl hover:bg-primary/90"
                onClick={() => {
                  setSuccessEmailSent(false)
                  setMode('login')
                }}
              >
                Proceed to Sign In
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
