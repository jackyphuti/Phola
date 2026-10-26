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

export async function verifyPin(pin: string, userId: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false
  const computedHash = await hashPin(pin, userId)
  return computedHash === storedHash
}

/**
 * Checks whether a user profile has a valid, configured security PIN.
 * Rejects null, undefined, empty strings, and malformed non-hash strings.
 */
export function hasConfiguredPin(profile: { pin_hash?: string | null } | null | undefined): boolean {
  if (!profile || !profile.pin_hash) return false
  const hash = profile.pin_hash.trim()
  return typeof hash === 'string' && hash.length >= 10 && hash !== 'null' && hash !== 'undefined'
}
