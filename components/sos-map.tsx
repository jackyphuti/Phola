'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { notifySOSActivated } from '@/lib/push-notifications'
import { getNearbySAPSStations, getNearbyHospitals } from '@/lib/saps-stations'
import { getReliableLocation, getCachedLocation, watchReliableLocation, DEFAULT_SOUTH_AFRICA_LOCATION } from '@/lib/geolocation'
import { launchEHailingWithDestination, RideServiceId } from '@/lib/safe-ride-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { 
  ArrowLeft, 
  Phone, 
  Navigation, 
  Hospital, 
  Shield, 
  MapPin, 
  Loader2, 
  X, 
  Clock, 
  Route, 
  Share2,
  Car,
  Volume2,
  VolumeX,
  LocateFixed,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  ArrowUpRight,
  ArrowUpLeft,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  WifiOff,
  Compass,
  ListOrdered,
  Send,
  Mail,
  MessageSquare,
  Copy,
  Check
} from 'lucide-react'
import { generateOfflineSteps, calculateBearing, getCompassCardinal, getShortCompassCardinal } from '@/lib/offline-navigation'
import { getSOSCallPreference } from '@/lib/user-sync'
import { getStoredEmergencyContacts } from '@/lib/emergency-contacts-storage'

// Mapbox Token configuration (supports NEXT_PUBLIC_MAPBOX_TOKEN and NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)
const MAPBOX_TOKEN = 
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || 
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || 
  ''

mapboxgl.accessToken = MAPBOX_TOKEN

// Default South Africa Map Center [lng, lat] (Mapbox uses [lng, lat])
const DEFAULT_SA_CENTER: [number, number] = [28.0473, -26.2041]

export const SA_CITIES = [
  { name: 'Pretoria CBD (Tshwane)', lat: -25.7479, lng: 28.2293 },
  { name: 'Johannesburg (Central)', lat: -26.2041, lng: 28.0473 },
  { name: 'Soweto (Gauteng)', lat: -26.2485, lng: 27.8540 },
  { name: 'Cape Town (Central)', lat: -33.9249, lng: 18.4241 },
  { name: 'Durban (eThekwini)', lat: -29.8587, lng: 31.0218 },
  { name: 'Gqeberha (Port Elizabeth)', lat: -33.9608, lng: 25.6022 },
  { name: 'Bloemfontein (Mangaung)', lat: -29.0852, lng: 26.1596 },
]

const OSM_RASTER_STYLE: mapboxgl.Style = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

export interface SafePlace {
  id: string
  name: string
  address: string
  distance: number
  distanceText: string
  duration: string
  location: { lat: number; lng: number }
  type: 'hospital' | 'police' | 'shelter'
  phone?: string
}

export interface NavigationStep {
  instruction: string
  distanceMeters: number
  durationSeconds: number
  streetName: string
  type: string
  modifier?: string
  location: [number, number] // [lng, lat]
}

export interface RouteInfo {
  coordinates: [number, number][]
  distance: string
  duration: string
  distanceMeters: number
  durationSeconds: number
  steps: NavigationStep[]
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  return `${km.toFixed(1)} km`
}

function formatMeters(meters: number): string {
  if (meters < 1000) {
    return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

function estimateDuration(km: number): string {
  const hours = km / 30
  const minutes = Math.round(hours * 60)
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min`
  }
  return `${Math.floor(hours)}h ${minutes % 60}m`
}

function parseManeuverInstruction(step: any, isLast: boolean, destinationName: string): string {
  if (isLast || step.maneuver?.type === 'arrive') {
    return `Arrive at ${destinationName}`
  }
  if (step.maneuver?.type === 'depart') {
    const street = step.name ? ` on ${step.name}` : ''
    return `Head ${step.maneuver?.modifier || ''}${street}`.replace(/\s+/g, ' ').trim()
  }

  const modifier = step.maneuver?.modifier || ''
  const type = step.maneuver?.type || 'turn'
  const street = step.name ? ` onto ${step.name}` : ''

  if (type === 'roundabout') {
    return `At the roundabout, take exit ${step.maneuver?.exit || ''}${street}`.trim()
  }
  if (type === 'turn' || type === 'new name') {
    if (modifier) {
      return `Turn ${modifier}${street}`.trim()
    }
    return `Continue${street}`.trim()
  }
  if (type === 'merge') {
    return `Merge ${modifier}${street}`.trim()
  }
  if (type === 'fork') {
    return `Keep ${modifier} at the fork${street}`.trim()
  }
  return `${type} ${modifier}${street}`.replace(/\s+/g, ' ').trim()
}

function ensureArrowImage(map: mapboxgl.Map, callback?: () => void) {
  if (typeof window === 'undefined') return
  if (map.hasImage('route-arrow-icon')) {
    callback?.()
    return
  }
  const img = new Image(24, 24)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2 L22 20 L12 15 L2 20 Z" fill="#ffffff" stroke="#047857" stroke-width="2.5" stroke-linejoin="round"/></svg>`
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  img.onload = () => {
    try {
      if (!map.hasImage('route-arrow-icon')) {
        map.addImage('route-arrow-icon', img)
      }
    } catch (e) {
      console.warn('Could not register route-arrow-icon on map:', e)
    }
    callback?.()
  }
}

export function SOSMap() {
  const router = useRouter()
  const { user } = useAuth()
  const [supabase] = useState(() => createClient())

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const placesMarkersRef = useRef<mapboxgl.Marker[]>([])
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastSpokenRef = useRef<string>('')
  const isFirstFixRef = useRef<boolean>(true)
  const autoRouteTriggeredRef = useRef<boolean>(false)
  const isRasterFallbackRef = useRef<boolean>(false)

  // State
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'loading' | 'active' | 'denied'>('loading')
  const [selectedCityName, setSelectedCityName] = useState<string>('')
  const [showAreaSelectorModal, setShowAreaSelectorModal] = useState(false)
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<SafePlace | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'hospital' | 'police'>('all')

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer.includes(window.location.host)) {
      router.back()
    } else {
      router.push('/dashboard')
    }
  }, [router])

  const handleSelectArea = useCallback((city: { name: string; lat: number; lng: number }) => {
    setCurrentLocation({ lat: city.lat, lng: city.lng })
    setSelectedCityName(city.name)
    setLocationStatus('active')
    loadSafePlacesForLocation(city.lat, city.lng)
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [city.lng, city.lat], zoom: 14 })
    }
    setShowAreaSelectorModal(false)
  }, [loadSafePlacesForLocation])

  // In-App Navigation State
  const [isNavigating, setIsNavigating] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const [isFollowingUser, setIsFollowingUser] = useState(true)
  const [userBearing, setUserBearing] = useState<number>(0)
  const [userSpeedKmH, setUserSpeedKmH] = useState<number | null>(null)
  const [hasArrived, setHasArrived] = useState(false)
  const [showDirectionsSheet, setShowDirectionsSheet] = useState(false)

  // Offline service & connectivity state
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // E-Hailing Modal State
  const [showEHailingModal, setShowEHailingModal] = useState(false)
  const [eHailingTargetPlace, setEHailingTargetPlace] = useState<SafePlace | null>(null)

  // Share GPS Modal State
  const [showShareModal, setShowShareModal] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  // Emergency Panel State
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false)
  const [sosActivated, setSosActivated] = useState(false)
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string | null>(null)

  // 1. Fetch Emergency Contacts (Instant local lookup + Cloud sync)
  useEffect(() => {
    // 1. Instant local cache lookup (0ms)
    const local = getStoredEmergencyContacts(user?.id)
    const primary = local.find((c) => c.is_primary) || local[0]
    if (primary?.phone) {
      setEmergencyContactPhone(primary.phone)
    }

    if (!user?.id) return

    const fetchEmergencyContact = async () => {
      try {
        const { data } = await supabase
          .from('emergency_contacts')
          .select('phone, is_primary')
          .eq('user_id', user.id)
          .order('is_primary', { ascending: false })
          .limit(1)

        if (data && data[0]?.phone) {
          setEmergencyContactPhone(data[0].phone)
        }
      } catch (err) {
        console.warn('Failed to load primary emergency contact:', err)
      }
    }

    void fetchEmergencyContact()
  }, [user?.id, supabase])

  // 2. Fetch Safe Places (SAPS Stations & Hospitals)
  const loadSafePlacesForLocation = useCallback((lat: number, lng: number) => {
    try {
      const saps = getNearbySAPSStations(lat, lng, 20).map((station) => ({
        id: station.code || `saps-${station.name}`,
        name: station.name,
        address: `${station.province}, South Africa`,
        distance: station.distanceKm,
        distanceText: formatDistance(station.distanceKm),
        duration: estimateDuration(station.distanceKm),
        location: { lat: station.lat, lng: station.lng },
        type: 'police' as const,
        phone: station.phone || '10111',
      }))

      const hospitals = getNearbyHospitals(lat, lng, 15).map((hosp) => ({
        id: hosp.id || `hosp-${hosp.name}`,
        name: hosp.name,
        address: `${hosp.province}, South Africa`,
        distance: hosp.distanceKm,
        distanceText: formatDistance(hosp.distanceKm),
        duration: estimateDuration(hosp.distanceKm),
        location: { lat: hosp.lat, lng: hosp.lng },
        type: 'hospital' as const,
        phone: hosp.phone || '112',
      }))

      const combined = [...saps, ...hospitals].sort((a, b) => a.distance - b.distance)
      setSafePlaces(combined)
    } catch (e) {
      console.warn('Failed to compute nearby safe places:', e)
    }
  }, [])

  // 3. Initialize Mapbox GL Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const mapStyle: string | mapboxgl.Style = MAPBOX_TOKEN
      ? 'mapbox://styles/mapbox/streets-v12'
      : {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            },
          },
          layers: [
            {
              id: 'osm-tiles-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        }

    const cached = getCachedLocation()
    const initialCenter: [number, number] = cached
      ? [cached.lng, cached.lat]
      : DEFAULT_SA_CENTER

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: initialCenter,
      zoom: cached ? 14 : 6,
      attributionControl: true,
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-left')

    map.on('error', (e) => {
      if (!isRasterFallbackRef.current) {
        isRasterFallbackRef.current = true
        console.warn('[Phola Map] Vector style error, falling back to Carto/OSM raster style:', e)
        try {
          map.setStyle(OSM_RASTER_STYLE)
        } catch (styleErr) {
          console.error('[Phola Map] Error applying fallback raster style:', styleErr)
        }
      }
    })

    map.on('load', () => {
      map.resize()
      ensureArrowImage(map)
    })

    // When user manually pans during navigation, disable auto-following
    map.on('dragstart', () => {
      if (isNavigating) {
        setIsFollowingUser(false)
      }
    })

    mapRef.current = map

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    resizeObserver.observe(mapContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      destinationMarkerRef.current?.remove()
      destinationMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [isNavigating])

  // 4. Resolve Live Coordinates & Keep Real-Time Watcher Active
  useEffect(() => {
    let isMounted = true

    // Immediately use cached GPS position if available
    const cached = getCachedLocation()
    if (cached) {
      setCurrentLocation(cached)
      setLocationStatus('active')
      loadSafePlacesForLocation(cached.lat, cached.lng)
      if (mapRef.current && isFirstFixRef.current) {
        mapRef.current.flyTo({ center: [cached.lng, cached.lat], zoom: 14 })
      }
    }

    // Fail-safe: If GPS takes longer than 3.5s, fall back to safe default area
    const gpsTimeout = setTimeout(() => {
      if (isMounted) {
        setLocationStatus((prev) => {
          if (prev === 'loading') {
            const fallback = cached || { lat: -25.7479, lng: 28.2293 }
            setCurrentLocation(fallback)
            setSelectedCityName(cached ? 'Cached GPS' : 'Pretoria CBD (Tshwane)')
            loadSafePlacesForLocation(fallback.lat, fallback.lng)
            if (mapRef.current && isFirstFixRef.current) {
              isFirstFixRef.current = false
              mapRef.current.flyTo({ center: [fallback.lng, fallback.lat], zoom: 13 })
            }
            return 'denied'
          }
          return prev
        })
      }
    }, 3500)

    // Fast initial one-shot lookup
    void getReliableLocation().then((coords) => {
      if (!isMounted) return
      clearTimeout(gpsTimeout)
      if (coords && (coords.lat !== DEFAULT_SOUTH_AFRICA_LOCATION.lat || coords.lng !== DEFAULT_SOUTH_AFRICA_LOCATION.lng)) {
        setCurrentLocation(coords)
        setLocationStatus('active')
        loadSafePlacesForLocation(coords.lat, coords.lng)

        if (mapRef.current && isFirstFixRef.current) {
          isFirstFixRef.current = false
          mapRef.current.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 1000 })
        }
      } else if (!cached) {
        setCurrentLocation(DEFAULT_SOUTH_AFRICA_LOCATION)
        setLocationStatus('denied')
        loadSafePlacesForLocation(DEFAULT_SOUTH_AFRICA_LOCATION.lat, DEFAULT_SOUTH_AFRICA_LOCATION.lng)
      }
    })

    // Continuous real-time GPS tracking (updates as user moves)
    const cleanupWatch = watchReliableLocation(
      (coords) => {
        if (!isMounted) return
        const newCoords = { lat: coords.lat, lng: coords.lng }
        setCurrentLocation(newCoords)
        setLocationStatus('active')
        loadSafePlacesForLocation(coords.lat, coords.lng)

        if (mapRef.current) {
          if (isFirstFixRef.current) {
            isFirstFixRef.current = false
            mapRef.current.flyTo({ center: [newCoords.lng, newCoords.lat], zoom: 15, duration: 1000 })
          }
        }
      },
      (err) => {
        if (!isMounted) return
        console.warn('Geolocation watcher warning:', err)
        if (!cached && locationStatus === 'loading') {
          setLocationStatus('denied')
        }
      }
    )

    return () => {
      isMounted = false
      clearTimeout(gpsTimeout)
      cleanupWatch()
    }
  }, [loadSafePlacesForLocation])

  // 5. Update User Marker (Normal vs Active Navigation Puck)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !currentLocation) return

    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = isNavigating ? 'nav-user-puck' : 'pulse-emergency-marker'
      el.title = 'Your Emergency Location'

      if (isNavigating) {
        el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="transform: rotate(${userBearing}deg);"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>`
      }

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map)

      userMarkerRef.current = marker
    } else {
      userMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat])
      const el = userMarkerRef.current.getElement()
      el.className = isNavigating ? 'nav-user-puck' : 'pulse-emergency-marker'

      if (isNavigating) {
        el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="transform: rotate(${userBearing}deg);"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>`
      } else {
        el.innerHTML = ''
      }
    }
  }, [currentLocation, isNavigating, userBearing])

  // 6. Update Safe Places Markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    placesMarkersRef.current.forEach((m) => m.remove())
    placesMarkersRef.current = []

    const filtered = activeFilter === 'all' 
      ? safePlaces 
      : safePlaces.filter((p) => p.type === activeFilter)

    filtered.forEach((place) => {
      const el = document.createElement('div')
      el.className = place.type === 'hospital' ? 'hospital-marker' : 'saps-station-marker'
      el.innerHTML = place.type === 'hospital'
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 6v12M6 12h12"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`

      const popupHtml = `
        <div style="min-width: 190px; font-family: inherit;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${place.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${place.address}</div>
          <div style="display:flex; align-items:center; gap: 8px; font-size: 11px; color: #0D6E6E; font-weight: 600; margin-top: 6px;">
            <span>📍 ${place.distanceText}</span>
            <span>⏱️ ${place.duration}</span>
          </div>
        </div>
      `

      const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(popupHtml)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([place.location.lng, place.location.lat])
        .setPopup(popup)
        .addTo(map)

      el.addEventListener('click', () => {
        setSelectedPlace(place)
        void getRoute(place)
      })

      placesMarkersRef.current.push(marker)
    })
  }, [safePlaces, activeFilter])

  // Voice Guidance speech helper
  const speakInstruction = useCallback((text: string) => {
    if (isVoiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (lastSpokenRef.current === text) return

    lastSpokenRef.current = text
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-ZA'
      utterance.rate = 1.0
      window.speechSynthesis.speak(utterance)
    } catch {
      // ignore audio error
    }
  }, [isVoiceMuted])

  // 7. Route Polyline & Turn-By-Turn Steps Fetching
  const getRoute = useCallback(async (place: SafePlace): Promise<RouteInfo | null> => {
    if (!currentLocation) return null

    setIsLoadingRoute(true)
    try {
      let routeData: any = null
      let coords: [number, number][] = []
      let parsedSteps: NavigationStep[] = []

      // 1. Try Mapbox Directions API
      if (MAPBOX_TOKEN) {
        try {
          const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${currentLocation.lng},${currentLocation.lat};${place.location.lng},${place.location.lat}?geometries=geojson&steps=true&overview=full&access_token=${MAPBOX_TOKEN}`
          const response = await fetch(mapboxUrl)
          if (response.ok) {
            const data = await response.json()
            if (data.routes && data.routes[0]) {
              routeData = data.routes[0]
              coords = routeData.geometry.coordinates as [number, number][]
            }
          }
        } catch (err) {
          console.warn('Mapbox route fetch failed, trying OSRM fallback:', err)
        }
      }

      // 2. Try OSRM fallback
      if (!routeData) {
        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${place.location.lng},${place.location.lat}?overview=full&geometries=geojson&steps=true`
          const response = await fetch(osrmUrl)
          if (response.ok) {
            const data = await response.json()
            if (data.routes && data.routes[0]) {
              routeData = data.routes[0]
              coords = routeData.geometry.coordinates as [number, number][]
            }
          }
        } catch (err) {
          console.warn('OSRM route fetch failed:', err)
        }
      }

      let computedRoute: RouteInfo

      // 3. Fallback: Offline / Waypoint vector path if network routing failed
      if (!routeData || coords.length === 0) {
        const distKm = calculateDistanceKm(currentLocation.lat, currentLocation.lng, place.location.lat, place.location.lng)
        const estDurationSec = Math.round((distKm / 35) * 3600)
        coords = [
          [currentLocation.lng, currentLocation.lat],
          [place.location.lng, place.location.lat],
        ]

        const offlineSteps = generateOfflineSteps(
          currentLocation.lat,
          currentLocation.lng,
          place.name,
          place.location.lat,
          place.location.lng,
          distKm
        )
        parsedSteps = offlineSteps.map((s) => ({
          instruction: s.instruction,
          distanceMeters: s.distanceMeters,
          durationSeconds: s.durationSeconds,
          streetName: s.streetName,
          type: s.type,
          modifier: s.modifier,
          location: s.location,
        }))

        computedRoute = {
          coordinates: coords,
          distance: formatDistance(distKm),
          duration: estimateDuration(distKm),
          distanceMeters: distKm * 1000,
          durationSeconds: estDurationSec,
          steps: parsedSteps,
        }
      } else {
        // Parse Turn-by-Turn Steps from routeData
        const rawSteps = routeData.legs?.[0]?.steps || []
        parsedSteps = rawSteps.map((step: any, index: number) => {
          const isLast = index === rawSteps.length - 1
          const officialInstruction = step.maneuver?.instruction
          return {
            instruction: officialInstruction || parseManeuverInstruction(step, isLast, place.name),
            distanceMeters: Math.round(step.distance || 0),
            durationSeconds: Math.round(step.duration || 0),
            streetName: step.name || 'Road',
            type: step.maneuver?.type || 'turn',
            modifier: step.maneuver?.modifier,
            location: step.maneuver?.location || [coords[0][0], coords[0][1]],
          }
        })

        if (parsedSteps.length === 0) {
          parsedSteps.push({
            instruction: `Head straight towards ${place.name}`,
            distanceMeters: Math.round(routeData.distance),
            durationSeconds: Math.round(routeData.duration),
            streetName: place.name,
            type: 'depart',
            location: [coords[0][0], coords[0][1]],
          })
          parsedSteps.push({
            instruction: `Arrive at ${place.name}`,
            distanceMeters: 0,
            durationSeconds: 0,
            streetName: place.name,
            type: 'arrive',
            location: [coords[coords.length - 1][0], coords[coords.length - 1][1]],
          })
        }

        computedRoute = {
          coordinates: coords,
          distance: formatDistance(routeData.distance / 1000),
          duration: `${Math.round(routeData.duration / 60)} min`,
          distanceMeters: routeData.distance,
          durationSeconds: routeData.duration,
          steps: parsedSteps,
        }
      }

      setRoute(computedRoute)
      setSelectedPlace(place)
      setCurrentStepIndex(0)

      // Draw highlighted route on Mapbox with emerald glow, casing, and directional forward chevrons
      const map = mapRef.current
      if (map) {
        const renderLayers = () => {
          const geojsonSource = map.getSource('route-source') as mapboxgl.GeoJSONSource
          if (geojsonSource) {
            geojsonSource.setData({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: coords,
              },
            })
          } else {
            map.addSource('route-source', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: coords,
                },
              },
            })
          }

          // 1. Route Glow (High-Visibility Emerald Pulse)
          if (!map.getLayer('route-glow')) {
            map.addLayer({
              id: 'route-glow',
              type: 'line',
              source: 'route-source',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#10B981',
                'line-width': 16,
                'line-opacity': 0.45,
                'line-blur': 3,
              },
            })
          }

          // 2. Route Casing (Crisp Contrast White)
          if (!map.getLayer('route-casing')) {
            map.addLayer({
              id: 'route-casing',
              type: 'line',
              source: 'route-source',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#ffffff',
                'line-width': 9.5,
                'line-opacity': 0.95,
              },
            })
          }

          // 3. Core Route Line (Safety Emerald)
          if (!map.getLayer('route-layer')) {
            map.addLayer({
              id: 'route-layer',
              type: 'line',
              source: 'route-source',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#0D6E6E',
                'line-width': 5.5,
                'line-opacity': 1.0,
              },
            })
          }

          // 4. Directional Forward-Facing Chevrons along Route
          const addArrowSymbols = () => {
            if (!map.getLayer('route-arrows') && map.hasImage('route-arrow-icon')) {
              map.addLayer({
                id: 'route-arrows',
                type: 'symbol',
                source: 'route-source',
                layout: {
                  'symbol-placement': 'line',
                  'symbol-spacing': 55,
                  'icon-image': 'route-arrow-icon',
                  'icon-size': 0.65,
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                  'icon-rotation-alignment': 'map',
                },
              })
            }
          }

          if (map.hasImage('route-arrow-icon')) {
            addArrowSymbols()
          } else {
            ensureArrowImage(map, addArrowSymbols)
          }

          // 5. Place High-Visibility Destination Pin Flag
          if (destinationMarkerRef.current) {
            destinationMarkerRef.current.remove()
            destinationMarkerRef.current = null
          }

          const destEl = document.createElement('div')
          destEl.className = 'destination-route-marker'
          destEl.innerHTML = `
            <div class="destination-flag-pill">
              <span class="destination-icon">${place.type === 'hospital' ? '🏥' : '🛡️'}</span>
              <span class="destination-name">${place.name}</span>
              <span class="eta-tag">${computedRoute.duration}</span>
            </div>
            <div class="destination-pin-pointer"></div>
          `
          const destMarker = new mapboxgl.Marker({ element: destEl, anchor: 'bottom' })
            .setLngLat([place.location.lng, place.location.lat])
            .addTo(map)

          destinationMarkerRef.current = destMarker

          // 6. Smoothly Frame Bounds
          if (!isNavigating) {
            const bounds = coords.reduce(
              (b, c) => b.extend(c as [number, number]),
              new mapboxgl.LngLatBounds([currentLocation.lng, currentLocation.lat], [place.location.lng, place.location.lat])
            )
            map.fitBounds(bounds, {
              padding: { top: 85, bottom: 200, left: 45, right: 45 },
              duration: 800,
              maxZoom: 16.5,
            })
          }
        }

        if (!map.isStyleLoaded()) {
          map.once('style.load', renderLayers)
        } else {
          renderLayers()
        }
      }

      return computedRoute
    } catch (e) {
      console.warn('Failed to calculate route:', e)
      setSelectedPlace(place)
      return null
    } finally {
      setIsLoadingRoute(false)
    }
  }, [currentLocation, isNavigating])

  // Auto-highlight route to nearest safe haven on initial load
  useEffect(() => {
    if (autoRouteTriggeredRef.current) return
    if (!currentLocation || safePlaces.length === 0 || route || selectedPlace) return

    const nearest = safePlaces.find((p) => p.type === 'police') || safePlaces[0]
    if (nearest) {
      autoRouteTriggeredRef.current = true
      void getRoute(nearest)
    }
  }, [currentLocation, safePlaces, route, selectedPlace, getRoute])

  // 8. Start Real In-App Turn-by-Turn Navigation
  const startInAppNavigation = async (place: SafePlace) => {
    setSelectedPlace(place)
    setHasArrived(false)
    setCurrentStepIndex(0)
    setIsFollowingUser(true)

    // Ensure route is computed and retrieve it
    let activeRoute = route
    if (!activeRoute || activeRoute.steps.length === 0 || selectedPlace?.id !== place.id) {
      activeRoute = await getRoute(place)
    }

    setIsNavigating(true)

    // Camera 3D Driver/Pedestrian View
    const map = mapRef.current
    if (map && currentLocation) {
      setTimeout(() => {
        map.resize()
        map.easeTo({
          center: [currentLocation.lng, currentLocation.lat],
          zoom: 17.5,
          pitch: 55,
          bearing: userBearing || 0,
          duration: 1200,
        })
      }, 150)
    }

    // Voice announcement
    if (activeRoute && activeRoute.steps[0]) {
      speakInstruction(`Starting navigation to ${place.name}. ${activeRoute.steps[0].instruction}`)
    } else {
      speakInstruction(`Starting navigation to ${place.name}.`)
    }
  }

  // Quick Actions for Safe Places & Police Stations
  const navigateToNearestPoliceStation = async () => {
    const target = selectedPlace || safePlaces.find((p) => p.type === 'police') || safePlaces[0]
    if (!target) return
    setSelectedPlace(target)
    await startInAppNavigation(target)
  }

  const showNearestPoliceStationRoute = async () => {
    const target = selectedPlace || safePlaces.find((p) => p.type === 'police') || safePlaces[0]
    if (!target) return
    setSelectedPlace(target)
    const computed = route && selectedPlace?.id === target.id ? route : await getRoute(target)
    if (computed) {
      setShowDirectionsSheet(true)
    }
  }

  // 9. Stop/Exit Navigation
  const stopInAppNavigation = () => {
    setIsNavigating(false)
    setHasArrived(false)

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    const map = mapRef.current
    if (map) {
      map.easeTo({
        pitch: 0,
        bearing: 0,
        zoom: 14,
        duration: 800,
      })
    }
  }

  // 10. Live Position Tracking During Navigation (watchPosition)
  useEffect(() => {
    if (!isNavigating || !navigator.geolocation) return

    const handlePositionUpdate = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const newCoords = { lat, lng }
      setCurrentLocation(newCoords)

      // Speed (convert m/s to km/h)
      if (typeof pos.coords.speed === 'number' && pos.coords.speed > 0) {
        setUserSpeedKmH(Math.round(pos.coords.speed * 3.6))
      }

      // Bearing
      if (typeof pos.coords.heading === 'number' && !isNaN(pos.coords.heading)) {
        setUserBearing(pos.coords.heading)
      } else if (selectedPlace) {
        const brng = calculateBearing(lat, lng, selectedPlace.location.lat, selectedPlace.location.lng)
        setUserBearing(brng)
      }

      // Check arrival at destination (within 25m)
      if (selectedPlace) {
        const distToDestKm = calculateDistanceKm(lat, lng, selectedPlace.location.lat, selectedPlace.location.lng)
        if (distToDestKm * 1000 <= 25 && !hasArrived) {
          setHasArrived(true)
          speakInstruction(`You have arrived at ${selectedPlace.name}`)
          return
        }
      }

      // Check step advancement
      if (route && route.steps.length > 0 && currentStepIndex < route.steps.length - 1) {
        const nextStep = route.steps[currentStepIndex + 1]
        const distToNextStepKm = calculateDistanceKm(lat, lng, nextStep.location[1], nextStep.location[0])

        if (distToNextStepKm * 1000 <= 35) {
          const nextIdx = currentStepIndex + 1
          setCurrentStepIndex(nextIdx)
          speakInstruction(route.steps[nextIdx].instruction)
        }
      }

      // Camera follow
      const map = mapRef.current
      if (map && isFollowingUser) {
        map.easeTo({
          center: [lng, lat],
          bearing: pos.coords.heading || userBearing || 0,
          duration: 500,
        })
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      (err) => console.warn('WatchPosition error:', err),
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 6000 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isNavigating, isFollowingUser, userBearing, selectedPlace, route, currentStepIndex, hasArrived, speakInstruction])

  // Recenter Camera to User & Force GPS Refresh
  const recenterToUser = () => {
    setIsFollowingUser(true)

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCurrentLocation(coords)
          setLocationStatus('active')
          loadSafePlacesForLocation(coords.lat, coords.lng)

          const map = mapRef.current
          if (map) {
            map.flyTo({
              center: [coords.lng, coords.lat],
              bearing: userBearing || 0,
              pitch: isNavigating ? 55 : 0,
              zoom: isNavigating ? 17.5 : 15,
              duration: 800,
            })
          }
        },
        () => {
          const map = mapRef.current
          if (map && currentLocation) {
            map.flyTo({
              center: [currentLocation.lng, currentLocation.lat],
              bearing: userBearing || 0,
              pitch: isNavigating ? 55 : 0,
              zoom: isNavigating ? 17.5 : 15,
              duration: 800,
            })
          }
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 5000 }
      )
    } else {
      const map = mapRef.current
      if (map && currentLocation) {
        map.flyTo({
          center: [currentLocation.lng, currentLocation.lat],
          bearing: userBearing || 0,
          pitch: isNavigating ? 55 : 0,
          zoom: isNavigating ? 17.5 : 15,
          duration: 800,
        })
      }
    }
  }

  // Clear Route
  const clearRoute = () => {
    stopInAppNavigation()
    setRoute(null)
    setSelectedPlace(null)

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove()
      destinationMarkerRef.current = null
    }

    const map = mapRef.current
    if (map && map.getSource('route-source')) {
      const src = map.getSource('route-source') as mapboxgl.GeoJSONSource
      src.setData({
        type: 'FeatureCollection',
        features: [],
      })
    }
  }

  // E-Hailing Launch Handler
  const handleOpenEHailing = (place: SafePlace) => {
    setEHailingTargetPlace(place)
    setShowEHailingModal(true)
  }

  const triggerEHailingApp = (serviceId: RideServiceId) => {
    if (!eHailingTargetPlace) return
    launchEHailingWithDestination({
      serviceId,
      destinationName: eHailingTargetPlace.name,
      lat: eHailingTargetPlace.location.lat,
      lng: eHailingTargetPlace.location.lng,
    })
    setShowEHailingModal(false)
  }

  // Emergency Share Location Modal Handlers
  const shareLocation = () => {
    if (!currentLocation) return
    setShowShareModal(true)
  }

  const getEmergencySharePayload = () => {
    if (!currentLocation) return { text: '', url: '', lat: '', lng: '' }
    const lat = currentLocation.lat.toFixed(5)
    const lng = currentLocation.lng.toFixed(5)
    const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`
    const text = `EMERGENCY ALERT: I need immediate assistance! My current live GPS location is (${lat}, ${lng}). Open in Google Maps: ${mapUrl}`
    return { text, url: mapUrl, lat, lng }
  }

  const handleSendEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const { text } = getEmergencySharePayload()
    const subject = encodeURIComponent('EMERGENCY: My Live GPS Location')
    const body = encodeURIComponent(`${text}\n\nSent from Phola Emergency Network.`)
    const target = recipientEmail.trim() ? encodeURIComponent(recipientEmail.trim()) : ''
    window.location.href = `mailto:${target}?subject=${subject}&body=${body}`
  }

  const handleSendWhatsApp = () => {
    const { text } = getEmergencySharePayload()
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleSendSMS = () => {
    const { text } = getEmergencySharePayload()
    window.location.href = `sms:?body=${encodeURIComponent(text)}`
  }

  const handleNativeShare = async () => {
    const { text, url } = getEmergencySharePayload()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Emergency - My Live GPS Location',
          text,
          url,
        })
      } catch {
        // User cancelled
      }
    }
  }

  const handleCopyLocation = async () => {
    const { text } = getEmergencySharePayload()
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2500)
      } catch {}
    }
  }

  const callNumber = (number: string) => {
    window.location.href = `tel:${number.replace(/\s+/g, '')}`
  }

  const handleSOS = async () => {
    setSosActivated(true)
    const pref = getSOSCallPreference()

    if (pref === 'contact' && emergencyContactPhone) {
      callNumber(emergencyContactPhone)
    } else {
      callNumber('10111')
    }

    setShowEmergencyPanel(true)

    if (currentLocation) {
      void notifySOSActivated()
    }
  }

  const filteredPlaces = activeFilter === 'all' 
    ? safePlaces 
    : safePlaces.filter((p) => p.type === activeFilter)

  // Current Turn Maneuver Icon
  const getTurnIcon = (modifier?: string, type?: string) => {
    if (type === 'arrive') return <CheckCircle2 className="w-7 h-7 text-white" />
    if (modifier === 'left' || modifier === 'sharp left') return <CornerUpLeft className="w-7 h-7 text-white" />
    if (modifier === 'slight left') return <ArrowUpLeft className="w-7 h-7 text-white" />
    if (modifier === 'right' || modifier === 'sharp right') return <CornerUpRight className="w-7 h-7 text-white" />
    if (modifier === 'slight right') return <ArrowUpRight className="w-7 h-7 text-white" />
    if (modifier === 'uturn') return <RotateCcw className="w-7 h-7 text-white" />
    return <ArrowUp className="w-7 h-7 text-white" />
  }

  // Offline Compass Calculations
  const nearestStation = safePlaces.find((p) => p.type === 'police') || safePlaces[0]
  const offlineBearing = currentLocation && nearestStation
    ? calculateBearing(currentLocation.lat, currentLocation.lng, nearestStation.location.lat, nearestStation.location.lng)
    : 0
  const offlineShortCardinal = getShortCompassCardinal(offlineBearing)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (Hidden when in full navigation mode)                       */}
      {/* ========================================================================= */}
      {!isNavigating && (
        <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-border z-[100] safe-top shadow-2xs">
          <div className="flex items-center justify-between p-3.5 sm:p-4 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="rounded-full"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-foreground text-base sm:text-lg">Emergency SOS & Safe Map</h1>
                <p className="text-xs text-muted-foreground">
                  {safePlaces.length} verified safe havens nearby
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={shareLocation}
                disabled={!currentLocation}
                className="border-emerald-200 text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-semibold"
              >
                <Share2 className="w-3.5 h-3.5 mr-1 text-primary" />
                Share GPS
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN MAP CONTAINER & IN-APP NAVIGATION HUD                             */}
      {/* ========================================================================= */}
      <div className={`flex-1 flex flex-col ${isNavigating ? 'p-0 w-full h-screen fixed inset-0 z-[150] bg-background' : 'p-3 sm:p-4 max-w-5xl mx-auto w-full gap-3'}`}>
        
        {/* Map Canvas Box */}
        <div className={`overflow-hidden relative ${
          isNavigating 
            ? 'w-full h-full flex-1' 
            : 'w-full h-[360px] min-h-[360px] sm:h-[460px] sm:min-h-[460px] rounded-2xl border border-emerald-100 shadow-sm bg-slate-100'
        }`}>
          {/* Mapbox Canvas Mount */}
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

          {/* ------------------------------------------------------------- */}
          {/* ACTIVE IN-APP NAVIGATION TOP HUD BANNER                       */}
          {/* ------------------------------------------------------------- */}
          {isNavigating && route && route.steps.length > 0 && (
            <div className="absolute top-4 left-4 right-4 z-30 flex flex-col gap-2 max-w-lg mx-auto pointer-events-auto">
              <div className="rounded-2xl bg-white/95 text-slate-900 backdrop-blur-md border-2 border-primary p-4 shadow-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md">
                    {getTurnIcon(
                      route.steps[currentStepIndex]?.modifier,
                      route.steps[currentStepIndex]?.type
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                      {route.steps[currentStepIndex]?.distanceMeters > 0 
                        ? `In ${formatMeters(route.steps[currentStepIndex].distanceMeters)}` 
                        : 'Now'}
                    </p>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                      {route.steps[currentStepIndex]?.instruction || `Proceed to ${selectedPlace?.name}`}
                    </h2>
                    {route.steps[currentStepIndex + 1] && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        Then: {route.steps[currentStepIndex + 1].instruction}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/40 text-primary hover:bg-emerald-50 text-xs font-bold rounded-xl h-8 px-2.5 shadow-2xs"
                    onClick={() => setShowDirectionsSheet(true)}
                  >
                    <ListOrdered className="w-3.5 h-3.5 mr-1" />
                    Steps
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:bg-emerald-50 shrink-0 rounded-full h-8 w-8"
                    onClick={() => setIsVoiceMuted(!isVoiceMuted)}
                    title={isVoiceMuted ? 'Unmute voice guidance' : 'Mute voice guidance'}
                  >
                    {isVoiceMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5 text-primary" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* ARRIVAL BANNER OVERLAY                                        */}
          {/* ------------------------------------------------------------- */}
          {isNavigating && hasArrived && selectedPlace && (
            <div className="absolute inset-x-4 top-24 z-40 max-w-md mx-auto animate-in zoom-in-95">
              <div className="rounded-2xl bg-white/98 text-slate-900 p-5 shadow-2xl border-2 border-primary text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto text-primary">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">You have arrived!</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedPlace.name}</p>
                </div>
                <div className="flex gap-2 justify-center pt-2">
                  {selectedPlace.phone && (
                    <Button 
                      className="bg-primary text-white font-bold text-xs h-9 rounded-xl hover:bg-primary/90"
                      onClick={() => callNumber(selectedPlace.phone!)}
                    >
                      <Phone className="w-3.5 h-3.5 mr-1 text-white" />
                      Call Facility
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    className="border-emerald-200 text-emerald-900 hover:bg-emerald-50 text-xs font-bold h-9 rounded-xl"
                    onClick={stopInAppNavigation}
                  >
                    Finish Route
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STATUS BADGE & MANUAL AREA SELECTOR                           */}
          {/* ------------------------------------------------------------- */}
          {!isNavigating && (
            <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5">
              {locationStatus === 'loading' ? (
                <div className="flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md border border-slate-200">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Locating GPS...</span>
                </div>
              ) : locationStatus === 'denied' ? (
                <div className="flex items-center gap-1.5 rounded-full bg-amber-500/95 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white shadow-md">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{selectedCityName || 'South Africa Default'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-md border border-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                  </span>
                  <span>{selectedCityName ? selectedCityName : 'Live GPS Active'}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAreaSelectorModal(true)}
                className="flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-md px-2.5 py-1.5 text-xs font-semibold text-primary shadow-md border border-emerald-200 hover:bg-emerald-50 active:scale-95 transition"
              >
                <Compass className="w-3.5 h-3.5 text-primary" />
                <span>Change Area</span>
              </button>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* FLOATING ACTION BUTTONS (Re-center & SOS)                     */}
          {/* ------------------------------------------------------------- */}
          <div className="absolute right-3 top-3 z-20 flex flex-col items-center gap-2.5">
            {/* SOS Panic Button */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleSOS}
                className="w-13 h-13 rounded-full bg-destructive text-white shadow-xl flex items-center justify-center animate-pulse hover:scale-105 transition-transform border-2 border-white"
                aria-label="Emergency SOS - tap for instant panic dialer"
              >
                <span className="text-xs font-black tracking-wider">SOS</span>
              </button>
            </div>

            {/* Recenter Button (Appears if user panned away) */}
            {(!isFollowingUser || !isNavigating) && (
              <Button
                variant="secondary"
                size="icon"
                onClick={recenterToUser}
                className="rounded-full shadow-lg bg-white/95 text-primary border border-emerald-200 hover:bg-emerald-50 h-10 w-10"
                title="Re-center to my location"
              >
                <LocateFixed className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* IN-APP NAVIGATION BOTTOM HUD BAR                             */}
          {/* ------------------------------------------------------------- */}
          {isNavigating && selectedPlace && (
            <div className="absolute bottom-4 left-4 right-4 z-30 max-w-lg mx-auto">
              <Card className="border-2 border-emerald-500 bg-white/95 text-slate-900 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden">
                <CardContent className="p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {selectedPlace.type === 'hospital' ? (
                          <Hospital className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Shield className="w-4 h-4 text-primary shrink-0" />
                        )}
                        <span className="font-bold text-sm sm:text-base truncate text-slate-900">
                          {selectedPlace.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 font-medium">
                        <span className="text-primary font-bold">{route?.duration || selectedPlace.duration}</span>
                        <span>•</span>
                        <span>{route?.distance || selectedPlace.distanceText}</span>
                        {userSpeedKmH !== null && (
                          <>
                            <span>•</span>
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md font-semibold text-[11px]">{userSpeedKmH} km/h</span>
                          </>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-xs font-bold shrink-0 h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={stopInAppNavigation}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Exit
                    </Button>
                  </div>

                  {/* Quick Action Buttons in Navigation */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-emerald-200 text-emerald-900 hover:bg-emerald-50 font-semibold text-xs rounded-xl h-9"
                      onClick={() => handleOpenEHailing(selectedPlace)}
                    >
                      <Car className="w-3.5 h-3.5 mr-1.5 text-primary" />
                      Request Ride (Uber/Bolt)
                    </Button>

                    {selectedPlace.phone && (
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-white font-semibold text-xs rounded-xl h-9 px-3"
                        onClick={() => callNumber(selectedPlace.phone!)}
                      >
                        <Phone className="w-3.5 h-3.5 mr-1 text-white" />
                        Call
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* SELECTED DESTINATION & ROUTE CARD (Clean Preview)             */}
          {/* ------------------------------------------------------------- */}
          {!isNavigating && selectedPlace && (
            <Card className="absolute bottom-3 left-3 right-3 z-10 border border-slate-200/90 bg-white/98 text-slate-900 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden animate-in slide-in-from-bottom-3 duration-250">
              <CardContent className="p-3.5 sm:p-4 space-y-2.5 relative">
                {/* Dismiss Button */}
                <button
                  onClick={clearRoute}
                  className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Clear destination"
                  title="Clear destination"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-start justify-between gap-3 pr-8">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        selectedPlace.type === 'hospital' ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-800'
                      }`}>
                        {selectedPlace.type === 'hospital' ? (
                          <Hospital className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate leading-tight">
                          {selectedPlace.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">{selectedPlace.address}</p>
                      </div>
                    </div>

                    {/* Route Metrics and Compass Heading */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-semibold">
                      <span className="bg-emerald-100 text-emerald-950 px-2.5 py-0.5 rounded-lg flex items-center gap-1 border border-emerald-200">
                        <Route className="w-3.5 h-3.5 text-primary" />
                        {route ? route.distance : selectedPlace.distanceText}
                      </span>
                      <span className="bg-teal-100 text-teal-950 px-2.5 py-0.5 rounded-lg flex items-center gap-1 border border-teal-200">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {route ? route.duration : selectedPlace.duration}
                      </span>
                      {currentLocation && (
                        <span className="text-slate-600 font-medium text-[11px] flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          <Compass className="w-3 h-3 text-primary" />
                          Heading {getShortCompassCardinal(calculateBearing(currentLocation.lat, currentLocation.lng, selectedPlace.location.lat, selectedPlace.location.lng))} ({Math.round(calculateBearing(currentLocation.lat, currentLocation.lng, selectedPlace.location.lat, selectedPlace.location.lng))}°)
                        </span>
                      )}
                    </div>

                    {/* Way forward step preview */}
                    {route && route.steps && route.steps[0] && (
                      <div className="text-[11px] text-slate-700 mt-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center gap-1.5 truncate">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          <strong>First step:</strong> {route.steps[0].instruction}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-9.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                    onClick={() => void startInAppNavigation(selectedPlace)}
                    disabled={isLoadingRoute}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Start Turn-by-Turn Navigation</span>
                  </Button>

                  {route && route.steps.length > 0 && (
                    <Button
                      variant="outline"
                      className="border-emerald-200 text-emerald-950 hover:bg-emerald-50 text-xs font-semibold h-9.5 rounded-xl px-3"
                      onClick={() => setShowDirectionsSheet(true)}
                    >
                      <ListOrdered className="w-3.5 h-3.5 mr-1 text-primary" />
                      Steps ({route.steps.length})
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-950 hover:bg-emerald-50 text-xs font-semibold h-9.5 rounded-xl px-3"
                    onClick={() => handleOpenEHailing(selectedPlace)}
                    title="Request Ride (Uber / Bolt)"
                  >
                    <Car className="w-3.5 h-3.5 text-primary" />
                  </Button>

                  {selectedPlace.phone && (
                    <Button
                      variant="outline"
                      className="border-emerald-200 text-emerald-950 hover:bg-emerald-50 text-xs font-semibold h-9.5 rounded-xl px-3"
                      onClick={() => callNumber(selectedPlace.phone!)}
                      title="Call Facility"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. CATEGORY FILTERS & FACILITY LIST (Hidden when in navigation)           */}
        {/* ========================================================================= */}
        {!isNavigating && (
          <>
            {/* Offline Safety Mode Banner & Live Compass Guide */}
            {isOffline && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 dark:text-amber-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Offline Mode Active (Zero Mobile Data)
                    </span>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
                    Direct Cellular & GPS
                  </span>
                </div>

                {nearestStation && currentLocation && (
                  <div className="bg-white/95 dark:bg-card/95 p-3.5 rounded-xl border border-amber-200/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                            {nearestStation.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {nearestStation.distanceText} straight line • Compass Heading: {offlineBearing}° ({offlineShortCardinal})
                        </p>
                      </div>

                      <div
                        className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/40 flex items-center justify-center shrink-0 shadow-sm transition-transform duration-500"
                        style={{ transform: `rotate(${offlineBearing}deg)` }}
                        title={`Heading ${offlineBearing}° ${offlineShortCardinal}`}
                      >
                        <Navigation className="w-5 h-5 text-primary" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <Button
                        size="sm"
                        className="bg-destructive hover:bg-destructive/90 text-white font-bold text-xs h-9 rounded-xl shadow-xs"
                        onClick={() => callNumber('10111')}
                      >
                        <Phone className="w-3.5 h-3.5 mr-1" />
                        Call 10111 (Direct)
                      </Button>

                      {emergencyContactPhone ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-950 hover:bg-amber-50 font-bold text-xs h-9 rounded-xl"
                          onClick={() => {
                            const mapLink = `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`
                            window.location.href = `sms:${emergencyContactPhone}?body=${encodeURIComponent(
                              `🚨 EMERGENCY DISTRESS: I am stranded without internet. GPS: ${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}. Heading towards: ${nearestStation.name} (${offlineShortCardinal} ${offlineBearing}°). Live map: ${mapLink}`
                            )}`
                          }}
                        >
                          <Send className="w-3.5 h-3.5 mr-1 text-amber-700" />
                          SMS Coordinates
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-950 hover:bg-amber-50 font-bold text-xs h-9 rounded-xl"
                          onClick={() => callNumber(nearestStation.phone || '10111')}
                        >
                          <Phone className="w-3.5 h-3.5 mr-1 text-primary" />
                          Call Station
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick In-App Navigation Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <Button
                onClick={() => void navigateToNearestPoliceStation()}
                className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-xs sm:text-sm h-11 rounded-2xl shadow-sm flex items-center justify-between px-4 border border-emerald-600/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Navigation className="w-4 h-4 text-emerald-200 shrink-0" />
                  <span className="truncate">Navigate In-App Only</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs bg-white/20 px-2.5 py-1 rounded-lg shrink-0">
                  <Shield className="w-3.5 h-3.5 text-white" />
                  <span>Nearest Safe Haven</span>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => void showNearestPoliceStationRoute()}
                className="border-emerald-200 text-emerald-900 hover:bg-emerald-50 font-semibold text-xs h-11 rounded-2xl px-3 shrink-0"
              >
                <Route className="w-3.5 h-3.5 mr-1 text-primary" />
                View Directions
              </Button>
            </div>

            {/* Category Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
              <Button
                size="sm"
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setActiveFilter('all')}
                className="rounded-full text-xs font-semibold shrink-0"
              >
                All Safe Places ({safePlaces.length})
              </Button>
              <Button
                size="sm"
                variant={activeFilter === 'police' ? 'default' : 'outline'}
                onClick={() => setActiveFilter('police')}
                className={`rounded-full text-xs font-semibold shrink-0 border-emerald-200 ${
                  activeFilter === 'police' ? 'bg-primary text-white hover:bg-primary/90' : ''
                }`}
              >
                <Shield className="w-3.5 h-3.5 mr-1" />
                SAPS Police Stations ({safePlaces.filter(p => p.type === 'police').length})
              </Button>
              <Button
                size="sm"
                variant={activeFilter === 'hospital' ? 'default' : 'outline'}
                onClick={() => setActiveFilter('hospital')}
                className={`rounded-full text-xs font-semibold shrink-0 border-emerald-200 ${
                  activeFilter === 'hospital' ? 'bg-primary text-white hover:bg-primary/90' : ''
                }`}
              >
                <Hospital className="w-3.5 h-3.5 mr-1" />
                Trauma Hospitals ({safePlaces.filter(p => p.type === 'hospital').length})
              </Button>
            </div>

            {/* Nearest Safe Places List */}
            <div className="flex-1 space-y-2 pb-6">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Nearest Emergency Facilities
                </h2>
                <span className="text-[11px] text-muted-foreground">Tap to view route & navigate in-app</span>
              </div>

              {filteredPlaces.length === 0 ? (
                <div className="text-center py-8 rounded-2xl border border-dashed border-slate-200 bg-white p-6">
                  <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-foreground">Loading nearby safe places...</p>
                  <p className="text-xs text-muted-foreground mt-1">Acquiring verified facilities in your area.</p>
                </div>
              ) : (
                filteredPlaces.map((place) => {
                  const isSelected = selectedPlace?.id === place.id
                  return (
                    <Card
                      key={place.id}
                      className={`cursor-pointer transition-all rounded-2xl border shadow-2xs ${
                        isSelected
                          ? 'border-2 border-primary bg-emerald-50/60 ring-2 ring-primary/20 shadow-md'
                          : 'border-emerald-100 bg-white hover:border-emerald-300'
                      }`}
                      onClick={() => {
                        setSelectedPlace(place)
                        void getRoute(place)
                        mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                      }}
                    >
                      <CardContent className="p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              place.type === 'hospital' ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {place.type === 'hospital' ? <Hospital className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-foreground text-sm truncate">{place.name}</p>
                              {isSelected && (
                                <span className="text-[10px] bg-primary text-white font-bold px-1.5 py-0.2 rounded-md shrink-0">
                                  ACTIVE ROUTE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                            <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-emerald-800">
                              <span className="flex items-center gap-1">
                                <Route className="w-3 h-3 text-primary" />
                                {place.distanceText}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-primary" />
                                {place.duration}
                              </span>
                            </div>
                          </div>
                        </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* E-Hailing Shortcut Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-slate-700 hover:bg-slate-100 rounded-xl"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEHailing(place)
                          }}
                          title={`Request ride to ${place.name}`}
                        >
                          <Car className="w-4 h-4 text-amber-600" />
                        </Button>

                        {/* Call Button */}
                        {place.phone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-emerald-700 hover:bg-emerald-50 rounded-xl"
                            onClick={(e) => {
                              e.stopPropagation()
                              callNumber(place.phone!)
                            }}
                            title={`Call ${place.name}`}
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Direct In-App Navigation Button */}
                        <Button
                          variant="default"
                          size="sm"
                          className="h-9 px-3 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation()
                            void startInAppNavigation(place)
                          }}
                          title="Start In-App Navigation"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Navigate</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. E-HAILING MODAL (Uber / Bolt / inDrive / Safe Ride Integration)         */}
      {/* ========================================================================= */}
      <Dialog open={showEHailingModal} onOpenChange={setShowEHailingModal}>
        <DialogContent className="sm:max-w-md rounded-3xl border-emerald-100 p-5">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Car className="w-5 h-5 text-primary" />
              Request E-Hailing Ride
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select your preferred ride service. Destination coordinates will be pre-filled automatically.
            </DialogDescription>
          </DialogHeader>

          {eHailingTargetPlace && (
            <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-2xl">
              <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Destination</p>
              <p className="font-bold text-sm text-foreground">{eHailingTargetPlace.name}</p>
              <p className="text-xs text-muted-foreground truncate">{eHailingTargetPlace.address}</p>
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            {/* Uber */}
            <Button
              className="w-full bg-black hover:bg-black/90 text-white font-bold h-11 rounded-xl flex items-center justify-between px-4 shadow-xs"
              onClick={() => triggerEHailingApp('uber')}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-black tracking-wider text-sm">Uber</span>
                <span className="text-xs font-normal text-slate-300">Open in Uber</span>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-300" />
            </Button>

            {/* Bolt */}
            <Button
              className="w-full bg-[#34d186] hover:bg-[#2fc07b] text-slate-950 font-bold h-11 rounded-xl flex items-center justify-between px-4 shadow-xs"
              onClick={() => triggerEHailingApp('bolt')}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-black tracking-wider text-sm">Bolt</span>
                <span className="text-xs font-medium text-slate-800">Open in Bolt</span>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-800" />
            </Button>

            {/* inDrive */}
            <Button
              className="w-full bg-[#22c55e] hover:bg-[#1eb054] text-white font-bold h-11 rounded-xl flex items-center justify-between px-4 shadow-xs"
              onClick={() => triggerEHailingApp('indrive')}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-black tracking-wider text-sm">inDrive</span>
                <span className="text-xs font-medium text-emerald-100">Open in inDrive</span>
              </div>
              <ExternalLink className="w-4 h-4 text-emerald-100" />
            </Button>

            {/* Default System Transport / Device Chooser */}
            <Button
              variant="outline"
              className="w-full border-slate-200 text-foreground font-semibold h-11 rounded-xl flex items-center justify-between px-4"
              onClick={() => triggerEHailingApp('taxi')}
            >
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-primary" />
                <span className="text-xs">Device Default Ride / Taxi App</span>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Phola Watchdog Integration Callout */}
          {eHailingTargetPlace && (
            <div className="pt-2">
              <Button
                variant="secondary"
                className="w-full bg-emerald-100/70 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 font-semibold text-xs h-10 rounded-xl flex items-center justify-center gap-2"
                onClick={() => {
                  setShowEHailingModal(false)
                  router.push(`/safe-ride?destination=${encodeURIComponent(eHailingTargetPlace.name)}`)
                }}
              >
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Monitor this trip with Phola Safe Ride Watchdog</span>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. EMERGENCY HELP MODAL                                                   */}
      {/* ========================================================================= */}
      {showEmergencyPanel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-destructive/20 rounded-3xl shadow-2xl animate-in zoom-in-95">
            <CardContent className="p-6 text-center space-y-4">
              <div
                className={`w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto ${
                  sosActivated ? 'animate-pulse' : ''
                }`}
              >
                <Phone className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Emergency Help Center</h2>
              {currentLocation && (
                <p className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded-xl">
                  GPS: {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                </p>
              )}
              <div className="space-y-2 pt-1">
                {emergencyContactPhone && (
                  <Button
                    className="w-full bg-destructive hover:bg-destructive/90 text-white font-bold rounded-xl h-11"
                    onClick={() => callNumber(emergencyContactPhone)}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call Primary Emergency Contact
                  </Button>
                )}
                <Button
                  className="w-full bg-destructive hover:bg-destructive/90 text-white font-bold rounded-xl h-11"
                  onClick={() => callNumber('10111')}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  SAPS Police Emergency (10111)
                </Button>
                <Button
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl h-11"
                  onClick={() => callNumber('112')}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Nationwide Emergency (112)
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => callNumber('0800428428')}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  National GBV Command Centre (0800 428 428)
                </Button>
                <Button
                  className="w-full border-emerald-200 text-emerald-950 hover:bg-emerald-50"
                  variant="outline"
                  onClick={shareLocation}
                  disabled={!currentLocation}
                >
                  <Share2 className="w-4 h-4 mr-2 text-primary" />
                  Broadcast Live Coordinates
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full rounded-xl"
                onClick={() => {
                  setShowEmergencyPanel(false)
                  setSosActivated(false)
                }}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TURN-BY-TURN DIRECTIONS DRAWER / MODAL                                 */}
      {/* ========================================================================= */}
      {showDirectionsSheet && route && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <Card className="w-full max-w-lg max-h-[85vh] bg-white dark:bg-card rounded-t-3xl sm:rounded-3xl border-emerald-200 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border/80 flex items-center justify-between bg-slate-50/70 dark:bg-muted/40">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                    Turn-by-Turn Directions
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  To {selectedPlace?.name} • {route.distance} • {route.duration}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setShowDirectionsSheet(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Steps List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-border/40">
              {route.steps.map((step, idx) => {
                const isCurrent = isNavigating && idx === currentStepIndex
                const isCompleted = isNavigating && idx < currentStepIndex
                return (
                  <div
                    key={idx}
                    className={`pt-2.5 first:pt-0 p-3 rounded-2xl border transition flex items-start gap-3.5 ${
                      isCurrent
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20 text-foreground'
                        : isCompleted
                        ? 'border-border/30 bg-slate-50/50 dark:bg-muted/20 text-muted-foreground opacity-60'
                        : 'border-border/60 bg-white dark:bg-card hover:border-emerald-200'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? 'bg-primary text-white shadow-sm'
                          : isCompleted
                          ? 'bg-slate-200 dark:bg-muted text-slate-500'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-primary'
                      }`}
                    >
                      {getTurnIcon(step.modifier, step.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Step {idx + 1}
                        </span>
                        {step.distanceMeters > 0 && (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {formatMeters(step.distanceMeters)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug mt-0.5">
                        {step.instruction}
                      </p>
                      {step.streetName && step.streetName !== 'Road' && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {step.streetName}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/80 bg-slate-50/70 dark:bg-muted/40 flex items-center gap-2">
              {!isNavigating ? (
                <Button
                  className="flex-1 bg-primary hover:bg-primary/95 text-white font-bold text-xs h-10 rounded-xl shadow-xs"
                  onClick={() => {
                    setShowDirectionsSheet(false)
                    if (selectedPlace) void startInAppNavigation(selectedPlace)
                  }}
                >
                  <Navigation className="w-3.5 h-3.5 mr-1.5" />
                  Start In-App Navigation
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1 border-emerald-200 text-emerald-950 dark:text-emerald-100 font-bold text-xs h-10 rounded-xl"
                  onClick={() => setShowDirectionsSheet(false)}
                >
                  Resume Live Map View
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
      {/* 7. MANUAL AREA SELECTOR MODAL */}
      <Dialog open={showAreaSelectorModal} onOpenChange={setShowAreaSelectorModal}>
        <DialogContent className="max-w-sm rounded-3xl border-emerald-100 p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              Select South Africa Area
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose your city or region to view nearby verified SAPS stations and emergency medical facilities.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
            {SA_CITIES.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() => handleSelectArea(city)}
                className="w-full flex items-center justify-between rounded-xl p-3 text-left text-xs font-semibold hover:bg-emerald-50 active:bg-emerald-100 transition border border-transparent hover:border-emerald-200"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-foreground">{city.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground uppercase">Select</span>
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAreaSelectorModal(false)}
            className="w-full mt-2 rounded-xl text-xs"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>

      {/* 8. SHARE GPS LOCATION MODAL */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-md rounded-3xl border border-border/80 bg-background/95 p-5 shadow-2xl backdrop-blur-md">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                <Share2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  Share Your Live GPS Location
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Send your coordinates directly to trusted contacts, family, or emergency services.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {currentLocation && (
            <div className="space-y-4 pt-2">
              {/* Coordinates Pill */}
              <div className="rounded-2xl bg-muted/70 border border-border/70 p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-mono font-semibold truncate text-foreground text-xs sm:text-sm">
                    {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyLocation}
                  className="flex items-center gap-1.5 font-bold text-primary hover:text-primary/80 shrink-0 text-xs px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 dark:text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Coordinates</span>
                    </>
                  )}
                </button>
              </div>

              {/* 1. Send via Email with Input */}
              <form onSubmit={handleSendEmail} className="space-y-2 rounded-2xl bg-slate-50/80 dark:bg-muted/40 p-3.5 border border-border/60">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-primary" />
                  <span>Send to Email:</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Enter recipient email (e.g. mom@gmail.com)"
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="rounded-xl px-3.5 text-xs font-bold h-9 shrink-0 bg-primary hover:bg-primary/90 text-white shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Send
                  </Button>
                </div>
              </form>

              {/* 2. Direct Messaging Channels */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-foreground">Or send instantly via messaging:</p>
                <div className="grid grid-cols-2 gap-2">
                  {/* WhatsApp */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendWhatsApp}
                    className="h-11 justify-center rounded-2xl border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 font-bold text-xs shadow-2xs"
                  >
                    <MessageSquare className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
                    <span>WhatsApp</span>
                  </Button>

                  {/* SMS Message */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendSMS}
                    className="h-11 justify-center rounded-2xl border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-950 dark:text-sky-300 font-bold text-xs shadow-2xs"
                  >
                    <Phone className="w-4 h-4 mr-2 text-sky-600 shrink-0" />
                    <span>SMS / Text</span>
                  </Button>
                </div>

                {/* Native OS Share Sheet */}
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleNativeShare}
                    className="w-full h-10 rounded-2xl text-xs font-bold mt-1 shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    More Apps (Device Share Sheet)
                  </Button>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShareModal(false)}
                className="w-full rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground mt-1"
              >
                Cancel
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
