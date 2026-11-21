export function clearSensitiveLocalData() {
  if (typeof window === 'undefined') {
    return
  }

  // Deep wipe of all Phola-related sensitive local storage items (GPS, notes, contacts, drafts)
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && (key.startsWith('phola') || key.startsWith('sb-') || key.includes('incident') || key.includes('gps'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => {
      try {
        window.localStorage.removeItem(key)
      } catch {}
    })
  } catch {}

  // Completely wipe session storage (tokens, drafts, unlock states)
  try {
    window.sessionStorage.clear()
  } catch {}
}
