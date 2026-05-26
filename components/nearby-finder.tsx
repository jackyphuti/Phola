'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, Navigation, Building2, Star, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppBottomNav } from '@/components/app-bottom-nav'

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

function getCacheKey(category: NearbyCategory): string {
  return `nearby-cache-${category}`
}

export function NearbyFinder() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCategory = (searchParams.get('category') as NearbyCategory) || 'taxi_ranks'

  const [category, setCategory] = useState<NearbyCategory>(initialCategory)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<NearbyResult[]>([])
  const [source, setSource] = useState('')

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
    const cachedRaw = typeof window !== 'undefined' ? window.localStorage.getItem(getCacheKey(category)) : null
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as { results: NearbyResult[]; source: string }
        if (Array.isArray(cached.results)) {
          setResults(cached.results)
          setSource(`${cached.source} (cached)`)
        }
      } catch {
        // ignore cache parse errors
      }
    }
  }, [category])

  useEffect(() => {
    if (!location) return

    const fetchResults = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/nearby?lat=${location.lat}&lng=${location.lng}&category=${category}`)
        const data = await response.json()
        const nextResults = Array.isArray(data?.results) ? data.results : []

        setResults(nextResults)
        setSource(data?.source || 'unknown')

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(getCacheKey(category), JSON.stringify({
            results: nextResults,
            source: data?.source || 'unknown',
            ts: Date.now(),
          }))
        }
      } catch {
        // Keep cached results if available.
      } finally {
        setIsLoading(false)
      }
    }

    void fetchResults()
  }, [location, category])

  const categoryLabel = useMemo(() => categories.find((item) => item.value === category)?.label || 'Nearby', [category])

  const openDirections = (result: NearbyResult, app: 'google' | 'waze') => {
    const destination = `${result.location.lat},${result.location.lng}`
    if (app === 'waze') {
      window.open(`https://waze.com/ul?ll=${destination}&navigate=yes`, '_blank', 'noopener,noreferrer')
      return
    }
    const origin = location ? `${location.lat},${location.lng}` : ''
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-[#ECE9E4] pb-24 safe-top safe-bottom">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4">
        <section className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Nearby</h1>
            <p className="text-sm text-muted-foreground">Find services around you quickly</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>Back Home</Button>
        </section>

        <section className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={item.value === category ? 'default' : 'outline'}
              className="shrink-0"
              onClick={() => setCategory(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </section>

        <section>
          <Card>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{categoryLabel}</p>
                <p className="text-xs text-muted-foreground">Source: {source || 'loading'}{isLoading ? ' • updating...' : ''}</p>
              </div>
              <MapPin className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-2">
          {results.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                No places yet. Enable location to load nearby results.
              </CardContent>
            </Card>
          ) : (
            results.map((result) => (
              <Card key={result.id} className="border-[#D4D6DA] bg-[#262A2F]">
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#F2F3F5]">{result.name}</p>
                      <p className="text-xs text-[#BFC4CC]">{result.address || 'Address unavailable'}</p>
                    </div>
                    <div className="text-sm font-semibold text-[#F97316]">{formatDistance(result.distanceKm)}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#BFC4CC]">
                    {typeof result.rating === 'number' && (
                      <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{result.rating.toFixed(1)}</span>
                    )}
                    {typeof result.openNow === 'boolean' && (
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{result.openNow ? 'Open now' : 'Closed now'}</span>
                    )}
                    <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />Local result</span>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 bg-[#F97316] hover:bg-[#EA6B0A] text-white" onClick={() => openDirections(result, 'google')}>
                      <Navigation className="mr-2 h-4 w-4" />Google Maps
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => openDirections(result, 'waze')}>
                      <Navigation className="mr-2 h-4 w-4" />Waze
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
