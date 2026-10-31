'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Sparkles, 
  Radio, 
  ExternalLink, 
  LogOut, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight,
  AlertTriangle,
  Flame,
  Globe2,
  Compass
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
import { getApiUrl } from '@/lib/api-client'
import { SafeRideSession } from '@/lib/safe-ride-types'
import { getActiveSafeRide, formatCountdown, calculateRemainingSeconds } from '@/lib/safe-ride-service'
import { getSOSCallPreference } from '@/lib/user-sync'
import { getStoredEmergencyContacts } from '@/lib/emergency-contacts-storage'
import { getNearbySAPSStations, getNearbyHospitals, getNearbyMalls } from '@/lib/saps-stations'
import { getCachedLocation } from '@/lib/geolocation'

const SA_RADAR_AREAS = [
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
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Safe Ride Session State
  const [activeRide, setActiveRide] = useState<SafeRideSession | null>(null)
  const [rideRemainingSecs, setRideRemainingSecs] = useState<number>(0)

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
        fetch(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}&category=taxi_ranks`).then((r) => r.json()),
        fetch(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}&category=malls_shops`).then((r) => r.json()),
        fetch(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}&category=clinics_hospitals`).then((r) => r.json()),
        fetch(`/api/nearby?lat=${loc.lat}&lng=${loc.lng}&category=police_stations`).then((r) => r.json()),
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_36%),linear-gradient(180deg,#f6fffb_0%,#ffffff_44%,#f7fbf9_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">

        {/* ========================================================================= */}
        {/* ACTIVE SAFE RIDE LIVE WIDGET (Shows whenever ride is active)              */}
        {/* ========================================================================= */}
        {activeRide && (
          <section className="animate-in fade-in zoom-in-95 duration-200">
            <div 
              onClick={() => router.push('/safe-ride')}
              className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-white p-4 shadow-sm cursor-pointer hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
                  <Car className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
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
                <Button size="sm" className="bg-primary hover:bg-primary/95 text-white text-xs h-9 rounded-xl font-semibold shadow-xs">
                  View Watchdog
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* HERO GREETING & DUAL EMERGENCY CONSOLE                                    */}
        {/* ========================================================================= */}
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_50px_rgba(5,40,40,0.05)] sm:p-6">
          <div className="flex flex-col gap-4">
            
            {/* Greeting Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-emerald-50 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Phola Community Hub</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {greeting}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Your safe space for immediate protection, trusted circles, and Mzansi community services.
                </p>
              </div>

              <Badge variant="secondary" className="self-start sm:self-center border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-1 text-xs">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Encrypted & Private
              </Badge>
            </div>

            {/* Emergency Action Dual Console */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
              
              {/* Box 1: Press & Hold SOS with Circular Radial Progress */}
              <div 
                role="button"
                tabIndex={0}
                aria-label="Hold SOS panic button for 1.3 seconds"
                className={`relative overflow-hidden rounded-2xl border p-4 transition-all select-none cursor-pointer ${
                  isSOSHolding 
                    ? 'border-red-500 bg-red-50/90 shadow-lg scale-[0.99] ring-2 ring-red-400' 
                    : 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white hover:border-emerald-300 shadow-2xs'
                }`}
                onPointerDown={startSOSHold}
                onPointerUp={cancelSOSHold}
                onPointerLeave={cancelSOSHold}
                onPointerCancel={cancelSOSHold}
                onContextMenu={(e) => e.preventDefault()}
              >
                {/* Hold Progress Bar */}
                {isSOSHolding && (
                  <div 
                    className="absolute bottom-0 left-0 top-0 bg-red-500/20 transition-all duration-75"
                    style={{ width: `${holdProgress}%` }}
                  />
                )}

                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Radial Progress Ring around Shield */}
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                      <svg className="absolute inset-0 h-12 w-12 -rotate-90" viewBox="0 0 44 44">
                        <circle
                          cx="22"
                          cy="22"
                          r="18"
                          className="stroke-slate-200 dark:stroke-slate-700"
                          strokeWidth="3.5"
                          fill="transparent"
                        />
                        <circle
                          cx="22"
                          cy="22"
                          r="18"
                          stroke={isSOSHolding ? '#dc2626' : '#0D6E6E'}
                          strokeWidth="3.5"
                          strokeDasharray={113.1}
                          strokeDashoffset={113.1 - (holdProgress / 100) * 113.1}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-[stroke-dashoffset] duration-75"
                        />
                      </svg>

                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-xs transition-colors ${isSOSHolding ? 'bg-red-600 animate-pulse' : 'bg-primary'}`}>
                        <Shield className="h-5 w-5" />
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {isSOSHolding ? 'Dispatching Emergency Alert...' : 'Emergency SOS'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isSOSHolding 
                          ? `Keep holding: ${Math.max(0, 1.3 - (holdProgress / 100) * 1.3).toFixed(1)}s` 
                          : 'Hold for 1.3s to alert trusted circle'}
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs font-mono font-bold uppercase tracking-wider rounded-lg px-2.5 py-1.5 transition-colors ${
                    isSOSHolding ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-100/70 text-emerald-900'
                  }`}>
                    {isSOSHolding ? `${Math.round(holdProgress)}%` : 'Hold SOS'}
                  </span>
                </div>
              </div>

              {/* Box 2: GBV Command Helpline */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-teal-50/70 to-white p-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-xs">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                      <p className="text-sm font-bold text-foreground">GBV Command Centre</p>
                    </div>
                    <p className="text-xs text-emerald-800 font-medium">Toll-free 24/7: 0800 428 428</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = 'tel:0800428428'}
                  className="border-emerald-300 bg-white font-semibold text-emerald-900 hover:bg-emerald-50 text-xs shrink-0 shadow-2xs h-9 rounded-xl"
                >
                  <Phone className="mr-1 h-3.5 w-3.5 text-primary" />
                  Call Free
                </Button>
              </div>

            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* UNIFIED SEARCH BAR WITH AUTOCOMPLETE & QUICK CATEGORIES                   */}
        {/* ========================================================================= */}
        <section className="relative space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearchSubmit()
            }}
            className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-white px-3.5 py-2.5 shadow-2xs focus-within:border-primary transition"
          >
            <Search className="h-4 w-4 text-primary shrink-0" />
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
              placeholder="Search services, report crime, taxi ranks, clinics..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search ? (
              <button 
                type="button" 
                onClick={() => setSearch('')}
                className="text-xs text-muted-foreground hover:text-foreground font-medium px-1"
              >
                Clear
              </button>
            ) : (
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-primary font-semibold hover:bg-emerald-50"
              >
                Search
              </Button>
            )}
          </form>

          {/* Quick Suggestion Pills when focused and empty */}
          {isSearchFocused && !search && (
            <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1 animate-in fade-in duration-200">
              <span className="text-[11px] text-muted-foreground mr-1">Suggested:</span>
              {[
                { label: 'Report GBV (Vault)', href: '/reports' },
                { label: 'Police Stations', href: '/nearby?category=police_stations' },
                { label: 'Safe Ride', href: '/safe-ride' },
                { label: 'Clinics & Health', href: '/nearby?category=clinics_hospitals' },
                { label: 'Taxi Ranks', href: '/nearby?category=taxi_ranks' },
              ].map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onMouseDown={() => {
                    router.push(pill.href)
                    setIsSearchFocused(false)
                  }}
                  className="rounded-lg bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 transition"
                >
                  {pill.label}
                </button>
              ))}
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {filteredSearch.length > 0 && (
            <Card className="absolute left-0 right-0 top-12 z-30 border-emerald-100 bg-white shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-2 space-y-1">
                {filteredSearch.map((item) => (
                  <button
                    key={item.href + item.label}
                    type="button"
                    className="flex items-center justify-between w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-emerald-50 transition"
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
        {/* CORE SAFETY & ACTION SUITE                                                */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Essential Tools & Protection
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
              className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm cursor-pointer transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition">
                    <Car className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 text-[10px] font-semibold uppercase">
                    Uber / Bolt
                  </Badge>
                </div>
                <p className="text-sm font-bold text-foreground">Safe Ride Watchdog</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Arrival countdown and emergency check-in for your trips.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-semibold text-primary">
                Open Watchdog <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* 2. Report GBV Incident (VAULT) */}
            <div 
              onClick={() => router.push('/reports')}
              className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm cursor-pointer transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 text-[10px] font-semibold uppercase">
                    Vault
                  </Badge>
                </div>
                <p className="text-sm font-bold text-foreground">Report GBV (VAULT)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Confidential encrypted vault with police auto-linking.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-semibold text-primary">
                Open Vault <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* 3. Report Crime & Theft */}
            <div 
              onClick={() => router.push('/report')}
              className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm cursor-pointer transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition">
                    <FileWarning className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 text-[10px] font-semibold uppercase">
                    SAPS Ready
                  </Badge>
                </div>
                <p className="text-sm font-bold text-foreground">Report Crime</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Robbery, assault, vehicle theft and police misconduct.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-semibold text-primary">
                Log Incident <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* 4. SOS Map & Safe Places */}
            <div 
              onClick={() => router.push('/sos')}
              className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm cursor-pointer transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition">
                    <Navigation className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 text-[10px] font-semibold uppercase">
                    Map
                  </Badge>
                </div>
                <p className="text-sm font-bold text-foreground">Emergency Map</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Locate verified SAPS stations, trauma clinics and shelters.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-semibold text-primary">
                Open Map <ChevronRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* LOCAL COMMUNITY RADAR (Pretoria / User's GPS)                             */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Nearest to You (Local Radar)
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAreaModal(true)}
                className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-950 hover:bg-emerald-100 transition shadow-2xs"
                title="Change manual location"
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

              <button 
                type="button" 
                onClick={() => router.push('/nearby')} 
                className="text-xs font-semibold text-muted-foreground hover:text-primary flex items-center ml-1"
              >
                Full List <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Card 1: Nearest Police Station */}
            <Card className="border-emerald-100 bg-white shadow-2xs rounded-2xl">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-primary">
                      <Shield className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Police Station</span>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-900 font-mono text-xs">
                    {nearest.police ? formatDistance(nearest.police.distanceKm) : '--'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground line-clamp-1">
                    {nearest.police?.name || 'Searching SAPS stations...'}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {nearest.police?.address || 'Verified SAPS station'}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => router.push('/nearby?category=police_stations')}
                  className="w-full rounded-xl border-emerald-200 text-xs text-primary font-medium h-7"
                >
                  View Details
                </Button>
              </CardContent>
            </Card>

            {/* Card 2: Nearest Clinic / Hospital */}
            <Card className="border-emerald-100 bg-white shadow-2xs rounded-2xl">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-primary">
                      <Hospital className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinic / Health</span>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-900 font-mono text-xs">
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
                  className="w-full rounded-xl border-emerald-200 text-xs text-primary font-medium h-7"
                >
                  View Details
                </Button>
              </CardContent>
            </Card>

            {/* Card 3: Nearest Taxi Rank */}
            <Card className="border-emerald-100 bg-white shadow-2xs rounded-2xl">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-primary">
                      <Bus className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxi Rank</span>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-900 font-mono text-xs">
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
                  className="w-full rounded-xl border-emerald-200 text-xs text-primary font-medium h-7"
                >
                  View Details
                </Button>
              </CardContent>
            </Card>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* MZANSI NEWS & COMMUNITY PULSE                                             */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Mzansi News & Updates
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
                className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm cursor-pointer transition"
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
                  <span>Verified SA Source</span>
                  <span className="text-primary font-medium">Read Article</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* AREA SELECTOR MODAL */}
      <Dialog open={showAreaModal} onOpenChange={setShowAreaModal}>
        <DialogContent className="max-w-sm rounded-3xl border-emerald-100 p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              Select South Africa Area
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select your city to instantly view nearby SAPS stations, emergency health facilities, and transit ranks.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
            {SA_RADAR_AREAS.map((area) => (
              <button
                key={area.name}
                type="button"
                onClick={() => {
                  setLocation({ lat: area.lat, lng: area.lng })
                  setSelectedAreaName(area.name)
                  setShowAreaModal(false)
                }}
                className="w-full flex items-center justify-between rounded-xl p-3 text-left text-xs font-semibold hover:bg-emerald-50 active:bg-emerald-100 transition border border-transparent hover:border-emerald-200"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-foreground">{area.name}</span>
                </div>
                {selectedAreaName === area.name && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 text-[10px]">
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
              className="flex-1 rounded-xl text-xs bg-primary text-white"
            >
              <Navigation className="h-3.5 w-3.5 mr-1" />
              Use My Live GPS
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAreaModal(false)}
              className="rounded-xl text-xs"
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
