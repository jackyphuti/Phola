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
import { Badge } from '@/components/ui/badge'
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
  ExternalLink,
  ShieldCheck,
  WifiOff,
  Compass,
  ListOrdered,
  Send,
  Mail,
  MessageSquare,
  Copy,
  Check,
  Users,
  UserPlus,
  BellRing,
  AlertTriangle,
  AlertCircle
} from 'lucide-react'
import { GuardianCircleModal } from '@/components/guardian-circle-modal'
import {
  fetchLocationShares,
  broadcastLiveLocation,
  pingUnsafeBuddies,
  resolveDistressPing,
  type LocationBuddy
} from '@/lib/location-sharing'
import { evaluateLocationSafety, type LocationSafetyReport } from '@/lib/high-risk-zones'
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
  { name: 'Hatfield (Tshwane)', lat: -25.7505, lng: 28.2385 },
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
  const announcedStepThresholdsRef = useRef<Record<string, boolean>>({})
  const wakeLockRef = useRef<any>(null)
  const lastCourseReminderAtRef = useRef<number>(0)
  const isFirstFixRef = useRef<boolean>(true)
  const autoRouteTriggeredRef = useRef<boolean>(false)
  const isRasterFallbackRef = useRef<boolean>(false)
  const isNavigatingRef = useRef<boolean>(false)
  const routeCoordsRef = useRef<[number, number][]>([])

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
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/dashboard')
    }
  }, [router])

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
  const [liveDistanceToNextManeuverMeters, setLiveDistanceToNextManeuverMeters] = useState<number | null>(null)
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

  // Mutual Guardian Circle (Live Location Sharing) State
  const [showGuardianModal, setShowGuardianModal] = useState(false)
  const [activeBuddies, setActiveBuddies] = useState<LocationBuddy[]>([])
  const [incomingRequestsCount, setIncomingRequestsCount] = useState<number>(0)
  const [isPingingUnsafe, setIsPingingUnsafe] = useState(false)
  const [myDistressActive, setMyDistressActive] = useState(false)
  const buddyMarkersRef = useRef<mapboxgl.Marker[]>([])

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


  // 3. Initialize Mapbox GL Map (Once on mount - NEVER destroy on isNavigating toggle!)
  const applyRouteLayersToMap = useCallback((map: mapboxgl.Map, coords: [number, number][]) => {
    if (!coords || coords.length === 0) return
    try {
      const routeDataGeoJSON = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: coords,
        },
      }

      const existingSource = map.getSource('route-source') as mapboxgl.GeoJSONSource | undefined
      if (existingSource) {
        existingSource.setData(routeDataGeoJSON)
      } else {
        map.addSource('route-source', {
          type: 'geojson',
          data: routeDataGeoJSON,
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
            'line-width': 15,
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
            'line-width': 9,
            'line-opacity': 0.96,
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
            'line-color': '#047857',
            'line-width': 5.5,
            'line-opacity': 1.0,
          },
        })
      }

      // 4. Directional Forward Chevrons along route
      ensureArrowImage(map, () => {
        try {
          if (!map.getLayer('route-arrows') && map.getSource('route-source')) {
            map.addLayer({
              id: 'route-arrows',
              type: 'symbol',
              source: 'route-source',
              layout: {
                'symbol-placement': 'line',
                'symbol-spacing': 70,
                'icon-image': 'route-arrow-icon',
                'icon-size': 0.75,
                'icon-rotate': 90,
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              },
            })
          }
        } catch {}
      })
    } catch (err) {
      console.warn('[Phola Map] applyRouteLayersToMap warning:', err)
    }
  }, [])

  useEffect(() => {
    isNavigatingRef.current = isNavigating
    // Resize map smoothly whenever layout switches between normal and full-screen navigation
    const timer = setTimeout(() => {
      mapRef.current?.resize()
    }, 60)
    return () => clearTimeout(timer)
  }, [isNavigating])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let map: mapboxgl.Map | null = null
    try {
      const mapStyle: string | mapboxgl.Style = MAPBOX_TOKEN
        ? 'mapbox://styles/mapbox/streets-v12'
        : OSM_RASTER_STYLE

      const cached = getCachedLocation()
      const initialCenter: [number, number] = cached
        ? [cached.lng, cached.lat]
        : [28.2385, -25.7505]

      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: mapStyle,
        center: initialCenter,
        zoom: cached ? 14.5 : 13,
        attributionControl: true,
      })

      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right')

      map.on('error', (e) => {
        if (!isRasterFallbackRef.current) {
          isRasterFallbackRef.current = true
          console.warn('[Phola Map] Vector style error, falling back to Carto/OSM raster style:', e)
          try {
            map?.setStyle(OSM_RASTER_STYLE)
          } catch (styleErr) {
            console.error('[Phola Map] Error applying fallback raster style:', styleErr)
          }
        }
      })

      map.on('load', () => {
        map?.resize()
        if (map) {
          ensureArrowImage(map)
          if (routeCoordsRef.current.length > 0) {
            applyRouteLayersToMap(map, routeCoordsRef.current)
          }
        }
      })

      map.on('style.load', () => {
        if (map) {
          ensureArrowImage(map)
          if (routeCoordsRef.current.length > 0) {
            applyRouteLayersToMap(map, routeCoordsRef.current)
          }
        }
      })

      map.on('dragstart', () => {
        if (isNavigatingRef.current) {
          setIsFollowingUser(false)
        }
      })

      mapRef.current = map
    } catch (mapErr) {
      console.warn('[Phola Map] Failed to initialize map instance:', mapErr)
    }

    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.resize()
    })
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      destinationMarkerRef.current?.remove()
      destinationMarkerRef.current = null
      placesMarkersRef.current.forEach((m) => m.remove())
      placesMarkersRef.current = []
      buddyMarkersRef.current.forEach((m) => m.remove())
      buddyMarkersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [applyRouteLayersToMap])

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

    // Fail-safe: If GPS takes longer than 2.5s, fall back to safe default area (Pretoria CBD)
    const PRETORIA_FALLBACK = { lat: -25.7479, lng: 28.2293 }
    const gpsTimeout = setTimeout(() => {
      if (isMounted) {
        setLocationStatus((prev) => {
          if (prev === 'loading') {
            const fallback = cached || PRETORIA_FALLBACK
            setCurrentLocation(fallback)
            setSelectedCityName(cached ? 'Cached GPS' : 'Pretoria CBD (Tshwane)')
            loadSafePlacesForLocation(fallback.lat, fallback.lng)
            if (mapRef.current && isFirstFixRef.current) {
              isFirstFixRef.current = false
              mapRef.current.flyTo({ center: [fallback.lng, fallback.lat], zoom: 13 })
            }
            return 'active'
          }
          return prev
        })
      }
    }, 2500)

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

  // 5. Update User Marker (High-Visibility Navigation Beacon with "YOU" label)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !currentLocation) return

    const renderMarkerContent = (el: HTMLElement) => {
      if (isNavigating) {
        el.className = 'phola-user-nav-marker'
        el.innerHTML = `
          <div class="user-heading-cone" style="transform: rotate(${userBearing}deg)">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#2563EB" stroke="#ffffff" stroke-width="2.5">
              <polygon points="12 2 19 21 12 17 5 21 12 2"/>
            </svg>
          </div>
          <div class="user-me-pill">
            <span class="user-me-dot"></span>
            <span class="user-me-text">YOU</span>
          </div>
        `
      } else {
        el.className = 'phola-user-location-marker'
        el.innerHTML = `
          <div class="user-beacon-ring"></div>
          <div class="user-beacon-core">
            <div class="user-beacon-center"></div>
          </div>
          <div class="user-me-pill">
            <span class="user-me-dot"></span>
            <span class="user-me-text">YOU</span>
          </div>
        `
      }
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.title = 'You are here'
      renderMarkerContent(el)

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map)

      userMarkerRef.current = marker
    } else {
      userMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat])
      renderMarkerContent(userMarkerRef.current.getElement())
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
          <div style="display:flex; align-items:center; gap: 8px; font-size: 11px; color: var(--primary); font-weight: 600; margin-top: 6px;">
            <span>${place.distanceText}</span>
            <span>${place.duration}</span>
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

  // 6b. Periodically sync Mutual Guardian Buddies & incoming requests
  useEffect(() => {
    let isMounted = true

    const syncBuddies = async () => {
      try {
        const data = await fetchLocationShares()
        if (isMounted) {
          setActiveBuddies(data.active || [])
          setIncomingRequestsCount(data.incoming?.length || 0)
          if (typeof data.myActiveDistress === 'boolean') {
            setMyDistressActive(data.myActiveDistress)
          }
        }
      } catch (err) {
        console.warn('[Phola Map] Buddy sync error:', err)
      }
    }

    void syncBuddies()
    const timer = setInterval(syncBuddies, 4000)

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('openBuddies') === 'true') {
        setShowGuardianModal(true)
      }
    }

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  // Broadcast user's own live coordinates to buddies
  useEffect(() => {
    if (currentLocation) {
      void broadcastLiveLocation(currentLocation)
    }
  }, [currentLocation])

  // Voice Guidance speech helper (Hands-Free Driving AI Voice Assistant)
  const speakInstruction = useCallback((text: string, options?: { force?: boolean; priority?: boolean }) => {
    if (isVoiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const cleanText = text.trim()
    if (!cleanText) return
    if (!options?.force && lastSpokenRef.current === cleanText) return

    lastSpokenRef.current = cleanText
    try {
      const synth = window.speechSynthesis
      // Wake up paused synthesis engine on mobile Chrome / Android WebView / iOS Safari
      if (synth.paused) {
        synth.resume()
      }
      if (options?.priority !== false) {
        synth.cancel()
      }

      const utterance = new SpeechSynthesisUtterance(cleanText)
      const voices = synth.getVoices()
      const preferredVoice =
        voices.find((v) => v.lang.toLowerCase().includes('en-za')) ||
        voices.find((v) => v.lang.toLowerCase().includes('en-gb')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en'))
      if (preferredVoice) {
        utterance.voice = preferredVoice
        utterance.lang = preferredVoice.lang
      } else {
        utterance.lang = 'en-ZA'
      }
      utterance.rate = 0.98
      utterance.pitch = 1.0
      utterance.volume = 1.0

      synth.speak(utterance)
    } catch {
      // ignore audio error
    }
  }, [isVoiceMuted])

  // Request / release Screen Wake Lock so phone never sleeps while driving
  const requestDrivingWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    try {
      if (!wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
        wakeLockRef.current.addEventListener?.('release', () => {
          wakeLockRef.current = null
        })
      }
    } catch {
      // wakeLock not granted or unsupported
    }
  }, [])

  const releaseDrivingWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
      } catch {}
      wakeLockRef.current = null
    }
  }, [])

  // Keep speechSynthesis voices loaded & keep wakeLock active on visibility restore
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isNavigatingRef.current) {
        void requestDrivingWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      void releaseDrivingWakeLock()
    }
  }, [requestDrivingWakeLock, releaseDrivingWakeLock])

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
      routeCoordsRef.current = coords

      // Draw highlighted route on Mapbox with emerald glow, casing, and directional forward chevrons
      const map = mapRef.current
      if (map) {
        const renderLayers = () => {
          applyRouteLayersToMap(map, coords)

          // Place High-Visibility Destination Pin Flag
          try {
            if (destinationMarkerRef.current) {
              destinationMarkerRef.current.remove()
              destinationMarkerRef.current = null
            }

            const destEl = document.createElement('div')
            destEl.className = 'destination-route-marker'
            destEl.innerHTML = `
              <div class="destination-flag-pill">
                <span class="destination-icon">${place.type === 'hospital' ? 'H' : 'SAPS'}</span>
                <span class="destination-name">${place.name}</span>
                <span class="eta-tag">${computedRoute.duration}</span>
              </div>
              <div class="destination-pin-pointer"></div>
            `
            const destMarker = new mapboxgl.Marker({ element: destEl, anchor: 'bottom' })
              .setLngLat([place.location.lng, place.location.lat])
              .addTo(map)

            destinationMarkerRef.current = destMarker
          } catch (markerErr) {
            console.warn('[Phola Map] Destination flag error:', markerErr)
          }

          // Smoothly Frame Bounds (Includes both "YOU" beacon and safe haven)
          if (!isNavigatingRef.current && coords.length > 0) {
            try {
              const bounds = new mapboxgl.LngLatBounds()
              coords.forEach((coord) => bounds.extend(coord as [number, number]))
              bounds.extend([currentLocation.lng, currentLocation.lat])
              bounds.extend([place.location.lng, place.location.lat])

              map.fitBounds(bounds, {
                padding: { top: 75, bottom: 75, left: 55, right: 55 },
                duration: 850,
                maxZoom: 16.5,
              })
            } catch (boundsErr) {
              console.warn('[Phola Map] fitBounds error:', boundsErr)
            }
          }
        }

        renderLayers()
        setTimeout(() => {
          if (mapRef.current && routeCoordsRef.current.length > 0) {
            applyRouteLayersToMap(mapRef.current, routeCoordsRef.current)
          }
        }, 300)
        setTimeout(() => {
          if (mapRef.current && routeCoordsRef.current.length > 0) {
            applyRouteLayersToMap(mapRef.current, routeCoordsRef.current)
          }
        }, 900)
      }

      return computedRoute
    } catch (e) {
      console.warn('Failed to calculate route:', e)
      setSelectedPlace(place)
      return null
    } finally {
      setIsLoadingRoute(false)
    }
  }, [currentLocation, applyRouteLayersToMap])

  // Auto-highlight route to nearest safe haven on initial load
  useEffect(() => {
    if (!currentLocation || safePlaces.length === 0 || route) return

    const nearest = safePlaces.find((p) => p.type === 'police') || safePlaces[0]
    if (nearest && !autoRouteTriggeredRef.current) {
      autoRouteTriggeredRef.current = true
      void getRoute(nearest)
    }
  }, [currentLocation, safePlaces, route, getRoute])

  // Update Mutual Guardian Buddy Markers on Mapbox
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clean up old buddy markers
    buddyMarkersRef.current.forEach((m) => m.remove())
    buddyMarkersRef.current = []

    activeBuddies.forEach((buddy) => {
      if (typeof buddy.buddyLat !== 'number' || typeof buddy.buddyLng !== 'number') return

      const el = document.createElement('div')
      el.className = buddy.buddyDistress
        ? 'phola-buddy-location-marker buddy-in-distress'
        : 'phola-buddy-location-marker'
      el.title = `${buddy.buddyName} (${buddy.buddyEmail})${buddy.buddyDistress ? ' - UNSAFE / DISTRESS ACTIVE' : ''}`

      const distKm = currentLocation
        ? calculateDistanceKm(currentLocation.lat, currentLocation.lng, buddy.buddyLat, buddy.buddyLng)
        : 0

      el.innerHTML = `
        <div class="buddy-beacon-ring"></div>
        <div class="buddy-beacon-core">
          <span class="buddy-avatar-letter">${buddy.buddyDistress ? '!' : (buddy.buddyName ? buddy.buddyName[0].toUpperCase() : 'B')}</span>
        </div>
        <div class="buddy-name-pill">
          <span class="buddy-live-dot"></span>
          <span class="buddy-name-text">${buddy.buddyDistress ? 'UNSAFE: ' : ''}${buddy.buddyName}</span>
          ${currentLocation ? `<span class="buddy-dist-tag">${formatDistance(distKm)}</span>` : ''}
        </div>
      `

      const popupHtml = buddy.buddyDistress
        ? `
        <div style="min-width: 210px; font-family: inherit;">
          <div style="font-weight: 800; font-size: 13px; color: var(--destructive);">${buddy.buddyName} (UNSAFE)</div>
          <div style="font-size: 11px; color: #7f1d1d; margin-top: 3px; font-style: italic;">&quot;${buddy.buddyDistressMessage || 'I feel unsafe right now!'}&quot;</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${buddy.buddyEmail}</div>
          <div style="display: flex; gap: 8px; font-size: 11px; color: #dc2626; font-weight: 700; margin-top: 5px;">
            <span>${formatDistance(distKm)} away</span>
            <span>DISTRESS ACTIVE</span>
          </div>
        </div>
      `
        : `
        <div style="min-width: 190px; font-family: inherit;">
          <div style="font-weight: 700; font-size: 13px; color: var(--primary);">${buddy.buddyName}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${buddy.buddyEmail}</div>
          <div style="display: flex; gap: 8px; font-size: 11px; color: #047857; font-weight: 600; margin-top: 5px;">
            <span>${formatDistance(distKm)} away</span>
            <span>Live GPS</span>
          </div>
        </div>
      `

      const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(popupHtml)
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([buddy.buddyLng, buddy.buddyLat])
        .setPopup(popup)
        .addTo(map)

      el.addEventListener('click', () => {
        const buddySafePlace: SafePlace = {
          id: `buddy-${buddy.shareId}`,
          name: `${buddy.buddyName} (Live)`,
          address: `Mutual Location Buddy (${buddy.buddyEmail})`,
          distance: distKm,
          distanceText: formatDistance(distKm),
          duration: estimateDuration(distKm),
          location: { lat: buddy.buddyLat!, lng: buddy.buddyLng! },
          type: 'police',
          phone: undefined,
        }
        setSelectedPlace(buddySafePlace)
        void getRoute(buddySafePlace)
      })

      buddyMarkersRef.current.push(marker)
    })
  }, [activeBuddies, currentLocation, getRoute])

  const handleFocusBuddy = useCallback((buddy: LocationBuddy) => {
    if (typeof buddy.buddyLat !== 'number' || typeof buddy.buddyLng !== 'number') return
    const distKm = currentLocation
      ? calculateDistanceKm(currentLocation.lat, currentLocation.lng, buddy.buddyLat, buddy.buddyLng)
      : 0

    const buddySafePlace: SafePlace = {
      id: `buddy-${buddy.shareId}`,
      name: `${buddy.buddyName} (Live)`,
      address: `Mutual Location Buddy (${buddy.buddyEmail})`,
      distance: distKm,
      distanceText: formatDistance(distKm),
      duration: estimateDuration(distKm),
      location: { lat: buddy.buddyLat, lng: buddy.buddyLng },
      type: 'police',
      phone: undefined,
    }
    setSelectedPlace(buddySafePlace)
    void getRoute(buddySafePlace)

    const map = mapRef.current
    if (map && currentLocation) {
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend([currentLocation.lng, currentLocation.lat])
      bounds.extend([buddy.buddyLng, buddy.buddyLat])
      map.fitBounds(bounds, {
        padding: { top: 90, bottom: 220, left: 55, right: 55 },
        duration: 900,
        maxZoom: 16.5,
      })
    }
  }, [currentLocation, getRoute])

  // Auto-focus buddy if launched from incoming distress alarm modal
  useEffect(() => {
    if (typeof window === 'undefined' || activeBuddies.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const targetBuddyId = params.get('focusBuddy')
    if (targetBuddyId) {
      const match = activeBuddies.find((b) => b.shareId === targetBuddyId)
      if (match) {
        handleFocusBuddy(match)
      }
    }
  }, [activeBuddies, handleFocusBuddy])

  const handleToggleUnsafePing = async () => {
    if (myDistressActive) {
      setIsPingingUnsafe(true)
      await resolveDistressPing()
      setMyDistressActive(false)
      setIsPingingUnsafe(false)
    } else {
      setIsPingingUnsafe(true)
      await pingUnsafeBuddies({
        lat: currentLocation?.lat,
        lng: currentLocation?.lng,
        message: 'I feel unsafe right now! Please check my live location and contact me.',
      })
      setMyDistressActive(true)
      setIsPingingUnsafe(false)
    }
  }

  // 8. Start Real In-App Turn-by-Turn Navigation (Hands-Free Driving Voice Guidance)
  const startInAppNavigation = async (place: SafePlace) => {
    setSelectedPlace(place)
    setHasArrived(false)
    setCurrentStepIndex(0)
    setLiveDistanceToNextManeuverMeters(null)
    setIsFollowingUser(true)
    setIsVoiceMuted(false)
    announcedStepThresholdsRef.current = {}
    lastCourseReminderAtRef.current = Date.now()

    // Request Screen Wake Lock so phone stays awake while driving
    void requestDrivingWakeLock()

    // Unlock SpeechSynthesis immediately inside the user click gesture (before any await)
    // so Android / iOS mobile browsers permit continuous background voice guidance
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume()
        }
      } catch {}
    }

    // Ensure route is computed and retrieve it
    let activeRoute = route
    if (!activeRoute || activeRoute.steps.length === 0 || selectedPlace?.id !== place.id) {
      speakInstruction(`Calculating safest driving route to ${place.name}.`, { force: true })
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

    // Full Hands-Free Driving Voice Briefing
    if (activeRoute && activeRoute.steps.length > 0) {
      const firstStep = activeRoute.steps[0]
      const secondStep = activeRoute.steps[1]
      const nextStepPreview =
        secondStep && firstStep.distanceMeters > 0
          ? ` In ${formatMeters(firstStep.distanceMeters)}, ${secondStep.instruction}.`
          : ''
      speakInstruction(
        `Starting voice navigation to ${place.name}. Total distance ${activeRoute.distance}, estimated arrival in ${activeRoute.duration}. ${firstStep.instruction}.${nextStepPreview}`,
        { force: true }
      )
    } else {
      speakInstruction(`Starting voice navigation to ${place.name}. Keep driving along the highlighted route.`, {
        force: true,
      })
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
    setLiveDistanceToNextManeuverMeters(null)
    announcedStepThresholdsRef.current = {}
    void releaseDrivingWakeLock()

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

  // Repeat current driving voice command on demand
  const repeatCurrentVoiceInstruction = useCallback(() => {
    if (!route || route.steps.length === 0) return
    const currentStep = route.steps[currentStepIndex]
    const nextStep = route.steps[currentStepIndex + 1]
    if (nextStep) {
      const distLabel =
        liveDistanceToNextManeuverMeters !== null
          ? formatMeters(liveDistanceToNextManeuverMeters)
          : currentStep?.distanceMeters
          ? formatMeters(currentStep.distanceMeters)
          : 'ahead'
      speakInstruction(`In ${distLabel}, ${nextStep.instruction}.`, { force: true })
    } else if (currentStep) {
      speakInstruction(currentStep.instruction, { force: true })
    }
  }, [route, currentStepIndex, liveDistanceToNextManeuverMeters, speakInstruction])

  // 10. Live Position Tracking & Multi-Stage Hands-Free Driving Voice Guidance
  useEffect(() => {
    if (!isNavigating) return

    const processNavigationPosition = (
      lat: number,
      lng: number,
      speedMps?: number | null,
      headingDeg?: number | null
    ) => {
      const newCoords = { lat, lng }
      setCurrentLocation(newCoords)

      // Speed (convert m/s to km/h)
      if (typeof speedMps === 'number' && speedMps >= 0) {
        setUserSpeedKmH(Math.round(speedMps * 3.6))
      }

      // Bearing
      let activeBearing = userBearing
      if (typeof headingDeg === 'number' && !isNaN(headingDeg)) {
        activeBearing = headingDeg
        setUserBearing(headingDeg)
      } else if (selectedPlace) {
        activeBearing = calculateBearing(lat, lng, selectedPlace.location.lat, selectedPlace.location.lng)
        setUserBearing(activeBearing)
      }

      // Check arrival at destination (within 35m while driving/walking)
      if (selectedPlace) {
        const distToDestMeters = Math.round(
          calculateDistanceKm(lat, lng, selectedPlace.location.lat, selectedPlace.location.lng) * 1000
        )
        if (distToDestMeters <= 35 && !hasArrived) {
          setHasArrived(true)
          setLiveDistanceToNextManeuverMeters(0)
          speakInstruction(
            `You have arrived at ${selectedPlace.name}. Stay safe.`,
            { force: true }
          )
          return
        }
      }

      // Multi-stage hands-free driving distance callouts & automatic step advancement
      if (route && route.steps.length > 0) {
        // Find if user has reached the next maneuver waypoint (or skipped ahead while driving)
        const targetStepIndex = Math.min(currentStepIndex + 1, route.steps.length - 1)
        const targetStep = route.steps[targetStepIndex]

        if (targetStep && targetStep.location) {
          const distToManeuverMeters = Math.round(
            calculateDistanceKm(lat, lng, targetStep.location[1], targetStep.location[0]) * 1000
          )
          setLiveDistanceToNextManeuverMeters(distToManeuverMeters)

          const stepKey = `step-${targetStepIndex}`

          // 1. Immediate Turn Callout & Step Advancement (<= 45m for driving responsiveness)
          if (distToManeuverMeters <= 45 && currentStepIndex < route.steps.length - 1) {
            const nextIdx = currentStepIndex + 1
            setCurrentStepIndex(nextIdx)
            announcedStepThresholdsRef.current[`${stepKey}-now`] = true
            lastCourseReminderAtRef.current = Date.now()

            const upcomingAfterThis = route.steps[nextIdx + 1]
            const followUp =
              upcomingAfterThis && route.steps[nextIdx].distanceMeters >= 80
                ? ` Then in ${formatMeters(route.steps[nextIdx].distanceMeters)}, ${upcomingAfterThis.instruction}.`
                : ''

            speakInstruction(`${targetStep.instruction} now.${followUp}`, { force: true })
          }
          // 2. 100m Pre-Turn Callout ("In 100 meters, turn...")
          else if (
            distToManeuverMeters <= 120 &&
            distToManeuverMeters > 45 &&
            !announcedStepThresholdsRef.current[`${stepKey}-100m`]
          ) {
            announcedStepThresholdsRef.current[`${stepKey}-100m`] = true
            announcedStepThresholdsRef.current[`${stepKey}-250m`] = true
            announcedStepThresholdsRef.current[`${stepKey}-500m`] = true
            lastCourseReminderAtRef.current = Date.now()
            speakInstruction(`In ${formatMeters(distToManeuverMeters)}, ${targetStep.instruction}.`, {
              force: true,
            })
          }
          // 3. 250m Advance Driving Callout ("In 250 meters, prepare to...")
          else if (
            distToManeuverMeters <= 280 &&
            distToManeuverMeters > 140 &&
            !announcedStepThresholdsRef.current[`${stepKey}-250m`]
          ) {
            announcedStepThresholdsRef.current[`${stepKey}-250m`] = true
            announcedStepThresholdsRef.current[`${stepKey}-500m`] = true
            lastCourseReminderAtRef.current = Date.now()
            speakInstruction(`In 250 meters, ${targetStep.instruction}.`, { force: true })
          }
          // 4. 500m Early Highway/Road Callout ("In 500 meters...")
          else if (
            distToManeuverMeters <= 550 &&
            distToManeuverMeters > 350 &&
            !announcedStepThresholdsRef.current[`${stepKey}-500m`]
          ) {
            announcedStepThresholdsRef.current[`${stepKey}-500m`] = true
            lastCourseReminderAtRef.current = Date.now()
            speakInstruction(`In 500 meters, ${targetStep.instruction}.`, { force: true })
          }
          // 5. Long Straight Stretch Reassurance (every 75 seconds if > 550m to turn)
          else if (
            distToManeuverMeters > 550 &&
            Date.now() - lastCourseReminderAtRef.current > 75000
          ) {
            lastCourseReminderAtRef.current = Date.now()
            const currentStreet = route.steps[currentStepIndex]?.streetName
            const streetPhrase = currentStreet && currentStreet !== 'Road' ? ` on ${currentStreet}` : ''
            speakInstruction(
              `Continue straight${streetPhrase} for ${formatMeters(distToManeuverMeters)}, then ${targetStep.instruction}.`,
              { force: true }
            )
          }
        }
      }

      // Camera follow
      const map = mapRef.current
      if (map && isFollowingUser) {
        map.easeTo({
          center: [lng, lat],
          bearing: activeBearing || 0,
          duration: 500,
        })
      }
    }

    // Subscribe to our always-on dual-mode GPS daemon + high-frequency watchPosition
    const unsubscribeDaemon = watchReliableLocation((coords) => {
      processNavigationPosition(coords.lat, coords.lng, coords.speed, coords.heading)
    })

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          processNavigationPosition(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.speed,
            pos.coords.heading
          )
        },
        (err) => console.warn('WatchPosition error:', err),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 6000 }
      )
    }

    return () => {
      unsubscribeDaemon()
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [
    isNavigating,
    isFollowingUser,
    userBearing,
    selectedPlace,
    route,
    currentStepIndex,
    hasArrived,
    speakInstruction,
  ])

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
    routeCoordsRef.current = []
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
    <div className="min-h-screen bg-background flex flex-col w-full max-w-full overflow-x-hidden">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (Hidden when in full navigation mode)                       */}
      {/* ========================================================================= */}
      {!isNavigating && (
        <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-border z-[100] safe-top shadow-2xs w-full">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:p-4 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="rounded-full h-9 w-9 shrink-0"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="font-bold text-foreground text-sm sm:text-lg truncate">Emergency SOS & Safe Map</h1>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                  {safePlaces.length} verified safe havens nearby
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant={myDistressActive ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleToggleUnsafePing}
                disabled={isPingingUnsafe}
                aria-label={myDistressActive ? 'I am safe now (cancel distress alarm)' : 'Ring guardian phones: I feel unsafe'}
                className={
                  myDistressActive
                    ? 'bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black h-9 w-9 sm:w-auto sm:px-3 p-0 shadow-md animate-pulse border-red-500 flex items-center justify-center gap-1.5 shrink-0'
                    : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 rounded-xl text-xs font-bold h-9 w-9 sm:w-auto sm:px-3 p-0 flex items-center justify-center gap-1.5 shadow-2xs shrink-0'
                }
                title={myDistressActive ? 'I am safe now (cancel distress alarm)' : 'Ring guardian phones: I feel unsafe'}
              >
                <BellRing className={`w-4 h-4 ${myDistressActive ? 'animate-bounce text-white' : 'text-red-600'}`} />
                <span className="hidden sm:inline">
                  {myDistressActive ? 'Distress Active' : 'Feel Unsafe'}
                </span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGuardianModal(true)}
                aria-label="Mutual Live Location Sharing (Guardian Circle)"
                className="border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-xs font-bold h-9 w-9 sm:w-auto sm:px-3 p-0 flex items-center justify-center gap-1.5 shadow-2xs relative shrink-0"
                title="Mutual Live Location Sharing (Guardian Circle)"
              >
                <Users className="w-4 h-4 text-emerald-700" />
                <span className="hidden sm:inline">Guardian Circle</span>
                {incomingRequestsCount > 0 ? (
                  <span className="absolute -top-1 -right-1 sm:static flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-extrabold animate-pulse">
                    {incomingRequestsCount}
                  </span>
                ) : activeBuddies.length > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 sm:static flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                ) : null}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={shareLocation}
                disabled={!currentLocation}
                aria-label="Share GPS Location"
                title="Share GPS Location"
                className="border-emerald-200 text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-semibold h-9 w-9 sm:w-auto sm:px-3 p-0 flex items-center justify-center gap-1.5 shrink-0"
              >
                <Share2 className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">Share GPS</span>
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN MAP CONTAINER & IN-APP NAVIGATION HUD                             */}
      {/* ========================================================================= */}
      <div className={`flex-1 flex flex-col min-w-0 max-w-full ${isNavigating ? 'p-0 w-full h-screen fixed inset-0 z-[150] bg-background' : 'p-3 sm:p-4 max-w-5xl mx-auto w-full gap-3'}`}>
        
        {/* LIVE LOCATION REALISTIC RISK & SAFETY STATUS BAR */}
        {!isNavigating && currentLocation && (() => {
          const safetyReport = evaluateLocationSafety(currentLocation.lat, currentLocation.lng)
          return (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-2xs transition-all ${
                safetyReport.level === 'high'
                  ? 'bg-red-50/95 dark:bg-red-950/40 border-red-300 text-red-900 dark:text-red-200'
                  : safetyReport.level === 'moderate'
                  ? 'bg-amber-50/95 dark:bg-amber-950/40 border-amber-300 text-amber-950 dark:text-amber-200'
                  : 'bg-emerald-50/95 dark:bg-emerald-950/40 border-emerald-300 text-emerald-950 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-1.5 rounded-xl text-white shrink-0 shadow-xs ${
                    safetyReport.level === 'high'
                      ? 'bg-red-600 animate-pulse'
                      : safetyReport.level === 'moderate'
                      ? 'bg-amber-600'
                      : 'bg-emerald-600'
                  }`}
                >
                  {safetyReport.level === 'high' ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : safetyReport.level === 'moderate' ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md ${
                        safetyReport.level === 'high'
                          ? 'bg-red-200/90 text-red-900 font-extrabold'
                          : safetyReport.level === 'moderate'
                          ? 'bg-amber-200/90 text-amber-950 font-extrabold'
                          : 'bg-emerald-200/90 text-emerald-900 font-extrabold'
                      }`}
                    >
                      {safetyReport.badgeText}
                    </span>
                    <span className="font-bold text-xs truncate">{safetyReport.zoneName}</span>
                  </div>
                  <p className="text-[11px] opacity-90 truncate mt-0.5">{safetyReport.advice}</p>
                </div>
              </div>
              {safetyReport.riskFactors && safetyReport.riskFactors.length > 0 && (
                <Badge
                  variant="outline"
                  className={`hidden md:inline-flex text-[10px] shrink-0 ${
                    safetyReport.level === 'high'
                      ? 'border-red-300 text-red-800'
                      : safetyReport.level === 'moderate'
                      ? 'border-amber-300 text-amber-900'
                      : 'border-emerald-300 text-emerald-800'
                  }`}
                >
                  {safetyReport.riskFactors[0]}
                </Badge>
              )}
            </div>
          )
        })()}

        {/* ACTIVE GUARDIAN CIRCLE BUDDIES & INVITE STRIP */}
        {!isNavigating && (activeBuddies.length > 0 || incomingRequestsCount > 0) && (
          <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-3 rounded-2xl bg-white border border-emerald-200/80 shadow-2xs">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5 shrink-0">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              Buddies:
            </span>

            {incomingRequestsCount > 0 && (
              <button
                type="button"
                onClick={() => setShowGuardianModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-extrabold shrink-0 transition cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                <span>{incomingRequestsCount} Pending Invite{incomingRequestsCount > 1 ? 's' : ''}</span>
              </button>
            )}

            {activeBuddies.map((buddy) => {
              const hasGps = typeof buddy.buddyLat === 'number' && typeof buddy.buddyLng === 'number'
              const distText =
                hasGps && currentLocation
                  ? formatDistance(
                      calculateDistanceKm(
                        currentLocation.lat,
                        currentLocation.lng,
                        buddy.buddyLat!,
                        buddy.buddyLng!
                      )
                    )
                  : 'Syncing GPS'

              return (
                <button
                  key={buddy.shareId}
                  type="button"
                  onClick={() => (hasGps ? handleFocusBuddy(buddy) : setShowGuardianModal(true))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold shrink-0 transition cursor-pointer ${
                    buddy.buddyDistress
                      ? 'bg-red-600 text-white border-red-700 animate-pulse shadow-sm'
                      : 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950 border-emerald-200'
                  }`}
                  title={hasGps ? `Focus map on ${buddy.buddyName}` : 'Waiting for buddy GPS signal'}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      buddy.buddyDistress
                        ? 'bg-white animate-ping'
                        : hasGps
                        ? 'bg-emerald-500'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span className="max-w-[130px] truncate">{buddy.buddyName}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      buddy.buddyDistress
                        ? 'bg-red-800 text-white font-black'
                        : 'bg-white/90 text-emerald-800 border border-emerald-200/60'
                    }`}
                  >
                    {buddy.buddyDistress ? 'SOS ALERT' : distText}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Map Canvas Box */}
        <div className={`overflow-hidden relative ${
          isNavigating 
            ? 'w-full h-full flex-1' 
            : 'w-full h-[400px] min-h-[400px] sm:h-[480px] sm:min-h-[480px] rounded-2xl border border-emerald-200 shadow-sm bg-slate-100'
        }`}>
          {/* Mapbox Canvas Mount */}
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

          {/* ------------------------------------------------------------- */}
          {/* ACTIVE IN-APP NAVIGATION TOP HUD BANNER (Hands-Free Driving)  */}
          {/* ------------------------------------------------------------- */}
          {isNavigating && route && route.steps.length > 0 && (
            <div className="absolute top-4 left-4 right-4 z-30 flex flex-col gap-2 max-w-lg mx-auto pointer-events-auto">
              <div className="rounded-2xl bg-white/95 text-slate-900 backdrop-blur-md border-2 border-primary p-4 shadow-xl flex items-center justify-between gap-3">
                <div
                  className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                  onClick={repeatCurrentVoiceInstruction}
                  title="Tap to hear driving voice command again"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md">
                    {getTurnIcon(
                      (route.steps[currentStepIndex + 1] || route.steps[currentStepIndex])?.modifier,
                      (route.steps[currentStepIndex + 1] || route.steps[currentStepIndex])?.type
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-primary">
                        {liveDistanceToNextManeuverMeters !== null && liveDistanceToNextManeuverMeters > 0
                          ? `In ${formatMeters(liveDistanceToNextManeuverMeters)}`
                          : route.steps[currentStepIndex]?.distanceMeters > 0
                          ? `In ${formatMeters(route.steps[currentStepIndex].distanceMeters)}`
                          : 'Now'}
                      </p>
                      <span className="text-[10px] font-bold bg-muted text-foreground px-1.5 py-0.5 rounded-md">
                        {isVoiceMuted ? 'Voice Muted' : 'Voice Guidance'}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight line-clamp-2">
                      {(route.steps[currentStepIndex + 1] || route.steps[currentStepIndex])?.instruction ||
                        `Proceed to ${selectedPlace?.name}`}
                    </h2>
                    {route.steps[currentStepIndex + 2] && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        Then: {route.steps[currentStepIndex + 2].instruction}
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
                    <ListOrdered className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Steps</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:bg-emerald-50 shrink-0 rounded-full h-9 w-9"
                    onClick={() => {
                      const nextMute = !isVoiceMuted
                      setIsVoiceMuted(nextMute)
                      if (!nextMute && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        setTimeout(() => repeatCurrentVoiceInstruction(), 80)
                      } else if (nextMute && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                        window.speechSynthesis.cancel()
                      }
                    }}
                    title={isVoiceMuted ? 'Unmute hands-free voice guidance' : 'Mute voice guidance'}
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

        </div>

        {/* ------------------------------------------------------------- */}
        {/* SELECTED DESTINATION & ROUTE CARD (Docked Cleanly Below Map)  */}
        {/* ------------------------------------------------------------- */}
        {!isNavigating && selectedPlace && (
          <Card className="border-2 border-emerald-500/80 bg-white text-slate-900 shadow-lg rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedPlace.type === 'hospital' ? 'bg-emerald-100 text-emerald-700' : 'bg-teal-100 text-teal-800'
                    }`}>
                      {selectedPlace.type === 'hospital' ? (
                        <Hospital className="w-4 h-4" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                          {selectedPlace.name}
                        </h3>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                          Selected Route
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{selectedPlace.address}</p>
                    </div>
                  </div>

                  {/* Route Metrics and Compass Heading */}
                  <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs font-semibold">
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
                    <div className="text-[11px] text-slate-700 mt-2 p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        <strong>Next turn:</strong> {route.steps[0].instruction}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  className="flex-1 min-w-[180px] bg-primary hover:bg-primary/90 text-white font-bold text-xs h-10 rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                  onClick={() => void startInAppNavigation(selectedPlace)}
                  disabled={isLoadingRoute}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Start Voice Turn-by-Turn Navigation</span>
                </Button>

                {route && route.steps.length > 0 && (
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-950 hover:bg-emerald-50 text-xs font-semibold h-10 rounded-xl px-3"
                    onClick={() => setShowDirectionsSheet(true)}
                  >
                    <ListOrdered className="w-3.5 h-3.5 mr-1 text-primary" />
                    Steps ({route.steps.length})
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="border-emerald-200 text-emerald-950 hover:bg-emerald-50 text-xs font-semibold h-10 rounded-xl px-3"
                  onClick={() => handleOpenEHailing(selectedPlace)}
                  title="Request Ride (Uber / Bolt)"
                >
                  <Car className="w-3.5 h-3.5 text-primary" />
                </Button>

                {selectedPlace.phone && (
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-950 hover:bg-emerald-50 text-xs font-semibold h-10 rounded-xl px-3"
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
                              `EMERGENCY DISTRESS: I am stranded without internet. GPS: ${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}. Heading towards: ${nearestStation.name} (${offlineShortCardinal} ${offlineBearing}°). Live map: ${mapLink}`
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

            {/* Quick In-App Navigation Action (Shown when no destination card is docked) */}
            {!selectedPlace && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <Button
                  onClick={() => void navigateToNearestPoliceStation()}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-xs sm:text-sm h-11 rounded-2xl shadow-sm flex items-center justify-between px-4 border border-emerald-600/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Navigation className="w-4 h-4 text-emerald-200 shrink-0" />
                    <span className="truncate">Navigate to Nearest Safe Haven</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs bg-white/20 px-2.5 py-1 rounded-lg shrink-0">
                    <Shield className="w-3.5 h-3.5 text-white" />
                    <span>Auto-Route</span>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => void showNearestPoliceStationRoute()}
                  className="border-emerald-200 text-emerald-900 hover:bg-emerald-50 font-semibold text-xs h-11 rounded-2xl px-3 shrink-0"
                >
                  <Route className="w-3.5 h-3.5 mr-1 text-primary" />
                  Preview Route
                </Button>
              </div>
            )}

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

      {/* 9. MUTUAL GUARDIAN CIRCLE (FIND MY) MODAL */}
      <GuardianCircleModal
        isOpen={showGuardianModal}
        onClose={() => setShowGuardianModal(false)}
        currentLocation={currentLocation}
        onFocusBuddy={handleFocusBuddy}
      />
    </div>
  )
}
