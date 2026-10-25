/**
 * High-reliability geolocation helper.
 * Tries High-Accuracy GPS first (8 second timeout);
 * if that times out (common indoors or in Android WebViews),
 * immediately falls back to coarse Network/Cell location.
 */

export const DEFAULT_SOUTH_AFRICA_LOCATION = {
  lat: -26.2041,
  lng: 28.0473,
}

export function getReliableLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return resolve(DEFAULT_SOUTH_AFRICA_LOCATION)
    }

    let resolved = false

    const handleSuccess = (pos: GeolocationPosition) => {
      if (!resolved) {
        resolved = true
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      }
    }

    // 1. Try High Accuracy GPS first with 8-second timeout
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      () => {
        // 2. Fallback to Network/Cell-tower location if GPS times out
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          () => {
            if (!resolved) {
              resolved = true
              resolve(DEFAULT_SOUTH_AFRICA_LOCATION)
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        )
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    )
  })
}
