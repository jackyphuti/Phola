import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/auth/login'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    const errorUrl = new URL('/auth/error', origin)
    errorUrl.searchParams.set('error', error)
    if (errorDescription) {
      errorUrl.searchParams.set('error_description', errorDescription)
    }
    return NextResponse.redirect(errorUrl)
  }

  const supabase = await createClient()
  const safeNext = next.startsWith('/') ? next : '/auth/login'
  const redirectUrl = new URL(safeNext, origin)
  redirectUrl.searchParams.set('verified', '1')

  // 1. Handle Email Verification via token_hash (works across any browser/device)
  if (tokenHash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!otpError) {
      return NextResponse.redirect(redirectUrl)
    }

    return NextResponse.redirect(
      `${origin}/auth/error?error=verification_failed&error_description=${encodeURIComponent(otpError.message)}`
    )
  }

  // 2. Handle PKCE code exchange (OAuth or same-browser email link)
  if (code) {
    const { error: codeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!codeError) {
      return NextResponse.redirect(redirectUrl)
    }

    // If PKCE code verifier is missing (common when opening email links in external mail app/browser),
    // redirect to login with verified flag instead of crashing out to error page
    if (codeError.message?.toLowerCase().includes('code verifier') || codeError.name === 'AuthPKCEGrantCodeExchangeError') {
      return NextResponse.redirect(redirectUrl)
    }

    return NextResponse.redirect(
      `${origin}/auth/error?error=oauth_callback_failed&error_description=${encodeURIComponent(codeError.message)}`
    )
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
