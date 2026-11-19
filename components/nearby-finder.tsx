'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, Navigation, Building2, Star, Clock, RefreshCw, Search, X, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { getReliableLocation, getCachedLocation, DEFAULT_SOUTH_AFRICA_LOCATION } from '@/lib/geolocation'
import { getApiUrl } from '@/lib/api-client'

type NearbyCategory =
  | 'taxi_ranks'
  | 'malls_shops'
  | 'clinics_hospitals'
  | 'police_stations'
  | 'schools'
  | 'spaza_shops'
  | 'petrol_stations'
  | 'shelters_ngos'
  | 'banks_atms'
  | 'post_offices'

type NearbyResult = {
  id: string
  name: string
  distanceKm: number
  address?: string
  rating?: number
  openNow?: boolean
  location: { lat: number; lng: number }
}

const categories: Array<{ value: NearbyCategory; label: string }> = [
  { value: 'taxi_ranks', label: 'Taxi ranks' },
  { value: 'malls_shops', label: 'Malls & shops' },
  { value: 'clinics_hospitals', label: 'Clinics & hospitals' },
  { value: 'police_stations', label: 'Police stations' },
  { value: 'schools', label: 'Schools' },
  { value: 'spaza_shops', label: 'Spaza shops' },
  { value: 'petrol_stations', label: 'Petrol stations' },
  { value: 'shelters_ngos', label: 'Shelters & NGOs' },
  { value: 'banks_atms', label: 'Banks & ATMs' },
  { value: 'post_offices', label: 'Post offices' },
]

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function getCacheKey(category: NearbyCategory, lat: number, lng: number): string {
  return `nearby-v2-${category}-${lat.toFixed(2)}-${lng.toFixed(2)}`
}

function inferCategoryFromQuery(q: string): NearbyCategory | null {
  const lower = q.toLowerCase().trim()
  if (!lower) return null
  if (lower.includes('saps') || lower.includes('police') || lower.includes('station')) return 'police_stations'
  if (lower.includes('clinic') || lower.includes('hospital') || lower.includes('doctor') || lower.includes('medical') || lower.includes('health')) return 'clinics_hospitals'
  if (lower.includes('taxi') || lower.includes('rank') || lower.includes('gautrain') || lower.includes('bus')) return 'taxi_ranks'
  if (lower.includes('shelter') || lower.includes('gbv') || lower.includes('ngo') || lower.includes('haven')) return 'shelters_ngos'
  if (lower.includes('bank') || lower.includes('atm')) return 'banks_atms'
  if (lower.includes('school') || lower.includes('campus') || lower.includes('university')) return 'schools'
  if (lower.includes('petrol') || lower.includes('garage') || lower.includes('fuel')) return 'petrol_stations'
  if (lower.includes('spaza') || lower.includes('tuck')) return 'spaza_shops'
  if (lower.includes('post office')) return 'post_offices'
  if (lower.includes('mall') || lower.includes('shop') || lower.includes('store')) return 'malls_shops'
  return null
}

export function NearbyFinder() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryParam = searchParams.get('q') || ''
  const categoryParam = searchParams.get('category') as NearbyCategory | null
  const initialCategory: NearbyCategory =
    categoryParam || inferCategoryFromQuery(queryParam) || 'police_stations'

  const [category, setCategory] = useState<NearbyCategory>(initialCategory)
  const [searchQuery, setSearchQuery] = useState(queryParam)
  const [location, setLocation] = useState<{ lat: number; lng: number }>(() => {
    return getCachedLocation() || DEFAULT_SOUTH_AFRICA_LOCATION
  })
  const [isLocationReady, setIsLocationReady] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [results, setResults] = useState<NearbyResult[]>([])
  const [source, setSource] = useState('')

  useEffect(() => {
    const nextCat = searchParams.get('category') as NearbyCategory | null
    const nextQ = searchParams.get('q') || ''
    if (nextCat && categories.some((c) => c.value === nextCat)) {
      setCategory(nextCat)
    } else if (nextQ) {
      const inferred = inferCategoryFromQuery(nextQ)
      if (inferred) setCategory(inferred)
    }
    if (nextQ) {
      setSearchQuery(nextQ)
    }
  }, [searchParams])

  const refreshLocation = () => {
    setIsLoading(true)
    void getReliableLocation().then((loc) => {
      if (loc) {
        setLocation(loc)
      }
      setIsLocationReady(true)
    })
  }

  useEffect(() => {
    let isMounted = true
    const cachedLoc = getCachedLocation()
    if (cachedLoc) {
      setLocation(cachedLoc)
    }

    void getReliableLocation().then((loc) => {
      if (!isMounted) return
      if (loc) {
        setLocation(loc)
      }
      setIsLocationReady(true)
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isLocationReady) return

    let isMounted = true
    const cacheKey = getCacheKey(category, location.lat, location.lng)

    // 1. Load location-specific cache immediately if available (< 30 mins old)
    if (typeof window !== 'undefined') {
      const cachedRaw = window.localStorage.getItem(cacheKey)
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as { results: NearbyResult[]; source: string; ts?: number }
          const isFresh = !cached.ts || Date.now() - cached.ts < 30 * 60 * 1000
          if (isFresh && Array.isArray(cached?.results) && cached.results.length > 0) {
            setResults(cached.results)
            setSource(`${cached.source} (cached)`)
          }
        } catch {
          window.localStorage.removeItem(cacheKey)
        }
      }
    }

    // 2. Fetch fresh results for the resolved GPS coordinates
    const fetchResults = async () => {
      setIsLoading(true)
      try {
        const url = getApiUrl(`/api/nearby?lat=${location.lat}&lng=${location.lng}&category=${category}`)
        const response = await fetch(url, { cache: 'no-store' })
        const data = await response.json()
        const nextResults = Array.isArray(data?.results) ? data.results : []

        if (!isMounted) return

        setResults(nextResults)
        setSource(data?.source || 'live')

        if (typeof window !== 'undefined' && nextResults.length > 0) {
          try {
            window.localStorage.setItem(
              cacheKey,
              JSON.stringify({
                results: nextResults,
                source: data?.source || 'live',
                ts: Date.now(),
              })
            )
          } catch {
            // ignore quota
          }
        }
      } catch {
        // Keep cached results if available
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void fetchResults()

    return () => {
      isMounted = false
    }
  }, [location, category, isLocationReady])

  const categoryLabel = useMemo(() => categories.find((item) => item.value === category)?.label || 'Nearby', [category])

  const filteredResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return results
    // If query is just the category name itself (e.g. "saps" or "police"), return all unless filtering specific station name
    const matches = results.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.address && item.address.toLowerCase().includes(q))
    )
    return matches.length > 0 ? matches : results
  }, [results, searchQuery])

  const openDirections = (result: NearbyResult, app: 'directions' | 'waze' | 'inapp') => {
    if (app === 'inapp') {
      router.push('/sos')
      return
    }
    const destination = `${result.location.lat},${result.location.lng}`
    if (app === 'waze') {
      window.open(`https://waze.com/ul?ll=${destination}&navigate=yes`, '_blank', 'noopener,noreferrer')
      return
    }
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile) {
      window.location.href = `geo:${destination}?q=${destination}(${encodeURIComponent(result.name)})`
    } else {
      const origin = location ? `${location.lat}%2C${location.lng}` : ''
      window.open(
        `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin}%3B${result.location.lat}%2C${result.location.lng}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_45%,#f6fbf8_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-4 shadow-sm sm:p-5 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Nearby services</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Find SAPS stations, clinics, taxi ranks & essential services.</h1>
              <p className="mt-2 text-sm text-muted-foreground">Results are tailored to your location ({location.lat.toFixed(3)}, {location.lng.toFixed(3)}).</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl" onClick={refreshLocation} disabled={isLoading}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh GPS
              </Button>
              <Button variant="outline" size="sm" className="border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl" onClick={() => router.push('/dashboard')}>Back Home</Button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-primary" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value
                setSearchQuery(val)
                const inferred = inferCategoryFromQuery(val)
                if (inferred && inferred !== category) {
                  setCategory(inferred)
                }
              }}
              placeholder="Filter nearby places by name, suburb (e.g. Hatfield, Brooklyn, SAPS)..."
              className="pl-10 pr-9 h-10 rounded-xl border-emerald-200 bg-emerald-50/30 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-muted-foreground hover:text-foreground p-1 rounded-full"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </section>

        <section className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={item.value === category ? 'default' : 'outline'}
              className={`shrink-0 rounded-full ${item.value === category ? 'bg-primary text-white shadow-sm' : 'border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50'}`}
              onClick={() => setCategory(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </section>

        <section>
          <Card className="border-emerald-100 bg-white shadow-sm">
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{categoryLabel} ({filteredResults.length})</p>
                <p className="text-xs text-muted-foreground">
                  Source: {!isLocationReady ? 'detecting GPS location...' : source || 'loading'}
                  {isLoading ? ' • updating...' : ''}
                </p>
              </div>
              <MapPin className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-2">
          {filteredResults.length === 0 && !isLoading ? (
            <Card className="border-emerald-100 bg-white shadow-sm">
              <CardContent className="p-4 text-sm text-muted-foreground">
                No places found for this category nearby.
              </CardContent>
            </Card>
          ) : (
            filteredResults.map((result) => (
              <Card key={result.id} className="border-emerald-100 bg-white shadow-sm">
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{result.name}</p>
                      <p className="text-xs text-muted-foreground">{result.address || 'Address unavailable'}</p>
                    </div>
                    <div className="text-sm font-semibold text-primary">{formatDistance(result.distanceKm)}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {typeof result.rating === 'number' && (
                      <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{result.rating.toFixed(1)}</span>
                    )}
                    {typeof result.openNow === 'boolean' && (
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{result.openNow ? 'Open now' : 'Closed now'}</span>
                    )}
                    <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />Local result</span>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 bg-primary text-white shadow-sm hover:bg-primary/90 text-xs rounded-xl" onClick={() => openDirections(result, 'inapp')}>
                      <Shield className="mr-1.5 h-3.5 w-3.5" />In-App Map
                    </Button>
                    <Button variant="outline" className="flex-1 border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50 text-xs rounded-xl" onClick={() => openDirections(result, 'directions')}>
                      <Navigation className="mr-1.5 h-3.5 w-3.5" />Directions
                    </Button>
                    <Button variant="outline" className="flex-1 border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50 text-xs rounded-xl" onClick={() => openDirections(result, 'waze')}>
                      <Navigation className="mr-1.5 h-3.5 w-3.5" />Waze
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </main>

      <AppBottomNav />
    </div>
  )
}
