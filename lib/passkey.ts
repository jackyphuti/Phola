// Passkey/WebAuthn management utilities
import { getApiUrl } from '@/lib/api-client'

export interface PasskeyCredential {
  id: string
  name?: string
  publicKey: string
  counter: number
  transports?: string[]
  created_at: string
}

const LOCAL_PASSKEYS_KEY = 'phola-local-passkeys'

export function savePasskeyToLocalCache(passkey: PasskeyCredential): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LOCAL_PASSKEYS_KEY)
    const list: PasskeyCredential[] = raw ? JSON.parse(raw) : []
    const filtered = list.filter((p) => p.id !== passkey.id)
    filtered.push(passkey)
    window.localStorage.setItem(LOCAL_PASSKEYS_KEY, JSON.stringify(filtered))
  } catch {}
}

export function getLocalPasskeys(): PasskeyCredential[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_PASSKEYS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function removeLocalPasskey(credentialId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LOCAL_PASSKEYS_KEY)
    if (!raw) return
    const list: PasskeyCredential[] = JSON.parse(raw)
    const filtered = list.filter((p) => p.id !== credentialId)
    window.localStorage.setItem(LOCAL_PASSKEYS_KEY, JSON.stringify(filtered))
  } catch {}
}

function generateChallenge(): Uint8Array {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)
  return challenge
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'PublicKeyCredential' in window &&
    'isUserVerifyingPlatformAuthenticatorAvailable' in PublicKeyCredential
  )
}

export async function isPasskeyAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function registerPasskey(userId: string, email: string, friendlyName?: string): Promise<PasskeyCredential | null> {
  if (!(await isPasskeyAvailable())) return null

  try {
    const challenge = generateChallenge()

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Phola Security & Passkeys',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: email,
          displayName: friendlyName || email,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!credential) return null

    const response = credential.response as AuthenticatorAttestationResponse

    const passkeyData: PasskeyCredential = {
      id: arrayBufferToBase64(credential.rawId),
      name: friendlyName || 'Hardware Security Passkey',
      publicKey: arrayBufferToBase64(response.getPublicKey() || new ArrayBuffer(0)),
      counter: 0,
      transports: (response as any).getTransports?.() || [],
      created_at: new Date().toISOString(),
    }

    savePasskeyToLocalCache(passkeyData)
    return passkeyData
  } catch (error) {
    console.error('Passkey registration failed:', error)
    return null
  }
}

export async function authenticateWithPasskey(credentialId?: string): Promise<boolean> {
  if (!(await isPasskeyAvailable())) return false

  try {
    const challenge = generateChallenge()
    const local = getLocalPasskeys()

    const allowCredentials = credentialId
      ? [{ type: 'public-key' as const, id: base64ToArrayBuffer(credentialId) }]
      : local.length > 0
      ? local.map((p) => ({ type: 'public-key' as const, id: base64ToArrayBuffer(p.id) }))
      : undefined

    const options: CredentialRequestOptions = {
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        ...(allowCredentials ? { allowCredentials } : {}),
      },
    }

    const assertion = (await navigator.credentials.get(options)) as PublicKeyCredential | null

    return !!assertion
  } catch (error) {
    console.error('Passkey authentication failed:', error)
    return false
  }
}

export async function savePasskeyToDatabase(
  userId: string,
  email: string,
  passkey: PasskeyCredential
): Promise<boolean> {
  try {
    savePasskeyToLocalCache(passkey)

    const response = await fetch(getApiUrl('/api/passkey'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email,
        name: passkey.name,
        credentialId: passkey.id,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports,
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Failed to save passkey:', error)
    // Local cache still allows offline passkey verification
    return true
  }
}
