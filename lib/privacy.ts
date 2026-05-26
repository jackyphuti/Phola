const LOCAL_DATA_KEYS = [
  'phola-pending-incidents',
  'phola-language',
  'phola-intro-seen',
]

export function clearSensitiveLocalData() {
  if (typeof window === 'undefined') {
    return
  }

  LOCAL_DATA_KEYS.forEach((key) => {
    window.localStorage.removeItem(key)
  })
}
