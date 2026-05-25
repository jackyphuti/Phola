'use client'

import { useRef, useState, useEffect } from 'react'
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
import { getProfilePhotoUrl } from '@/lib/profile-photo'
import { 
  ArrowLeft, 
  Camera,
  Fingerprint, 
  KeyRound, 
  User,
  Shield,
  Trash2,
  LogOut,
  Loader2,
  Check,
  AlertCircle,
  X
} from 'lucide-react'

export function SettingsPage() {
  const router = useRouter()
  const { user, profile, signOut, lock, refreshProfile } = useAuth()
  const supabase = createClient()
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoZoom, setPhotoZoom] = useState(1)
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
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

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const currentPhotoUrl = getProfilePhotoUrl(profile?.profile_photo_path || user?.user_metadata?.profile_photo_path)

  const resizePhoto = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => {
        const image = new window.Image()

        image.onload = () => {
          const maxSize = 320
          const scale = Math.min(maxSize / image.width, maxSize / image.height, 1)
          const width = Math.round(image.width * scale)
          const height = Math.round(image.height * scale)

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const context = canvas.getContext('2d')
          if (!context) {
            reject(new Error('Unable to process photo'))
            return
          }

          context.drawImage(image, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }

        image.onerror = () => reject(new Error('Unable to load photo'))
        image.src = reader.result as string
      }

      reader.onerror = () => reject(new Error('Unable to read photo'))
      reader.readAsDataURL(file)
    })
  }

  const handlePhotoPick = async (file?: File) => {
    if (!file) return

    try {
      const compressedPhoto = await resizePhoto(file)
      setPhotoDataUrl(compressedPhoto)
      setPhotoZoom(1)
      setIsPhotoPreviewOpen(true)
      setMessage(null)
    } catch {
      setMessage({ type: 'error', text: 'Please take a clear photo or choose another image.' })
    }
  }

  const openCamera = async () => {
    setCameraError('')
    setIsCameraOpen(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })

      cameraStreamRef.current = stream

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream
        await cameraVideoRef.current.play()
      }
    } catch {
      setCameraError('Camera access is blocked. You can still choose a photo file.')
    }
  }

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null
    }
    setIsCameraOpen(false)
    setCameraError('')
  }

  const captureCameraPhoto = () => {
    const video = cameraVideoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 720
    canvas.height = video.videoHeight || 720

    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Unable to capture camera photo.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85))
    setPhotoZoom(1)
    setIsPhotoPreviewOpen(true)
    setMessage(null)
    closeCamera()
  }

  const closePhotoPreview = () => {
    setIsPhotoPreviewOpen(false)
    setPhotoDataUrl('')
    setPhotoZoom(1)
  }

  const cropPhotoForUpload = (sourceDataUrl: string, zoom: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const image = new window.Image()

      image.onload = () => {
        const outputSize = 512
        const canvas = document.createElement('canvas')
        canvas.width = outputSize
        canvas.height = outputSize

        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Unable to process photo'))
          return
        }

        const baseScale = Math.max(outputSize / image.width, outputSize / image.height)
        const renderScale = baseScale * zoom
        const renderWidth = image.width * renderScale
        const renderHeight = image.height * renderScale
        const renderX = (outputSize - renderWidth) / 2
        const renderY = (outputSize - renderHeight) / 2

        context.fillStyle = '#000000'
        context.fillRect(0, 0, outputSize, outputSize)
        context.drawImage(image, renderX, renderY, renderWidth, renderHeight)
        resolve(canvas.toDataURL('image/jpeg', 0.84))
      }

      image.onerror = () => reject(new Error('Unable to load photo'))
      image.src = sourceDataUrl
    })
  }

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

  const handleSavePhoto = async () => {
    if (!user || !photoDataUrl) return

    setIsSaving(true)
    setMessage(null)

    try {
      const croppedPhoto = await cropPhotoForUpload(photoDataUrl, photoZoom)
      const response = await fetch('/api/profile-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          fullName: displayName || profile?.display_name || user.user_metadata?.full_name || user.email || 'User',
          photoDataUrl: croppedPhoto,
        }),
      })

      if (!response.ok) {
        const { error } = await response.json().catch(() => ({ error: 'Photo upload failed' }))
        throw new Error(error)
      }

      setPhotoDataUrl('')
      setPhotoZoom(1)
      setIsPhotoPreviewOpen(false)
      await refreshProfile()
      setMessage({ type: 'success', text: 'Profile photo updated successfully' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update photo' })
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
      {isPhotoPreviewOpen && photoDataUrl && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Adjust Photo
              </CardTitle>
              <CardDescription>Zoom in to center the part you want shown.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoDataUrl}
                  alt="Selected photo preview"
                  className="h-full w-full object-cover"
                  style={{ transform: `scale(${photoZoom})`, transformOrigin: 'center' }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Zoom</span>
                  <span>{photoZoom.toFixed(2)}x</span>
                </div>
                <Input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.01"
                  value={photoZoom}
                  onChange={(e) => setPhotoZoom(Number(e.target.value))}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={closePhotoPreview} disabled={isSaving}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSavePhoto} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Photo'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Camera Preview Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Take Photo
                </CardTitle>
                <CardDescription>Use the live camera preview to capture your profile photo.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={closeCamera}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl bg-black aspect-square">
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              </div>
              {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={closeCamera}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={captureCameraPhoto}>
                  Capture
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
              <Label>Profile Photo</Label>
              <div className="rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {(photoDataUrl || currentPhotoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoDataUrl || currentPhotoUrl || ''} alt="Profile photo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground text-center px-2">No photo</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Your current photo</p>
                    <p className="text-xs text-muted-foreground">Update it anytime.</p>
                  </div>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => handlePhotoPick(e.target.files?.[0])}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={openCamera}>
                    <Camera className="w-4 h-4 mr-2" />
                    Camera
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => photoInputRef.current?.click()}>
                    Change Photo
                  </Button>
                </div>
                {photoDataUrl && !isPhotoPreviewOpen && (
                  <p className="text-xs text-muted-foreground">Photo ready to review.</p>
                )}
              </div>
            </div>
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
