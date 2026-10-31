/**
 * High-speed, high-reliability geolocation helper.
 * Uses cached position immediately (if fresh), keeps active GPS watcher,
 * and falls back gracefully.
 */

export const DEFAULT_SOUTH_AFRICA_LOCATION = {
  lat: -26.2041,
  lng: 28.0473,
}

let memoryLocationCache: { lat: number; lng: number; ts: number } | null = null

export function getCachedLocation(): { lat: number; lng: number } | null {
  if (memoryLocationCache && Date.now() - memoryLocationCache.ts < 15 * 60 * 1000) {
    return { lat: memoryLocationCache.lat, lng: memoryLocationCache.lng }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem('phola_last_gps') || window.localStorage.getItem('phola_last_gps')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.lat && parsed?.lng && Date.now() - (parsed.ts || 0) < 60 * 60 * 1000) {
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
      const serialized = JSON.stringify(memoryLocationCache)
      window.sessionStorage.setItem('phola_last_gps', serialized)
      window.localStorage.setItem('phola_last_gps', serialized)
    } catch {
      // ignore storage error
    }
  }
}

export function getReliableLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    const cached = getCachedLocation()

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return resolve(cached || DEFAULT_SOUTH_AFRICA_LOCATION)
    }

    let resolved = false

    // Guarantee that this promise resolves in 4000ms max under all network/device conditions
    const hardTimeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(cached || DEFAULT_SOUTH_AFRICA_LOCATION)
      }
    }, 4000)

    const handleSuccess = (pos: GeolocationPosition) => {
      if (!resolved) {
        resolved = true
        clearTimeout(hardTimeoutTimer)
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        saveLocationToCache(coords.lat, coords.lng)
        resolve(coords)
      }
    }

    // 1. Try GPS with high accuracy (3.5s timeout)
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      () => {
        // 2. Fast fallback to coarse Network/Cell location (2s timeout)
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          () => {
            if (!resolved) {
              resolved = true
              clearTimeout(hardTimeoutTimer)
              resolve(cached || DEFAULT_SOUTH_AFRICA_LOCATION)
            }
          },
          { enableHighAccuracy: false, timeout: 2000, maximumAge: 300000 }
        )
      },
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 60000 }
    )
  })
}

/**
 * Continuous GPS watcher that triggers callback whenever user moves or GPS updates.
 */
export function watchReliableLocation(
  onUpdate: (coords: { lat: number; lng: number; heading?: number | null; speed?: number | null }) => void,
  onError?: (error: GeolocationPositionError) => void
): () => void {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return () => {}
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
      }
      saveLocationToCache(coords.lat, coords.lng)
      onUpdate(coords)
    },
    (err) => {
      if (onError) onError(err)
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  )

  return () => {
    navigator.geolocation.clearWatch(watchId)
  }
}
