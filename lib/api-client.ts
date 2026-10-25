/**
 * Client-side API URL resolution utility.
 * Ensures relative /api/* fetches route to the deployed backend origin
 * when the app is executed inside a native Capacitor shell or offline wrapper.
 */

export function getApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (typeof window !== 'undefined') {
    const isCapacitorScheme = window.location.protocol === 'capacitor:'
    const isLocalhostNoPort = window.location.hostname === 'localhost' && !window.location.port
    const isFileScheme = window.location.protocol === 'file:'

    if (isCapacitorScheme || isLocalhostNoPort || isFileScheme) {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://phola-beta.vercel.app'
      return `${base.replace(/\/$/, '')}${normalizedPath}`
    }
  }

  return normalizedPath
}
