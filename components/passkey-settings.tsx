'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, Plus, Trash2, Check } from 'lucide-react'
import { registerPasskey, savePasskeyToDatabase, isPasskeyAvailable } from '@/lib/passkey'

interface Passkey {
  credential_id: string
  created_at: string
  transports?: string[]
}

export function PasskeySettings({ userId, email }: { userId: string; email: string }) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [passkeySupported, setPasskeySupported] = useState(false)

  useEffect(() => {
    const checkSupport = async () => {
      const supported = await isPasskeyAvailable()
      setPasskeySupported(supported)
      if (supported) {
        fetchPasskeys()
      }
    }
    checkSupport()
  }, [])

  const fetchPasskeys = async () => {
    try {
      const response = await fetch(`/api/passkey?userId=${userId}`)
      const data = await response.json()
      if (data.passkeys) {
        setPasskeys(data.passkeys)
      }
    } catch (err) {
      console.error('Failed to fetch passkeys:', err)
    }
  }

  const handleAddPasskey = async () => {
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const passkey = await registerPasskey(userId, email)
      if (passkey) {
        const saved = await savePasskeyToDatabase(userId, email, passkey)
        if (saved) {
          await fetchPasskeys()
          setSuccess('Passkey saved successfully')
          setTimeout(() => setSuccess(''), 3000)
        } else {
          setError('Failed to save passkey')
        }
      } else {
        setError('Passkey registration was cancelled or failed')
      }
    } catch {
      setError('Failed to register passkey')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePasskey = async (credentialId: string) => {
    setIsDeleting(credentialId)
    setError('')

    try {
      const response = await fetch(
        `/api/passkey?userId=${userId}&credentialId=${credentialId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        await fetchPasskeys()
        setSuccess('Passkey deleted')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError('Failed to delete passkey')
      }
    } catch {
      setError('Failed to delete passkey')
    } finally {
      setIsDeleting(null)
    }
  }

  if (!passkeySupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>
            Passkeys are not supported on this device
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>
          Add passkeys for faster, password-free sign-in
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-green-700 text-sm">
            <Check className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {passkeys.length > 0 ? (
          <div className="space-y-2">
            {passkeys.map((passkey) => (
              <div
                key={passkey.credential_id}
                className="flex items-center justify-between p-3 border border-border rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium">
                    {new Date(passkey.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {passkey.transports?.join(', ') || 'Platform authenticator'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeletePasskey(passkey.credential_id)}
                  disabled={isDeleting !== null}
                >
                  {isDeleting === passkey.credential_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No passkeys saved yet
          </p>
        )}

        <Button
          onClick={handleAddPasskey}
          disabled={isLoading || isDeleting !== null}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Add Passkey
        </Button>
      </CardContent>
    </Card>
  )
}
