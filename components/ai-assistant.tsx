'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Mic, MicOff, MessageCircle, ShieldAlert, Sparkles } from 'lucide-react'
import { loadLanguagePreference } from '@/lib/locale-storage'
import { DEFAULT_LANGUAGE } from '@/lib/language-options'
import type { GeminiAssistantResponse } from '@/lib/gemini'

const starterPrompts = [
  'Help me leave safely tonight',
  'I need to report what happened',
  'Help me contact my trusted circle',
  'What should I do if I am being watched?',
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
  const [message, setMessage] = useState('')
  const [response, setResponse] = useState<GeminiAssistantResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE)
  const [isActivated, setIsActivated] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null)

  useEffect(() => {
    void loadLanguagePreference().then(setLanguage)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsActivated(false)
    }, 2400)

    return () => window.clearTimeout(timer)
  }, [])

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
    recognition.lang = language === DEFAULT_LANGUAGE ? 'en-ZA' : 'en-ZA'
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

  const canSend = useMemo(() => message.trim().length > 0 && !isLoading, [message, isLoading])

  const handleSend = async (presetMessage?: string) => {
    const finalMessage = (presetMessage || message).trim()
    if (!finalMessage) return

    setIsActivated(true)
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMessage,
          language,
          mode: 'safety',
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
    <div className="relative min-h-screen overflow-hidden bg-background safe-top safe-bottom">
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

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Gemini</p>
            <h1 className="text-lg font-semibold text-foreground">Sisi / Buti Bot</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} aria-label="Back to dashboard">
            <MessageCircle className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="space-y-4 p-4 pb-8">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Talk to Gemini for step-by-step help</p>
                <p className="text-sm text-muted-foreground">
                  Give instructions like “help me get to safety”, “what should I say to report this?”, or “help me contact my trusted circle”.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <Button key={prompt} variant="outline" size="sm" onClick={() => void handleSend(prompt)}>
                  {prompt}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What do you need help with?</CardTitle>
            <CardDescription>
              The assistant does not keep your conversation after this screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your instruction here..."
                aria-label="Assistant instruction"
              />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void handleSend()} disabled={!canSend}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                  Get Help
                </Button>
                <Button
                  type="button"
                  variant={isListening ? 'default' : 'outline'}
                  onClick={toggleVoiceInput}
                  disabled={!speechSupported}
                  aria-pressed={isListening}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                >
                  {isListening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                  {isListening ? 'Listening' : 'Voice'}
                </Button>
                <Button variant="outline" onClick={() => { setMessage(''); setResponse(null); setError('') }}>
                  Clear
                </Button>
              </div>
              {!speechSupported && (
                <p className="text-xs text-muted-foreground">Voice input is unavailable in this browser.</p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {response && (
              <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{response.reply}</p>
                <div className="flex flex-wrap gap-2">
                  {response.actions.map((action) => (
                    <Button
                      key={`${action.label}-${action.href || 'action'}`}
                      variant={action.href ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (action.href) {
                          router.push(action.href)
                        }
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
