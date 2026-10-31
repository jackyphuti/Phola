'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Loader2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Check, 
  KeyRound, 
  ShieldCheck, 
  Fingerprint, 
  Smartphone, 
  X 
} from 'lucide-react'
import { 
  registerPasskey, 
  savePasskeyToDatabase, 
  isPasskeyAvailable, 
  getLocalPasskeys, 
  removeLocalPasskey, 
  PasskeyCredential 
} from '@/lib/passkey'

interface PasskeyItem {
  credential_id: string
  name?: string
  created_at: string
  transports?: string[]
}

export function PasskeySettings({ userId, email }: { userId: string; email: string }) {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [passkeyName, setPasskeyName] = useState('')

  useEffect(() => {
    let isMounted = true
    const checkSupport = async () => {
      const supported = await isPasskeyAvailable()
      if (isMounted) {
        setPasskeySupported(supported)
        if (supported) {
          void fetchPasskeys()
        }
      }
    }
    void checkSupport()
    return () => {
      isMounted = false
    }
  }, [userId])

  const fetchPasskeys = async () => {
    // 1. Instant local cache lookup
    const local = getLocalPasskeys()
    if (local.length > 0) {
      setPasskeys(
        local.map((p) => ({
          credential_id: p.id,
          name: p.name,
          created_at: p.created_at,
          transports: p.transports,
        }))
      )
    }

    try {
      const response = await fetch(`/api/passkey?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data.passkeys) && data.passkeys.length > 0) {
          setPasskeys(data.passkeys)
        }
      }
    } catch (err) {
      console.warn('Failed to fetch passkeys from backend:', err)
    }
  }

  const handleOpenAddModal = () => {
    const defaultName = typeof navigator !== 'undefined' && /iphone|ipad|mac/i.test(navigator.userAgent)
      ? 'Apple Passkey / Touch ID'
      : /android/i.test(navigator.userAgent)
      ? 'Android Screen Lock / Biometrics'
      : 'Hardware Security Key'
    setPasskeyName(defaultName)
    setError('')
    setShowAddModal(true)
  }

  const handleConfirmAddPasskey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const passkey = await registerPasskey(userId, email, passkeyName.trim() || 'My Passkey')
      if (passkey) {
        await savePasskeyToDatabase(userId, email, passkey)
        await fetchPasskeys()
        setShowAddModal(false)
        setSuccess('Passkey registered successfully! You can now use it for instant, password-free security.')
        setTimeout(() => setSuccess(''), 4000)
      } else {
        setError('Passkey registration was cancelled or failed.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to register passkey with device authenticator.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePasskey = async (credentialId: string) => {
    setIsDeleting(credentialId)
    setError('')

    try {
      removeLocalPasskey(credentialId)
      const response = await fetch(
        `/api/passkey?userId=${userId}&credentialId=${encodeURIComponent(credentialId)}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setPasskeys((prev) => prev.filter((p) => p.credential_id !== credentialId))
        setSuccess('Passkey removed.')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError('Failed to delete passkey from server.')
      }
    } catch {
      setError('Failed to delete passkey.')
    } finally {
      setIsDeleting(null)
    }
  }

  if (!passkeySupported) {
    return (
      <div className="p-5 flex items-start gap-3.5 bg-muted/20 rounded-2xl border border-border/60">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground mt-0.5">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">Passkeys & Security Keys</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Passkeys (FIDO2 / WebAuthn) are not supported on this specific browser or environment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-primary mt-0.5">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground">Passkeys & Security Keys</p>
              {passkeys.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {passkeys.length} Active
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sign in and unlock with passkeys, Face ID, fingerprint sensors, or USB hardware tokens.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleOpenAddModal}
          className="rounded-xl text-xs font-semibold h-8.5 px-3.5 bg-primary hover:bg-primary/90 text-white shadow-xs self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Passkey
        </Button>
      </div>

      {/* Status Alerts */}
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Passkeys List */}
      {passkeys.length > 0 ? (
        <div className="space-y-2 pt-1">
          {passkeys.map((passkey, idx) => (
            <div
              key={passkey.credential_id || idx}
              className="flex items-center justify-between p-3 border border-border/80 rounded-xl bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {passkey.name || `Passkey #${idx + 1}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Created {new Date(passkey.created_at).toLocaleDateString()} • {passkey.transports?.join(', ') || 'Platform authenticator'}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeletePasskey(passkey.credential_id)}
                disabled={isDeleting !== null}
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                title="Remove Passkey"
              >
                {isDeleting === passkey.credential_id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/80 p-4 text-center space-y-1">
          <p className="text-xs font-medium text-foreground">No passkeys configured yet</p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Passkeys replace passwords with encrypted device biometrics or security keys that cannot be phished.
          </p>
        </div>
      )}

      {/* Add Passkey Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-border/80 bg-background p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Add Security Passkey</h3>
                  <p className="text-xs text-muted-foreground">Name your passkey or device</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddPasskey} className="space-y-3.5 pt-1">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Passkey Name
                </label>
                <input
                  type="text"
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  placeholder="e.g. My iPhone 15, MacBook Air, YubiKey"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>

              <div className="rounded-xl bg-muted/50 p-2.5 text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Next Step:</p>
                <p>Your browser or OS will prompt you to scan your Face ID, Touch ID, fingerprint, or plug in a security key.</p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl text-xs font-semibold h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 rounded-xl text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Scanning...
                    </>
                  ) : (
                    'Scan & Register'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
