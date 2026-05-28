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

  useEffect(() => {
    if (!location) return

    void fetch(`/api/loadshedding?lat=${location.lat}&lng=${location.lng}`)
      .then((res) => {
        if (!res.ok) throw new Error('Loadshedding request failed')
        return res.json()
      })
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
      const [taxiRes, shopRes, clinicRes] = await Promise.allSettled([
        fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&category=taxi_ranks`).then(async (res) => {
          if (!res.ok) throw new Error('Taxi ranks request failed')
          return res.json()
        }),
        fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&category=malls_shops`).then(async (res) => {
          if (!res.ok) throw new Error('Nearby shops request failed')
          return res.json()
        }),
        fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&category=clinics_hospitals`).then(async (res) => {
          if (!res.ok) throw new Error('Clinics request failed')
          return res.json()
        }),
      ])

      setNearest({
        taxi: taxiRes.status === 'fulfilled' ? taxiRes.value?.results?.[0] : undefined,
        shop: shopRes.status === 'fulfilled' ? shopRes.value?.results?.[0] : undefined,
        clinic: clinicRes.status === 'fulfilled' ? clinicRes.value?.results?.[0] : undefined,
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
        return
      }

      if (navigator.share) {
        await navigator.share({
          title: 'Emergency SOS',
          text: message,
        })
        return
      }

      router.push('/sos')
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.09),_transparent_36%),linear-gradient(180deg,#f6fffb_0%,#ffffff_44%,#f7fbf9_100%)] pb-24 safe-top safe-bottom">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_60px_rgba(5,40,40,0.06)] sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Phola home</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{getGreetingByLanguage(language, name || 'friend')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Your Mzansi community super app</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Safety, news, nearby services, and quick actions in one place.
            </div>
          </div>
        </section>

        <section className="relative">
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-3 py-3 shadow-sm">
            <Search className="h-4 w-4 text-primary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shops, news, taxi ranks, reports"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {filteredSearch.length > 0 && (
            <Card className="absolute left-0 right-0 top-14 z-30 border-emerald-100 bg-white shadow-lg">
              <CardContent className="p-2">
                <div className="space-y-1">
                  {filteredSearch.map((item) => (
                    <button
                      key={item.href + item.label}
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-emerald-50"
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
          <Card className="border border-emerald-100 bg-emerald-50/70">
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-semibold text-emerald-950">
                  {loadshedding?.stage || 'Loadshedding status unavailable'}
                </p>
                <p className="text-xs text-emerald-800">
                  {loadshedding?.areaName || 'South Africa'}
                  {loadshedding?.nextOutage ? ` • Next outage: ${new Date(loadshedding.nextOutage).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" className="border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50" onClick={() => router.push('/loadshedding')}>
                <Zap className="mr-1 h-4 w-4" />
                View
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border border-emerald-100 bg-white shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Emergency SOS</p>
                <p className="text-xs text-muted-foreground">Press and hold to alert trusted circle</p>
              </div>
              <Button
                className={`min-w-[128px] ${isSOSHolding ? 'animate-pulse bg-primary shadow-lg shadow-primary/20' : 'bg-primary'}`}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => router.push(action.href)}
                  className="flex min-h-24 flex-col items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-3 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-xs leading-tight text-foreground">{action.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Live SA news</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/news')}>More</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {news.slice(0, 4).map((item) => (
              <button
                key={item.url}
                type="button"
                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                className="rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{item.source}</p>
                <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Nearest to you</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/nearby')}>View map</Button>
          </div>
          <div className="space-y-2">
            {[{ label: 'Taxi Rank', item: nearest.taxi }, { label: 'Shop', item: nearest.shop }, { label: 'Clinic', item: nearest.clinic }].map((entry) => (
              <Card key={entry.label} className="border-emerald-100 bg-white shadow-sm">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{entry.item?.name || entry.label}</p>
                    <p className="text-xs text-muted-foreground">{entry.item?.address || 'Location info loading...'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
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
