'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ShieldAlert, 
  FileWarning, 
  MapPinned, 
  ListChecks, 
  Siren, 
  Car, 
  Phone, 
  PhoneCall,
  PhoneOff,
  Lock, 
  HeartHandshake, 
  ChevronRight, 
  ExternalLink, 
  ShieldCheck, 
  AlertTriangle,
  Scale, 
  Sparkles, 
  ArrowRight,
  EyeOff,
  Volume2,
  VolumeX,
  CloudSun,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Key,
  Home,
  Check,
  Radio
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { AppBottomNav } from '@/components/app-bottom-nav'

const NATIONAL_HOTLINES = [
  {
    title: 'GBV Command Centre',
    phone: '0800 428 428',
    alt: 'Free SMS *120*7867#',
    description: 'National 24/7 toll-free crisis intervention, trauma counselling, and shelter placement.',
    tag: 'Toll-Free 24/7',
  },
  {
    title: 'SAPS Flying Squad',
    phone: '10111',
    alt: 'National Police Dispatch',
    description: 'Emergency police response unit for immediate danger, armed crime, or assault.',
    tag: 'Emergency Police',
  },
  {
    title: 'Suicide Crisis Helpline (SADAG)',
    phone: '0800 567 567',
    alt: 'SMS 31393',
    description: 'South African Depression and Anxiety Group free 24-hour mental health crisis lifeline.',
    tag: 'Mental Health 24/7',
  },
  {
    title: 'Childline South Africa',
    phone: '116',
    alt: 'Toll-Free All Networks',
    description: 'Protecting children and supporting youth facing abuse, neglect, or violence.',
    tag: 'Child Protection',
  },
]

const SAFETY_RIGHTS = [
  {
    title: 'How to obtain a Protection Order',
    content: 'You can apply at any local Magistrate’s Court for free without needing a lawyer. In urgent danger, you can request an interim protection order the same day under the Domestic Violence Act.',
  },
  {
    title: 'Your rights at a SAPS police station',
    content: 'Under South African law, police must open a docket if you report a crime or GBV. You are entitled to a Victim Friendly Room (VFR) and medical referral form (J88).',
  },
  {
    title: 'E-Hailing (Uber/Bolt) verification rule',
    content: 'Always match the vehicle registration number plate and driver face before entering. Use Phola Safe Ride Watchdog so trusted contacts are alerted automatically if you do not check in.',
  },
]

const ESCAPE_CALL_PRESETS = [
  { label: 'Mom', name: 'Mom ', script: 'Hey my child, where are you right now? I am waiting just around the corner in the car, please come out immediately so we can leave.' },
  { label: 'SAPS Patrol', name: 'SAPS Sector Patrol', script: 'Good day, this is Sector Policing Dispatch. We have received an alert for this grid and our vehicle is pulling up near your location now.' },
  { label: 'Sipho (Uber)', name: 'Sipho (Uber Ride)', script: 'Hello, your driver is waiting outside by the main gate with hazards flashing. Please come out so we avoid cancellation charges.' },
  { label: 'Sister Lerato', name: 'Sister Lerato', script: 'Hey! Did you hear what happened? Come outside right now, everyone is asking for you and I need your help.' }
]

const DEFAULT_READINESS_ITEMS = [
  { id: 'item_1', text: 'Certified copy of South African ID / Passport & birth certificates', done: true },
  { id: 'item_2', text: 'Secret emergency cash stash (R200 - R500 in small notes)', done: true },
  { id: 'item_3', text: 'Charged emergency power bank and charging cable', done: false },
  { id: 'item_4', text: 'Spare house & car keys kept outside the primary residence', done: false },
  { id: 'item_5', text: 'Essential prescription chronic medication (minimum 3-day supply)', done: false },
  { id: 'item_6', text: 'Safe haven address and emergency contacts written on paper', done: true }
]

const READINESS_STORAGE_KEY = 'phola_safety_readiness_plan_v2'

export function SafetyHub() {
  const router = useRouter()
  const [openGuideIndex, setOpenGuideIndex] = useState<number | null>(null)

  // ==========================================
  // 1. STEALTH DECOY MODE STATE
  // ==========================================
  const [isDecoyActive, setIsDecoyActive] = useState(false)
  const [decoyTapCount, setDecoyTapCount] = useState(0)

  // ==========================================
  // 2. EMERGENCY SIREN STATE
  // ==========================================
  const [isSirenActive, setIsSirenActive] = useState(false)
  const sirenAudioCtxRef = useRef<AudioContext | null>(null)
  const sirenOscillatorRef = useRef<OscillatorNode | null>(null)
  const sirenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ==========================================
  // 3. ESCAPE CALL SIMULATOR STATE
  // ==========================================
  const [escapeCallStatus, setEscapeCallStatus] = useState<'idle' | 'scheduled' | 'ringing' | 'connected'>('idle')
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0)
  const [customCallerName, setCustomCallerName] = useState('')
  const [callDelaySeconds, setCallDelaySeconds] = useState<number>(0)
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0)
  const [callDuration, setCallDuration] = useState<number>(0)
  const ringtoneCtxRef = useRef<AudioContext | null>(null)
  const ringtoneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const callDurationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ==========================================
  // 4. INTERACTIVE GO-BAG & READINESS STATE
  // ==========================================
  const [readinessItems, setReadinessItems] = useState(DEFAULT_READINESS_ITEMS)
  const [distressCodeWord, setDistressCodeWord] = useState('The laundry is ready')
  const [safeHavenAddress, setSafeHavenAddress] = useState('Sister residence, Melville, JHB')
  const [newItemText, setNewItemText] = useState('')
  const [isEditingSecrets, setIsEditingSecrets] = useState(false)

  // Load persisted readiness plan from local storage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(READINESS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.items) setReadinessItems(parsed.items)
        if (parsed.codeWord) setDistressCodeWord(parsed.codeWord)
        if (parsed.safeHaven) setSafeHavenAddress(parsed.safeHaven)
      }
    } catch {}
  }, [])

  // Persist readiness plan
  const persistReadiness = (items: typeof readinessItems, codeWord: string, safeHaven: string) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(READINESS_STORAGE_KEY, JSON.stringify({
        items,
        codeWord,
        safeHaven
      }))
    } catch {}
  }

  const toggleReadinessItem = (id: string) => {
    const updated = readinessItems.map(item => item.id === id ? { ...item, done: !item.done } : item)
    setReadinessItems(updated)
    persistReadiness(updated, distressCodeWord, safeHavenAddress)
  }

  const handleAddReadinessItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemText.trim()) return
    const newItem = {
      id: 'custom_' + Date.now(),
      text: newItemText.trim(),
      done: false
    }
    const updated = [...readinessItems, newItem]
    setReadinessItems(updated)
    persistReadiness(updated, distressCodeWord, safeHavenAddress)
    setNewItemText('')
  }

  const handleDeleteReadinessItem = (id: string) => {
    const updated = readinessItems.filter(item => item.id !== id)
    setReadinessItems(updated)
    persistReadiness(updated, distressCodeWord, safeHavenAddress)
  }

  const completedCount = readinessItems.filter(i => i.done).length
  const readinessPercent = readinessItems.length > 0 ? Math.round((completedCount / readinessItems.length) * 100) : 0

  // ==========================================
  // SIREN SYNTHESIS (800Hz - 1400Hz Oscillating Web Audio)
  // ==========================================
  const startSiren = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      sirenAudioCtxRef.current = ctx

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(850, ctx.currentTime)
      gain.gain.setValueAtTime(0.85, ctx.currentTime)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      sirenOscillatorRef.current = osc
      setIsSirenActive(true)

      let freqHigh = false
      const interval = setInterval(() => {
        if (!sirenOscillatorRef.current || ctx.state === 'closed') return
        const targetFreq = freqHigh ? 820 : 1380
        sirenOscillatorRef.current.frequency.exponentialRampToValueAtTime(targetFreq, ctx.currentTime + 0.35)
        freqHigh = !freqHigh

        // Vibrate phone rhythmically if supported
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([220, 100])
        }
      }, 400)
      sirenIntervalRef.current = interval
    } catch {}
  }, [])

  const stopSiren = useCallback(() => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current)
      sirenIntervalRef.current = null
    }
    if (sirenOscillatorRef.current) {
      try {
        sirenOscillatorRef.current.stop()
        sirenOscillatorRef.current.disconnect()
      } catch {}
      sirenOscillatorRef.current = null
    }
    if (sirenAudioCtxRef.current) {
      try {
        void sirenAudioCtxRef.current.close()
      } catch {}
      sirenAudioCtxRef.current = null
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(0)
    }
    setIsSirenActive(false)
  }, [])

  // Clean up siren on unmount
  useEffect(() => {
    return () => {
      stopSiren()
    }
  }, [stopSiren])

  // ==========================================
  // ESCAPE CALL LOGIC (Web Audio Ringtone + Web Speech Synthesis)
  // ==========================================
  const activeCaller = ESCAPE_CALL_PRESETS[selectedPresetIndex]
  const resolvedCallerName = customCallerName.trim() || activeCaller.name

  const startRingtone = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      ringtoneCtxRef.current = ctx

      const playRingBurst = () => {
        if (ctx.state === 'closed') return
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()

        osc1.frequency.value = 400
        osc2.frequency.value = 450
        gain.gain.value = 0.25

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)

        osc1.start()
        osc2.start()

        setTimeout(() => {
          try {
            osc1.stop()
            osc2.stop()
          } catch {}
        }, 1200)

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([400, 200, 400, 1000])
        }
      }

      playRingBurst()
      ringtoneTimerRef.current = setInterval(playRingBurst, 3200)
    } catch {}
  }, [])

  const stopRingtone = useCallback(() => {
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current)
      ringtoneTimerRef.current = null
    }
    if (ringtoneCtxRef.current) {
      try {
        void ringtoneCtxRef.current.close()
      } catch {}
      ringtoneCtxRef.current = null
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(0)
    }
  }, [])

  const triggerEscapeCallNow = useCallback(() => {
    setEscapeCallStatus('ringing')
    startRingtone()
  }, [startRingtone])

  const scheduleEscapeCall = (delaySec: number) => {
    setCallDelaySeconds(delaySec)
    if (delaySec === 0) {
      triggerEscapeCallNow()
      return
    }

    setCountdownRemaining(delaySec)
    setEscapeCallStatus('scheduled')

    const timer = setInterval(() => {
      setCountdownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          triggerEscapeCallNow()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleAnswerEscapeCall = () => {
    stopRingtone()
    setEscapeCallStatus('connected')
    setCallDuration(0)

    // Start elapsed call timer
    callDurationTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)

    // Voice Script via Web Speech Synthesis API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(activeCaller.script)
      utterance.rate = 1.02
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    }
  }

  const handleEndEscapeCall = () => {
    stopRingtone()
    if (callDurationTimerRef.current) {
      clearInterval(callDurationTimerRef.current)
      callDurationTimerRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setEscapeCallStatus('idle')
    setCallDuration(0)
  }

  const formatCallTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // ==========================================
  // STEALTH WEATHER DECOY UNLOCK HANDLER
  // ==========================================
  const handleDecoyTap = () => {
    const next = decoyTapCount + 1
    if (next >= 3) {
      setIsDecoyActive(false)
      setDecoyTapCount(0)
    } else {
      setDecoyTapCount(next)
      setTimeout(() => setDecoyTapCount(0), 1200)
    }
  }

  // =========================================================================
  // RENDER FULL-SCREEN STEALTH WEATHER DECOY MODE IF ACTIVE
  // =========================================================================
  if (isDecoyActive) {
    return (
      <div className="fixed inset-0 z-50 bg-[#f7f9fa] text-slate-800 flex flex-col justify-between p-6 select-none font-sans">
        <div className="space-y-6 max-w-md mx-auto w-full pt-8">
          {/* Header & Location */}
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Johannesburg, Gauteng</span>
            <span>Updated 2m ago</span>
          </div>

          {/* Weather Widget (Tap 3x to Exit) */}
          <div 
            onClick={handleDecoyTap} 
            className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col items-center cursor-pointer active:scale-98 transition"
            title="Tap temperature 3 times to unlock"
          >
            <CloudSun className="w-16 h-16 text-amber-500 mb-2 stroke-[1.5]" />
            <div className="text-5xl font-light text-slate-900 tracking-tight">24°C</div>
            <p className="text-sm font-medium text-slate-600 mt-1">Sunny & Mild Highveld Afternoon</p>
            <div className="flex gap-4 mt-3 text-xs text-slate-500">
              <span>H: 26°</span>
              <span>L: 14°</span>
              <span>Wind: 11 km/h</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-3">
              {decoyTapCount > 0 ? `Tap ${3 - decoyTapCount} more time(s) to reveal vault` : 'Highveld Forecast'}
            </p>
          </div>

          {/* Innocent Errands & Grocery Checklist */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Errands & Groceries</h4>
            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="line-through text-slate-400">Rooibos tea & 2L Milk</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-slate-300" />
                <span>Brown bread & Farm eggs</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-slate-300" />
                <span>Pick up dry cleaning on 4th Ave</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-slate-300" />
                <span>Water house plants</span>
              </div>
            </div>
          </div>
        </div>

        {/* Discreet bottom exit button */}
        <div className="text-center pb-4">
          <button
            type="button"
            onClick={() => setIsDecoyActive(false)}
            className="text-[11px] text-slate-400 hover:text-slate-600 underline"
          >
            Switch Application View
          </button>
        </div>
      </div>
    )
  }

  // =========================================================================
  // RENDER REALISTIC FULL-SCREEN INCOMING ESCAPE CALL MODAL
  // =========================================================================
  if (escapeCallStatus === 'ringing' || escapeCallStatus === 'connected') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-8 safe-top safe-bottom animate-in fade-in duration-200 select-none">
        {/* Caller Info Header */}
        <div className="flex flex-col items-center pt-12 space-y-3">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-emerald-400/40 flex items-center justify-center text-3xl font-bold shadow-lg shadow-emerald-950/50">
            {resolvedCallerName.charAt(0)}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">{resolvedCallerName}</h2>
            <p className="text-sm text-slate-400 mt-1">
              {escapeCallStatus === 'ringing' ? 'Incoming Mobile Call...' : formatCallTime(callDuration)}
            </p>
          </div>
        </div>

        {/* Spoken voice feedback during active call */}
        {escapeCallStatus === 'connected' && (
          <div className="max-w-xs mx-auto p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
            <p className="text-xs text-emerald-400 font-mono flex items-center justify-center gap-1.5 mb-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Call in Progress
            </p>
            <p className="text-xs text-slate-300 italic leading-relaxed">
              &quot;{activeCaller.script}&quot;
            </p>
          </div>
        )}

        {/* Call Controls */}
        <div className="flex items-center justify-around pb-8 w-full max-w-sm mx-auto">
          {escapeCallStatus === 'ringing' ? (
            <>
              {/* Decline Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleEndEscapeCall}
                  className="w-18 h-18 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 flex items-center justify-center text-white shadow-lg transition"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>
                <span className="text-xs text-slate-400 font-medium">Decline</span>
              </div>

              {/* Accept Button */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleAnswerEscapeCall}
                  className="w-18 h-18 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 flex items-center justify-center text-white shadow-lg animate-bounce transition"
                >
                  <PhoneCall className="w-8 h-8" />
                </button>
                <span className="text-xs text-slate-400 font-medium">Answer</span>
              </div>
            </>
          ) : (
            /* Connected: Red Hang Up Button */
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleEndEscapeCall}
                className="w-18 h-18 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 flex items-center justify-center text-white shadow-lg transition"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
              <span className="text-xs text-slate-400 font-medium">End Call</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        
        {/* ========================================================================= */}
        {/* HERO TITLE & DISGUISE ACTION                                              */}
        {/* ========================================================================= */}
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_60px_rgba(5,40,40,0.05)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="mr-1 h-3 w-3 text-primary" />
                  Active Deterrence & Readiness
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Safety & Emergency Hub
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Tactical escape toolkit, stealth cloaking decoy, transit watchdog, and crisis lifelines.
              </p>
            </div>

            {/* Stealth Cloak Trigger */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDecoyActive(true)}
                className="rounded-xl border-slate-300 dark:border-border text-xs font-semibold h-9 px-3.5 gap-1.5 shadow-2xs hover:bg-slate-100"
                title="Immediately camouflage screen as weather & grocery notes"
              >
                <EyeOff className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                Stealth Cloak
              </Button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* ACTIVE DETERRENCE & STEALTH TOOLKIT                                       */}
        {/* ========================================================================= */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Active Deterrence & Stealth Toolkit
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* TOOL 1: ESCAPE CALL SIMULATOR */}
            <Card className="border-emerald-200/90 bg-white shadow-2xs rounded-3xl overflow-hidden">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                        <PhoneCall className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm text-foreground">Escape Call Simulator</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-900 border border-emerald-200">
                      Discreet Exit
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Trigger a realistic incoming phone call with ringtone and spoken voice audio so you can step away from uncomfortable or dangerous social situations.
                  </p>
                </div>

                {/* Preset Selector */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-muted-foreground">Select Caller Identity:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ESCAPE_CALL_PRESETS.map((preset, idx) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setSelectedPresetIndex(idx)}
                        className={`py-1.5 px-2.5 rounded-xl text-xs font-medium text-left truncate transition ${
                          selectedPresetIndex === idx
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trigger Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => scheduleEscapeCall(0)}
                    disabled={escapeCallStatus === 'scheduled'}
                    className="flex-1 rounded-xl text-xs font-bold h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <PhoneCall className="w-3.5 h-3.5" /> Call Now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => scheduleEscapeCall(5)}
                    disabled={escapeCallStatus === 'scheduled'}
                    className="rounded-xl text-xs font-semibold h-9 px-3 border-emerald-200"
                  >
                    {escapeCallStatus === 'scheduled' && countdownRemaining > 0 ? `In ${countdownRemaining}s` : '+5s Delay'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => scheduleEscapeCall(15)}
                    disabled={escapeCallStatus === 'scheduled'}
                    className="rounded-xl text-xs font-semibold h-9 px-3 border-emerald-200"
                  >
                    +15s
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* TOOL 2: EMERGENCY DETERRENT SIREN */}
            <Card className={`rounded-3xl shadow-2xs transition-all overflow-hidden ${
              isSirenActive ? 'border-2 border-red-500 bg-red-50/80 animate-pulse' : 'border-emerald-200/90 bg-white'
            }`}>
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${isSirenActive ? 'bg-red-600 text-white animate-spin' : 'bg-red-100 text-red-700'}`}>
                        <Siren className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm text-foreground">Emergency Deterrent Siren</span>
                    </div>
                    {isSirenActive && (
                      <Badge className="bg-red-600 text-white text-[10px] animate-bounce">
                        ALARM ACTIVE
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Emits a high-decibel oscillating acoustic alarm (800Hz - 1400Hz) and rhythmic vibration to startle assailants and draw immediate crowd attention.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-muted/40 text-[11px] text-muted-foreground space-y-1">
                  <p className="font-semibold text-slate-800 dark:text-foreground">Tactical Acoustic Alarm</p>
                  <p>Synthesizes full volume without requiring cellular network or internet data.</p>
                </div>

                <div className="pt-2">
                  {isSirenActive ? (
                    <Button
                      onClick={stopSiren}
                      className="w-full rounded-2xl text-xs font-bold h-11 bg-slate-900 hover:bg-black text-white gap-2 shadow-md"
                    >
                      <VolumeX className="w-4 h-4 text-red-400" />
                      Silence Alarm Immediately
                    </Button>
                  ) : (
                    <Button
                      onClick={startSiren}
                      className="w-full rounded-2xl text-xs font-bold h-11 bg-red-600 hover:bg-red-700 text-white gap-2 shadow-md"
                    >
                      <Volume2 className="w-4 h-4" />
                      Sound Deterrent Alarm
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* INTERACTIVE SAFETY READINESS & GO-BAG PLAN                                 */}
        {/* ========================================================================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5 text-emerald-600" />
              Safety Readiness & Go-Bag Plan
            </h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {readinessPercent}% Ready
            </span>
          </div>

          <Card className="rounded-3xl border-emerald-200/90 bg-white p-5 shadow-2xs space-y-4">
            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-foreground">Emergency Preparedness Score</span>
                <span className="text-muted-foreground">{completedCount} of {readinessItems.length} steps complete</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
            </div>

            {/* Secret Distress Code & Safe Haven Address Box */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-primary" /> Confidential Distress Code & Haven
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingSecrets(!isEditingSecrets)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {isEditingSecrets ? 'Done' : 'Edit'}
                </button>
              </div>

              {isEditingSecrets ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Secret Distress Code Phrase:</label>
                    <Input
                      value={distressCodeWord}
                      onChange={(e) => {
                        setDistressCodeWord(e.target.value)
                        persistReadiness(readinessItems, e.target.value, safeHavenAddress)
                      }}
                      className="h-8 text-xs bg-white rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Designated Safe Haven Address:</label>
                    <Input
                      value={safeHavenAddress}
                      onChange={(e) => {
                        setSafeHavenAddress(e.target.value)
                        persistReadiness(readinessItems, distressCodeWord, e.target.value)
                      }}
                      className="h-8 text-xs bg-white rounded-xl"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-muted-foreground block">Code Phrase (Spoken to Contacts):</span>
                    <span className="font-bold text-foreground font-mono">&quot;{distressCodeWord}&quot;</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-muted-foreground block">Designated Safe Haven:</span>
                    <span className="font-semibold text-foreground truncate block">{safeHavenAddress}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist items */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-foreground block">Emergency Go-Bag Checklist:</span>
              <div className="space-y-1.5">
                {readinessItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleReadinessItem(item.id)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 cursor-pointer border border-slate-100 transition"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                        item.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {item.done && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className={`text-xs ${item.done ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                        {item.text}
                      </span>
                    </div>
                    {item.id.startsWith('custom_') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteReadinessItem(item.id)
                        }}
                        className="text-muted-foreground hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Custom Step Form */}
              <form onSubmit={handleAddReadinessItem} className="flex gap-2 pt-2">
                <Input
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Add custom readiness step (e.g. Spare glasses)..."
                  className="h-8 text-xs rounded-xl flex-1 border-slate-200"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newItemText.trim()}
                  className="h-8 text-xs rounded-xl px-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </form>
            </div>
          </Card>
        </section>

        {/* ========================================================================= */}
        {/* URGENT TRANSIT & RADAR PILLAR (Safe Ride & SOS Map)                       */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            Immediate Protection & Transit
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Safe Ride Watchdog Card */}
            <div 
              onClick={() => router.push('/safe-ride')}
              className="group flex flex-col justify-between rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white p-5 shadow-2xs hover:border-primary hover:shadow-sm cursor-pointer transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
                    <Car className="h-6 w-6" />
                  </div>
                  <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold tracking-wider">
                    Recommended
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-foreground">Safe Ride Watchdog</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Taking an <strong>Uber</strong>, <strong>Bolt</strong>, or <strong>inDrive</strong>? Track driver details, number plate, and heartbeat check-ins. Dispatches emergency WhatsApp if you don&apos;t arrive safely.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-emerald-100">
                <span className="text-xs font-bold text-primary flex items-center">
                  Launch Safe Ride <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition" />
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">1-Tap Watchdog</span>
              </div>
            </div>

            {/* 2. Emergency SOS & Safe Haven Map */}
            <div 
              onClick={() => router.push('/sos')}
              className="group flex flex-col justify-between rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-teal-50/50 via-emerald-50/20 to-white p-5 shadow-2xs hover:border-primary hover:shadow-sm cursor-pointer transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-800 text-white shadow-xs">
                    <Siren className="h-6 w-6" />
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 text-[10px] uppercase font-bold tracking-wider">
                    GPS Heatmap
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-foreground">Emergency SOS & Safe Places</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Interactive radar locating verified SAPS police stations, 24-hour trauma units, hospitals, and designated Thuthuzela Care Centres near you.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-emerald-100">
                <span className="text-xs font-bold text-primary flex items-center">
                  Open Safety Map <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition" />
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">Direct Directions</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 24/7 NATIONAL CRISIS HELPLINES (SOUTH AFRICA)                             */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              National Emergency Helplines (Toll-Free South Africa)
            </h2>
            <Badge variant="outline" className="border-emerald-200 text-emerald-800 text-[10px]">
              24/7 Active
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NATIONAL_HOTLINES.map((hotline) => (
              <Card key={hotline.phone} className="border-emerald-100 bg-white shadow-2xs rounded-2xl overflow-hidden">
                <CardContent className="p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">{hotline.title}</span>
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-900 text-[10px] font-semibold">
                        {hotline.tag}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {hotline.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <p className="font-mono text-sm font-bold text-primary">{hotline.phone}</p>
                      <p className="text-[10px] text-muted-foreground">{hotline.alt}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => window.location.href = `tel:${hotline.phone.replace(/[^\d+]/g, '')}`}
                      className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded-xl h-8 px-3"
                    >
                      <Phone className="mr-1.5 h-3.5 w-3.5" />
                      Call Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* LEGAL RIGHTS & PROTECTION ORDER GUIDES                                    */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            Legal Rights & Safety Guidelines (South Africa)
          </h2>

          <div className="space-y-2">
            {SAFETY_RIGHTS.map((guide, idx) => {
              const isOpen = openGuideIndex === idx
              return (
                <div 
                  key={guide.title}
                  className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenGuideIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Scale className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold text-foreground">{guide.title}</span>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground border-t border-slate-100 pt-3">
                      {guide.content}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Security / Privacy Guarantee Banner */}
        <section>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 flex items-start gap-3 shadow-2xs">
            <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Zero-Knowledge Offline-First Architecture</p>
              <p className="text-emerald-900 mt-0.5 leading-relaxed">
                Active deterrence triggers, siren synthesis, escape calls, and go-bag checklists operate entirely on your device with local storage and Web Audio — no external servers or cell signal required.
              </p>
            </div>
          </div>
        </section>

      </main>

      <AppBottomNav />
    </div>
  )
}
