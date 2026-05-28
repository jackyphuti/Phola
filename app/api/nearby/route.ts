import { captureException } from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/api'

export const runtime = 'edge'

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
const REQUEST_TIMEOUT_MS = 12000

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

function categoryToPlacesType(category: NearbyCategory): { type?: string; keyword?: string } {
  switch (category) {
    case 'malls_shops':
      return { type: 'shopping_mall' }
    case 'clinics_hospitals':
      return { type: 'hospital' }
    case 'police_stations':
      return { type: 'police' }
    case 'schools':
      return { type: 'school' }
    case 'spaza_shops':
      return { keyword: 'spaza shop' }
    case 'petrol_stations':
      return { type: 'gas_station' }
    case 'shelters_ngos':
      return { keyword: 'shelter ngo' }
    case 'banks_atms':
      return { type: 'bank' }
    case 'post_offices':
      return { type: 'post_office' }
    default:
      return {}
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

async function fetchFromGoogle(lat: number, lng: number, category: NearbyCategory, key: string): Promise<PlaceResult[]> {
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

  const mapping = categoryToPlacesType(category)
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: '50000',
    key,
  })

  if (mapping.type) params.set('type', mapping.type)
  if (mapping.keyword) params.set('keyword', mapping.keyword)

  const response = await fetchWithTimeout(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`)

  if (!response.ok) {
    throw new Error('google places request failed')
  }

  const data = await response.json()
  const results = Array.isArray(data?.results) ? data.results : []

  return sortByDistance(
    results
      .map((item: { place_id?: string; name?: string; vicinity?: string; rating?: number; opening_hours?: { open_now?: boolean }; geometry?: { location?: { lat?: number; lng?: number } } }) => {
        const placeLat = item?.geometry?.location?.lat
        const placeLng = item?.geometry?.location?.lng
        if (typeof placeLat !== 'number' || typeof placeLng !== 'number') return null

        return {
          id: item.place_id || `${item.name}-${placeLat}-${placeLng}`,
          name: item.name || 'Unknown place',
          address: item.vicinity || undefined,
          rating: typeof item.rating === 'number' ? item.rating : undefined,
          openNow: typeof item?.opening_hours?.open_now === 'boolean' ? item.opening_hours.open_now : undefined,
          location: { lat: placeLat, lng: placeLng },
          distanceKm: haversineKm(lat, lng, placeLat, placeLng),
        } satisfies PlaceResult
      })
      .filter((item: PlaceResult | null): item is PlaceResult => item !== null)
  ).slice(0, 30)
}

async function fetchFromOverpass(lat: number, lng: number, category: NearbyCategory): Promise<PlaceResult[]> {
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

  const amenityMap: Partial<Record<NearbyCategory, string>> = {
    malls_shops: 'marketplace',
    clinics_hospitals: 'hospital',
    police_stations: 'police',
    schools: 'school',
    petrol_stations: 'fuel',
    banks_atms: 'bank',
    post_offices: 'post_office',
  }

  const amenity = amenityMap[category]
  const keyword = category === 'spaza_shops' ? 'spaza' : category === 'shelters_ngos' ? 'shelter' : ''

  const queryParts = []
  if (amenity) {
    queryParts.push(`node[\"amenity\"=\"${amenity}\"](around:50000,${lat},${lng});`)
    queryParts.push(`way[\"amenity\"=\"${amenity}\"](around:50000,${lat},${lng});`)
  }
  if (keyword) {
    queryParts.push(`node[\"name\"~\"${keyword}\",i](around:50000,${lat},${lng});`)
    queryParts.push(`way[\"name\"~\"${keyword}\",i](around:50000,${lat},${lng});`)
  }

  if (queryParts.length === 0) {
    return []
  }

  const query = `[out:json][timeout:30];(${queryParts.join('')});out center;`

  const response = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    throw new Error('overpass request failed')
  }

  const data = await response.json()
  const elements = Array.isArray(data?.elements) ? data.elements : []

  return sortByDistance(
    elements
      .map((item: { id?: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: { name?: string; 'addr:street'?: string; 'addr:city'?: string } }) => {
        const placeLat = item.lat ?? item.center?.lat
        const placeLng = item.lon ?? item.center?.lon
        if (typeof placeLat !== 'number' || typeof placeLng !== 'number') return null

        const street = item.tags?.['addr:street'] || ''
        const city = item.tags?.['addr:city'] || ''

        return {
          id: String(item.id || `${placeLat}-${placeLng}`),
          name: item.tags?.name || 'Nearby place',
          address: [street, city].filter(Boolean).join(', ') || undefined,
          location: { lat: placeLat, lng: placeLng },
          distanceKm: haversineKm(lat, lng, placeLat, placeLng),
        } satisfies PlaceResult
      })
      .filter((item: PlaceResult | null): item is PlaceResult => item !== null)
  ).slice(0, 30)
}

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'api:nearby', { limit: 120, windowMs: 5 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const lat = parseCoordinate(request.nextUrl.searchParams.get('lat'), DEFAULT_LAT, -90, 90)
  const lng = parseCoordinate(request.nextUrl.searchParams.get('lng'), DEFAULT_LNG, -180, 180)
  const category = (request.nextUrl.searchParams.get('category') || 'malls_shops') as NearbyCategory
  const googleKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  try {
    const results = googleKey
      ? await fetchFromGoogle(lat, lng, category, googleKey)
      : await fetchFromOverpass(lat, lng, category)

    return NextResponse.json({
      category,
      results,
      source: googleKey ? 'google' : 'overpass',
    })
  } catch (error) {
    captureException(error)
    try {
      const fallback = await fetchFromOverpass(lat, lng, category)
      return NextResponse.json({
        category,
        results: fallback,
        source: 'overpass',
      })
    } catch (fallbackError) {
      captureException(fallbackError)
      return NextResponse.json({
        category,
        results: [],
        source: 'fallback-empty',
      })
    }
  }
}
