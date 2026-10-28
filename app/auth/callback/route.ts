import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')
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

  // 1. Handle Email Verification via token_hash (works across any browser/device)
  if (tokenHash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!otpError) {
      // Email verified successfully - redirect to dedicated verified confirmation page
      return NextResponse.redirect(new URL('/auth/verified?verified=true', origin))
    }

    return NextResponse.redirect(
      `${origin}/auth/error?error=verification_failed&error_description=${encodeURIComponent(otpError.message)}`
    )
  }

  // 2. Handle PKCE code exchange (Google OAuth or email confirmation link)
  if (code) {
    const { data, error: codeError } = await supabase.auth.exchangeCodeForSession(code)

    // Check if this was an email verification flow
    const isEmailVerification =
      type === 'signup' ||
      type === 'email' ||
      next === '/auth/verified' ||
      Boolean(next?.startsWith('/auth/verified'))

    if (!codeError) {
      if (data?.session?.user) {
        const user = data.session.user
        const meta = user.user_metadata || {}
        let firstName = meta.given_name || meta.first_name || null
        let lastName = meta.family_name || meta.last_name || null
        let dateOfBirth = meta.date_of_birth || meta.birthday || null

        // If Google provider token is available, attempt to retrieve birthday and details from Google People API
        if (data.session.provider_token) {
          try {
            const res = await fetch(
              'https://people.googleapis.com/v1/people/me?personFields=birthdays,names',
              {
                headers: { Authorization: `Bearer ${data.session.provider_token}` },
              }
            )
            if (res.ok) {
              const people = await res.json()
              if (people.birthdays && people.birthdays.length > 0) {
                const bdayObj = people.birthdays.find((b: { date?: { month?: number; day?: number } }) => b.date?.month && b.date?.day) || people.birthdays[0]
                const b = bdayObj?.date
                if (b && b.month && b.day) {
                  const y = b.year ? String(b.year).padStart(4, '0') : '1900'
                  const m = String(b.month).padStart(2, '0')
                  const d = String(b.day).padStart(2, '0')
                  dateOfBirth = `${y}-${m}-${d}`
                }
              }
              if (!firstName && people.names?.[0]?.givenName) {
                firstName = people.names[0].givenName
              }
              if (!lastName && people.names?.[0]?.familyName) {
                lastName = people.names[0].familyName
              }
            }
          } catch (err) {
            console.warn('Google People API fetch error:', err)
          }
        }

        const displayName =
          meta.full_name ||
          meta.name ||
          [firstName, lastName].filter(Boolean).join(' ') ||
          user.email?.split('@')[0] ||
          'User'

        try {
          await supabase.from('profiles').upsert(
            {
              id: user.id,
              display_name: displayName,
              first_name: firstName,
              last_name: lastName,
              date_of_birth: dateOfBirth,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )

          await supabase.auth.updateUser({
            data: {
              full_name: displayName,
              first_name: firstName,
              last_name: lastName,
              given_name: firstName,
              family_name: lastName,
              date_of_birth: dateOfBirth,
            },
          })
        } catch (profileErr) {
          console.error('Failed to sync profile from OAuth:', profileErr)
        }
      }

      if (isEmailVerification) {
        return NextResponse.redirect(new URL('/auth/verified?verified=true', origin))
      }

      // For Google OAuth, go straight to dashboard (no email verification required!)
      const targetPath = next && next.startsWith('/') ? next : '/dashboard'
      return NextResponse.redirect(new URL(targetPath, origin))
    }

    // If PKCE code verifier is missing (common when opening email links in external mail app/browser),
    // redirect to verified confirmation page instead of crashing out to error page
    if (codeError.message?.toLowerCase().includes('code verifier') || codeError.name === 'AuthPKCEGrantCodeExchangeError') {
      return NextResponse.redirect(new URL('/auth/verified?verified=true', origin))
    }

    return NextResponse.redirect(
      `${origin}/auth/error?error=oauth_callback_failed&error_description=${encodeURIComponent(codeError.message)}`
    )
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
