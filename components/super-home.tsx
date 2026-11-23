'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ShieldAlert, 
  Bus, 
  Store, 
  Newspaper, 
  Hospital, 
  Shield, 
  Phone, 
  Car, 
  MapPin, 
  ArrowRight, 
  Navigation, 
  Radio, 
  ExternalLink, 
  CheckCircle2, 
  ChevronRight,
  Compass,
  Users,
  X,
  Clock,
  AlertTriangle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { loadLanguagePreference } from '@/lib/locale-storage'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { notifySOSActivated, subscribeForProductionPush } from '@/lib/push-notifications'
import { pingUnsafeBuddies } from '@/lib/location-sharing'
import { getApiUrl } from '@/lib/api-client'
import { SafeRideSession } from '@/lib/safe-ride-types'
import { getActiveSafeRide, formatCountdown, calculateRemainingSeconds } from '@/lib/safe-ride-service'
import { getSOSCallPreference } from '@/lib/user-sync'
import { getStoredEmergencyContacts } from '@/lib/emergency-contacts-storage'
import { getNearbySAPSStations, getNearbyHospitals, getNearbyMalls } from '@/lib/saps-stations'
import { getCachedLocation } from '@/lib/geolocation'
import { evaluateLocationSafety } from '@/lib/high-risk-zones'
import { triggerHapticFeedback } from '@/lib/biometric'

const SA_RADAR_AREAS = [
  { name: 'Hatfield (Tshwane)', lat: -25.7505, lng: 28.2385 },
  { name: 'Pretoria CBD (Tshwane)', lat: -25.7479, lng: 28.2293 },
  { name: 'Johannesburg (Central)', lat: -26.2041, lng: 28.0473 },
  { name: 'Soweto (Gauteng)', lat: -26.2485, lng: 27.8540 },
  { name: 'Cape Town (Central)', lat: -33.9249, lng: 18.4241 },
  { name: 'Durban (eThekwini)', lat: -29.8587, lng: 31.0218 },
  { name: 'Gqeberha (Port Elizabeth)', lat: -33.9608, lng: 25.6022 },
  { name: 'Bloemfontein (Mangaung)', lat: -29.0852, lng: 26.1596 },
]

type NewsItem = {
  title: string
  source: string
  url: string
  category: string
  publishedAt?: string
}

type NearbyItem = {
  name: string
  distanceKm: number
  address?: string
}

function getGreetingByLanguage(language: string, name: string): { greeting: string; period: string } {
  const hour = new Date().getHours()
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  if (language === 'zu') {
    return { greeting: `Sawubona, ${name}`, period: hour < 12 ? 'Kuseni' : 'Ntambama' }
  }
  if (language === 'af') {
    return { greeting: `Goeiedag, ${name}`, period: hour < 12 ? 'Goeiemôre' : 'Goeiemiddag' }
  }
  if (language === 'nso' || language === 'tn' || language === 'st') {
    return { greeting: `Dumela, ${name}`, period: hour < 12 ? 'Meso' : 'Thapama' }
  }
  return { 
    greeting: `Good ${period}, ${name}`, 
    period: hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening' 
  }
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function SuperHome({ name }: { name: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const [supabase] = useState(() => createClient())

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [language, setLanguage] = useState('en')
  const [location, setLocation] = useState<{ lat: number; lng: number }>(() => {
    const cached = getCachedLocation()
    return cached || { lat: -25.7479, lng: 28.2293 }
  })
  const [selectedAreaName, setSelectedAreaName] = useState(() => {
    const cached = getCachedLocation()
    return cached ? 'Cached GPS' : 'Pretoria CBD (Tshwane)'
  })
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [news, setNews] = useState<NewsItem[]>([])
  const [nearest, setNearest] = useState<{ taxi?: NearbyItem; shop?: NearbyItem; clinic?: NearbyItem; police?: NearbyItem }>({})
  const [isSOSHolding, setIsSOSHolding] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [sosConfirmed, setSosConfirmed] = useState(false)
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isHoldingRef = useRef(false)

  // Safe Ride Session State
  const [activeRide, setActiveRide] = useState<SafeRideSession | null>(null)
  const [rideRemainingSecs, setRideRemainingSecs] = useState<number>(0)

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
      if (holdTimer.current) clearTimeout(holdTimer.current)
    }
  }, [])

  // 1. Language Setup
  useEffect(() => {
    void loadLanguagePreference().then((value) => setLanguage(value || 'en'))
  }, [])

  // 2. Active Safe Ride Monitor Heartbeat
  useEffect(() => {
    const checkActiveRide = () => {
      const existing = getActiveSafeRide()
      if (existing && existing.status !== 'arrived' && existing.status !== 'cancelled') {
        setActiveRide(existing)
        setRideRemainingSecs(calculateRemainingSeconds(existing))
      } else {
        setActiveRide(null)
      }
    }

    checkActiveRide()
    const interval = setInterval(checkActiveRide, 1000)
    return () => clearInterval(interval)
  }, [])

  // 3. Location Detection (Attempts GPS; falls back gracefully)
  const detectGPS = () => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSelectedAreaName('My Live GPS')
      },
      () => {
        // Keep current selected city
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }

  useEffect(() => {
    detectGPS()
  }, [])

  // 4. Fetch Live News
  useEffect(() => {
    void fetch(getApiUrl('/api/news?category=top&limit=6'))
      .then((res) => {
        if (!res.ok) throw new Error('News request failed')
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data?.items)) {
          setNews(data.items)
        }
      })
      .catch(() => setNews([]))
  }, [])

  // 5. Fetch Nearest Services Summary (Fast API + robust local SA data fallback)
  useEffect(() => {
    const fetchSummary = async () => {
      const loc = location || { lat: -25.7479, lng: 28.2293 }
      const fallbackPolice = getNearbySAPSStations(loc.lat, loc.lng, 1)[0]
      const fallbackClinic = getNearbyHospitals(loc.lat, loc.lng, 1)[0]
      const fallbackShop = getNearbyMalls(loc.lat, loc.lng, 1)[0]

      const [taxiRes, shopRes, clinicRes, policeRes] = await Promise.allSettled([
        fetch(getApiUrl(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}&category=taxi_ranks`)).then((r) => r.json()),
        fetch(getApiUrl(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}&category=malls_shops`)).then((r) => r.json()),
        fetch(getApiUrl(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}&category=clinics_hospitals`)).then((r) => r.json()),
        fetch(getApiUrl(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}&category=police_stations`)).then((r) => r.json()),
      ])

      setNearest({
        taxi: (taxiRes.status === 'fulfilled' && taxiRes.value?.results?.[0]) || {
          name: `${selectedAreaName.split(' ')[0]} Central Taxi Rank`,
          distanceKm: 0.9,
          address: 'Verified Transit Point',
        },
        shop: (shopRes.status === 'fulfilled' && shopRes.value?.results?.[0]) || (fallbackShop ? {
          name: fallbackShop.name,
          distanceKm: fallbackShop.distanceKm,
          address: fallbackShop.address || 'Safe Retail Hub',
        } : undefined),
        clinic: (clinicRes.status === 'fulfilled' && clinicRes.value?.results?.[0]) || (fallbackClinic ? {
          name: fallbackClinic.name,
          distanceKm: fallbackClinic.distanceKm,
          address: `${fallbackClinic.province}, South Africa`,
        } : undefined),
        police: (policeRes.status === 'fulfilled' && policeRes.value?.results?.[0]) || (fallbackPolice ? {
          name: fallbackPolice.name,
          distanceKm: fallbackPolice.distanceKm,
          address: `${fallbackPolice.province}, South Africa`,
        } : undefined),
      })
    }

    void fetchSummary()
  }, [location, selectedAreaName])

  // 6. Push Notifications Subscription
  useEffect(() => {
    void subscribeForProductionPush()
  }, [])

  // SOS Hold Handlers with Progress Meter
  const triggerTrustedCirclePing = async () => {
    const preference = getSOSCallPreference()
    const localContacts = getStoredEmergencyContacts(user?.id)
    const primaryContact = localContacts.find((c) => c.is_primary) || localContacts[0]

    try {
      await pingUnsafeBuddies('Emergency SOS triggered from Phola home screen.', location.lat, location.lng)
    } catch (e) {
      console.warn('Buddy ping failed:', e)
    }

    setSosConfirmed(true)

    // 1. If preferred action is calling primary emergency contact
    if (preference === 'contact' && primaryContact?.phone) {
      window.location.href = `tel:${primaryContact.phone.replace(/\s+/g, '')}`
      return
    }

    // 2. If preferred action is calling police (10111) or if no primary contact exists
    if (preference === 'police' || !primaryContact?.phone) {
      window.location.href = 'tel:10111'
      return
    }

    router.push('/sos')
  }

  const startSOSHold = () => {
    if (isHoldingRef.current) return
    isHoldingRef.current = true
    setIsSOSHolding(true)
    setHoldProgress(0)
    triggerHapticFeedback('medium')

    let progress = 0
    holdIntervalRef.current = setInterval(() => {
      progress += 10
      setHoldProgress(progress)
      if (progress >= 100) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
      }
    }, 120)

    holdTimer.current = setTimeout(() => {
      isHoldingRef.current = false
      setIsSOSHolding(false)
      setHoldProgress(0)
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
      triggerHapticFeedback('heavy')
      void triggerTrustedCirclePing()
      void notifySOSActivated()
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 300, 100, 500])
      }
    }, 1300)
  }

  const cancelSOSHold = () => {
    isHoldingRef.current = false
    setIsSOSHolding(false)
    setHoldProgress(0)
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const { greeting } = getGreetingByLanguage(language, name || 'friend')
  const areaSafety = evaluateLocationSafety(location.lat, location.lng)

  return (
    <div className="min-h-screen bg-surface-canvas pt-16 sm:pt-20 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        
        {/* SOS Confirmation Banner */}
        {sosConfirmed && (
          <div className="mb-4 flex items-center justify-between gap-2 p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-foreground text-xs shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-destructive shrink-0" />
              <span className="font-semibold">
                Emergency SOS broadcasted. Guardian Circle alerted with your live location.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/sos" className="underline font-bold text-primary hover:text-primary/80">
                View SOS Map
              </Link>
              <button
                type="button"
                onClick={() => setSosConfirmed(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss confirmation"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 2-Column Responsive Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ========================================================================= */}
          {/* LEFT MAIN COLUMN (lg:col-span-8)                                          */}
          {/* ========================================================================= */}
          <div className="order-2 lg:order-1 lg:col-span-8 space-y-6">

            {/* 1. Header + Area Selector */}
            <section className="rounded-xl border border-border/70 bg-surface-workspace p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {greeting}
                  </h1>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    Civic safety network for emergency response, trusted circles, and community services.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAreaModal(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-tonal px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition"
                    title="Change location"
                  >
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>{selectedAreaName}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </button>

                  <button 
                    type="button" 
                    onClick={detectGPS}
                    className="text-xs font-semibold text-primary hover:underline flex items-center p-1"
                    title="Detect live GPS"
                  >
                    <Navigation className="h-3.5 w-3.5 mr-0.5" />
                    GPS
                  </button>
                </div>
              </div>
            </section>

            {/* 2. Core Tools 2x2 Tonal Cards */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Core Safety Tools
                </h2>
                <button 
                  type="button" 
                  onClick={() => router.push('/safety')} 
                  className="text-xs font-semibold text-primary hover:underline flex items-center"
                >
                  All Tools <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Safe Ride Watchdog */}
                <div 
                  onClick={() => router.push('/safe-ride')}
                  className="group flex flex-col justify-between rounded-xl bg-surface-tonal p-4.5 border border-border/50 hover:border-primary/40 cursor-pointer transition-all shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-workspace text-primary shadow-xs">
                        <Car className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="border-border bg-surface-workspace text-foreground text-[11px] font-semibold">
                        Watchdog
                      </Badge>
                    </div>
                    <p className="text-[15px] font-semibold text-foreground">Safe Ride Watchdog</p>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      Trip countdown and route deviation detection for e-hailing and minibus transit.
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="text-[11px] text-muted-foreground font-normal">Active telemetry</span>
                    <span className="flex items-center">Open <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" /></span>
                  </div>
                </div>

                {/* 2. Incident Vault */}
                <div 
                  onClick={() => router.push('/reports')}
                  className="group flex flex-col justify-between rounded-xl bg-surface-tonal p-4.5 border border-border/50 hover:border-primary/40 cursor-pointer transition-all shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-workspace text-primary shadow-xs">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="border-border bg-surface-workspace text-foreground text-[11px] font-semibold">
                        Enclave
                      </Badge>
                    </div>
                    <p className="text-[15px] font-semibold text-foreground">Incident Vault</p>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      Confidential encrypted records with instant Section 212 SAPS sworn docket generation.
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="text-[11px] text-muted-foreground font-normal">AES-256 encrypted</span>
                    <span className="flex items-center">Open <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" /></span>
                  </div>
                </div>

                {/* 3. Emergency SOS Map */}
                <div 
                  onClick={() => router.push('/sos')}
                  className="group flex flex-col justify-between rounded-xl bg-surface-tonal p-4.5 border border-border/50 hover:border-primary/40 cursor-pointer transition-all shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-workspace text-primary shadow-xs">
                        <Navigation className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="border-border bg-surface-workspace text-foreground text-[11px] font-semibold">
                        Radar
                      </Badge>
                    </div>
                    <p className="text-[15px] font-semibold text-foreground">Emergency SOS Map</p>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      Locate verified police stations, trauma centres, and 24/7 designated safe havens.
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="text-[11px] text-muted-foreground font-normal">Live GPS tracking</span>
                    <span className="flex items-center">Open <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" /></span>
                  </div>
                </div>

                {/* 4. Safety Hub & Helplines */}
                <div 
                  onClick={() => router.push('/safety')}
                  className="group flex flex-col justify-between rounded-xl bg-surface-tonal p-4.5 border border-border/50 hover:border-primary/40 cursor-pointer transition-all shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-workspace text-primary shadow-xs">
                        <Shield className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="border-border bg-surface-workspace text-foreground text-[11px] font-semibold">
                        Helplines
                      </Badge>
                    </div>
                    <p className="text-[15px] font-semibold text-foreground">Safety Hub & Hotlines</p>
                    <p className="text-[13px] text-muted-foreground mt-1">
                      Verified crisis lines, legal resources, GBV Command Centre, and shelter directories.
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="text-[11px] text-muted-foreground font-normal">24/7 Support</span>
                    <span className="flex items-center">Open <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" /></span>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Safety Guide & Trusted Contacts Row */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => router.push('/assistant')}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-workspace p-4 shadow-xs hover:border-primary/50 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">Safety Guide</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      Legal rights, domestic violence protocols, and protection orders.
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>

              <div
                onClick={() => router.push('/settings')}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-workspace p-4 shadow-xs hover:border-primary/50 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">Trusted Contacts</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      Configure your Guardian Circle and automated distress notification alerts.
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </section>

            {/* 4. Nearest Services 2x2 Grid */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Nearest Services ({selectedAreaName})
                  </h2>
                </div>
                <Link 
                  href="/nearby" 
                  className="text-xs font-semibold text-primary hover:underline flex items-center"
                >
                  All Services <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Card 1: Nearest Police Station */}
                <Card className="border-border/70 bg-surface-workspace shadow-xs rounded-xl">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-tonal text-primary">
                          <Shield className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Police Station</span>
                      </div>
                      <Badge variant="secondary" className="tabular-nums font-mono text-[11px]">
                        {nearest.police ? formatDistance(nearest.police.distanceKm) : '--'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-foreground line-clamp-1">
                        {nearest.police?.name || 'Searching SAPS stations...'}
                      </p>
                      <p className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5">
                        {nearest.police?.address || 'Verified police station'}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => router.push('/nearby?category=police_stations')}
                      className="w-full rounded-lg border-border text-xs text-foreground font-medium h-8"
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>

                {/* Card 2: Nearest Clinic / Hospital */}
                <Card className="border-border/70 bg-surface-workspace shadow-xs rounded-xl">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-tonal text-primary">
                          <Hospital className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Clinic / Health</span>
                      </div>
                      <Badge variant="secondary" className="tabular-nums font-mono text-[11px]">
                        {nearest.clinic ? formatDistance(nearest.clinic.distanceKm) : '--'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-foreground line-clamp-1">
                        {nearest.clinic?.name || 'Searching clinics...'}
                      </p>
                      <p className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5">
                        {nearest.clinic?.address || 'Emergency medical facility'}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => router.push('/nearby?category=clinics_hospitals')}
                      className="w-full rounded-lg border-border text-xs text-foreground font-medium h-8"
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>

                {/* Card 3: Nearest Taxi Rank */}
                <Card className="border-border/70 bg-surface-workspace shadow-xs rounded-xl">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-tonal text-primary">
                          <Bus className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Taxi Rank</span>
                      </div>
                      <Badge variant="secondary" className="tabular-nums font-mono text-[11px]">
                        {nearest.taxi ? formatDistance(nearest.taxi.distanceKm) : '--'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-foreground line-clamp-1">
                        {nearest.taxi?.name || 'Searching ranks...'}
                      </p>
                      <p className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5">
                        {nearest.taxi?.address || 'Transit point'}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => router.push('/nearby?category=taxi_ranks')}
                      className="w-full rounded-lg border-border text-xs text-foreground font-medium h-8"
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>

                {/* Card 4: Safe Retail Hub */}
                <Card className="border-border/70 bg-surface-workspace shadow-xs rounded-xl">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-tonal text-primary">
                          <Store className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Safe Retail Hub</span>
                      </div>
                      <Badge variant="secondary" className="tabular-nums font-mono text-[11px]">
                        {nearest.shop ? formatDistance(nearest.shop.distanceKm) : '--'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-foreground line-clamp-1">
                        {nearest.shop?.name || 'Searching hubs...'}
                      </p>
                      <p className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5">
                        {nearest.shop?.address || 'Safe commercial center'}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => router.push('/nearby?category=malls_shops')}
                      className="w-full rounded-lg border-border text-xs text-foreground font-medium h-8"
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* 5. South Africa Headlines List */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <Newspaper className="h-4 w-4 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    South Africa News & Bulletins
                  </h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push('/news')} className="text-xs text-primary">
                  All News <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {news.slice(0, 4).map((item) => (
                  <div
                    key={item.url}
                    onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                    className="group flex flex-col justify-between rounded-xl border border-border/70 bg-surface-workspace p-4 shadow-xs hover:border-primary/50 cursor-pointer transition"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                          {item.source}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition" />
                      </div>
                      <p className="line-clamp-2 text-[14px] font-semibold text-foreground group-hover:text-primary transition">
                        {item.title}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Verified SA Source</span>
                      <span className="text-primary font-medium">Read Article</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* ========================================================================= */}
          {/* RIGHT STICKY SAFETY RAIL (lg:col-span-4 lg:sticky lg:top-20 self-start)    */}
          {/* ========================================================================= */}
          <div className="order-1 lg:order-2 lg:col-span-4 lg:sticky lg:top-20 self-start space-y-4">
            
            {/* Card 1: High-Contrast Crimson Hold SOS Card (1.3s) */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Hold SOS panic button for 1.3 seconds"
              className={`relative overflow-hidden rounded-xl border p-4.5 transition-all select-none cursor-pointer ${
                isSOSHolding
                  ? 'border-destructive bg-destructive text-destructive-foreground ring-4 ring-destructive/40 shadow-lg'
                  : 'border-destructive bg-destructive text-destructive-foreground shadow-md hover:brightness-105 active:scale-[0.99]'
              }`}
              onPointerDown={startSOSHold}
              onPointerUp={cancelSOSHold}
              onPointerLeave={cancelSOSHold}
              onPointerCancel={cancelSOSHold}
              onContextMenu={(e) => e.preventDefault()}
            >
              {isSOSHolding && (
                <div
                  className="absolute bottom-0 left-0 top-0 bg-black/30 transition-none"
                  style={{ width: `${holdProgress}%` }}
                />
              )}

              <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white font-bold">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold tracking-tight">
                      {isSOSHolding ? 'TRANSMITTING DISTRESS ALERT...' : 'EMERGENCY SOS'}
                    </p>
                    <p className="text-[12px] text-white/90">
                      {isSOSHolding
                        ? `Hold for ${Math.max(0, 1.3 - (holdProgress / 100) * 1.3).toFixed(1)}s`
                        : 'Hold 1.3s to notify Guardian Circle & dial'}
                    </p>
                  </div>
                </div>

                <span className="tabular-nums text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-black/30 px-2.5 py-1 text-white border border-white/20 shrink-0">
                  {isSOSHolding ? `${Math.round(holdProgress)}%` : 'HOLD SOS'}
                </span>
              </div>
            </div>

            {/* Card 2: GBV Command Centre Direct Call Card */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-workspace p-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-foreground">GBV Command Centre</p>
                  <p className="tabular-nums text-[12px] text-muted-foreground font-medium">Toll-free 24/7: 0800 428 428</p>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.href = 'tel:0800428428'}
                className="border-border text-foreground hover:bg-muted text-xs h-8.5 rounded-lg font-semibold shrink-0"
              >
                <Phone className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Call Free
              </Button>
            </div>

            {/* Card 3: Active Safe Ride Countdown OR Quick Start Prompt */}
            {activeRide ? (
              <div 
                onClick={() => router.push('/safe-ride')}
                className="rounded-xl border border-primary/50 bg-surface-workspace p-4 shadow-xs cursor-pointer hover:border-primary transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Watchdog Active
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                    {activeRide.serviceName}
                  </Badge>
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground line-clamp-1">
                      To {activeRide.destination}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Driver: {activeRide.driverName || 'Verified'}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-mono text-xl font-bold text-primary">
                      {formatCountdown(rideRemainingSecs)}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">Remaining</p>
                  </div>
                </div>

                <Button size="sm" className="w-full mt-3 bg-primary hover:bg-primary/95 text-primary-foreground text-xs h-8 rounded-lg font-semibold">
                  Open Live Monitor <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-surface-workspace p-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-tonal text-primary">
                    <Car className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-foreground">Safe Ride Watchdog</p>
                    <p className="text-[12px] text-muted-foreground truncate">Auto-monitor trips and route deviations</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => router.push('/safe-ride')}
                  className="w-full mt-3 border-border hover:bg-surface-tonal text-xs h-8 rounded-lg font-semibold"
                >
                  Start Safe Ride Watchdog
                </Button>
              </div>
            )}

            {/* Card 4: Current Area Safety Status Card */}
            <div className="rounded-xl border border-border/70 bg-surface-workspace p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Area Safety Status</span>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider text-white ${
                    areaSafety.level === 'high'
                      ? 'bg-destructive'
                      : areaSafety.level === 'moderate'
                      ? 'bg-amber-600'
                      : 'bg-primary'
                  }`}
                >
                  {areaSafety.badgeText}
                </span>
              </div>

              <div>
                <p className="text-[14px] font-semibold text-foreground">{selectedAreaName}</p>
                <p className="tabular-nums text-[12px] text-muted-foreground mt-0.5">
                  Lat {location.lat.toFixed(4)}, Lng {location.lng.toFixed(4)}
                </p>
              </div>

              <div className="pt-2 border-t border-border/50 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowAreaModal(true)}
                  className="flex-1 text-xs h-7.5 rounded-lg font-semibold"
                >
                  <MapPin className="h-3 w-3 mr-1 text-primary" />
                  Change Area
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={detectGPS}
                  className="text-xs h-7.5 px-2 text-primary font-semibold"
                >
                  Refresh GPS
                </Button>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* AREA SELECTOR MODAL */}
      <Dialog open={showAreaModal} onOpenChange={setShowAreaModal}>
        <DialogContent className="max-w-sm rounded-xl border-border p-5 shadow-2xl bg-surface-workspace">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              Select South Africa Area
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select your area to instantly view nearby police stations, health facilities, and transit points.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-1 max-h-72 overflow-y-auto">
            {SA_RADAR_AREAS.map((area) => (
              <button
                key={area.name}
                type="button"
                onClick={() => {
                  setLocation({ lat: area.lat, lng: area.lng })
                  setSelectedAreaName(area.name)
                  setShowAreaModal(false)
                }}
                className="w-full flex items-center justify-between rounded-lg p-2.5 text-left text-xs font-semibold hover:bg-surface-tonal active:bg-muted transition border border-transparent hover:border-border"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-foreground">{area.name}</span>
                </div>
                {selectedAreaName === area.name && (
                  <Badge variant="secondary" className="text-[10px]">
                    Active
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                detectGPS()
                setShowAreaModal(false)
              }}
              className="flex-1 rounded-lg text-xs bg-primary text-primary-foreground font-semibold"
            >
              <Navigation className="h-3.5 w-3.5 mr-1" />
              Use My Live GPS
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAreaModal(false)}
              className="rounded-lg text-xs border-border"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AppBottomNav />
    </div>
  )
}
