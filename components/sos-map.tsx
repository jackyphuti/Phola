'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { notifySOSActivated } from '@/lib/push-notifications'
import { getNearbySAPSStations, getNearbyHospitals } from '@/lib/saps-stations'
import { getReliableLocation, getCachedLocation, DEFAULT_SOUTH_AFRICA_LOCATION } from '@/lib/geolocation'
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
  ShieldCheck
} from 'lucide-react'

// Mapbox Token configuration (supports NEXT_PUBLIC_MAPBOX_TOKEN and NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)
const MAPBOX_TOKEN = 
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || 
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || 
  ''

mapboxgl.accessToken = MAPBOX_TOKEN

// Default South Africa Map Center [lng, lat] (Mapbox uses [lng, lat])
const DEFAULT_SA_CENTER: [number, number] = [28.0473, -26.2041]

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

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI

  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1))
  const brng = toDeg(Math.atan2(y, x))
  return (brng + 360) % 360
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

export function SOSMap() {
  const router = useRouter()
  const { user } = useAuth()
  const [supabase] = useState(() => createClient())

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const placesMarkersRef = useRef<mapboxgl.Marker[]>([])
  const watchIdRef = useRef<number | null>(null)
  const lastSpokenRef = useRef<string>('')

  // State
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'loading' | 'active' | 'denied'>('loading')
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<SafePlace | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'hospital' | 'police'>('all')

  // In-App Navigation State
  const [isNavigating, setIsNavigating] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const [isFollowingUser, setIsFollowingUser] = useState(true)
  const [userBearing, setUserBearing] = useState<number>(0)
  const [userSpeedKmH, setUserSpeedKmH] = useState<number | null>(null)
  const [hasArrived, setHasArrived] = useState(false)

  // E-Hailing Modal State
  const [showEHailingModal, setShowEHailingModal] = useState(false)
  const [eHailingTargetPlace, setEHailingTargetPlace] = useState<SafePlace | null>(null)

  // Emergency Panel State
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false)
  const [sosActivated, setSosActivated] = useState(false)
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string | null>(null)

  // 1. Fetch Emergency Contacts if authenticated
  useEffect(() => {
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

    map.on('load', () => {
      map.resize()
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
      map.remove()
      mapRef.current = null
    }
  }, [isNavigating])

  // 4. Resolve Live Coordinates
  useEffect(() => {
    let isMounted = true

    const cached = getCachedLocation()
    if (cached) {
      setCurrentLocation(cached)
      setLocationStatus('active')
      loadSafePlacesForLocation(cached.lat, cached.lng)
      if (mapRef.current) {
        mapRef.current.flyTo({ center: [cached.lng, cached.lat], zoom: 14 })
      }
    }

    void getReliableLocation().then((coords) => {
      if (!isMounted) return
      if (coords && (coords.lat !== DEFAULT_SOUTH_AFRICA_LOCATION.lat || coords.lng !== DEFAULT_SOUTH_AFRICA_LOCATION.lng)) {
        setCurrentLocation(coords)
        setLocationStatus('active')
        loadSafePlacesForLocation(coords.lat, coords.lng)

        if (mapRef.current) {
          mapRef.current.flyTo({ center: [coords.lng, coords.lat], zoom: 14 })
        }
      } else {
        setCurrentLocation(DEFAULT_SOUTH_AFRICA_LOCATION)
        setLocationStatus('denied')
        loadSafePlacesForLocation(DEFAULT_SOUTH_AFRICA_LOCATION.lat, DEFAULT_SOUTH_AFRICA_LOCATION.lng)
      }
    })

    return () => {
      isMounted = false
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
  const getRoute = useCallback(async (place: SafePlace) => {
    if (!currentLocation) return

    setIsLoadingRoute(true)
    try {
      const routingUrl = MAPBOX_TOKEN
        ? `https://api.mapbox.com/directions/v5/mapbox/driving/${currentLocation.lng},${currentLocation.lat};${place.location.lng},${place.location.lat}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`
        : `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${place.location.lng},${place.location.lat}?overview=full&geometries=geojson&steps=true`

      const response = await fetch(routingUrl)
      if (!response.ok) throw new Error('Routing request failed')

      const data = await response.json()
      if (data.routes && data.routes[0]) {
        const routeData = data.routes[0]
        const coords = routeData.geometry.coordinates as [number, number][]

        // Parse Turn-by-Turn Steps
        const rawSteps = routeData.legs?.[0]?.steps || []
        const parsedSteps: NavigationStep[] = rawSteps.map((step: any, index: number) => {
          const isLast = index === rawSteps.length - 1
          return {
            instruction: parseManeuverInstruction(step, isLast, place.name),
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

        setRoute({
          coordinates: coords,
          distance: formatDistance(routeData.distance / 1000),
          duration: `${Math.round(routeData.duration / 60)} min`,
          distanceMeters: routeData.distance,
          durationSeconds: routeData.duration,
          steps: parsedSteps,
        })
        setSelectedPlace(place)
        setCurrentStepIndex(0)

        // Draw line on mapbox
        const map = mapRef.current
        if (map) {
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
                'line-width': 6,
                'line-opacity': 0.9,
              },
            })
          }

          // Fit bounds to show route if not navigating
          if (!isNavigating) {
            const bounds = coords.reduce(
              (b, c) => b.extend(c as [number, number]),
              new mapboxgl.LngLatBounds(coords[0], coords[0])
            )
            map.fitBounds(bounds, { padding: 60, duration: 800 })
          }
        }
      }
    } catch (e) {
      console.warn('Failed to calculate route:', e)
      setSelectedPlace(place)
    } finally {
      setIsLoadingRoute(false)
    }
  }, [currentLocation, isNavigating])

  // 8. Start Real In-App Turn-by-Turn Navigation
  const startInAppNavigation = async (place: SafePlace) => {
    setSelectedPlace(place)
    setHasArrived(false)
    setCurrentStepIndex(0)
    setIsFollowingUser(true)

    // Ensure route is computed
    if (!route || route.steps.length === 0) {
      await getRoute(place)
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
    if (route && route.steps[0]) {
      speakInstruction(`Starting navigation to ${place.name}. ${route.steps[0].instruction}`)
    } else {
      speakInstruction(`Starting navigation to ${place.name}.`)
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

  // Recenter Camera to User
  const recenterToUser = () => {
    setIsFollowingUser(true)
    const map = mapRef.current
    if (map && currentLocation) {
      map.easeTo({
        center: [currentLocation.lng, currentLocation.lat],
        bearing: userBearing || 0,
        pitch: isNavigating ? 55 : 0,
        zoom: isNavigating ? 17.5 : 15,
        duration: 800,
      })
    }
  }

  // Clear Route
  const clearRoute = () => {
    stopInAppNavigation()
    setRoute(null)
    setSelectedPlace(null)

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

  // Emergency Share Location
  const shareLocation = async () => {
    if (!currentLocation) return

    const message = `EMERGENCY! I need immediate help. My GPS coordinates: https://www.openstreetmap.org/?mlat=${currentLocation.lat}&mlon=${currentLocation.lng}#map=16/${currentLocation.lat}/${currentLocation.lng}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Emergency - My GPS Location',
          text: message,
        })
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(message)
      alert('Emergency location copied to clipboard!')
    }
  }

  const callNumber = (number: string) => {
    window.location.href = `tel:${number.replace(/\s+/g, '')}`
  }

  const handleSOS = async () => {
    setSosActivated(true)
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
                onClick={() => router.back()}
                className="rounded-full"
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
          {/* STATUS BADGE (Standard View)                                  */}
          {/* ------------------------------------------------------------- */}
          {!isNavigating && (
            <div className="absolute top-3 left-3 z-10 pointer-events-none">
              {locationStatus === 'loading' ? (
                <div className="flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md border border-slate-200">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Finding your location... (South Africa default)</span>
                </div>
              ) : locationStatus === 'denied' ? (
                <div className="flex items-center gap-2 rounded-full bg-amber-500/90 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white shadow-md">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>GPS permission unavailable (Viewing South Africa)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-md border border-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                  </span>
                  <span>Live GPS Active</span>
                </div>
              )}
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
          {/* STANDARD SELECTED PLACE OVERLAY CARD (Before Starting Nav)    */}
          {/* ------------------------------------------------------------- */}
          {!isNavigating && selectedPlace && (
            <Card className="absolute bottom-3 left-3 right-3 z-10 border-emerald-200 bg-white/95 backdrop-blur-md shadow-lg rounded-2xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {selectedPlace.type === 'hospital' ? (
                        <Hospital className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Shield className="w-4 h-4 text-primary shrink-0" />
                      )}
                      <span className="font-bold text-foreground text-sm sm:text-base truncate">
                        {selectedPlace.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedPlace.address}</p>
                    <p className="text-xs font-semibold text-primary mt-1">
                      {route ? `${route.distance} • ${route.duration}` : `${selectedPlace.distanceText} • ${selectedPlace.duration}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0" onClick={clearRoute}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {/* Primary IN-APP Navigation Trigger */}
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-9 rounded-xl shadow-xs"
                    onClick={() => void startInAppNavigation(selectedPlace)}
                    disabled={isLoadingRoute}
                  >
                    <Navigation className="w-3.5 h-3.5 mr-1.5" />
                    Start In-App Navigation
                  </Button>

                  {/* Open E-Hailing Drawer (Uber / Bolt / inDrive) */}
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-900 hover:bg-emerald-50 text-xs font-semibold h-9 rounded-xl px-3"
                    onClick={() => handleOpenEHailing(selectedPlace)}
                  >
                    <Car className="w-3.5 h-3.5 mr-1 text-primary" />
                    Ride (Uber/Bolt)
                  </Button>

                  {selectedPlace.phone && (
                    <Button
                      variant="outline"
                      className="border-emerald-200 text-emerald-900 hover:bg-emerald-50 text-xs font-semibold h-9 rounded-xl px-3"
                      onClick={() => callNumber(selectedPlace.phone!)}
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
            {/* Category Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                className="rounded-full text-xs font-semibold shrink-0 border-emerald-200"
              >
                <Shield className="w-3.5 h-3.5 mr-1" />
                SAPS Police Stations
              </Button>
              <Button
                size="sm"
                variant={activeFilter === 'hospital' ? 'default' : 'outline'}
                onClick={() => setActiveFilter('hospital')}
                className="rounded-full text-xs font-semibold shrink-0 border-emerald-200"
              >
                <Hospital className="w-3.5 h-3.5 mr-1" />
                Trauma Hospitals
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
                filteredPlaces.map((place) => (
                  <Card
                    key={place.id}
                    className="cursor-pointer hover:border-emerald-300 transition-all rounded-2xl border border-emerald-100 bg-white shadow-2xs"
                    onClick={() => {
                      setSelectedPlace(place)
                      void getRoute(place)
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
                          <p className="font-semibold text-foreground text-sm truncate">{place.name}</p>
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
                          size="icon"
                          className="h-9 w-9 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            void startInAppNavigation(place)
                          }}
                          title="Start In-App Navigation"
                        >
                          <Navigation className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
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
    </div>
  )
}
