// WebAuthn utilities for biometric authentication in PWA, iOS, and Android

export interface BiometricCredential {
  credentialId: string
  publicKey: string
}

export type BiometricType = 'faceID' | 'fingerprint' | 'biometrics'

let biometricCredentialId: string | null = null

export function isBiometricSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'PublicKeyCredential' in window &&
    'isUserVerifyingPlatformAuthenticatorAvailable' in PublicKeyCredential
  )
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Determine whether device is iOS (Face ID) or Android (Fingerprint) or generic desktop biometrics.
 */
export function getBiometricType(): BiometricType {
  if (typeof window === 'undefined') return 'biometrics'
  const ua = (window.navigator?.userAgent || '').toLowerCase()
  const platform = (window.navigator?.platform || '').toLowerCase()

  // iOS devices (iPhone, iPad, iPod, or iPadOS Safari with desktop UA)
  if (
    /iphone|ipad|ipod/.test(ua) ||
    (platform.includes('mac') && typeof window.navigator.maxTouchPoints === 'number' && window.navigator.maxTouchPoints > 1)
  ) {
    return 'faceID'
  }

  // Android devices
  if (/android/.test(ua)) {
    return 'fingerprint'
  }

  return 'biometrics'
}

/**
 * Returns human-readable label matching the native OS:
 * iOS: "Face ID"
 * Android: "Fingerprint"
 * Desktop/Other: "Biometrics"
 */
export function getBiometricLabel(): string {
  const type = getBiometricType()
  if (type === 'faceID') return 'Face ID'
  if (type === 'fingerprint') return 'Fingerprint'
  return 'Biometrics'
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

export async function registerBiometric(userId: string): Promise<BiometricCredential | null> {
  if (!(await isBiometricAvailable())) return null

  try {
    const challenge = generateChallenge()

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Phola Safety',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: 'Phola User',
          displayName: 'Phola User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!credential) return null

    const response = credential.response as AuthenticatorAttestationResponse

    return {
      credentialId: arrayBufferToBase64(credential.rawId),
      publicKey: arrayBufferToBase64(response.getPublicKey() || new ArrayBuffer(0)),
    }
  } catch (error) {
    console.error('Biometric registration failed:', error)
    return null
  }
}

export async function authenticateBiometric(credentialId?: string): Promise<boolean> {
  if (!(await isBiometricAvailable())) return false

  try {
    const challenge = generateChallenge()

    const options: CredentialRequestOptions = {
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: 'required',
        timeout: 60000,
        allowCredentials: credentialId
          ? [
              {
                id: base64ToArrayBuffer(credentialId),
                type: 'public-key',
                transports: ['internal'],
              },
            ]
          : [],
      },
    }

    const credential = await navigator.credentials.get(options)
    return !!credential
  } catch (error) {
    console.error('Biometric authentication failed:', error)
    return false
  }
}

const BIOMETRIC_STORAGE_KEY = 'phola-biometric-credential-id'

export function saveCredentialId(credentialId: string): void {
  biometricCredentialId = credentialId
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BIOMETRIC_STORAGE_KEY, credentialId)
    } catch {
      // Storage might be restricted
    }
  }
}

export function getCredentialId(): string | null {
  if (biometricCredentialId) return biometricCredentialId
  if (typeof window !== 'undefined') {
    try {
      biometricCredentialId = window.localStorage.getItem(BIOMETRIC_STORAGE_KEY)
    } catch {
      // Storage might be restricted
    }
  }
  return biometricCredentialId
}

export function clearCredentialId(): void {
  biometricCredentialId = null
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(BIOMETRIC_STORAGE_KEY)
    } catch {
      // Storage might be restricted
    }
  }
}
