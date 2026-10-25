const LOCAL_DATA_KEYS = [
  'phola-pending-incidents',
  'phola-language',
  'phola-intro-seen',
  'phola-biometric-credential-id',
  'phola_side_tabs_hidden',
]

export function clearSensitiveLocalData() {
  if (typeof window === 'undefined') {
    return
  }

  // Clear all localStorage keys
  LOCAL_DATA_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  })

  // Completely wipe session storage (tokens, drafts, unlock states)
  try {
    window.sessionStorage.clear()
  } catch {
    // ignore
  }
}
