'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Zap, ShieldAlert, Bus, Store, Newspaper, Briefcase, Hospital, Shield, FileWarning, CircleDot } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { loadLanguagePreference } from '@/lib/locale-storage'
import { createClient } from '@/lib/supabase/client'
import { notifySOSActivated, scheduleLoadsheddingReminder, subscribeForProductionPush, triggerLoadsheddingPushEvent } from '@/lib/push-notifications'

type NewsItem = {
  title: string
  source: string
  url: string
  category: string
}

type NearbyItem = {
  name: string
  distanceKm: number
  address?: string
}

type LoadsheddingInfo = {
  areaName: string
  stage: string
  nextOutage: string | null
  nextRestore: string | null
  source: 'eskomsepush' | 'fallback'
}

const quickActions = [
  { label: 'Report GBV', href: '/report', icon: ShieldAlert },
  { label: 'Report Crime', href: '/report', icon: FileWarning },
  { label: 'Taxi Ranks', href: '/nearby?category=taxi_ranks', icon: Bus },
  { label: 'Nearby Shops', href: '/nearby?category=malls_shops', icon: Store },
  { label: 'SA News', href: '/news', icon: Newspaper },
  { label: 'Jobs', href: '/jobs', icon: Briefcase },
  { label: 'Loadshedding', href: '/loadshedding', icon: Zap },
  { label: 'Clinics', href: '/nearby?category=clinics_hospitals', icon: Hospital },
]

const searchIndex = [
  { label: 'Report GBV', href: '/report' },
  { label: 'Report Crime', href: '/report' },
  { label: 'Taxi Ranks', href: '/nearby?category=taxi_ranks' },
  { label: 'Nearby Shops', href: '/nearby?category=malls_shops' },
  { label: 'Clinics & Hospitals', href: '/nearby?category=clinics_hospitals' },
  { label: 'Police Stations', href: '/nearby?category=police_stations' },
  { label: 'SA News', href: '/news' },
  { label: 'My Reports', href: '/notes' },
  { label: 'Safety', href: '/safety' },
  { label: 'Profile Settings', href: '/settings' },
]

function getGreetingByLanguage(language: string, name: string): string {
  if (language === 'zu') return `Sawubona ${name}`
  if (language === 'af') return `Hoe gaan dit, ${name}`
  if (language === 'nso' || language === 'tn' || language === 'st') return `Dumela ${name}`
  return `Hello ${name}`
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function SuperHome({ name }: { name: string }) {
  const router = useRouter()
  const supabase = createClient()
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [language, setLanguage] = useState('en')
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [loadshedding, setLoadshedding] = useState<LoadsheddingInfo | null>(null)
  const [nearest, setNearest] = useState<{ taxi?: NearbyItem; shop?: NearbyItem; clinic?: NearbyItem }>({})
  const [isSOSHolding, setIsSOSHolding] = useState(false)

  useEffect(() => {
    void loadLanguagePreference().then((value) => setLanguage(value))
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setLocation(null)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }, [])

  useEffect(() => {
    void fetch('/api/news?category=top&limit=6')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.items)) {
          setNews(data.items)
        }
      })
      .catch(() => setNews([]))
  }, [])

  useEffect(() => {
    if (!location) return

    void fetch(`/api/loadshedding?lat=${location.lat}&lng=${location.lng}`)
      .then((res) => res.json())
      .then((data) => {
        const parsed = data as LoadsheddingInfo
        setLoadshedding(parsed)
        void scheduleLoadsheddingReminder({
          areaName: parsed.areaName,
          stage: parsed.stage,
          nextOutage: parsed.nextOutage,
        })
        void triggerLoadsheddingPushEvent({
          areaName: parsed.areaName,
          stage: parsed.stage,
          nextOutage: parsed.nextOutage,
        })
      })
      .catch(() => setLoadshedding(null))

    const fetchSummary = async () => {
      const [taxiRes, shopRes, clinicRes] = await Promise.all([
        fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&category=taxi_ranks`).then((res) => res.json()),
        fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&category=malls_shops`).then((res) => res.json()),
        fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&category=clinics_hospitals`).then((res) => res.json()),
      ])

      setNearest({
        taxi: taxiRes?.results?.[0],
        shop: shopRes?.results?.[0],
        clinic: clinicRes?.results?.[0],
      })
    }

    void fetchSummary()
  }, [location])

  const filteredSearch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return searchIndex.filter((entry) => entry.label.toLowerCase().includes(q)).slice(0, 6)
  }, [search])

  const triggerTrustedCirclePing = async () => {
    if (!location) {
      router.push('/sos')
      return
    }

    try {
      const { data } = await supabase
        .from('emergency_contacts')
        .select('phone, is_primary, created_at')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)

      const phone = data?.[0]?.phone
      const mapsLink = `https://maps.google.com/?q=${location.lat},${location.lng}`
      const message = `Emergency alert. I need help. My live location: ${mapsLink}`

      if (phone) {
        window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`
      } else if (navigator.share) {
        await navigator.share({
          title: 'Emergency SOS',
          text: message,
        })
      } else {
        router.push('/sos')
      }
    } catch {
      router.push('/sos')
    }
  }

  const startSOSHold = () => {
    setIsSOSHolding(true)
    holdTimer.current = setTimeout(() => {
      setIsSOSHolding(false)
      void triggerTrustedCirclePing()
      void notifySOSActivated()
      if (navigator.vibrate) navigator.vibrate([120, 80, 120])
    }, 1200)
  }

  const cancelSOSHold = () => {
    setIsSOSHolding(false)
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  useEffect(() => {
    void subscribeForProductionPush()
  }, [])

  return (
    <div className="min-h-screen bg-[#ECE9E4] pb-24 safe-top safe-bottom">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        <section>
          <h1 className="text-2xl font-semibold text-[#1F2125]">{getGreetingByLanguage(language, name || 'friend')}</h1>
          <p className="text-sm text-[#525760]">Your Mzansi community super app</p>
        </section>

        <section className="relative">
          <div className="flex items-center gap-2 rounded-2xl border border-[#D8D2C8] bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-[#6D7078]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shops, news, taxi ranks, reports"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {filteredSearch.length > 0 && (
            <Card className="absolute left-0 right-0 top-12 z-30 border-[#D8D2C8] bg-white">
              <CardContent className="p-2">
                <div className="space-y-1">
                  {filteredSearch.map((item) => (
                    <button
                      key={item.href + item.label}
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent/40"
                      onClick={() => router.push(item.href)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <section>
          <Card className="border border-[#F0B56A]/50 bg-[#FCE7CE]">
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-semibold text-[#5A3A16]">
                  {loadshedding?.stage || 'Loadshedding status unavailable'}
                </p>
                <p className="text-xs text-[#755334]">
                  {loadshedding?.areaName || 'South Africa'}
                  {loadshedding?.nextOutage ? ` • Next outage: ${new Date(loadshedding.nextOutage).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/loadshedding')}>
                <Zap className="mr-1 h-4 w-4" />
                View
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border border-[#F06A48]/45 bg-[#FFE3DB]">
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-semibold text-[#6F2417]">Emergency SOS</p>
                <p className="text-xs text-[#8A3A2A]">Press and hold to alert trusted circle</p>
              </div>
              <Button
                className={`min-w-[128px] ${isSOSHolding ? 'animate-pulse bg-destructive' : 'bg-destructive'}`}
                onMouseDown={startSOSHold}
                onMouseUp={cancelSOSHold}
                onMouseLeave={cancelSOSHold}
                onTouchStart={startSOSHold}
                onTouchEnd={cancelSOSHold}
              >
                <Shield className="mr-2 h-4 w-4" />
                Hold SOS
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => router.push(action.href)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-[#D4D6DA] bg-[#22252A] px-2 py-3 text-center hover:bg-[#2B2F35]"
                >
                  <Icon className="h-5 w-5 text-[#F97316]" />
                  <span className="text-[11px] leading-tight text-[#EDEFF2]">{action.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1F2125]">Live SA news</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/news')}>More</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {news.slice(0, 4).map((item) => (
              <button
                key={item.url}
                type="button"
                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                className="rounded-2xl border border-[#D4D6DA] bg-[#25282D] p-3 text-left hover:bg-[#2C3137]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#F97316]">{item.source}</p>
                <p className="line-clamp-2 text-sm font-medium text-[#EEF0F2]">{item.title}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#F1F2F4]">Nearest to you</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/nearby')}>View map</Button>
          </div>
          <div className="space-y-2">
            {[{ label: 'Taxi Rank', item: nearest.taxi }, { label: 'Shop', item: nearest.shop }, { label: 'Clinic', item: nearest.clinic }].map((entry) => (
              <Card key={entry.label} className="border-[#D4D6DA] bg-[#262A2F]">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F2F3F5]">{entry.item?.name || entry.label}</p>
                    <p className="text-xs text-[#BFC4CC]">{entry.item?.address || 'Location info loading...'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#F97316]">
                    <CircleDot className="h-4 w-4" />
                    {entry.item ? formatDistance(entry.item.distanceKm) : '--'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <AppBottomNav />
    </div>
  )
}
