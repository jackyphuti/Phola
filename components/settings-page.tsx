'use client'

import { AppBottomNav } from '@/components/app-bottom-nav'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTranslation } from 'react-i18next'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { 
  isBiometricAvailable, 
  registerBiometric, 
  saveCredentialId,
  getCredentialId,
  clearCredentialId
} from '@/lib/biometric'
import { getProfilePhotoUrl } from '@/lib/profile-photo'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/language-options'
import { loadLanguagePreference, saveLanguagePreference } from '@/lib/locale-storage'
import i18n from '@/lib/i18n'
import { clearSensitiveLocalData } from '@/lib/privacy'
import { getApiUrl } from '@/lib/api-client'
import { hashPin, verifyPin } from '@/lib/pin'
import type { EmergencyContact } from '@/lib/types'
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
  X,
  Phone,
  UserPlus,
  Star,
  ShieldCheck,
  Pencil,
  Globe,
  Lock,
  ChevronDown
} from 'lucide-react'

export function SettingsPage() {
  const router = useRouter()
  const { user, profile, signOut, lock, refreshProfile } = useAuth()
  const { t } = useTranslation()
  const supabase = createClient()
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  
  const [displayName, setDisplayName] = useState(profile?.display_name || user?.user_metadata?.full_name || '')
  const [firstName, setFirstName] = useState(profile?.first_name || user?.user_metadata?.first_name || user?.user_metadata?.given_name || '')
  const [lastName, setLastName] = useState(profile?.last_name || user?.user_metadata?.last_name || user?.user_metadata?.family_name || '')
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || user?.user_metadata?.date_of_birth || '')
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoZoom, setPhotoZoom] = useState(1)
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isEnablingBiometric, setIsEnablingBiometric] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // PIN settings state
  const [showPinModal, setShowPinModal] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isSavingPin, setIsSavingPin] = useState(false)

  // Emergency contacts state
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactRelationship, setContactRelationship] = useState('')
  const [contactIsPrimary, setContactIsPrimary] = useState(false)
  const [isSavingContact, setIsSavingContact] = useState(false)

  // Language preference state
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en')
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false)

  useEffect(() => {
    void loadLanguagePreference().then((lang) => {
      if (lang) {
        setCurrentLanguage(lang)
      }
    })
  }, [])

  const handleLanguageChange = async (newLang: SupportedLanguage) => {
    setCurrentLanguage(newLang)
    await i18n.changeLanguage(newLang)
    await saveLanguagePreference(newLang)
    document.documentElement.lang = newLang
    setIsLanguageDropdownOpen(false)
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === newLang)
    setMessage({
      type: 'success',
      text: `Language updated to ${langObj?.nativeName || newLang} (${langObj?.englishName || ''})`,
    })
  }

  useEffect(() => {
    const checkBiometric = async () => {
      const available = await isBiometricAvailable()
      setBiometricAvailable(available)
      setBiometricEnabled(!!getCredentialId())
    }
    checkBiometric()
  }, [])

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || user?.user_metadata?.full_name || '')
      setFirstName(profile.first_name || user?.user_metadata?.first_name || user?.user_metadata?.given_name || '')
      setLastName(profile.last_name || user?.user_metadata?.last_name || user?.user_metadata?.family_name || '')
      setDateOfBirth(profile.date_of_birth || user?.user_metadata?.date_of_birth || '')
    }
  }, [profile, user])

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const loadContacts = async () => {
    if (!user?.id) return
    setIsLoadingContacts(true)
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })

      if (data && !error) {
        setContacts(data as EmergencyContact[])
      }
    } catch {
      // Failed to load contacts
    } finally {
      setIsLoadingContacts(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      void loadContacts()
    }
  }, [user?.id])

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    if (!contactName.trim() || !contactPhone.trim()) {
      setMessage({ type: 'error', text: 'Contact name and phone number are required.' })
      return
    }

    setIsSavingContact(true)
    try {
      if (contactIsPrimary) {
        await supabase
          .from('emergency_contacts')
          .update({ is_primary: false })
          .eq('user_id', user.id)
      }

      const { error } = await supabase.from('emergency_contacts').insert({
        user_id: user.id,
        name: contactName.trim(),
        phone: contactPhone.trim(),
        relationship: contactRelationship.trim() || null,
        is_primary: contacts.length === 0 ? true : contactIsPrimary,
      })

      if (error) throw error

      setContactName('')
      setContactPhone('')
      setContactRelationship('')
      setContactIsPrimary(false)
      setShowAddContact(false)
      await loadContacts()
      setMessage({ type: 'success', text: 'Emergency contact added successfully' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to add emergency contact' })
    } finally {
      setIsSavingContact(false)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!user?.id) return
    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', contactId)
        .eq('user_id', user.id)

      if (error) throw error
      await loadContacts()
      setMessage({ type: 'success', text: 'Emergency contact removed' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove emergency contact' })
    }
  }

  const handleSetPrimaryContact = async (contactId: string) => {
    if (!user?.id) return
    try {
      await supabase
        .from('emergency_contacts')
        .update({ is_primary: false })
        .eq('user_id', user.id)

      await supabase
        .from('emergency_contacts')
        .update({ is_primary: true })
        .eq('id', contactId)
        .eq('user_id', user.id)

      await loadContacts()
      setMessage({ type: 'success', text: 'Primary emergency contact updated' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to update primary contact' })
    }
  }

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setPinError('')

    if (profile?.pin_hash) {
      if (!currentPin) {
        setPinError('Please enter your current PIN.')
        return
      }
      const isCurrentValid = await verifyPin(currentPin, user.id, profile.pin_hash)
      if (!isCurrentValid) {
        setPinError('Current PIN is incorrect.')
        return
      }
    }

    if (newPin.length < 4 || newPin.length > 6) {
      setPinError('New PIN must be between 4 and 6 digits.')
      return
    }

    if (newPin !== confirmPin) {
      setPinError('New PINs do not match.')
      return
    }

    setIsSavingPin(true)
    try {
      const hashedPin = await hashPin(newPin, user.id)
      const { error } = await supabase
        .from('profiles')
        .update({
          pin_hash: hashedPin,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      setShowPinModal(false)
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setMessage({ type: 'success', text: 'PIN successfully saved!' })
    } catch {
      setPinError('Failed to save PIN. Please try again.')
    } finally {
      setIsSavingPin(false)
    }
  }

  const handleRemovePin = async () => {
    if (!user?.id) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          pin_hash: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      setMessage({ type: 'success', text: 'PIN lock removed.' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove PIN.' })
    }
  }

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
    if (!user || !isEditingProfile) return
    
    setIsSaving(true)
    setMessage(null)

    try {
      const computedDisplayName = displayName.trim() || [firstName, lastName].filter(Boolean).join(' ') || 'User'
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: computedDisplayName,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          date_of_birth: dateOfBirth || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      await supabase.auth.updateUser({
        data: {
          full_name: computedDisplayName,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          given_name: firstName.trim() || null,
          family_name: lastName.trim() || null,
          date_of_birth: dateOfBirth || null,
        },
      })

      await refreshProfile()
      setMessage({ type: 'success', text: 'Profile updated successfully' })
      setIsEditingProfile(false)
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePhoto = async () => {
    if (!user || !photoDataUrl || !isEditingProfile) return

    setIsSaving(true)
    setMessage(null)

    try {
      const croppedPhoto = await cropPhotoForUpload(photoDataUrl, photoZoom)
      const response = await fetch(getApiUrl('/api/profile-photo'), {
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

  const handleStartEditingProfile = () => {
    setMessage(null)
    setIsEditingProfile(true)
  }

  const handleCancelEditingProfile = () => {
    setDisplayName(profile?.display_name || user?.user_metadata?.full_name || '')
    setFirstName(profile?.first_name || user?.user_metadata?.first_name || user?.user_metadata?.given_name || '')
    setLastName(profile?.last_name || user?.user_metadata?.last_name || user?.user_metadata?.family_name || '')
    setDateOfBirth(profile?.date_of_birth || user?.user_metadata?.date_of_birth || '')
    setPhotoDataUrl('')
    setPhotoZoom(1)
    setIsPhotoPreviewOpen(false)
    closeCamera()
    setMessage(null)
    setIsEditingProfile(false)
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

      setContacts([])
      clearSensitiveLocalData()

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
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

      {/* PIN Setup/Change Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <Card className="max-w-sm w-full">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  {profile?.pin_hash ? 'Change PIN' : 'Set PIN Lock'}
                </CardTitle>
                <CardDescription>
                  Protect your app with a 4 to 6 digit security PIN.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowPinModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePin} className="space-y-4">
                {profile?.pin_hash && (
                  <div className="space-y-1">
                    <Label htmlFor="currentPin">Current PIN</Label>
                    <Input
                      id="currentPin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      required
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="newPin">New PIN (4-6 digits)</Label>
                  <Input
                    id="newPin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirmPin">Confirm New PIN</Label>
                  <Input
                    id="confirmPin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    required
                  />
                </div>
                {pinError && <p className="text-sm text-destructive">{pinError}</p>}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPinModal(false)}
                    disabled={isSavingPin}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSavingPin}>
                    {isSavingPin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save PIN
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Emergency Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <Card className="max-w-sm w-full">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  Add Emergency Contact
                </CardTitle>
                <CardDescription>
                  Add a trusted person to your circle for rapid SOS alerts.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAddContact(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveContact} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="contactName">Full Name</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Mama, Sister Nomsa"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contactPhone">Phone Number</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. 082 123 4567"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contactRel">Relationship (optional)</Label>
                  <Input
                    id="contactRel"
                    value={contactRelationship}
                    onChange={(e) => setContactRelationship(e.target.value)}
                    placeholder="e.g. Family, Friend, Neighbor"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="isPrimaryContact" className="text-sm font-medium">Set as primary contact</Label>
                    <p className="text-xs text-muted-foreground">Dialed first in emergencies</p>
                  </div>
                  <Switch
                    id="isPrimaryContact"
                    checked={contactIsPrimary}
                    onCheckedChange={setContactIsPrimary}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAddContact(false)}
                    disabled={isSavingContact}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSavingContact}>
                    {isSavingContact ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add Contact
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:px-6">
        
        {/* ========================================================================= */}
        {/* EXECUTIVE PROFILE HEADER (Big-Tech App Style)                             */}
        {/* ========================================================================= */}
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-100/90 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 p-6 shadow-sm dark:border-border dark:from-card dark:to-background">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar Ring with Camera Trigger */}
            <div className="relative group shrink-0">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full ring-4 ring-white dark:ring-card shadow-md overflow-hidden bg-emerald-100/60 dark:bg-muted flex items-center justify-center">
                {(photoDataUrl || currentPhotoUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoDataUrl || currentPhotoUrl || ''}
                    alt="Profile photo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-primary">
                    <User className="h-10 w-10 sm:h-12 sm:w-12 text-primary/70" />
                  </div>
                )}
              </div>

              {/* Floating Camera / Photo Action Button */}
              <button
                type="button"
                onClick={() => {
                  if (!isEditingProfile) {
                    setIsEditingProfile(true)
                  }
                  photoInputRef.current?.click()
                }}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all"
                title="Change profile photo"
                aria-label="Change profile photo"
              >
                <Camera className="h-4 w-4" />
              </button>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => handlePhotoPick(e.target.files?.[0])}
              />
            </div>

            {/* Profile Info & Actions */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="mr-1 h-3 w-3 text-primary" />
                  Verified Member
                </Badge>
                <Badge variant="outline" className="border-slate-200 text-slate-600 dark:text-muted-foreground text-[10px] font-medium">
                  Phola Safety Circle
                </Badge>
              </div>

              <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
                {displayName || user?.user_metadata?.full_name || 'Phola Member'}
              </h1>
              
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate">
                {user?.email}
              </p>

              {/* Action Buttons Row */}
              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                {!isEditingProfile ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleStartEditingProfile}
                      className="rounded-full bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-4 h-8 shadow-xs"
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit Profile
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openCamera}
                      className="rounded-full border-emerald-200 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 h-8 px-3.5 shadow-2xs"
                    >
                      <Camera className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      Snap Photo
                    </Button>
                  </>
                ) : (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-medium px-3 py-1">
                    Editing Mode Active
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* EDIT PROFILE DRAWER / FORM (When editing mode is active) */}
          {isEditingProfile && (
            <div className="mt-6 pt-5 border-t border-emerald-100 dark:border-border space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Personal Information
                </h3>
                <span className="text-xs text-muted-foreground">Update your personal details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Preferred display name"
                    className="rounded-xl border-emerald-200/80 focus-visible:ring-primary h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dateOfBirth" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Date of Birth
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="rounded-xl border-emerald-200/80 focus-visible:ring-primary h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="rounded-xl border-emerald-200/80 focus-visible:ring-primary h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Surname / Last Name
                  </Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Surname"
                    className="rounded-xl border-emerald-200/80 focus-visible:ring-primary h-10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Registered Email Address
                </Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="rounded-xl bg-slate-100 dark:bg-muted/70 text-muted-foreground h-10 text-sm cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground">Account email is managed via Supabase authentication security.</p>
              </div>

              {/* Save & Cancel Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEditingProfile}
                  disabled={isSaving}
                  className="flex-1 rounded-xl h-10 font-semibold text-xs border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 rounded-xl h-10 font-bold text-xs bg-primary hover:bg-primary/95 text-white shadow-xs"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-1.5" />}
                  Save Profile Changes
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Status Toast Message */}
        {message && (
          <div className={`flex items-center gap-3 rounded-2xl p-4 text-xs font-medium transition shadow-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span className="flex-1">{message.text}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. EMERGENCY CONTACTS (Trusted Circle)                                     */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-border/80 bg-white dark:bg-card shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  Emergency Contacts (Trusted Circle)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Contacts dialed first and notified with GPS coords during SOS alerts.
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setContactName('')
                setContactPhone('')
                setContactRelationship('')
                setContactIsPrimary(contacts.length === 0)
                setShowAddContact(true)
              }}
              className="rounded-full border-emerald-200 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 h-8 px-3"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1 text-primary" />
              Add Contact
            </Button>
          </div>

          <div className="p-5">
            {isLoadingContacts ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-xs">Loading trusted contacts...</span>
              </div>
            ) : contacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-emerald-200/80 bg-emerald-50/40 p-6 text-center space-y-2">
                <Phone className="h-8 w-8 mx-auto text-primary/60" />
                <p className="text-xs font-semibold text-foreground">No emergency contacts set yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Add at least one trusted friend, family member, or neighbor so Phola can reach them immediately in emergencies.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setContactName('')
                    setContactPhone('')
                    setContactRelationship('')
                    setContactIsPrimary(true)
                    setShowAddContact(true)
                  }}
                  className="rounded-full bg-primary hover:bg-primary/95 text-white text-xs font-semibold h-8 px-4"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  Add First Contact
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-slate-50/50 dark:bg-muted/30 p-3.5 transition hover:border-emerald-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                        {contact.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">{contact.name}</p>
                          {contact.is_primary && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 border border-emerald-200">
                              <Star className="h-2.5 w-2.5 fill-emerald-800 text-emerald-800" />
                              Primary SOS Contact
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {contact.phone} {contact.relationship ? `• ${contact.relationship}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {!contact.is_primary && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground"
                          onClick={() => handleSetPrimaryContact(contact.id)}
                        >
                          Make Primary
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-red-50 rounded-lg"
                        onClick={() => handleDeleteContact(contact.id)}
                        title="Delete contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. SECURITY & AUTHENTICATION                                              */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-border/80 bg-white dark:bg-card shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  Security & App Lock
                </h2>
                <p className="text-xs text-muted-foreground">
                  Safeguard your confidential records and prevent unauthorized access.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {/* Biometric Row */}
            <div className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-700 dark:text-foreground mt-0.5">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">Biometric Authentication</p>
                    {biometricEnabled ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {biometricAvailable
                      ? 'Unlock Phola instantly with Fingerprint or Face ID.'
                      : 'Biometric sensors not available on this device browser.'}
                  </p>
                </div>
              </div>

              {biometricAvailable && (
                <div className="shrink-0">
                  {isEnablingBiometric ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={biometricEnabled}
                      onCheckedChange={handleToggleBiometric}
                    />
                  )}
                </div>
              )}
            </div>

            {/* PIN Lock Row */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-muted text-slate-700 dark:text-foreground mt-0.5">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">Security PIN Lock</p>
                    {profile?.pin_hash ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                        PIN Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Not set
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A 4 to 6 digit fallback code required to view encrypted incident logs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {profile?.pin_hash ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPinError('')
                        setCurrentPin('')
                        setNewPin('')
                        setConfirmPin('')
                        setShowPinModal(true)
                      }}
                      className="rounded-full text-xs font-semibold h-8 px-3 border-emerald-200 text-emerald-900 hover:bg-emerald-50"
                    >
                      Change PIN
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-xs font-semibold h-8 px-2.5 text-destructive hover:bg-red-50"
                      onClick={handleRemovePin}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPinError('')
                      setCurrentPin('')
                      setNewPin('')
                      setConfirmPin('')
                      setShowPinModal(true)
                    }}
                    className="rounded-full text-xs font-semibold h-8 px-3.5 border-emerald-200 text-emerald-900 hover:bg-emerald-50"
                  >
                    Set Up PIN
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. PREFERENCES & LOCALIZATION                                             */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-border/80 bg-white dark:bg-card shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  Language Preferences
                </h2>
                <p className="text-xs text-muted-foreground">
                  Choose your preferred official South African language for safety alerts and navigation.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Current Active Language Pill + Change Action Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 dark:bg-muted/30">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl" aria-hidden="true">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage)?.flag || '🇿🇦'}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Currently Selected Language</p>
                  <p className="text-sm font-bold text-foreground truncate">
                    {SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage)?.nativeName || 'English'}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      ({SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage)?.englishName || 'English'})
                    </span>
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                className="rounded-full border-emerald-200 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 h-9 px-4 shrink-0 shadow-2xs"
              >
                Change Preferred Language
                <ChevronDown className={`ml-1.5 h-3.5 w-3.5 text-primary transition-transform duration-200 ${isLanguageDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>
            </div>

            {/* Dropdown Menu (revealed when user presses "Change Preferred Language") */}
            {isLanguageDropdownOpen && (
              <div className="pt-2 animate-in fade-in duration-200 space-y-2">
                <Label htmlFor="language-dropdown-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select your Preferred Language
                </Label>
                <div className="relative">
                  <select
                    id="language-dropdown-select"
                    value={currentLanguage}
                    onChange={(e) => void handleLanguageChange(e.target.value as SupportedLanguage)}
                    className="w-full h-11 rounded-xl border border-emerald-200 bg-white dark:bg-card px-4 pr-10 text-sm font-semibold text-foreground shadow-2xs focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.nativeName} ({lang.englishName})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Phola will immediately switch all crisis instructions and labels to your chosen language.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. PRIVACY & DATA MANAGEMENT                                              */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-border/80 bg-white dark:bg-card shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">
                  Privacy & Data Ownership
                </h2>
                <p className="text-xs text-muted-foreground">
                  You own your data. Export, encrypt, or permanently erase your history.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 dark:bg-card p-3.5 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-foreground">End-to-End Client Encryption</p>
                <p className="text-muted-foreground leading-relaxed">
                  Incident dockets, private evidence files, and personal logs are stored securely with zero third-party commercial tracking.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">Permanently Erase All Data</p>
                <p className="text-[11px] text-muted-foreground">Deletes all incident notes, emergency contacts, and cached records.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-8 px-3 shrink-0 self-start sm:self-auto"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete All Data
              </Button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. SESSION & LOGOUT ACTION (Executive Big-Company Footer)                 */}
        {/* ========================================================================= */}
        <div className="space-y-4 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSignOut}
            className="w-full rounded-2xl h-12 border-red-200/80 bg-red-50/50 hover:bg-red-100/70 text-red-700 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50 text-sm font-bold shadow-2xs transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4 text-red-600" />
            Log Out of Phola
          </Button>

          <div className="text-center space-y-1 pb-4">
            <p className="text-xs font-medium text-muted-foreground">
              Phola Safety Network • South Africa
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Version 2.4.0 (Build 2026) • All rights reserved
            </p>
          </div>
        </div>
      </main>
      <AppBottomNav />
    </div>
  )
}
