const CALLBACK_PATH = '/auth/callback'

export function getAppBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL

  if (configuredUrl) {
    return configuredUrl.replace(/\/auth\/callback\/?$/, '').replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'http://localhost:3000'
}

export function getAuthCallbackUrl(nextPath = '/auth/login?verified=1') {
  const baseUrl = getAppBaseUrl()
  const url = new URL(CALLBACK_PATH, baseUrl)
  if (nextPath) {
    url.searchParams.set('next', nextPath)
  }
  return url.toString()
}
