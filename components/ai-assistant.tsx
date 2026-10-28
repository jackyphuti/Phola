'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { 
  Loader2, 
  Mic, 
  MicOff, 
  ShieldAlert, 
  Sparkles,
  Volume2,
  VolumeX,
  Trash2,
  Scale,
  ListChecks,
  HeartHandshake,
  Send,
  ArrowRight,
  ShieldCheck,
  Radio
} from 'lucide-react'
import { loadLanguagePreference } from '@/lib/locale-storage'
import { DEFAULT_LANGUAGE } from '@/lib/language-options'
import type { GeminiAssistantMode, GeminiAssistantResponse } from '@/lib/gemini'
import { getApiUrl } from '@/lib/api-client'

interface ModeConfig {
  id: GeminiAssistantMode
  label: string
  icon: typeof ShieldAlert
  description: string
  starterPrompts: string[]
}

const ASSISTANT_MODES: ModeConfig[] = [
  {
    id: 'immediate_safety',
    label: 'Immediate Safety',
    icon: ShieldAlert,
    description: 'Active emergency steps, tactical exits, and silent SOS guidance.',
    starterPrompts: [
      'I am in danger right now, what do I do?',
      'Someone is following my car or taxi',
      'How do I trigger an emergency alert silently?',
      'How to leave an escalating domestic argument safely'
    ]
  },
  {
    id: 'legal_rights',
    label: 'SAPS & Legal Rights',
    icon: Scale,
    description: 'Protection orders, police dockets, J88 medical exam, and court rights.',
    starterPrompts: [
      'How do I get an urgent Protection Order today?',
      'What is a J88 medical form and when do I need it?',
      'Police refused to open my docket, what are my rights?',
      'Can I apply for a protection order without a lawyer?'
    ]
  },
  {
    id: 'escape_plan',
    label: 'Escape & Go-Bag Plan',
    icon: ListChecks,
    description: 'Discreet departure checklists, safe havens, secret code words, and go-bags.',
    starterPrompts: [
      'What should I pack in an emergency go-bag?',
      'How do I plan to leave without my partner knowing?',
      'Setting up a secret distress code word with my family',
      'Where to keep certified ID copies and emergency cash'
    ]
  },
  {
    id: 'shelters_care',
    label: 'Shelters & Trauma Care',
    icon: HeartHandshake,
    description: 'Thuthuzela Care Centres, 24/7 GBV crisis beds, and counseling lifelines.',
    starterPrompts: [
      'Find a Thuthuzela Care Centre near me',
      'Free national trauma counseling helplines in SA',
      'Where can I stay tonight safely with my children?',
      'How does the GBV Command Centre shelter referral work?'
    ]
  }
]

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript?: string }>>
}

type SpeechRecognitionInstanceLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionInstanceLike

export function AIAssistant() {
  const router = useRouter()
  const { t } = useTranslation()
  const [selectedMode, setSelectedMode] = useState<GeminiAssistantMode>('immediate_safety')
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState<GeminiAssistantResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE)
  const [isActivated, setIsActivated] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null)

  const activeModeConfig = ASSISTANT_MODES.find(m => m.id === selectedMode) || ASSISTANT_MODES[0]

  useEffect(() => {
    void loadLanguagePreference().then(setLanguage)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsActivated(false)
    }, 2400)

    return () => window.clearTimeout(timer)
  }, [])

  // Web Speech Recognition Setup
  useEffect(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike
    }

    const SpeechRecognitionClass = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null

    if (!SpeechRecognitionClass) {
      setSpeechSupported(false)
      return
    }

    setSpeechSupported(true)

    const recognition = new SpeechRecognitionClass()
    recognition.lang = 'en-ZA'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) {
        setMessage(transcript)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
      setError('Voice input is not available right now.')
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [language])

  // Stop SpeechSynthesis when unmounting
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const canSend = useMemo(() => message.trim().length > 0 && !isLoading, [message, isLoading])

  const handleSend = async (presetMessage?: string) => {
    const finalMessage = (presetMessage || message).trim()
    if (!finalMessage) return

    // Stop ongoing speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }

    setIsActivated(true)
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch(getApiUrl('/api/assistant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMessage,
          language,
          mode: selectedMode,
        }),
      })

      if (!res.ok) {
        throw new Error('Assistant request failed')
      }

      const data = (await res.json()) as GeminiAssistantResponse
      setResponse(data)
      if (!presetMessage) {
        setMessage('')
      }
    } catch {
      setError('Unable to reach the assistant right now. Try again in a moment.')
    } finally {
      setIsLoading(false)
      window.setTimeout(() => setIsActivated(false), 1800)
    }
  }

  // 1-Tap Wipe Chat Button
  const handleWipeChat = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
    setMessage('')
    setResponse(null)
    setError('')
  }

  // Read Aloud Speech Synthesis
  const handleToggleReadAloud = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setError('Speech synthesis is not supported on this device.')
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    if (!response?.reply) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(response.reply)
    utterance.rate = 1.0
    utterance.pitch = 1.0

    utterance.onend = () => {
      setIsSpeaking(false)
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
    }

    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const toggleVoiceInput = () => {
    const recognition = recognitionRef.current

    if (!recognition) {
      setError('Voice input is not supported on this device or browser.')
      return
    }

    if (isListening) {
      recognition.stop()
      setIsListening(false)
      return
    }

    setError('')
    setIsListening(true)
    recognition.start()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      {/* Edge activation aura */}
      <div
        className={`pointer-events-none fixed inset-0 z-40 transition-opacity duration-500 ${
          isActivated || isLoading ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      >
        <div className="assistant-edge assistant-edge-top" />
        <div className="assistant-edge assistant-edge-bottom" />
        <div className="assistant-edge assistant-edge-left" />
        <div className="assistant-edge assistant-edge-right" />
        <div className="assistant-sweep" />
        <div className="assistant-sweep assistant-sweep-delayed" />
        <div className="assistant-corner assistant-corner-tl" />
        <div className="assistant-corner assistant-corner-tr" />
        <div className="assistant-corner assistant-corner-bl" />
        <div className="assistant-corner assistant-corner-br" />
      </div>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 sm:px-6">
        
        {/* Title Header with Wipe Chat Trigger */}
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_50px_rgba(5,40,40,0.05)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles className="mr-1 h-3 w-3 text-primary" />
                  Gemini 3.8 Flash AI
                </Badge>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Sisi / Buti Safety Advisor
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Empowering, culturally attuned South African safety advice and emergency protocols.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              {/* 1-Tap Wipe Chat Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleWipeChat}
                className="rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:text-red-600 hover:bg-red-50 h-9 px-3 gap-1.5 shadow-2xs"
                title="Wipe conversation from screen immediately"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Wipe Chat
              </Button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4 SPECIALIZED ASSISTANT MODES SELECTOR                                    */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ASSISTANT_MODES.map((mode) => {
            const isSelected = selectedMode === mode.id
            const Icon = mode.icon
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setSelectedMode(mode.id)
                  setError('')
                }}
                className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500'
                    : 'border-emerald-100 bg-white hover:border-emerald-300 shadow-2xs'
                }`}
              >
                <div className={`p-2 rounded-xl mb-2 ${
                  isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold leading-tight ${
                  isSelected ? 'text-emerald-950 font-extrabold' : 'text-foreground'
                }`}>
                  {mode.label}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                  {mode.description}
                </span>
              </button>
            )
          })}
        </div>

        {/* Starter Prompts for Active Mode */}
        <Card className="border-emerald-100 bg-white shadow-2xs rounded-3xl">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                Quick Prompts: {activeModeConfig.label}
              </span>
              <span className="text-[11px] text-muted-foreground">Tap to send</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeModeConfig.starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleSend(prompt)}
                  className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-emerald-50/80 hover:border-emerald-300 text-left text-xs font-medium text-slate-700 transition"
                >
                  &quot;{prompt}&quot;
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Chat Composer & Response Display */}
        <Card className="border-emerald-100 bg-white shadow-2xs rounded-3xl">
          <CardHeader className="pb-3 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Ask Sisi / Buti Safety Advisor</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Private memoryless AI safety session — no conversation history is stored.
                </CardDescription>
              </div>

              {response && (
                <div className="flex items-center gap-1">
                  {/* Read Aloud Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleReadAloud}
                    className={`rounded-xl text-xs h-8 px-2.5 gap-1.5 ${
                      isSpeaking ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : ''
                    }`}
                    title={isSpeaking ? 'Stop reading response aloud' : 'Read response aloud'}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-red-600" /> Stop Audio
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> Read Aloud
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pb-5">
            {/* Input & Voice Controls */}
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSend) {
                      void handleSend()
                    }
                  }}
                  placeholder={`Ask anything about ${activeModeConfig.label.toLowerCase()}...`}
                  className="h-11 text-xs rounded-xl pr-10 border-slate-200 focus-visible:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  className="flex-1 rounded-xl h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs" 
                  onClick={() => void handleSend()} 
                  disabled={!canSend}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Ask Sisi / Buti
                </Button>

                <Button
                  type="button"
                  variant={isListening ? 'default' : 'outline'}
                  onClick={toggleVoiceInput}
                  disabled={!speechSupported}
                  className={`rounded-xl h-10 text-xs font-semibold px-3.5 gap-1.5 ${
                    isListening ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : ''
                  }`}
                  title={isListening ? 'Listening to voice...' : 'Speak your question'}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  <span>{isListening ? 'Listening' : 'Voice'}</span>
                </Button>
              </div>
            </div>

            {error && <p className="text-xs text-destructive font-medium">{error}</p>}

            {/* AI Advisor Response Display */}
            {response && (
              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Sisi / Buti Safety Advice
                  </span>
                  {response.emergency && (
                    <Badge className="bg-red-600 text-white text-[10px] uppercase font-bold animate-pulse">
                      Urgent Safety Flag
                    </Badge>
                  )}
                </div>

                <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-slate-800 font-sans">
                  {response.reply}
                </div>

                {/* In-App Action Deep Links */}
                {response.actions && response.actions.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-2 border-t border-emerald-100">
                    {response.actions.map((action) => (
                      <Button
                        key={`${action.label}-${action.href || 'action'}`}
                        size="sm"
                        onClick={() => {
                          if (action.href) {
                            router.push(action.href)
                          }
                        }}
                        className="rounded-xl text-xs font-semibold h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                      >
                        {action.label} <ArrowRight className="w-3 h-3" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AppBottomNav />
    </div>
  )
}
