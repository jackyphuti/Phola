import { captureException } from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/api'
import { getNearbySAPSStations, getNearbyMalls, getNearbyHospitals } from '@/lib/saps-stations'

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

interface PlaceResult {
  id: string
  name: string
  distanceKm: number
  address?: string
  rating?: number
  openNow?: boolean
  location: { lat: number; lng: number }
}

const TAXI_RANKS = [
  { id: 'noord', name: 'Noord Taxi Rank', lat: -26.1976, lng: 28.0439, address: 'Noord Street, Johannesburg' },
  { id: 'park-station', name: 'Park Station Taxi Rank', lat: -26.2049, lng: 28.0406, address: 'Rissik Street, Johannesburg' },
  { id: 'bree', name: 'Bree Street Taxi Rank', lat: -26.201, lng: 28.0356, address: 'Bree Street, Johannesburg' },
  { id: 'bosman', name: 'Bosman Station Taxi Rank', lat: -25.7522, lng: 28.1882, address: 'Bosman Street, Pretoria' },
  { id: 'durban-workshop', name: 'Durban Workshop Taxi Rank', lat: -29.8587, lng: 31.0218, address: 'Durban Central' },
  { id: 'cape-town-station', name: 'Cape Town Station Taxi Rank', lat: -33.922, lng: 18.4231, address: 'Cape Town CBD' },
]

const ALLOWED_CATEGORIES: NearbyCategory[] = [
  'taxi_ranks',
  'malls_shops',
  'clinics_hospitals',
  'police_stations',
  'schools',
  'spaza_shops',
  'petrol_stations',
  'shelters_ngos',
  'banks_atms',
  'post_offices',
]

const DEFAULT_LAT = -26.2041
const DEFAULT_LNG = 28.0473
const REQUEST_TIMEOUT_MS = 3800

interface CacheEntry {
  data: PlaceResult[]
  source: string
  timestamp: number
}
const serverNearbyCache = new Map<string, CacheEntry>()

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

function parseCoordinate(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min || value > max) {
    return fallback
  }

  return value
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timeout)
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function sortByDistance(items: PlaceResult[]): PlaceResult[] {
  return items.sort((a, b) => a.distanceKm - b.distanceKm)
}

function getCuratedFallbacks(category: NearbyCategory, lat: number, lng: number): PlaceResult[] {
  if (category === 'taxi_ranks') {
    return sortByDistance(
      TAXI_RANKS.map((rank) => ({
        id: rank.id,
        name: rank.name,
        address: rank.address,
        location: { lat: rank.lat, lng: rank.lng },
        distanceKm: haversineKm(lat, lng, rank.lat, rank.lng),
      }))
    ).slice(0, 20)
  }

  if (category === 'police_stations') {
    return getNearbySAPSStations(lat, lng, 15).map((station) => ({
      id: station.code,
      name: station.name,
      address: `${station.province}, South Africa${station.phone ? ` • Tel: ${station.phone}` : ''}`,
      location: { lat: station.lat, lng: station.lng },
      distanceKm: station.distanceKm,
    }))
  }

  if (category === 'malls_shops') {
    return getNearbyMalls(lat, lng, 15).map((mall) => ({
      id: mall.id,
      name: mall.name,
      address: mall.address,
      location: { lat: mall.lat, lng: mall.lng },
      distanceKm: mall.distanceKm,
    }))
  }

  if (category === 'clinics_hospitals') {
    return getNearbyHospitals(lat, lng, 15).map((hospital) => ({
      id: hospital.id,
      name: hospital.name,
      address: `${hospital.address}${hospital.phone ? ` • Tel: ${hospital.phone}` : ''}`,
      location: { lat: hospital.lat, lng: hospital.lng },
      distanceKm: hospital.distanceKm,
    }))
  }

  return []
}

function buildOverpassQuery(lat: number, lng: number, category: NearbyCategory, radius = 12000): string {
  const parts: string[] = []

  switch (category) {
    case 'malls_shops':
      parts.push(`nwr["shop"~"mall|shopping_centre|supermarket|department_store"](around:${radius},${lat},${lng});`)
      parts.push(`nwr["amenity"="marketplace"](around:${radius},${lat},${lng});`)
      break
    case 'police_stations':
      parts.push(`nwr["amenity"="police"](around:${radius},${lat},${lng});`)
      break
    case 'clinics_hospitals':
      parts.push(`nwr["amenity"~"hospital|clinic|doctors|pharmacy"](around:${radius},${lat},${lng});`)
      break
    case 'schools':
      parts.push(`nwr["amenity"="school"](around:${radius},${lat},${lng});`)
      break
    case 'petrol_stations':
      parts.push(`nwr["amenity"="fuel"](around:${radius},${lat},${lng});`)
      break
    case 'banks_atms':
      parts.push(`nwr["amenity"~"bank|atm"](around:${radius},${lat},${lng});`)
      break
    case 'post_offices':
      parts.push(`nwr["amenity"="post_office"](around:${radius},${lat},${lng});`)
      break
    case 'spaza_shops':
      parts.push(`nwr["shop"="convenience"](around:${radius},${lat},${lng});`)
      parts.push(`nwr["name"~"spaza|tuck shop",i](around:${radius},${lat},${lng});`)
      break
    case 'shelters_ngos':
      parts.push(`nwr["amenity"~"social_facility|shelter"](around:${radius},${lat},${lng});`)
      parts.push(`nwr["name"~"shelter|crisis|haven|care",i](around:${radius},${lat},${lng});`)
      break
    default:
      break
  }

  if (parts.length === 0) return ''
  // Use 180 instead of 40 so Overpass doesn't truncate closest nodes before distance sorting
  return `[out:json][timeout:12];(${parts.join('')});out center 180;`
}

function mergeAndDeduplicate(liveResults: PlaceResult[], curatedResults: PlaceResult[]): PlaceResult[] {
  const combined = [...liveResults]
  for (const curated of curatedResults) {
    const isDuplicate = combined.some(
      (item) =>
        item.name.toLowerCase() === curated.name.toLowerCase() ||
        haversineKm(item.location.lat, item.location.lng, curated.location.lat, curated.location.lng) < 0.25
    )
    if (!isDuplicate) {
      combined.push(curated)
    }
  }
  return sortByDistance(combined).slice(0, 30)
}

async function fetchFromOverpass(lat: number, lng: number, category: NearbyCategory): Promise<PlaceResult[]> {
  if (category === 'taxi_ranks') {
    return getCuratedFallbacks('taxi_ranks', lat, lng)
  }

  const query = buildOverpassQuery(lat, lng, category, 12000)
  if (!query) {
    return getCuratedFallbacks(category, lat, lng)
  }

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PholaSafetyApp/1.0 (https://phola.co.za; contact@phola.co.za)',
        },
      })

      if (!response.ok) {
        continue
      }

      const data = await response.json()
      const elements = Array.isArray(data?.elements) ? data.elements : []

      const parsed = sortByDistance(
        elements
          .map((item: { id?: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> }) => {
            const placeLat = item.lat ?? item.center?.lat
            const placeLng = item.lon ?? item.center?.lon
            if (typeof placeLat !== 'number' || typeof placeLng !== 'number') return null

            const name = item.tags?.name || item.tags?.['name:en'] || item.tags?.operator || item.tags?.shop || item.tags?.amenity || 'Nearby Place'
            const street = item.tags?.['addr:street'] || item.tags?.['addr:housenumber'] || ''
            const suburb = item.tags?.['addr:suburb'] || item.tags?.['addr:city'] || ''
            const address = [street, suburb].filter(Boolean).join(', ') || undefined

            return {
              id: String(item.id || `${placeLat}-${placeLng}`),
              name,
              address,
              location: { lat: placeLat, lng: placeLng },
              distanceKm: haversineKm(lat, lng, placeLat, placeLng),
            } satisfies PlaceResult
          })
          .filter((item: PlaceResult | null): item is PlaceResult => item !== null)
      )

      const namedOnly = parsed.filter((p) => p.name !== 'Nearby Place' && p.name !== 'police' && p.name !== 'mall')
      const curatedNearby = getCuratedFallbacks(category, lat, lng).filter((c) => c.distanceKm <= 35)
      const finalResults = mergeAndDeduplicate(namedOnly.length > 0 ? namedOnly : parsed, curatedNearby)

      if (finalResults.length > 0) {
        return finalResults
      }
    } catch {
      // Try next mirror
    }
  }

  // If Overpass mirrors returned 0 results or timed out, fall back to curated stations/malls
  return getCuratedFallbacks(category, lat, lng)
}

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'api:nearby', { limit: 120, windowMs: 5 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const lat = parseCoordinate(request.nextUrl.searchParams.get('lat'), DEFAULT_LAT, -90, 90)
  const lng = parseCoordinate(request.nextUrl.searchParams.get('lng'), DEFAULT_LNG, -180, 180)
  const category = (request.nextUrl.searchParams.get('category') || 'malls_shops') as NearbyCategory

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const cacheKey = `${category}_${lat.toFixed(2)}_${lng.toFixed(2)}`
  const cached = serverNearbyCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    return NextResponse.json({
      category,
      results: cached.data,
      source: `${cached.source} (cached)`,
    })
  }

  try {
    const results = await fetchFromOverpass(lat, lng, category)
    const source = results.length > 0 ? 'overpass+curated' : 'fallback'
    serverNearbyCache.set(cacheKey, { data: results, source, timestamp: Date.now() })
    return NextResponse.json({
      category,
      results,
      source,
    })
  } catch (error) {
    captureException(error)
    const fallback = getCuratedFallbacks(category, lat, lng)
    serverNearbyCache.set(cacheKey, { data: fallback, source: 'curated-fallback', timestamp: Date.now() })
    return NextResponse.json({
      category,
      results: fallback,
      source: 'curated-fallback',
    })
  }
}
