'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { 
  getSOSCallPreference, 
  setSOSCallPreference, 
  isSafetyOnboardingCompleted, 
  markSafetyOnboardingCompleted, 
  saveEmergencyContactBoth,
  SOSCallTarget 
} from '@/lib/user-sync'
import { getStoredEmergencyContacts } from '@/lib/emergency-contacts-storage'
import { hashPin } from '@/lib/pin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, Phone, Lock, CheckCircle2, ArrowRight, Loader2, Sparkles } from 'lucide-react'

export function SafetyOnboardingModal() {
  const { user, profile, refreshProfile } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [sosTarget, setSosTarget] = useState<SOSCallTarget>('police')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactRelationship, setContactRelationship] = useState('Parent')
  const [pin, setPin] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!user?.id) {
      setIsOpen(false)
      return
    }

    // Check if user has already completed onboarding
    const completed = isSafetyOnboardingCompleted(user.id)
    const existingContacts = getStoredEmergencyContacts(user.id)

    // Check if user metadata already has sos_call_target
    const hasMetadata = Boolean(user.user_metadata?.sos_call_target)

    if (!completed && existingContacts.length === 0 && !hasMetadata) {
      // Small timeout to allow initial smooth render
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setIsOpen(false)
    }
  }, [user?.id, user?.user_metadata])

  if (!isOpen || !user?.id) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (sosTarget === 'contact' && !contactPhone.trim()) {
      setErrorMessage('Please enter a valid phone number for your primary emergency contact.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      // 1. Save SOS Call Preference
      await setSOSCallPreference(sosTarget, user.id, supabase)

      // 2. Save Primary Emergency Contact if provided
      if (contactPhone.trim()) {
        await saveEmergencyContactBoth(
          {
            name: contactName.trim() || 'Primary Contact',
            phone: contactPhone.trim(),
            relationship: contactRelationship.trim() || 'Emergency',
            is_primary: true,
          },
          user.id,
          supabase
        )
      }

      // 3. Save Security PIN if provided
      if (pin.trim().length >= 4) {
        const pinHash = await hashPin(pin.trim(), user.id)
        await supabase
          .from('profiles')
          .update({
            pin_hash: pinHash,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
      }

      // 4. Mark Onboarding as Completed
      markSafetyOnboardingCompleted(user.id)
      await supabase.auth.updateUser({
        data: {
          sos_call_target: sosTarget,
          onboarding_completed: true,
        },
      })

      await refreshProfile()
      setIsOpen(false)
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save safety settings. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-card rounded-3xl border border-emerald-200 shadow-2xl p-6 sm:p-7 animate-in zoom-in-95 my-auto">
        <div className="flex items-center gap-2.5 text-primary mb-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Shield className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Safety Protocol Setup
          </span>
        </div>

        <h2 className="text-xl font-black text-foreground">
          Complete Your Emergency Protocol
        </h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Your account is verified. Customize your 1-Tap SOS response and trusted circle so Phola can protect you immediately.
        </p>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Question 1: Who should Emergency SOS call? */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-900 dark:text-slate-100">
              When you press Emergency SOS, who should it call first?
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSosTarget('police')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col items-start ${
                  sosTarget === 'police'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20 text-foreground font-bold'
                    : 'border-border bg-slate-50/50 dark:bg-muted/40 text-muted-foreground hover:border-emerald-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                  sosTarget === 'police' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  <Shield className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">SAPS Police (10111)</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Instant police dispatch</span>
              </button>

              <button
                type="button"
                onClick={() => setSosTarget('contact')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col items-start ${
                  sosTarget === 'contact'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20 text-foreground font-bold'
                    : 'border-border bg-slate-50/50 dark:bg-muted/40 text-muted-foreground hover:border-emerald-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                  sosTarget === 'contact' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  <Phone className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">Primary Contact</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Mom, partner, friend</span>
              </button>
            </div>
          </div>

          {/* Question 2: Primary Emergency Contact */}
          <div className="space-y-2 pt-1 border-t border-border/60">
            <Label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span>Trusted Emergency Contact</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {sosTarget === 'contact' ? 'Required for contact calling' : 'Optional for SMS alerts'}
              </span>
            </Label>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Contact Name (e.g. Mom, Sindi, Thabo)"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
              <Input
                type="tel"
                placeholder="Phone Number (e.g. 082 123 4567)"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Question 3: Optional Quick Security PIN */}
          <div className="space-y-1.5 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Security PIN (Optional)
              </Label>
              <span className="text-[10px] text-muted-foreground">4 digits</span>
            </div>
            <Input
              type="password"
              maxLength={4}
              placeholder="e.g. 1234 for quick app unlock"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="h-10 rounded-xl text-xs tracking-widest"
            />
            <p className="text-[10px] text-muted-foreground">
              Protects sensitive incident notes and prevents unauthorized changes.
            </p>
          </div>

          {/* Confirm Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs sm:text-sm mt-3 flex items-center justify-center gap-1.5 shadow-sm"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Save & Activate Protection</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
