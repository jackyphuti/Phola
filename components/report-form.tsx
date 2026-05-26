'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CRIME_TYPE_LABELS, DYNAMIC_FIELDS_BY_TYPE, type CrimeType, type DynamicFieldConfig } from '@/lib/crime-report'
import { SEVERITY_OPTIONS } from '@/lib/types'
import { getNearestSAPSStation } from '@/lib/saps-stations'
import { queueIncidentSubmission } from '@/lib/offline-queue'
import { triggerIncidentPushEvent } from '@/lib/push-notifications'
import { safeExit } from '@/lib/safe-exit'
import { AlertCircle, ArrowLeft, Calendar, FileImage, Loader2, MapPin, Save, Send, Shield, Upload, X } from 'lucide-react'

interface ReportFormProps {
  incidentId?: string
  initialData?: {
    incident_type: string
    crime_type?: string | null
    description: string | null
    location: string | null
    date_occurred: string | null
    perpetrator_relationship: string | null
    severity: string | null
    anonymous_report?: boolean | null
    case_reference?: string | null
    incident_metadata?: Record<string, unknown> | null
    is_draft: boolean
  }
}

type ReportFormState = {
  incident_type: string
  crime_type: CrimeType
  description: string
  location: string
  date_occurred: string
  perpetrator_relationship: string
  severity: string
  anonymous_report: boolean
  case_reference: string
}

function isCrimeType(value: string | null | undefined): value is CrimeType {
  if (!value) return false
  return value in CRIME_TYPE_LABELS
}

function normalizeCrimeType(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): CrimeType {
  if (isCrimeType(primary)) return primary
  if (isCrimeType(fallback)) return fallback
  return 'gbv'
}

export function ReportForm({ incidentId, initialData }: ReportFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const initialCrimeType = normalizeCrimeType(initialData?.crime_type, initialData?.incident_type)

  const [formData, setFormData] = useState<ReportFormState>({
    incident_type: initialCrimeType,
    crime_type: initialCrimeType,
    description: initialData?.description || '',
    location: initialData?.location || '',
    date_occurred: initialData?.date_occurred?.split('T')[0] || '',
    perpetrator_relationship: initialData?.perpetrator_relationship || '',
    severity: initialData?.severity || '',
    anonymous_report: Boolean(initialData?.anonymous_report),
    case_reference: initialData?.case_reference || '',
  })

  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>(() => {
    if (initialData?.incident_metadata && typeof initialData.incident_metadata === 'object') {
      const converted: Record<string, string> = {}
      for (const [key, value] of Object.entries(initialData.incident_metadata)) {
        if (typeof value === 'string') {
          converted[key] = value
        }
      }
      return converted
    }
    return {}
  })
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [nearestStation, setNearestStation] = useState<{ name: string; code: string } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showSafeExit, setShowSafeExit] = useState(false)

  const activeDynamicConfig: DynamicFieldConfig[] = useMemo(() => {
    const crimeTypeKey = String(formData.crime_type) as CrimeType
    return DYNAMIC_FIELDS_BY_TYPE[crimeTypeKey] || []
  }, [formData.crime_type])

  useEffect(() => {
    if (!navigator.geolocation) return

    setIsGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setLocationCoords(coords)

        const station = getNearestSAPSStation(coords.lat, coords.lng)
        if (station) {
          setNearestStation({ name: station.name, code: station.code })
        }

        if (!formData.location) {
          setFormData((prev: ReportFormState) => ({ ...prev, location: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` }))
        }
        setIsGettingLocation(false)
      },
      () => setIsGettingLocation(false),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  }, [formData.location])

  const handleSafeExit = () => {
    safeExit()
  }

  const handleChange = <K extends keyof ReportFormState>(field: K, value: ReportFormState[K]) => {
    setFormData((prev: ReportFormState) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleDynamicFieldChange = (key: string, value: string) => {
    setDynamicFields((prev: Record<string, string>) => ({ ...prev, [key]: value }))
  }

  const handleEvidencePick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    setEvidenceFiles((prev: File[]) => [...prev, ...files].slice(0, 5))
    event.target.value = ''
  }

  const removeEvidence = (index: number) => {
    setEvidenceFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index))
  }

  const validateForm = () => {
    if (!formData.crime_type) {
      setError('Please choose an incident type.')
      return false
    }
    if (!formData.description.trim()) {
      setError('Please add a short description of what happened.')
      return false
    }
    for (const field of activeDynamicConfig) {
      if (field.required && !dynamicFields[field.key]?.trim()) {
        setError(`Please complete: ${field.label}`)
        return false
      }
    }
    return true
  }

  const buildMetadata = () => ({
    ...dynamicFields,
    coordinates: locationCoords,
    station: nearestStation,
    stampedAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  })

  const uploadEvidence = async (crimeType: CrimeType) => {
    if (evidenceFiles.length === 0) return []

    setUploadProgress('Uploading evidence...')

    const payload = new FormData()
    for (const file of evidenceFiles) {
      payload.append('evidence', file)
    }
    payload.append('userId', user?.id || 'anonymous')
    payload.append('incidentType', crimeType)
    payload.append('metadata', JSON.stringify(buildMetadata()))

    const response = await fetch('/api/evidence', {
      method: 'POST',
      body: payload,
    })

    if (!response.ok) {
      const details = await response.json().catch(() => ({ error: 'Evidence upload failed' }))
      throw new Error(details.error || 'Evidence upload failed')
    }

    const data = await response.json()
    setUploadProgress('')
    return Array.isArray(data?.items) ? data.items : []
  }

  const buildIncidentPayload = async (isDraft: boolean) => {
    const evidence = await uploadEvidence(formData.crime_type)
    return {
      incident_type: formData.crime_type,
      crime_type: formData.crime_type,
      description: formData.description || null,
      location: formData.location || null,
      date_occurred: formData.date_occurred || null,
      perpetrator_relationship: formData.perpetrator_relationship || dynamicFields.relationship_to_suspect || null,
      severity: formData.severity || null,
      anonymous_report: formData.anonymous_report,
      case_reference: formData.case_reference || null,
      saps_station_name: nearestStation?.name || null,
      saps_station_code: nearestStation?.code || null,
      incident_metadata: buildMetadata(),
      evidence_files: evidence,
      is_draft: isDraft,
    }
  }

  const queueAndReturn = async (isDraft: boolean) => {
    if (!user) return

    await queueIncidentSubmission({
      userId: user.id,
      incidentId,
      payload: {
        ...formData,
        incident_type: formData.crime_type,
        is_draft: isDraft,
      },
    })

    router.push('/dashboard')
  }

  const saveAsDraft = async () => {
    if (!user) return

    setIsSaving(true)
    setError('')

    try {
      if (!navigator.onLine) {
        await queueAndReturn(true)
        return
      }

      const payload = await buildIncidentPayload(true)

      if (incidentId) {
        await supabase
          .from('incidents')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', incidentId)
      } else {
        await supabase.from('incidents').insert({
          user_id: user.id,
          ...payload,
        })
      }

      await triggerIncidentPushEvent({
        crimeType: formData.crime_type,
        location: formData.location || undefined,
      })

      router.push('/dashboard')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save. Please try again.'
      setError(message)
    } finally {
      setIsSaving(false)
      setUploadProgress('')
    }
  }

  const submitReport = async () => {
    if (!user || !validateForm()) return

    setIsSubmitting(true)
    setError('')

    try {
      if (!navigator.onLine) {
        await queueAndReturn(false)
        return
      }

      const payload = await buildIncidentPayload(false)

      if (incidentId) {
        await supabase
          .from('incidents')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', incidentId)
      } else {
        await supabase.from('incidents').insert({
          user_id: user.id,
          ...payload,
        })
      }

      router.push('/dashboard')
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to save. Please try again.'
      setError(message)
    } finally {
      setIsSubmitting(false)
      setUploadProgress('')
    }
  }

  const isLoading = isSaving || isSubmitting

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {showSafeExit && (
        <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-sm">
            <p className="text-lg text-foreground">Leave without saving?</p>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowSafeExit(false)}>
                Stay
              </Button>
              <Button className="flex-1" onClick={handleSafeExit}>
                Exit Now
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-40">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">{incidentId ? 'Update Report' : 'New Crime Report'}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowSafeExit(true)} className="text-muted-foreground">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-6 pb-32">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground">Evidence-ready reporting</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload photos/videos. Metadata stamp includes timestamp, device, and GPS when available.
            </p>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <Label className="text-foreground">Incident Type</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.entries(CRIME_TYPE_LABELS) as [CrimeType, string][]).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={formData.crime_type === value ? 'default' : 'outline'}
                className="h-auto py-3 px-4 justify-start"
                onClick={() => {
                  setDynamicFields({})
                  handleChange('crime_type', value)
                  handleChange('incident_type', value)
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-foreground">Privacy</Label>
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Anonymous report</p>
                <p className="text-xs text-muted-foreground">Hide identifying details in shared views.</p>
              </div>
              <Button
                type="button"
                variant={formData.anonymous_report ? 'default' : 'outline'}
                onClick={() => handleChange('anonymous_report', !formData.anonymous_report)}
              >
                {formData.anonymous_report ? 'On' : 'Off'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-foreground">What happened?</Label>
          <Textarea
            id="description"
            placeholder="Describe what happened in your own words..."
            value={formData.description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange('description', e.target.value)}
            className="min-h-[120px] resize-none"
          />
          <p className="text-xs text-muted-foreground">Take your time. Only share what you feel comfortable with.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date" className="text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            When did this happen?
          </Label>
          <Input
            id="date"
            type="date"
            value={formData.date_occurred}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('date_occurred', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location
          </Label>
          <Input
            id="location"
            placeholder="Where did this happen?"
            value={formData.location}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('location', e.target.value)}
          />
          {isGettingLocation && <p className="text-xs text-muted-foreground">Detecting your location...</p>}
        </div>

        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Nearest SAPS Station</p>
              {nearestStation ? (
                <p className="text-xs text-muted-foreground mt-1">{nearestStation.name} ({nearestStation.code})</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Enable location access to auto-select station.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label htmlFor="caseReference" className="text-foreground">Case reference (optional)</Label>
          <Input
            id="caseReference"
            placeholder="SAPS case number if available"
            value={formData.case_reference}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('case_reference', e.target.value)}
          />
        </div>

        {activeDynamicConfig.length > 0 && (
          <div className="space-y-4">
            <Label className="text-foreground">Type-specific details</Label>
            {activeDynamicConfig.map((field) => (
              <div className="space-y-2" key={field.key}>
                <Label className="text-foreground">{field.label}{field.required ? ' *' : ''}</Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    placeholder={field.placeholder}
                    value={dynamicFields[field.key] || ''}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleDynamicFieldChange(field.key, e.target.value)}
                    className="min-h-[96px] resize-none"
                  />
                ) : (
                  <Input
                    placeholder={field.placeholder}
                    value={dynamicFields[field.key] || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleDynamicFieldChange(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-foreground">How serious does this feel?</Label>
          <div className="space-y-2">
            {SEVERITY_OPTIONS.map((option) => (
              <Card
                key={option.value}
                className={`cursor-pointer transition-colors ${formData.severity === option.value ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}
                onClick={() => handleChange('severity', option.value || '')}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${formData.severity === option.value ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-foreground">Evidence Upload</Label>
          <Card>
            <CardContent className="p-4 space-y-3">
              <input id="evidence-upload" type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleEvidencePick} />
              <Button type="button" variant="outline" onClick={() => document.getElementById('evidence-upload')?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Add photos or videos
              </Button>

              {evidenceFiles.length > 0 && (
                <div className="space-y-2">
                  {evidenceFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border border-border p-2">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate inline-flex items-center gap-2">
                          <FileImage className="w-4 h-4 text-primary" />
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeEvidence(index)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {uploadProgress && <p className="text-xs text-muted-foreground">{uploadProgress}</p>}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 safe-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button variant="outline" className="flex-1" onClick={saveAsDraft} disabled={isLoading}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Draft
          </Button>
          <Button className="flex-1" onClick={submitReport} disabled={isLoading}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Submit Report
          </Button>
        </div>
      </div>
    </div>
  )
}
