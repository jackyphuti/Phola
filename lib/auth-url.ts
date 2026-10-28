const CALLBACK_PATH = '/auth/callback'
export const PRODUCTION_APP_URL = 'https://phola-beta.vercel.app'
export const APP_DEEP_LINK_SCHEME = 'phola'

export function getAppBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL

  if (configuredUrl) {
    return configuredUrl.replace(/\/auth\/callback\/?$/, '').replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    // Inside Capacitor Android/iOS WebView, origin is localhost or capacitor://localhost
    // An external email verification link must point to the public web server, not localhost!
    if (
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') || 
      origin.startsWith('capacitor:') ||
      origin.startsWith('file:')
    ) {
      return PRODUCTION_APP_URL
    }
    return origin
  }

  return PRODUCTION_APP_URL
}

export function getAuthCallbackUrl(nextPath = '/auth/verified?verified=true') {
  const baseUrl = getAppBaseUrl()
  const url = new URL(CALLBACK_PATH, baseUrl)
  if (nextPath) {
    url.searchParams.set('next', nextPath)
  }
  return url.toString()
}

export function getNativeAppDeepLink(path = '/auth/verified', queryParams?: Record<string, string>): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  let deepLink = `${APP_DEEP_LINK_SCHEME}://${cleanPath}`
  if (queryParams) {
    const search = new URLSearchParams(queryParams).toString()
    if (search) deepLink += `?${search}`
  }
  return deepLink
}

export function getAndroidIntentUrl(path = '/auth/verified', queryParams?: Record<string, string>): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  let search = ''
  if (queryParams) {
    search = '?' + new URLSearchParams(queryParams).toString()
  }
  return `intent://${cleanPath}${search}#Intent;scheme=${APP_DEEP_LINK_SCHEME};package=com.phola.phola;end`
}
