/**
 * High-speed, high-reliability geolocation helper.
 * Uses cached position immediately (if fresh), tries fast GPS (3s timeout),
 * and instantly falls back to coarse Network/Cell location.
 */

export const DEFAULT_SOUTH_AFRICA_LOCATION = {
  lat: -26.2041,
  lng: 28.0473,
}

let memoryLocationCache: { lat: number; lng: number; ts: number } | null = null

export function getCachedLocation(): { lat: number; lng: number } | null {
  if (memoryLocationCache && Date.now() - memoryLocationCache.ts < 10 * 60 * 1000) {
    return { lat: memoryLocationCache.lat, lng: memoryLocationCache.lng }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem('phola_last_gps')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.lat && parsed?.lng && Date.now() - (parsed.ts || 0) < 15 * 60 * 1000) {
          memoryLocationCache = parsed
          return { lat: parsed.lat, lng: parsed.lng }
        }
      }
    } catch {
      // ignore storage error
    }
  }

  return null
}

export function saveLocationToCache(lat: number, lng: number) {
  memoryLocationCache = { lat, lng, ts: Date.now() }
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem('phola_last_gps', JSON.stringify(memoryLocationCache))
    } catch {
      // ignore storage error
    }
  }
}

export function getReliableLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    // 0. If we have a recent GPS position (< 5 min old), resolve immediately
    const cached = getCachedLocation()
    if (cached && memoryLocationCache && Date.now() - memoryLocationCache.ts < 5 * 60 * 1000) {
      return resolve(cached)
    }

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return resolve(cached || DEFAULT_SOUTH_AFRICA_LOCATION)
    }

    let resolved = false

    const handleSuccess = (pos: GeolocationPosition) => {
      if (!resolved) {
        resolved = true
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        saveLocationToCache(coords.lat, coords.lng)
        resolve(coords)
      }
    }

    // 1. Try GPS with high accuracy but tight 3.5s timeout and 3-minute maximumAge
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      () => {
        // 2. Fast fallback to coarse Network/Cell location (2.5s timeout)
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          () => {
            if (!resolved) {
              resolved = true
              resolve(cached || DEFAULT_SOUTH_AFRICA_LOCATION)
            }
          },
          { enableHighAccuracy: false, timeout: 2500, maximumAge: 300000 }
        )
      },
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 180000 }
    )
  })
}
