/**
 * Always-On High-Reliability Geolocation Engine.
 * - Immediately emits cached GPS coordinates (0ms latency).
 * - Maintains a continuous high-accuracy GPS watcher with automatic Wi-Fi/Cell-tower fallback.
 * - Includes an active keep-alive heartbeat and visibility/focus recovery so location services
 *   never stall or die when the user switches tabs, locks/unlocks their phone, or moves indoors.
 */

export const DEFAULT_SOUTH_AFRICA_LOCATION = {
  lat: -25.7479,
  lng: 28.2293,
}

let memoryLocationCache: {
  lat: number
  lng: number
  heading?: number | null
  speed?: number | null
  ts: number
} | null = null

export function getCachedLocation(): { lat: number; lng: number } | null {
  if (memoryLocationCache) {
    return { lat: memoryLocationCache.lat, lng: memoryLocationCache.lng }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw =
        window.sessionStorage.getItem('phola_last_gps') ||
        window.localStorage.getItem('phola_last_gps')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (
          typeof parsed?.lat === 'number' &&
          typeof parsed?.lng === 'number' &&
          Number.isFinite(parsed.lat) &&
          Number.isFinite(parsed.lng)
        ) {
          memoryLocationCache = {
            lat: parsed.lat,
            lng: parsed.lng,
            heading: parsed.heading ?? null,
            speed: parsed.speed ?? null,
            ts: parsed.ts || Date.now(),
          }
          return { lat: parsed.lat, lng: parsed.lng }
        }
      }
    } catch {
      // ignore storage error
    }
  }

  return null
}

export function saveLocationToCache(
  lat: number,
  lng: number,
  heading?: number | null,
  speed?: number | null
) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
  memoryLocationCache = {
    lat,
    lng,
    heading: heading ?? memoryLocationCache?.heading ?? null,
    speed: speed ?? memoryLocationCache?.speed ?? null,
    ts: Date.now(),
  }
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

    const hardTimeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(cached || DEFAULT_SOUTH_AFRICA_LOCATION)
      }
    }, 3500)

    const handleSuccess = (pos: GeolocationPosition) => {
      const coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }
      saveLocationToCache(coords.lat, coords.lng, pos.coords.heading, pos.coords.speed)
      if (!resolved) {
        resolved = true
        clearTimeout(hardTimeoutTimer)
        resolve(coords)
      }
    }

    // 1. Try high-accuracy GPS
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      () => {
        // 2. Fast fallback to coarse Network/Cell/Wi-Fi location
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          () => {
            if (!resolved) {
              resolved = true
              clearTimeout(hardTimeoutTimer)
              resolve(cached || DEFAULT_SOUTH_AFRICA_LOCATION)
            }
          },
          { enableHighAccuracy: false, timeout: 2500, maximumAge: 300000 }
        )
      },
      { enableHighAccuracy: true, timeout: 2500, maximumAge: 30000 }
    )
  })
}

/**
 * Always-on continuous GPS watcher with dual-mode fallback (High-Accuracy GPS + Network/Cell)
 * and automatic keep-alive polling on visibility/focus/interval.
 */
export function watchReliableLocation(
  onUpdate: (coords: {
    lat: number
    lng: number
    heading?: number | null
    speed?: number | null
  }) => void,
  onError?: (error: GeolocationPositionError) => void
): () => void {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return () => {}
  }

  let isDisposed = false
  let highAccWatchId: number | null = null
  let lowAccWatchId: number | null = null

  const emitPosition = (pos: GeolocationPosition) => {
    if (isDisposed) return
    const coords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
    }
    saveLocationToCache(coords.lat, coords.lng, coords.heading, coords.speed)
    onUpdate(coords)
  }

  // 1. Emit cached fix immediately so UI/map is never waiting
  const cached = getCachedLocation()
  if (cached) {
    onUpdate({
      lat: cached.lat,
      lng: cached.lng,
      heading: memoryLocationCache?.heading ?? null,
      speed: memoryLocationCache?.speed ?? null,
    })
  }

  // 2. Start primary High-Accuracy GPS watcher
  const startWatchers = () => {
    if (isDisposed) return

    if (highAccWatchId !== null) {
      try {
        navigator.geolocation.clearWatch(highAccWatchId)
      } catch {}
    }

    highAccWatchId = navigator.geolocation.watchPosition(
      emitPosition,
      (err) => {
        if (onError) onError(err)
        // Start coarse network/cell watcher fallback if high accuracy fails or times out indoors
        if (!isDisposed && lowAccWatchId === null) {
          lowAccWatchId = navigator.geolocation.watchPosition(
            emitPosition,
            () => {},
            { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
          )
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
    )
  }

  startWatchers()

  // 3. Active ping function to force location refresh
  const forceLocationPing = () => {
    if (isDisposed) return
    navigator.geolocation.getCurrentPosition(
      emitPosition,
      () => {
        navigator.geolocation.getCurrentPosition(
          emitPosition,
          () => {},
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 5000 }
        )
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
    )
  }

  // Immediately request a fresh fix
  forceLocationPing()

  // 4. Keep-alive interval every 8 seconds so location never goes stale
  const keepAliveTimer = setInterval(forceLocationPing, 8000)

  // 5. Re-acquire immediately when phone wakes up or tab returns to foreground
  const handleVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible') {
      forceLocationPing()
      startWatchers()
    }
  }

  window.addEventListener('focus', handleVisibilityOrFocus)
  window.addEventListener('online', forceLocationPing)
  document.addEventListener('visibilitychange', handleVisibilityOrFocus)

  return () => {
    isDisposed = true
    clearInterval(keepAliveTimer)
    window.removeEventListener('focus', handleVisibilityOrFocus)
    window.removeEventListener('online', forceLocationPing)
    document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
    if (highAccWatchId !== null) {
      try {
        navigator.geolocation.clearWatch(highAccWatchId)
      } catch {}
    }
    if (lowAccWatchId !== null) {
      try {
        navigator.geolocation.clearWatch(lowAccWatchId)
      } catch {}
    }
  }
}
