//export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
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

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const safeNext = next.startsWith('/') ? next : '/'
      return NextResponse.redirect(`${origin}${safeNext}`)
    }

    return NextResponse.redirect(`${origin}/auth/error?error=oauth_callback_failed&error_description=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
