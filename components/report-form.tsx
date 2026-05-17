'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { 
  INCIDENT_TYPE_LABELS, 
  RELATIONSHIP_OPTIONS, 
  SEVERITY_OPTIONS,
  type IncidentType 
} from '@/lib/types'
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Loader2,
  Calendar,
  MapPin,
  AlertCircle,
  X
} from 'lucide-react'

interface ReportFormProps {
  incidentId?: string
  initialData?: {
    incident_type: string
    description: string | null
    location: string | null
    date_occurred: string | null
    perpetrator_relationship: string | null
    severity: string | null
    is_draft: boolean
  }
}

export function ReportForm({ incidentId, initialData }: ReportFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  
  const [formData, setFormData] = useState({
    incident_type: initialData?.incident_type || '',
    description: initialData?.description || '',
    location: initialData?.location || '',
    date_occurred: initialData?.date_occurred?.split('T')[0] || '',
    perpetrator_relationship: initialData?.perpetrator_relationship || '',
    severity: initialData?.severity || '',
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showSafeExit, setShowSafeExit] = useState(false)

  const handleSafeExit = () => {
    window.location.href = 'https://www.google.com'
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const validateForm = () => {
    if (!formData.incident_type) {
      setError('Please select a category')
      return false
    }
    return true
  }

  const saveAsDraft = async () => {
    if (!user) return
    
    setIsSaving(true)
    setError('')

    try {
      if (incidentId) {
        await supabase
          .from('incidents')
          .update({
            ...formData,
            date_occurred: formData.date_occurred || null,
            is_draft: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', incidentId)
      } else {
        await supabase
          .from('incidents')
          .insert({
            user_id: user.id,
            ...formData,
            date_occurred: formData.date_occurred || null,
            is_draft: true,
          })
      }

      router.push('/dashboard')
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const submitReport = async () => {
    if (!user || !validateForm()) return
    
    setIsSubmitting(true)
    setError('')

    try {
      if (incidentId) {
        await supabase
          .from('incidents')
          .update({
            ...formData,
            date_occurred: formData.date_occurred || null,
            is_draft: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', incidentId)
      } else {
        await supabase
          .from('incidents')
          .insert({
            user_id: user.id,
            ...formData,
            date_occurred: formData.date_occurred || null,
            is_draft: false,
          })
      }

      router.push('/dashboard')
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLoading = isSaving || isSubmitting

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Safe Exit Overlay */}
      {showSafeExit && (
        <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-sm">
            <p className="text-lg text-foreground">Leave without saving?</p>
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowSafeExit(false)}
              >
                Stay
              </Button>
              <Button 
                className="flex-1"
                onClick={handleSafeExit}
              >
                Exit Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-40">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              {incidentId ? 'Edit Note' : 'New Note'}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSafeExit(true)}
            className="text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Form */}
      <main className="p-4 space-y-6 pb-32">
        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Category Selection */}
        <div className="space-y-3">
          <Label className="text-foreground">Category</Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(INCIDENT_TYPE_LABELS) as [IncidentType, string][]).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={formData.incident_type === value ? 'default' : 'outline'}
                className="h-auto py-3 px-4 justify-start"
                onClick={() => handleChange('incident_type', value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-foreground">
            What happened?
          </Label>
          <Textarea
            id="description"
            placeholder="Describe what happened in your own words..."
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="min-h-[120px] resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Take your time. Only share what you feel comfortable with.
          </p>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="date" className="text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            When did this happen?
          </Label>
          <Input
            id="date"
            type="date"
            value={formData.date_occurred}
            onChange={(e) => handleChange('date_occurred', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location" className="text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location (optional)
          </Label>
          <Input
            id="location"
            placeholder="Where did this happen?"
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
          />
        </div>

        {/* Relationship */}
        <div className="space-y-3">
          <Label className="text-foreground">Relationship to person involved</Label>
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIP_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                variant={formData.perpetrator_relationship === option ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleChange('perpetrator_relationship', option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div className="space-y-3">
          <Label className="text-foreground">How serious does this feel?</Label>
          <div className="space-y-2">
            {SEVERITY_OPTIONS.map((option) => (
              <Card
                key={option.value}
                className={`cursor-pointer transition-colors ${
                  formData.severity === option.value 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => handleChange('severity', option.value || '')}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      formData.severity === option.value 
                        ? 'border-primary bg-primary' 
                        : 'border-muted-foreground'
                    }`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 safe-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            className="flex-1"
            onClick={saveAsDraft}
            disabled={isLoading}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Draft
          </Button>
          <Button
            className="flex-1"
            onClick={submitReport}
            disabled={isLoading}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Save Note
          </Button>
        </div>
      </div>
    </div>
  )
}
