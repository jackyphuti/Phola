// Passkey/WebAuthn management utilities

export interface PasskeyCredential {
  id: string
  publicKey: string
  counter: number
  transports?: string[]
  created_at: string
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
  return typeof window !== 'undefined' && 
    'PublicKeyCredential' in window &&
    'isUserVerifyingPlatformAuthenticatorAvailable' in PublicKeyCredential
}

export async function isPasskeyAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function registerPasskey(userId: string, email: string): Promise<PasskeyCredential | null> {
  if (!await isPasskeyAvailable()) return null

  try {
    const challenge = generateChallenge()
    
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Phola',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: email,
          displayName: email,
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
      id: arrayBufferToBase64(credential.rawId),
      publicKey: arrayBufferToBase64(response.getPublicKey() || new ArrayBuffer(0)),
      counter: 0,
      transports: (response as any).getTransports?.() || [],
      created_at: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Passkey registration failed:', error)
    return null
  }
}

export async function authenticateWithPasskey(credentialId?: string): Promise<boolean> {
  if (!await isPasskeyAvailable()) return false

  try {
    const challenge = generateChallenge()

    const options: CredentialRequestOptions = {
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
      },
    }

    if (credentialId) {
      options.publicKey!.allowCredentials = [
        {
          type: 'public-key',
          id: base64ToArrayBuffer(credentialId),
        },
      ]
    }

    const assertion = await navigator.credentials.get(options) as PublicKeyCredential | null
    
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
    const response = await fetch('/api/passkey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email,
        credentialId: passkey.id,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports,
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Failed to save passkey:', error)
    return false
  }
}
