'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Mail,
  Check,
  X,
  MapPin,
  Clock,
  Navigation,
  Loader2,
  Trash2,
  ShieldCheck,
  Radio,
  Send,
  AlertCircle,
  BellRing,
  AlertTriangle
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  fetchLocationShares,
  sendLocationShareInvite,
  respondToLocationShare,
  stopLocationShare,
  pingUnsafeBuddies,
  resolveDistressPing,
  type LocationBuddy,
  type LocationSharesState
} from '@/lib/location-sharing'
import { subscribeForProductionPush } from '@/lib/push-notifications'

interface GuardianCircleModalProps {
  isOpen: boolean
  onClose: () => void
  currentLocation: { lat: number; lng: number } | null
  onFocusBuddy?: (buddy: LocationBuddy) => void
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDistance(distKm: number): string {
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)} m`
  }
  return `${distKm.toFixed(1)} km`
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Offline'
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 20) return 'Live now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return 'Yesterday'
}

export function GuardianCircleModal({
  isOpen,
  onClose,
  currentLocation,
  onFocusBuddy,
}: GuardianCircleModalProps) {
  const [emailInput, setEmailInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPinging, setIsPinging] = useState(false)
  const [distressNote, setDistressNote] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [shares, setShares] = useState<LocationSharesState>({
    active: [],
    incoming: [],
    outgoing: [],
  })

  const loadData = useCallback(async () => {
    try {
      const data = await fetchLocationShares()
      setShares(data)
    } catch {
      // Ignored
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      void loadData()
      void subscribeForProductionPush().catch(() => {})
      const timer = setInterval(() => {
        void loadData()
      }, 7000)
      return () => clearInterval(timer)
    }
  }, [isOpen, loadData])

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailInput.trim()) return

    setIsSubmitting(true)
    setMessage(null)

    const res = await sendLocationShareInvite(emailInput.trim())
    if (res.success) {
      setMessage({ type: 'success', text: res.message })
      setEmailInput('')
      await loadData()
    } else {
      setMessage({ type: 'error', text: res.message })
    }
    setIsSubmitting(false)
  }

  const handleRespond = async (shareId: string, accept: boolean) => {
    const res = await respondToLocationShare(shareId, accept)
    if (res.success) {
      setMessage({ type: 'success', text: res.message })
      await loadData()
    } else {
      setMessage({ type: 'error', text: res.message })
    }
  }

  const handleStop = async (shareId: string) => {
    const res = await stopLocationShare(shareId)
    if (res.success) {
      setMessage({ type: 'success', text: res.message })
      await loadData()
    } else {
      setMessage({ type: 'error', text: res.message })
    }
  }

  const handlePingUnsafe = async () => {
    setIsPinging(true)
    setMessage(null)
    const res = await pingUnsafeBuddies({
      lat: currentLocation?.lat,
      lng: currentLocation?.lng,
      message: distressNote.trim() || undefined,
    })
    if (res.success) {
      setMessage({ type: 'success', text: res.message })
      setDistressNote('')
      setShowNoteInput(false)
      await loadData()
    } else {
      setMessage({ type: 'error', text: res.message })
    }
    setIsPinging(false)
  }

  const handleResolvePing = async () => {
    setIsPinging(true)
    setMessage(null)
    const res = await resolveDistressPing()
    if (res.success) {
      setMessage({ type: 'success', text: res.message })
      await loadData()
    } else {
      setMessage({ type: 'error', text: res.message })
    }
    setIsPinging(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full rounded-3xl border border-emerald-200/80 bg-white dark:bg-card p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <span>Mutual Guardian Circle</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold">
                  LIVE FIND MY
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter another registered user&apos;s email. Once they accept, you will both see each other&apos;s live location on the map.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Feedback Alert */}
        {message && (
          <div
            className={`p-3 rounded-2xl text-xs font-semibold flex items-start gap-2 animate-in fade-in ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* 0. GUARDIAN DISTRESS PING (FEEL UNSAFE TRIGGER) */}
        <div className={`p-4 rounded-3xl border-2 transition-all ${
          shares.myActiveDistress
            ? 'bg-red-50 dark:bg-red-950/40 border-red-500 shadow-lg'
            : 'bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent border-red-200 dark:border-red-900/60'
        } space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-red-600 text-white shadow-xs">
                <BellRing className={`w-4 h-4 ${shares.myActiveDistress ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-red-700 dark:text-red-400">
                  {shares.myActiveDistress ? 'Distress Ping Active' : 'Feel Unsafe? Ping Circle'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {shares.myActiveDistress
                    ? 'Ringing your connected guardians now'
                    : 'Instantly sounds a loud alarm on all connected guardian devices'}
                </p>
              </div>
            </div>
            {shares.myActiveDistress && (
              <Badge className="bg-red-600 text-white text-[10px] font-extrabold animate-pulse">
                RINGING
              </Badge>
            )}
          </div>

          {shares.myActiveDistress ? (
            <Button
              onClick={handleResolvePing}
              disabled={isPinging}
              className="w-full rounded-2xl bg-white hover:bg-zinc-100 text-red-700 font-extrabold text-xs h-11 border border-red-300 shadow-xs flex items-center justify-center gap-2"
            >
              {isPinging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-emerald-600" />}
              <span>I Am Safe Now (Cancel Alarm)</span>
            </Button>
          ) : (
            <div className="space-y-2">
              {showNoteInput && (
                <Input
                  type="text"
                  value={distressNote}
                  onChange={(e) => setDistressNote(e.target.value)}
                  placeholder="Optional note: e.g. Being followed, stranger at door..."
                  maxLength={120}
                  className="rounded-xl text-xs h-9 bg-white dark:bg-card border-red-200"
                />
              )}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePingUnsafe}
                  disabled={isPinging}
                  className="flex-1 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs h-11 shadow-md shadow-red-500/25 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
                >
                  {isPinging ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      <span>Ping Guardians (Ring Phones)</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNoteInput(!showNoteInput)}
                  className="rounded-xl text-[11px] text-red-700 dark:text-red-300 h-11 px-2.5 hover:bg-red-100/50"
                  title="Add custom distress note"
                >
                  {showNoteInput ? 'Cancel Note' : '+ Note'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 1. INCOMING REQUESTS (MUST ACCEPT / DECLINE) */}
        {shares.incoming.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Incoming Requests ({shares.incoming.length})
              </h4>
            </div>
            <div className="space-y-2">
              {shares.incoming.map((req) => (
                <div
                  key={req.shareId}
                  className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-foreground">{req.fromName}</p>
                      <p className="text-[11px] text-muted-foreground">{req.fromEmail}</p>
                    </div>
                    <span className="text-[10px] bg-amber-200/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-md">
                      Wants to Share
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Accepting will allow both of you to see each other&apos;s live locations in real-time.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleRespond(req.shareId, true)}
                      className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      Accept & Share
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRespond(req.shareId, false)}
                      className="rounded-xl border-slate-300 text-slate-700 text-xs h-9 px-3"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. INVITE FORM */}
        <form onSubmit={handleSendInvite} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-muted/40 border border-border/70 space-y-2.5">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-primary" />
            <span>Invite Guardian by Email:</span>
          </label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="e.g. partner@gmail.com, mom@family.com"
              required
              className="rounded-xl text-xs h-10 border-border bg-white dark:bg-card focus-visible:ring-primary/20"
            />
            <Button
              type="submit"
              disabled={isSubmitting || !emailInput.trim()}
              className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs h-10 px-4 shrink-0 shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Invite
                </>
              )}
            </Button>
          </div>
        </form>

        {/* 3. ACTIVE MUTUAL SHARING GUARDIANS */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Active Mutual Guardians ({shares.active.length})</span>
            </h4>
            <span className="text-[10px] text-muted-foreground">Streaming Live GPS</span>
          </div>

          {isLoading ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Checking live buddy connections...</span>
            </div>
          ) : shares.active.length === 0 ? (
            <div className="p-5 rounded-2xl border border-dashed border-border/80 bg-white dark:bg-card text-center space-y-1">
              <Users className="w-7 h-7 text-muted-foreground mx-auto opacity-40 mb-1" />
              <p className="text-xs font-bold text-foreground">No Active Guardians Yet</p>
              <p className="text-[11px] text-muted-foreground">
                Invite a trusted friend or family member by email above to see each other&apos;s live coordinates.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {shares.active.map((buddy) => {
                const hasLocation = typeof buddy.buddyLat === 'number' && typeof buddy.buddyLng === 'number'
                let distText = 'Locating...'
                if (hasLocation && currentLocation) {
                  const d = calculateDistanceKm(currentLocation.lat, currentLocation.lng, buddy.buddyLat!, buddy.buddyLng!)
                  distText = formatDistance(d)
                }

                return (
                  <div
                    key={buddy.shareId}
                    className="p-3.5 rounded-2xl bg-white dark:bg-card border border-emerald-200/80 dark:border-emerald-900/60 shadow-2xs space-y-2.5 transition-all hover:border-emerald-400"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-xs">
                          {buddy.buddyName ? buddy.buddyName[0].toUpperCase() : 'B'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-foreground truncate">{buddy.buddyName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{buddy.buddyEmail}</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 text-[10px] font-bold shrink-0 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>MUTUAL LIVE</span>
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-muted/30 p-2 rounded-xl text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Distance: {distText}</span>
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground text-[10px]">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(buddy.buddyUpdatedAt)}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      {hasLocation && (
                        <Button
                          size="sm"
                          onClick={() => {
                            onFocusBuddy?.(buddy)
                            onClose()
                          }}
                          className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs h-8 shadow-2xs"
                        >
                          <Navigation className="w-3 h-3 mr-1.5" />
                          Locate on Map
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStop(buddy.shareId)}
                        className="rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs h-8 px-2.5"
                        title="Stop sharing location with this person"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        <span>Stop Sharing</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 4. OUTGOING PENDING INVITES */}
        {shares.outgoing.length > 0 && (
          <div className="pt-1 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Awaiting Acceptance ({shares.outgoing.length})
            </h4>
            <div className="space-y-1.5">
              {shares.outgoing.map((out) => (
                <div
                  key={out.shareId}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-muted/20 border border-border/70 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground truncate">{out.toEmail}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
