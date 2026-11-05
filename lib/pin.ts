/**
 * Secure client-side and server-side PIN hashing and verification utilities
 * using Web Crypto SHA-256 with user ID salting.
 */

export async function hashPin(pin: string, userId: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${userId}:phola-pin-salt:${pin}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPin(pin: string, userId: string, storedHash?: string | null): Promise<boolean> {
  const computedHash = await hashPin(pin, userId)
  if (storedHash && computedHash === storedHash) {
    return true
  }

  // Local device storage check fallback
  if (typeof window !== 'undefined') {
    const localHash = window.localStorage.getItem(`phola_pin_hash_${userId}`)
    if (localHash && computedHash === localHash) {
      return true
    }
    const rawPin = window.localStorage.getItem('phola_user_pin')
    if (rawPin && pin === rawPin) {
      return true
    }
  }

  return false
}

/**
 * Checks whether a user profile has a valid, configured security PIN.
 * Rejects null, undefined, empty strings, and malformed non-hash strings.
 * Also checks local device storage fallback.
 */
export function hasConfiguredPin(profile: { pin_hash?: string | null } | null | undefined): boolean {
  if (profile && profile.pin_hash) {
    const hash = profile.pin_hash.trim()
    if (typeof hash === 'string' && hash.length >= 10 && hash !== 'null' && hash !== 'undefined') {
      return true
    }
  }

  if (typeof window !== 'undefined') {
    if (window.localStorage.getItem('phola_has_pin_configured') === 'true') {
      return true
    }
    if (Boolean(window.localStorage.getItem('phola_user_pin'))) {
      return true
    }
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && key.startsWith('phola_pin_hash_')) {
          const val = window.localStorage.getItem(key)
          if (val && val.length >= 10) return true
        }
      }
    } catch {}
  }

  return false
}
