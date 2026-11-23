'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Search, 
  ShieldAlert, 
  Bus, 
  Store, 
  Newspaper, 
  Hospital, 
  Shield, 
  FileWarning, 
  Phone, 
  HeartHandshake, 
  Car, 
  MapPin, 
  ArrowRight, 
  Navigation, 
  Clock, 
  Radio, 
  ExternalLink, 
  LogOut, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight,
  AlertTriangle,
  Flame,
  Globe2,
  Compass,
  Users,
  Check,
  X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [search, setSearch] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [activeCategory, setActiveCategory] = useState<'all' | 'safety' | 'transit' | 'services'>('all')
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

  // Search Index Data with rich keyword synonyms
  const searchIndex = useMemo(() => [
    { label: 'Safe Ride Watchdog (Uber / Bolt)', href: '/safe-ride', category: 'safety', keywords: 'safe ride watchdog uber bolt taxi trip driver countdown' },
    { label: 'Report GBV (VAULT)', href: '/reports', category: 'safety', keywords: 'report gbv vault domestic violence abuse assault confidential police docket statement victim friendly room' },
    { label: 'Report Crime & Theft', href: '/report', category: 'safety', keywords: 'report crime theft robbery mugging vehicle assault saps police incident' },
    { label: 'Emergency SOS & Safe Map', href: '/sos', category: 'safety', keywords: 'emergency sos map panic safe places shelter trauma havens' },
    { label: 'Safety Hub & Helplines', href: '/safety', category: 'safety', keywords: 'safety hub helplines hotlines contacts crisis victim support 0800428428' },
    { label: 'Police Stations Near Me', href: '/nearby?category=police_stations', category: 'services', keywords: 'police saps station charge office cop law enforcement' },
    { label: 'Clinics & Hospitals Near Me', href: '/nearby?category=clinics_hospitals', category: 'services', keywords: 'clinic hospital medical doctor health nurse ambulance emergency room j88' },
    { label: 'Taxi Ranks & Gautrain', href: '/nearby?category=taxi_ranks', category: 'transit', keywords: 'taxi rank transit gautrain bus rank minibus station transport' },
    { label: 'Shopping Malls & Stores', href: '/nearby?category=malls_shops', category: 'services', keywords: 'shopping malls stores supermarket groceries pharmacy' },
    { label: 'Live South Africa News', href: '/news', category: 'services', keywords: 'live news updates mzansi south africa alerts headlines' },
    { label: 'My Incidents Vault', href: '/reports', category: 'safety', keywords: 'my incidents vault notes statements records evidence files' },
    { label: 'AI Safety Assistant', href: '/assistant', category: 'safety', keywords: 'ai assistant safety chat questions help advice legal rights' },
    { label: 'Profile & Emergency Contacts', href: '/settings', category: 'services', keywords: 'profile settings emergency contacts trusted circle biometric pin security' },
  ], [])

  const filteredSearch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return searchIndex.filter((entry) => 
      entry.label.toLowerCase().includes(q) || entry.keywords.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [search, searchIndex])

  const handleSearchSubmit = () => {
    const q = search.trim()
    if (!q) return
    if (filteredSearch.length > 0) {
      router.push(filteredSearch[0].href)
    } else {
      router.push(`/nearby?q=${encodeURIComponent(q)}`)
    }
    setSearch('')
    setIsSearchFocused(false)
  }

  // SOS Hold Handlers with Progress Meter
  const triggerTrustedCirclePing = async () => {
    const preference = getSOSCallPreference()
    const localContacts = getStoredEmergencyContacts(user?.id)
    const primaryContact = localContacts.find((c) => c.is_primary) || localContacts[0]

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
      setIsSOSHolding(false)
      setHoldProgress(0)
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
      triggerHapticFeedback('heavy')
      void triggerTrustedCirclePing()
      void notifySOSActivated()
      if (navigator.vibrate) navigator.vibrate([200, 100, 300, 100, 500])
    }, 1300)
  }

  const cancelSOSHold = () => {
    setIsSOSHolding(false)
    setHoldProgress(0)
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const { greeting } = getGreetingByLanguage(language, name || 'friend')

  return (
    <div className="min-h-screen bg-background pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">

        {/* Active Safe Ride Widget (When ride is in progress) */}
        {activeRide && (
          <section className="animate-in fade-in duration-200">
            <div 
              onClick={() => router.push('/safe-ride')}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/40 bg-card p-4 shadow-xs cursor-pointer hover:border-primary transition"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Watchdog Active • {activeRide.serviceName}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    To {activeRide.destination}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <p className="font-mono text-xl font-black text-primary">
                    {formatCountdown(rideRemainingSecs)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Remaining</p>
                </div>
                <Button size="sm" className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs h-8 rounded-lg font-semibold">
                  View Safe Ride
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* 1. HEADER + AREA SELECTOR + RISK PILL                                      */}
        {/* ========================================================================= */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {greeting}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Civic safety network for emergency response, trusted circles, and community services.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAreaModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition"
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

              {(() => {
                const safety = evaluateLocationSafety(location.lat, location.lng)
                return (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider text-white ${
                      safety.level === 'high'
                        ? 'bg-destructive'
                        : safety.level === 'moderate'
                        ? 'bg-amber-600'
                        : 'bg-primary'
                    }`}
                  >
                    {safety.badgeText}
                  </span>
                )
              })()}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. EMERGENCY ACTION STRIP (HIGH-CONTRAST CRIMSON HOLD SOS + GBV CALL CARD)*/}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Box 1: Unmistakable High-Contrast Crimson Hold SOS */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Hold SOS panic button for 1.3 seconds"
            className={`relative overflow-hidden rounded-xl border p-4 transition-all select-none cursor-pointer ${
              isSOSHolding
                ? 'border-destructive bg-destructive text-destructive-foreground ring-4 ring-destructive/40'
                : 'border-destructive bg-destructive text-destructive-foreground shadow-sm hover:brightness-105 active:scale-[0.99]'
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
                  <p className="text-sm font-bold tracking-tight">
                    {isSOSHolding ? 'TRANSMITTING DISTRESS ALERT...' : 'EMERGENCY SOS'}
                  </p>
                  <p className="text-xs text-white/90">
                    {isSOSHolding
                      ? `Hold for ${Math.max(0, 1.3 - (holdProgress / 100) * 1.3).toFixed(1)}s`
                      : 'Hold 1.3s to notify Guardian Circle & dial'}
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold uppercase tracking-wider rounded-lg bg-black/25 px-2.5 py-1 text-white border border-white/20">
                {isSOSHolding ? `${Math.round(holdProgress)}%` : 'HOLD SOS'}
              </span>
            </div>
          </div>

          {/* Box 2: GBV Command Centre Direct Call Card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">GBV Command Centre</p>
                <p className="text-xs text-muted-foreground">Toll-free 24/7: 0800 428 428</p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.href = 'tel:0800428428'}
              className="border-border text-foreground hover:bg-muted text-xs h-9 rounded-lg font-semibold"
            >
              <Phone className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Call Free
            </Button>
          </div>
        </section>

        {/* SOS Confirmation Banner (Clear feedback for desktop & all devices) */}
        {sosConfirmed && (
          <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-foreground text-xs shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-destructive shrink-0" />
              <span className="font-semibold">
                Emergency SOS triggered. Guardian Circle alerted and coordinates broadcast.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/sos" className="underline font-bold text-primary hover:text-primary/80">
                Open SOS Map
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

        {/* ========================================================================= */}
        {/* 3. UNIFIED SEARCH BAR WITH AUTOCOMPLETE & QUICK CATEGORIES                */}
        {/* ========================================================================= */}
        <section className="relative space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearchSubmit()
            }}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xs focus-within:border-primary transition"
          >
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearchSubmit()
                }
              }}
              placeholder="Search services, police stations, clinics, transit..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button 
                type="button" 
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition"
                title="Clear input"
                aria-label="Clear search input"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs text-primary font-semibold hover:bg-muted rounded-md shrink-0"
            >
              Search
            </Button>
          </form>

          {/* Quick Suggestion Pills when focused and empty */}
          {isSearchFocused && !search && (
            <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1 animate-in fade-in duration-150">
              <span className="text-[11px] text-muted-foreground mr-1">Suggested:</span>
              {[
                { label: 'Incident Vault', href: '/reports' },
                { label: 'Police Stations', href: '/nearby?category=police_stations' },
                { label: 'Safe Ride', href: '/safe-ride' },
                { label: 'Clinics & Hospitals', href: '/nearby?category=clinics_hospitals' },
                { label: 'Taxi Ranks', href: '/nearby?category=taxi_ranks' },
              ].map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onMouseDown={() => {
                    router.push(pill.href)
                    setIsSearchFocused(false)
                  }}
                  className="rounded-md bg-secondary border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted transition"
                >
                  {pill.label}
                </button>
              ))}
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {filteredSearch.length > 0 && (
            <Card className="absolute left-0 right-0 top-12 z-30 border-border bg-card shadow-lg rounded-xl overflow-hidden">
              <CardContent className="p-1.5 space-y-0.5">
                {filteredSearch.map((item) => (
                  <button
                    key={item.href + item.label}
                    type="button"
                    className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted transition"
                    onClick={() => {
                      router.push(item.href)
                      setIsSearchFocused(false)
                      setSearch('')
                    }}
                  >
                    <span className="font-medium text-foreground">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        {/* ========================================================================= */}
        {/* 4. CORE TOOLS GRID (4 CARDS)                                               */}
        {/* ========================================================================= */}
        <section className="space-y-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Safe Ride Watchdog */}
            <div 
              onClick={() => router.push('/safe-ride')}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs hover:border-primary/50 cursor-pointer transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Car className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary" className="bg-secondary text-foreground text-[10px] font-semibold">
                    Watchdog
                  </Badge>
                </div>
                <p className="text-sm font-bold text-foreground">Safe Ride Watchdog</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Trip countdown and route deviation detection for e-hailing and transit.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs font-semibold text-primary">
                <span className="text-[11px] text-muted-foreground font-normal">Live Telemetry</span>
                <span className="flex items-center">Open <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" /></span>
              </div>
            </div>

            {/* 2. Incident Vault */}
            <div 
              onClick={() => router.push('/reports')}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs hover:border-primary/50 cursor-pointer transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary" className="bg-secondary text-foreground text-[10px] font-semibold">
                    Vault
                  </Badge>
                </div>
                <p className="text-sm font-bold text-foreground">Incident Vault</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Confidential encrypted records with Section 212 SAPS docket generation.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs font-semibold text-primary">
                <span className="text-[11px] text-muted-foreground font-normal">Encrypted Enclave</span>
                <span className="flex items-center">Open <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" /></span>
              </div>
            </div>

            {/* 3. Emergency SOS Map */}
            <div 
              onClick={() => router.push('/sos')}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs hover:border-primary/50 cursor-pointer transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Navigation className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary" className="bg-secondary text-foreground text-[10px] font-semibold">
                    SOS Map
                  </Badge>
                </div>
                <p className="text-sm font-bold text-foreground">Emergency SOS Map</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Locate verified police stations, trauma centres, and safe havens.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs font-semibold text-primary">
                <span className="text-[11px] text-muted-foreground font-normal">GPS Radar</span>
                <span className="flex items-center">Open <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" /></span>
              </div>
            </div>

            {/* 4. Safety Hub & Hotlines */}
            <div 
              onClick={() => router.push('/safety')}
              className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs hover:border-primary/50 cursor-pointer transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Shield className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary" className="bg-secondary text-foreground text-[10px] font-semibold">
                    Hotlines
                  </Badge>
                </div>
                <p className="text-sm font-bold text-foreground">Safety Hub & Hotlines</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Verified emergency crisis lines, legal resources, and shelter directories.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs font-semibold text-primary">
                <span className="text-[11px] text-muted-foreground font-normal">Helplines</span>
                <span className="flex items-center">Open <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" /></span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. SAFETY GUIDE & TRUSTED CONTACTS ROW                                    */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: Safety Guide */}
          <div
            onClick={() => router.push('/assistant')}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs hover:border-primary/50 cursor-pointer transition"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Safety Guide</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Guidance on domestic violence rights, protection orders, and emergency safe routes.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          {/* Card 2: Trusted Contacts / Guardian Circle */}
          <div
            onClick={() => router.push('/settings')}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs hover:border-primary/50 cursor-pointer transition"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Trusted Contacts</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage primary emergency contacts and automated distress notification alerts.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. NEAREST SERVICES STRIP (4 CARDS)                                       */}
        {/* ========================================================================= */}
        <section className="space-y-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Nearest Police Station */}
            <Card className="border-border bg-card shadow-xs rounded-xl">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-primary">
                      <Shield className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Police Station</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {nearest.police ? formatDistance(nearest.police.distanceKm) : '--'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground line-clamp-1">
                    {nearest.police?.name || 'Searching SAPS stations...'}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {nearest.police?.address || 'Verified police station'}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => router.push('/nearby?category=police_stations')}
                  className="w-full rounded-lg border-border text-xs text-foreground font-medium h-7"
                >
                  View Details
                </Button>
              </CardContent>
            </Card>

            {/* Card 2: Nearest Clinic / Hospital */}
            <Card className="border-border bg-card shadow-xs rounded-xl">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-primary">
                      <Hospital className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Clinic / Health</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {nearest.clinic ? formatDistance(nearest.clinic.distanceKm) : '--'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground line-clamp-1">
                    {nearest.clinic?.name || 'Searching clinics...'}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {nearest.clinic?.address || 'Emergency medical facility'}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => router.push('/nearby?category=clinics_hospitals')}
                  className="w-full rounded-lg border-border text-xs text-foreground font-medium h-7"
                >
                  View Details
                </Button>
              </CardContent>
            </Card>

            {/* Card 3: Nearest Taxi Rank */}
            <Card className="border-border bg-card shadow-xs rounded-xl">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-primary">
                      <Bus className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Taxi Rank</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {nearest.taxi ? formatDistance(nearest.taxi.distanceKm) : '--'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground line-clamp-1">
                    {nearest.taxi?.name || 'Searching ranks...'}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {nearest.taxi?.address || 'Transit point'}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => router.push('/nearby?category=taxi_ranks')}
                  className="w-full rounded-lg border-border text-xs text-foreground font-medium h-7"
                >
                  View Details
                </Button>
              </CardContent>
            </Card>

            {/* Card 4: Safe Retail Hub */}
            <Card className="border-border bg-card shadow-xs rounded-xl">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-primary">
                      <Store className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Safe Retail Hub</span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {nearest.shop ? formatDistance(nearest.shop.distanceKm) : '--'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground line-clamp-1">
                    {nearest.shop?.name || 'Searching hubs...'}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {nearest.shop?.address || 'Safe commercial center'}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => router.push('/nearby?category=malls_shops')}
                  className="w-full rounded-lg border-border text-xs text-foreground font-medium h-7"
                >
                  View Details
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 7. SOUTH AFRICA HEADLINES LIST                                            */}
        {/* ========================================================================= */}
        <section className="space-y-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {news.slice(0, 4).map((item) => (
              <div
                key={item.url}
                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs hover:border-primary/50 cursor-pointer transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      {item.source}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition" />
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary transition">
                    {item.title}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Verified Source</span>
                  <span className="text-primary font-medium">Read Article</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* AREA SELECTOR MODAL */}
      <Dialog open={showAreaModal} onOpenChange={setShowAreaModal}>
        <DialogContent className="max-w-sm rounded-xl border-border p-5 shadow-2xl">
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
                className="w-full flex items-center justify-between rounded-lg p-2.5 text-left text-xs font-semibold hover:bg-muted active:bg-muted/80 transition border border-transparent hover:border-border"
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
              className="flex-1 rounded-lg text-xs bg-primary text-primary-foreground"
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
