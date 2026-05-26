const CALLBACK_PATH = '/auth/callback'

export function getAppBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'https://localhost:3000'
}

export function getAuthCallbackUrl(nextPath = '/') {
  const baseUrl = getAppBaseUrl()
  const url = new URL(CALLBACK_PATH, baseUrl)
  if (nextPath) {
    url.searchParams.set('next', nextPath)
  }
  return url.toString()
}
