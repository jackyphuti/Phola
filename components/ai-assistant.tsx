'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Volume2,
  VolumeX,
  Trash2,
  Scale,
  ListChecks,
  HeartHandshake,
  Send,
  ArrowRight,
  ShieldCheck,
  Radio,
  Compass
} from 'lucide-react'
import { loadLanguagePreference } from '@/lib/locale-storage'
import { DEFAULT_LANGUAGE } from '@/lib/language-options'
import type { GeminiAssistantMode, GeminiAssistantResponse } from '@/lib/gemini'
import { getApiUrl } from '@/lib/api-client'

export interface ChatEntry {
  id: string
  role: 'user' | 'guide'
  text: string
  emergency?: boolean
  actions?: Array<{ label: string; href?: string }>
  timestamp: number
}

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
  const [selectedMode, setSelectedMode] = useState<GeminiAssistantMode>('immediate_safety')
  const [message, setMessage] = useState('')
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speakingEntryId, setSpeakingEntryId] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)

  const activeModeConfig = ASSISTANT_MODES.find(m => m.id === selectedMode) || ASSISTANT_MODES[0]

  useEffect(() => {
    void loadLanguagePreference().then(setLanguage)
  }, [])

  // Auto-scroll to latest response
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, isLoading])

  // Web Speech Recognition Setup (en-ZA)
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
      setSpeakingEntryId(null)
    }

    const userEntry: ChatEntry = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: finalMessage,
      timestamp: Date.now()
    }

    setEntries(prev => [...prev, userEntry])
    if (!presetMessage) {
      setMessage('')
    }
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
      const guideEntry: ChatEntry = {
        id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'guide',
        text: data.reply,
        emergency: data.emergency,
        actions: data.actions,
        timestamp: Date.now()
      }
      setEntries(prev => [...prev, guideEntry])
    } catch {
      setError('Unable to reach Safety Guide right now. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // 1-Tap Clear Session Button
  const handleClearSession = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setSpeakingEntryId(null)
    }
    setMessage('')
    setEntries([])
    setError('')
  }

  // Read Aloud Speech Synthesis
  const handleToggleReadAloud = (entry: ChatEntry) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setError('Speech synthesis is not supported on this device.')
      return
    }

    if (speakingEntryId === entry.id) {
      window.speechSynthesis.cancel()
      setSpeakingEntryId(null)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(entry.text)
    utterance.lang = 'en-ZA'
    utterance.rate = 1.0
    utterance.pitch = 1.0

    utterance.onend = () => {
      setSpeakingEntryId(null)
    }

    utterance.onerror = () => {
      setSpeakingEntryId(null)
    }

    setSpeakingEntryId(entry.id)
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
    <div className="relative min-h-screen bg-background pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 sm:px-6">
        
        {/* Title Header with Clear Session Trigger */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border border-border bg-muted text-foreground text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="mr-1 h-3 w-3 text-primary" />
                  SAFETY GUIDE
                </Badge>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Safety Guide
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Private session · not saved after you leave. Immediate emergency protocols and South African rights information.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSession}
                className="rounded-lg border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-3 gap-1.5"
                title="Clear current session immediately"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Session
              </Button>
            </div>
          </div>
        </section>

        {/* 4 Specialized Modes Selector */}
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
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                    : 'border-border bg-card hover:border-border/80 hover:bg-muted/30 shadow-2xs'
                }`}
              >
                <div className={`p-2 rounded-lg mb-2 ${
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-xs font-bold leading-tight ${
                  isSelected ? 'text-primary font-bold' : 'text-foreground'
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
        <Card className="border border-border bg-card shadow-xs rounded-xl">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary" />
                Suggested Queries: {activeModeConfig.label}
              </span>
              <span className="text-[11px] text-muted-foreground">Tap to send</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeModeConfig.starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleSend(prompt)}
                  className="p-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted text-left text-xs font-medium text-foreground transition"
                >
                  &quot;{prompt}&quot;
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Multi-turn Chat Thread & Composer */}
        <Card className="border border-border bg-card shadow-xs rounded-xl">
          <CardHeader className="pb-3 pt-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">Safety Guide Session</CardTitle>
                <CardDescription className="text-xs mt-0.5 text-muted-foreground">
                  Responses are generated for your session only.
                </CardDescription>
              </div>
              <Compass className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            {/* Conversation entries stream */}
            {entries.length > 0 && (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {entries.map((entry) => {
                  const isUser = entry.role === 'user'
                  return (
                    <div
                      key={entry.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                          isUser
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'border border-border bg-muted/40 text-foreground'
                        }`}
                      >
                        {!isUser && (
                          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 mb-2">
                            <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                              Safety Guide
                            </span>
                            <div className="flex items-center gap-1.5">
                              {entry.emergency && (
                                <Badge className="bg-destructive text-destructive-foreground text-[9px] uppercase font-bold px-1.5 py-0">
                                  Urgent Flag
                                </Badge>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleReadAloud(entry)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                title={speakingEntryId === entry.id ? 'Stop audio' : 'Read aloud'}
                              >
                                {speakingEntryId === entry.id ? (
                                  <VolumeX className="w-3 h-3 text-destructive" />
                                ) : (
                                  <Volume2 className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="whitespace-pre-wrap">{entry.text}</div>

                        {!isUser && entry.actions && entry.actions.length > 0 && (
                          <div className="pt-2.5 mt-2 flex flex-wrap gap-1.5 border-t border-border/60">
                            {entry.actions.map((action) => (
                              <Button
                                key={`${entry.id}-${action.label}`}
                                size="sm"
                                onClick={() => {
                                  if (action.href) {
                                    router.push(action.href)
                                  }
                                }}
                                className="rounded-lg text-xs font-semibold h-7 bg-primary text-primary-foreground hover:bg-primary/90 gap-1 px-2.5"
                              >
                                {action.label} <ArrowRight className="w-3 h-3" />
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                <div ref={threadEndRef} />
              </div>
            )}

            {/* Pulsing Typing Indicator */}
            {isLoading && (
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">Safety Guide</p>
                    <p className="text-xs text-muted-foreground">Consulting South African safety protocols...</p>
                  </div>
                </div>
              </div>
            )}

            {/* Input & Voice Controls */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="relative">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSend) {
                      void handleSend()
                    }
                  }}
                  placeholder={`Ask Safety Guide about ${activeModeConfig.label.toLowerCase()}...`}
                  className="h-10 text-xs rounded-lg pr-10 border-border bg-background focus-visible:ring-primary"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  className="flex-1 rounded-lg h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-xs" 
                  onClick={() => void handleSend()} 
                  disabled={!canSend}
                >
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send Query
                </Button>

                <Button
                  type="button"
                  variant={isListening ? 'default' : 'outline'}
                  onClick={toggleVoiceInput}
                  disabled={!speechSupported}
                  className={`rounded-lg h-9 text-xs font-semibold px-3 gap-1.5 ${
                    isListening ? 'bg-destructive text-destructive-foreground animate-pulse' : ''
                  }`}
                  title={isListening ? 'Listening...' : 'Speak your question'}
                >
                  {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  <span>{isListening ? 'Listening' : 'Voice'}</span>
                </Button>
              </div>

              {error && <p className="text-xs text-destructive font-medium">{error}</p>}
            </div>
          </CardContent>
        </Card>
      </main>

      <AppBottomNav />
    </div>
  )
}
