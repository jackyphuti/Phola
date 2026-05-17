'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  isBiometricAvailable, 
  registerBiometric, 
  saveCredentialId,
  getCredentialId,
  clearCredentialId
} from '@/lib/biometric'
import { 
  ArrowLeft, 
  Fingerprint, 
  KeyRound, 
  User,
  Shield,
  Trash2,
  LogOut,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react'

export function SettingsPage() {
  const router = useRouter()
  const { user, profile, signOut, lock, refreshProfile } = useAuth()
  const supabase = createClient()
  
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEnablingBiometric, setIsEnablingBiometric] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const checkBiometric = async () => {
      const available = await isBiometricAvailable()
      setBiometricAvailable(available)
      setBiometricEnabled(!!getCredentialId())
    }
    checkBiometric()
  }, [])

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name)
    }
  }, [profile])

  const handleSaveProfile = async () => {
    if (!user) return
    
    setIsSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      setMessage({ type: 'success', text: 'Profile updated successfully' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleBiometric = async () => {
    if (!user) return
    
    if (biometricEnabled) {
      // Disable biometric
      clearCredentialId()
      setBiometricEnabled(false)
      
      await supabase
        .from('profiles')
        .update({ biometric_enabled: false })
        .eq('id', user.id)
      
      setMessage({ type: 'success', text: 'Biometric login disabled' })
    } else {
      // Enable biometric
      setIsEnablingBiometric(true)
      setMessage(null)

      try {
        const credential = await registerBiometric(user.id)
        
        if (credential) {
          saveCredentialId(credential.credentialId)
          setBiometricEnabled(true)
          
          await supabase
            .from('profiles')
            .update({ biometric_enabled: true })
            .eq('id', user.id)
          
          setMessage({ type: 'success', text: 'Biometric login enabled' })
        } else {
          setMessage({ type: 'error', text: 'Biometric setup failed. Please try again.' })
        }
      } catch {
        setMessage({ type: 'error', text: 'Biometric setup failed. Please try again.' })
      } finally {
        setIsEnablingBiometric(false)
      }
    }
  }

  const handleDeleteAllData = async () => {
    if (!user) return
    
    setIsDeleting(true)

    try {
      // Delete all incidents
      await supabase
        .from('incidents')
        .delete()
        .eq('user_id', user.id)

      // Delete all emergency contacts
      await supabase
        .from('emergency_contacts')
        .delete()
        .eq('user_id', user.id)

      setMessage({ type: 'success', text: 'All data deleted successfully' })
      setShowDeleteConfirm(false)
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete data' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSignOut = async () => {
    lock()
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <Card className="max-w-sm w-full">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Delete All Data?
              </CardTitle>
              <CardDescription>
                This will permanently delete all your notes and cannot be undone. Your account will remain active.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteAllData}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Delete All'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-40">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-6 pb-8">
        {/* Message */}
        {message && (
          <Card className={message.type === 'success' ? 'border-primary/50 bg-primary/5' : 'border-destructive/50 bg-destructive/5'}>
            <CardContent className="p-3 flex items-center gap-2">
              {message.type === 'success' ? (
                <Check className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              )}
              <p className={`text-sm ${message.type === 'success' ? 'text-primary' : 'text-destructive'}`}>
                {message.text}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <Button
              onClick={handleSaveProfile}
              disabled={isSaving || displayName === profile?.display_name}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Biometric Toggle */}
            {biometricAvailable && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <Fingerprint className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Biometric Login</p>
                    <p className="text-sm text-muted-foreground">
                      Use fingerprint or face to unlock
                    </p>
                  </div>
                </div>
                {isEnablingBiometric ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    checked={biometricEnabled}
                    onCheckedChange={handleToggleBiometric}
                  />
                )}
              </div>
            )}

            {!biometricAvailable && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Fingerprint className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Biometric login is not available on this device
                </p>
              </div>
            )}

            {/* PIN Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">PIN Lock</p>
                <p className="text-sm text-muted-foreground">
                  Use any 4+ digit PIN to unlock
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" />
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Delete all your notes and data. This action cannot be undone.
            </p>
            <Button
              variant="outline"
              className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All My Data
            </Button>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Your data is encrypted and stored securely.
        </p>
      </main>
    </div>
  )
}
