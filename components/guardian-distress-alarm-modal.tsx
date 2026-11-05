'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Volume2,
  VolumeX,
  Phone,
  ShieldAlert,
  Navigation,
  MapPin,
  Clock,
  CheckCircle2,
  BellRing
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  fetchLocationShares,
  resolveDistressPing,
  type LocationBuddy
} from '@/lib/location-sharing'
import { emergencyRingtone } from '@/lib/emergency-ringtone'
import { useAuth } from '@/lib/auth-context'

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
  if (!dateStr) return 'Just now'
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 15) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

export function GuardianDistressAlarmModal() {
  const router = useRouter()
  const { user } = useAuth()

  const [activeDistressBuddy, setActiveDistressBuddy] = useState<LocationBuddy | null>(null)
  const [myDistressActive, setMyDistressActive] = useState(false)
  const [isRinging, setIsRinging] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Track acknowledged timestamps to avoid ringing repeatedly if silenced
  const silencedPingsRef = useRef<Record<string, string>>({})

  // Watch current user position for distance calculation
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setMyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Poll for buddy distress pings
  useEffect(() => {
    if (!user) return

    let isMounted = true

    const checkPings = async () => {
      try {
        const data = await fetchLocationShares()
        if (!isMounted) return

        setMyDistressActive(Boolean(data.myActiveDistress))

        // Find any active buddy distress from the last 30 minutes
        const now = Date.now()
        const urgentBuddy = data.active.find((b) => {
          if (!b.buddyDistress || !b.buddyDistressAt) return false
          const ageMs = now - new Date(b.buddyDistressAt).getTime()
          const isRecent = ageMs < 30 * 60 * 1000 // 30 minutes
          const isSilenced = silencedPingsRef.current[b.shareId] === b.buddyDistressAt
          return isRecent && !isSilenced
        })

        if (urgentBuddy) {
          setActiveDistressBuddy(urgentBuddy)
          if (!emergencyRingtone.active()) {
            emergencyRingtone.start()
            setIsRinging(true)
          }
        } else {
          // If no urgent buddy requires ringing, stop
          if (emergencyRingtone.active()) {
            emergencyRingtone.stop()
            setIsRinging(false)
          }
        }
      } catch (err) {
        // Ignored
      }
    }

    void checkPings()
    const interval = setInterval(checkPings, 4500)

    return () => {
      isMounted = false
      clearInterval(interval)
      emergencyRingtone.stop()
    }
  }, [user])

  // Handle Silence / Acknowledge
  const handleSilence = () => {
    emergencyRingtone.stop()
    setIsRinging(false)
    if (activeDistressBuddy && activeDistressBuddy.buddyDistressAt) {
      silencedPingsRef.current[activeDistressBuddy.shareId] = activeDistressBuddy.buddyDistressAt
    }
    setActiveDistressBuddy(null)
  }

  // Handle View Live on Map
  const handleTrackOnMap = () => {
    emergencyRingtone.stop()
    setIsRinging(false)
    if (activeDistressBuddy) {
      if (activeDistressBuddy.buddyDistressAt) {
        silencedPingsRef.current[activeDistressBuddy.shareId] = activeDistressBuddy.buddyDistressAt
      }
      const buddyId = activeDistressBuddy.shareId
      setActiveDistressBuddy(null)
      router.push(`/sos?focusBuddy=${buddyId}`)
    } else {
      router.push('/sos')
    }
  }

  // Handle "I am safe now" (for current user)
  const handleResolveMyDistress = async () => {
    setIsResolving(true)
    await resolveDistressPing()
    setMyDistressActive(false)
    setIsResolving(false)
  }

  const hasLocation =
    activeDistressBuddy &&
    typeof activeDistressBuddy.buddyLat === 'number' &&
    typeof activeDistressBuddy.buddyLng === 'number'

  let distanceText = 'Locating...'
  if (hasLocation && myCoords) {
    const d = calculateDistanceKm(
      myCoords.lat,
      myCoords.lng,
      activeDistressBuddy!.buddyLat!,
      activeDistressBuddy!.buddyLng!
    )
    distanceText = formatDistance(d)
  }

  return (
    <>
      {/* 1. FLOATING SENDER DISTRESS BANNER (When YOU are broadcasting distress) */}
      {myDistressActive && !activeDistressBuddy && (
        <div className="fixed bottom-20 inset-x-3 sm:max-w-md sm:mx-auto z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-3.5 rounded-2xl bg-red-600 text-white shadow-2xl border-2 border-red-400 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-3.5 w-3.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white" />
              </span>
              <div className="min-w-0">
                <p className="font-extrabold text-xs tracking-wide uppercase">Unsafe Ping Active</p>
                <p className="text-[11px] text-red-100 truncate">Ringing your Guardian Circle devices</p>
              </div>
            </div>
            <Button
              size="sm"
              disabled={isResolving}
              onClick={handleResolveMyDistress}
              className="rounded-xl bg-white text-red-700 hover:bg-red-50 font-bold text-xs h-8 px-3 shrink-0 shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>I&apos;m Safe Now</span>
            </Button>
          </div>
        </div>
      )}

      {/* 2. HIGH-URGENCY INCOMING DISTRESS ALARM MODAL (RINGS YOUR PHONE) */}
      <Dialog
        open={Boolean(activeDistressBuddy)}
        onOpenChange={(open) => {
          if (!open) handleSilence()
        }}
      >
        <DialogContent className="max-w-md w-full rounded-3xl border-2 border-red-500 bg-white dark:bg-zinc-950 p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
          <DialogHeader className="text-left space-y-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-red-600 hover:bg-red-600 text-white border-0 text-[11px] font-extrabold tracking-wider px-3 py-1 uppercase flex items-center gap-1.5 shadow-md animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>EMERGENCY DISTRESS ALARM</span>
              </Badge>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-semibold">
                <Clock className="w-3.5 h-3.5 text-red-500" />
                <span>{formatRelativeTime(activeDistressBuddy?.buddyDistressAt)}</span>
              </span>
            </div>

            <div className="flex items-start gap-3 pt-2">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 border border-red-300">
                <BellRing className="h-7 w-7 animate-bounce" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600" />
                </span>
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400 leading-tight">
                  {activeDistressBuddy?.buddyName || 'Your Guardian Contact'} Feels Unsafe!
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {activeDistressBuddy?.buddyEmail} triggered an emergency distress ping.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Audible Siren Alert Banner */}
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-300">
              <Volume2 className="w-4 h-4 text-red-600 animate-pulse shrink-0" />
              <span>SIREN RINGING (HIGH URGENCY)</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSilence}
              className="rounded-xl border-red-300 hover:bg-red-100 text-red-700 text-xs h-7 px-2.5 font-semibold"
            >
              <VolumeX className="w-3.5 h-3.5 mr-1" />
              Silence Ring
            </Button>
          </div>

          {/* Distress Note */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Distress Message:</p>
            <p className="text-xs font-semibold text-foreground italic">
              &quot;{activeDistressBuddy?.buddyDistressMessage || 'I feel unsafe right now! Please check my live location and contact me.'}&quot;
            </p>
          </div>

          {/* Location & Distance Micro-card */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  Distance: {distanceText}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  Live GPS beacon broadcasting
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
              LIVE
            </Badge>
          </div>

          {/* Action Grid */}
          <div className="space-y-2 pt-1">
            <Button
              onClick={handleTrackOnMap}
              className="w-full rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm h-12 shadow-lg shadow-red-500/25 flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
            >
              <Navigation className="w-4 h-4" />
              <span>Track Live On Map & Navigate</span>
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`tel:${activeDistressBuddy?.buddyEmail}`}
                className="w-full"
                onClick={handleSilence}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl border-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs h-10 flex items-center justify-center gap-1.5 hover:bg-slate-100"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Call Buddy</span>
                </Button>
              </a>

              <a href="tel:10111" className="w-full" onClick={handleSilence}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs h-10 flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  <span>Call SAPS (10111)</span>
                </Button>
              </a>
            </div>

            <Button
              variant="ghost"
              onClick={handleSilence}
              className="w-full rounded-xl text-muted-foreground text-xs h-9 hover:bg-muted font-medium"
            >
              Acknowledge & Dismiss Alarm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
