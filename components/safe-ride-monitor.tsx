'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Car, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Phone, 
  Send, 
  Plus, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  ArrowLeft, 
  Share2, 
  RefreshCw, 
  Volume2, 
  AlertOctagon, 
  ShieldAlert,
  Sparkles
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { notifySOSActivated } from '@/lib/push-notifications'
import { 
  RIDE_SERVICES, 
  RideServiceId, 
  SafeRideSession,
  getActiveSafeRide, 
  saveActiveSafeRide, 
  clearActiveSafeRide, 
  startSafeRideSession, 
  extendSafeRideSession, 
  calculateRemainingSeconds, 
  formatCountdown, 
  launchRideApp, 
  generateWhatsAppDispatch, 
  triggerSafetyAlertAudio, 
  triggerSafetyVibration 
} from '@/lib/safe-ride-service'

const DURATION_PRESETS = [15, 25, 35, 45, 60]

export function SafeRideMonitor() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [supabase] = useState(() => createClient())

  // Session state
  const [session, setSession] = useState<SafeRideSession | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const [isMounted, setIsMounted] = useState(false)

  // Form state
  const [selectedService, setSelectedService] = useState<RideServiceId>('uber')
  const [destination, setDestination] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(25)
  const [tripLink, setTripLink] = useState('')
  const [notes, setNotes] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Dialog / feedback
  const [showArrivalModal, setShowArrivalModal] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [isLaunching, setIsLaunching] = useState(false)

  const alertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 1. Initial Mount & Load Existing Session
  useEffect(() => {
    setIsMounted(true)
    const existing = getActiveSafeRide()
    if (existing) {
      setSession(existing)
      setRemainingSeconds(calculateRemainingSeconds(existing))
    }

    // Capture initial GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      )
    }
  }, [])

  // 2. Parse Incoming URL or Shared Text (e.g. from Uber/Bolt Share Sheet)
  useEffect(() => {
    if (!searchParams) return
    const sharedText = searchParams.get('shared_text') || searchParams.get('text') || searchParams.get('url') || ''
    if (sharedText) {
      // Extract URL if present
      const urlMatch = sharedText.match(/https?:\/\/[^\s]+/)
      if (urlMatch) {
        const foundUrl = urlMatch[0]
        setTripLink(foundUrl)
        if (foundUrl.includes('uber.com')) setSelectedService('uber')
        else if (foundUrl.includes('bolt.eu') || foundUrl.includes('bolt.com')) setSelectedService('bolt')
        else if (foundUrl.includes('indrive')) setSelectedService('indrive')
      }
    }
  }, [searchParams])

  // 3. Load Primary Emergency Contact from Supabase
  useEffect(() => {
    if (!user?.id) return
    let isCancelled = false

    async function loadContact() {
      try {
        const { data } = await supabase
          .from('emergency_contacts')
          .select('name, phone, is_primary')
          .eq('user_id', user!.id)
          .order('is_primary', { ascending: false })
          .limit(1)

        if (!isCancelled && data && data.length > 0) {
          setContactName(data[0].name)
          setContactPhone(data[0].phone)
        }
      } catch {}
    }

    void loadContact()
    return () => {
      isCancelled = true
    }
  }, [supabase, user])

  // 4. Watchdog Countdown & Audio/Vibration Heartbeat
  useEffect(() => {
    if (!session || session.status === 'arrived' || session.status === 'cancelled') {
      if (alertIntervalRef.current) clearInterval(alertIntervalRef.current)
      return
    }

    const interval = setInterval(() => {
      const rem = calculateRemainingSeconds(session)
      setRemainingSeconds(rem)

      // When overdue (less than 0 seconds remaining)
      if (rem <= 0) {
        if (session.status !== 'overdue') {
          const overdueSession: SafeRideSession = { ...session, status: 'overdue' }
          setSession(overdueSession)
          saveActiveSafeRide(overdueSession)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [session])

  // 5. Periodic Chime / Vibration when Overdue
  useEffect(() => {
    if (session?.status === 'overdue') {
      triggerSafetyAlertAudio()
      triggerSafetyVibration('urgent')

      alertIntervalRef.current = setInterval(() => {
        triggerSafetyAlertAudio()
        triggerSafetyVibration('urgent')
      }, 15000)

      return () => {
        if (alertIntervalRef.current) clearInterval(alertIntervalRef.current)
      }
    }
  }, [session?.status])

  // Handlers
  const handleStartRide = (andLaunchApp: boolean) => {
    setIsLaunching(true)

    const newSession = startSafeRideSession({
      serviceId: selectedService,
      destination: destination || 'My Destination',
      expectedDurationMinutes: durationMinutes,
      notes,
      tripLink,
      startLocation: currentCoords || undefined,
      contactName: contactName || 'My Emergency Contact',
      contactPhone: contactPhone || undefined
    })

    setSession(newSession)
    setRemainingSeconds(calculateRemainingSeconds(newSession))
    triggerSafetyVibration('warning')

    if (andLaunchApp) {
      launchRideApp(selectedService)
    }

    setIsLaunching(false)
  }

  const handleExtend = (mins: number) => {
    const updated = extendSafeRideSession(mins)
    if (updated) {
      setSession(updated)
      setRemainingSeconds(calculateRemainingSeconds(updated))
      triggerSafetyVibration('warning')
    }
  }

  const handleArrivedSafely = () => {
    if (!session) return
    clearActiveSafeRide()
    setSession(null)
    setShowArrivalModal(true)
    triggerSafetyVibration('warning')
  }

  const handleCancelRide = () => {
    if (window.confirm('Cancel this Safe Ride session? Phola watchdog countdown will stop.')) {
      clearActiveSafeRide()
      setSession(null)
    }
  }

  const handleTriggerSOS = () => {
    void notifySOSActivated()
    triggerSafetyVibration('urgent')
    if (session?.contactPhone) {
      window.location.href = `tel:${session.contactPhone.replace(/[^\d+]/g, '')}`
    } else {
      window.location.href = 'tel:112'
    }
  }

  const handleSendWhatsAppUpdate = () => {
    if (!session) return
    const text = generateWhatsAppDispatch(session)
    const phoneClean = session.contactPhone ? session.contactPhone.replace(/[^\d]/g, '') : ''
    const url = phoneClean 
      ? `https://api.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const handlePasteTripLink = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          const match = text.match(/https?:\/\/[^\s]+/)
          setTripLink(match ? match[0] : text)
        }
      }
    } catch {}
  }

  const handleCopyTripLink = () => {
    if (!session?.tripLink) return
    void navigator.clipboard.writeText(session.tripLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  if (!isMounted) return null

  // Calculate Progress Percent for Active Session
  const totalSeconds = session ? session.expectedDurationMinutes * 60 : 1
  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds)
  const progressPercent = Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100))
  const isOverdue = session?.status === 'overdue' || remainingSeconds < 0

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4 sm:px-6">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/safety')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Safety Hub
          </Button>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
            <ShieldCheck className="mr-1 h-3.5 w-3.5 text-primary" />
            Safe Ride Watchdog
          </Badge>
        </div>

        {/* ========================================================================= */}
        {/* ACTIVE SESSION VIEW                                                       */}
        {/* ========================================================================= */}
        {session ? (
          <div className="space-y-4">
            
            {/* Status Alert Banner */}
            {isOverdue ? (
              <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4 text-red-950 shadow-md animate-pulse">
                <div className="flex items-start gap-3">
                  <AlertOctagon className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-base font-bold">Arrival Time Exceeded!</h2>
                    <p className="text-xs text-red-800 mt-1">
                      Your expected trip duration has elapsed. Confirm you are safe or Phola will alert your emergency contacts.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-emerald-950 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                      Protection Active • {session.serviceName}
                    </span>
                  </div>
                  <Badge variant="secondary" className="bg-white text-emerald-800 font-medium text-[11px]">
                    {session.destination}
                  </Badge>
                </div>
              </div>
            )}

            {/* Countdown Clock Card */}
            <Card className={`border shadow-sm text-center ${isOverdue ? 'border-red-300 bg-red-50/30' : 'border-emerald-100 bg-white'}`}>
              <CardContent className="pt-6 pb-6 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {isOverdue ? 'Overdue Elapsed Time' : 'Time Remaining Until Arrival'}
                </p>
                <div className={`font-mono text-5xl font-extrabold tracking-tight ${isOverdue ? 'text-red-600' : 'text-foreground'}`}>
                  {formatCountdown(remainingSeconds)}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-2.5 transition-all duration-500 ${isOverdue ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${isOverdue ? 100 : progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Started {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>Est. Arrival {new Date(session.expectedArrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Emergency & Safe Actions */}
            <div className="grid grid-cols-1 gap-2.5">
              <Button
                size="lg"
                onClick={handleArrivedSafely}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6 text-base rounded-2xl shadow-sm"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                I Have Arrived Safely
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleExtend(10)}
                  className="rounded-xl border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium py-3 text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  +10 Min Delay
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExtend(20)}
                  className="rounded-xl border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium py-3 text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  +20 Min Delay
                </Button>
              </div>

              <Button
                variant="destructive"
                size="lg"
                onClick={handleTriggerSOS}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-5 text-sm rounded-2xl shadow-sm"
              >
                <ShieldAlert className="mr-2 h-5 w-5" />
                Emergency SOS (Speed Dial)
              </Button>
            </div>

            {/* Trip Details & WhatsApp Share */}
            <Card className="border-emerald-100 bg-white shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Trip Watch Details</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSendWhatsAppUpdate}
                    className="text-xs text-emerald-700 hover:bg-emerald-50 h-8"
                  >
                    <Share2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                    Share on WhatsApp
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs text-muted-foreground pb-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-foreground">Service:</span>
                  <span>{session.serviceName}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium text-foreground">Destination:</span>
                  <span className="font-semibold text-foreground">{session.destination}</span>
                </div>
                {session.contactName && (
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium text-foreground">Contact:</span>
                    <span>{session.contactName} {session.contactPhone && `(${session.contactPhone})`}</span>
                  </div>
                )}
                {session.tripLink && (
                  <div className="pt-1 flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg">
                    <span className="truncate text-[11px] text-slate-700">{session.tripLink}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyTripLink}>
                        {linkCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(session.tripLink, '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="pt-2 text-right">
                  <button
                    type="button"
                    onClick={handleCancelRide}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Cancel watchdog without alerting
                  </button>
                </div>
              </CardContent>
            </Card>

          </div>
        ) : (
          /* ========================================================================= */
          /* SETUP & LAUNCH FORM                                                       */
          /* ========================================================================= */
          <div className="space-y-4">
            
            {/* Intro Card */}
            <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Safe Ride Protection</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Launch Uber, Bolt, or inDrive with Phola’s active arrival countdown and emergency watchdog.
                  </p>
                </div>
              </div>
            </section>

            {/* Service Selector */}
            <Card className="border-emerald-100 bg-white shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  1. Select Ride Service
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 pb-4">
                {RIDE_SERVICES.map((s) => {
                  const isSelected = selectedService === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedService(s.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                        isSelected 
                          ? 'border-primary bg-emerald-50/70 shadow-xs' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-semibold text-sm text-foreground">{s.name}</span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{s.tagline}</span>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            {/* Destination & Duration Form */}
            <Card className="border-emerald-100 bg-white shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Destination & Duration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pb-4">
                <div>
                  <label className="text-xs font-medium text-foreground">Where are you going?</label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. Hatfield Plaza, Home, Menlyn"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-foreground">Expected Duration</label>
                    <span className="text-xs font-bold text-primary">{durationMinutes} minutes</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {DURATION_PRESETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDurationMinutes(m)}
                        className={`rounded-lg py-2 text-xs font-semibold border transition ${
                          durationMinutes === m
                            ? 'border-primary bg-primary text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      Uber/Bolt Share Link <span className="text-muted-foreground">(Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteTripLink}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Paste from clipboard
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <Share2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Paste trip sharing URL from Uber or Bolt"
                      value={tripLink}
                      onChange={(e) => setTripLink(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Tip: Inside Uber/Bolt, tap <strong>Share Trip</strong> and paste the link here so your contacts can watch your driver live.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact Notice */}
            <Card className="border-emerald-100 bg-white shadow-sm">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {contactName ? `Alert Contact: ${contactName}` : 'Emergency Contact'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {contactPhone ? contactPhone : 'Will dial 112 if not set'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/settings')}
                  className="text-xs text-primary"
                >
                  Edit
                </Button>
              </CardContent>
            </Card>

            {/* Primary Action Buttons */}
            <div className="space-y-2 pt-1">
              <Button
                size="lg"
                disabled={isLaunching}
                onClick={() => handleStartRide(true)}
                className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-6 text-sm sm:text-base rounded-2xl shadow-sm"
              >
                <Car className="mr-2 h-5 w-5" />
                Start Watchdog & Open {selectedService === 'taxi' ? 'Ride' : RIDE_SERVICES.find(s => s.id === selectedService)?.name}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStartRide(false)}
                className="w-full rounded-xl border-slate-200 text-xs text-slate-600 hover:bg-slate-50 py-2.5"
              >
                Already in car? Start watchdog only (without opening app)
              </Button>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* SAFE ARRIVAL SUCCESS MODAL                                                */}
        {/* ========================================================================= */}
        {showArrivalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">You Have Arrived Safely!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Your trip watchdog has been closed and your emergency countdown stopped.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                {contactPhone && (
                  <Button
                    size="sm"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    onClick={() => {
                      const cleanPhone = contactPhone.replace(/[^\d]/g, '')
                      const msg = `Hi ${contactName || 'there'}, I have arrived safely at my destination.`
                      window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank')
                      setShowArrivalModal(false)
                    }}
                  >
                    <Send className="mr-1.5 h-4 w-4" />
                    Send "I'm Safe" text on WhatsApp
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowArrivalModal(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}

      </main>

      <AppBottomNav />
    </div>
  )
}
