// WebAuthn utilities for biometric authentication in PWA

export interface BiometricCredential {
  credentialId: string
  publicKey: string
}

export function isBiometricSupported(): boolean {
  return typeof window !== 'undefined' && 
    'PublicKeyCredential' in window &&
    'isUserVerifyingPlatformAuthenticatorAvailable' in PublicKeyCredential
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
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
  if (!await isBiometricAvailable()) return null

  try {
    const challenge = generateChallenge()
    
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'My Notes',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: 'User',
          displayName: 'User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256
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
    }) as PublicKeyCredential | null

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
  if (!await isBiometricAvailable()) return false

  try {
    const challenge = generateChallenge()
    
    const options: CredentialRequestOptions = {
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: 'required',
        timeout: 60000,
        allowCredentials: credentialId ? [{
          id: base64ToArrayBuffer(credentialId),
          type: 'public-key',
          transports: ['internal'],
        }] : [],
      },
    }

    const credential = await navigator.credentials.get(options)
    return !!credential
  } catch (error) {
    console.error('Biometric authentication failed:', error)
    return false
  }
}

// Store credential ID in localStorage (encrypted in production)
const CREDENTIAL_KEY = 'notes_biometric_credential'

export function saveCredentialId(credentialId: string): void {
  localStorage.setItem(CREDENTIAL_KEY, credentialId)
}

export function getCredentialId(): string | null {
  return localStorage.getItem(CREDENTIAL_KEY)
}

export function clearCredentialId(): void {
  localStorage.removeItem(CREDENTIAL_KEY)
}
