'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { notifySOSActivated } from '@/lib/push-notifications'
import { getNearbySAPSStations, getNearbyHospitals } from '@/lib/saps-stations'
import { getApiUrl } from '@/lib/api-client'
import 'leaflet/dist/leaflet.css'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  ArrowLeft, 
  Phone, 
  Navigation, 
  Hospital, 
  Shield,
  MapPin,
  Loader2,
  X,
  Building2,
  Clock,
  Route,
  ExternalLink,
  Share2
} from 'lucide-react'

// Dynamic import of map components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
)

interface SafePlace {
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

interface RouteInfo {
  coordinates: [number, number][]
  distance: string
  duration: string
}

const SEARCH_RADIUS_METERS = 50000

const defaultCenter = {
  lat: -26.2041,
  lng: 28.0473,
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  return `${km.toFixed(1)} km`
}

function estimateDuration(km: number): string {
  // Assume average speed of 30 km/h in urban areas
  const hours = km / 30
  const minutes = Math.round(hours * 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  return `${Math.floor(hours)}h ${minutes % 60}m`
}

export function SOSMap() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<SafePlace | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'hospital' | 'police'>('all')
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [sosActivated, setSosActivated] = useState(false)
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string | null>(null)
  const lastTapRef = useRef<number>(0)
  const watchIdRef = useRef<number | null>(null)
  const initialLocationRequestedRef = useRef(false)
  

  useEffect(() => {
    const loadEmergencyContact = async () => {
      if (!user?.id) {
        setEmergencyContactPhone(null)
        return
      }

      const { data } = await supabase
        .from('emergency_contacts')
        .select('phone, is_primary, created_at')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)

      setEmergencyContactPhone(data?.[0]?.phone ?? null)
    }

    loadEmergencyContact()
  }, [supabase, user?.id])

  const callNumber = useCallback((number: string) => {
    const cleaned = number.replace(/[^\d+]/g, '')
    if (!cleaned) return
    window.location.href = `tel:${cleaned}`
  }, [])

  const handleSpeedDial = useCallback(() => {
    void notifySOSActivated()

    if (emergencyContactPhone) {
      callNumber(emergencyContactPhone)
      return
    }

    callNumber('112')
  }, [callNumber, emergencyContactPhone])

  // Double-tap SOS activation
  useEffect(() => {
    const handleTap = () => {
      const now = Date.now()
      if (now - lastTapRef.current < 500) {
        // Double tap detected - activate SOS
        setSosActivated(true)
        setShowEmergencyPanel(true)
        void notifySOSActivated()
        // Vibrate if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200])
        }
      }
      lastTapRef.current = now
    }

    // Listen for rapid taps on the SOS button area
    const sosArea = document.getElementById('sos-trigger-area')
    if (sosArea) {
      sosArea.addEventListener('touchend', handleTap)
      sosArea.addEventListener('click', handleTap)
    }

    return () => {
      if (sosArea) {
        sosArea.removeEventListener('touchend', handleTap)
        sosArea.removeEventListener('click', handleTap)
      }
    }
  }, [])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      setIsLoading(false)
      return
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    setIsLoading(true)
    setLocationError(null)

    const handleSuccess = (position: GeolocationPosition) => {
      const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      setCurrentLocation(newLocation)
      setLocationError(null)
      setIsLoading(false)

      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        })
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      console.log('[v0] High-accuracy GPS timed out/failed, trying network fallback:', error.message)
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (fallbackErr) => {
          console.log('[v0] Coarse geolocation fallback error:', fallbackErr.message)
          setCurrentLocation(null)
          setLocationError('Unable to get your location. Tap Allow Location Access and enable location services.')
          setIsLoading(false)
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      )
    }

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    })
  }, [])

  // Get user's current location
  useEffect(() => {
    if (initialLocationRequestedRef.current) {
      return
    }

    initialLocationRequestedRef.current = true
    requestLocation()

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [requestLocation])

  // Search for nearby safe places using curated SA stations & server /api/nearby
  const searchNearbyPlaces = useCallback(async () => {
    if (!currentLocation) return

    setIsLoadingPlaces(true)
    const { lat, lng } = currentLocation

    // 1. Instant verified fallbacks from our South African database
    const sapsFallback: SafePlace[] = getNearbySAPSStations(lat, lng, 15).map((s) => ({
      id: s.code,
      name: s.name,
      address: `${s.province}, South Africa`,
      distance: s.distanceKm,
      distanceText: formatDistance(s.distanceKm),
      duration: estimateDuration(s.distanceKm),
      location: { lat: s.lat, lng: s.lng },
      type: 'police' as const,
      phone: s.phone || '10111',
    }))

    const hospitalFallback: SafePlace[] = getNearbyHospitals(lat, lng, 15).map((h) => ({
      id: h.id,
      name: h.name,
      address: h.address,
      distance: h.distanceKm,
      distanceText: formatDistance(h.distanceKm),
      duration: estimateDuration(h.distanceKm),
      location: { lat: h.lat, lng: h.lng },
      type: 'hospital' as const,
      phone: h.phone || '10177',
    }))

    const baseline = [...sapsFallback, ...hospitalFallback].sort((a, b) => a.distance - b.distance)
    setSafePlaces(baseline)

    // 2. Fetch live Overpass enriched data through our internal server endpoint
    try {
      const [policeRes, hospitalRes] = await Promise.all([
        fetch(getApiUrl(`/api/nearby?lat=${lat}&lng=${lng}&category=police_stations`))
          .then((r) => r.json())
          .catch(() => ({ results: [] })),
        fetch(getApiUrl(`/api/nearby?lat=${lat}&lng=${lng}&category=clinics_hospitals`))
          .then((r) => r.json())
          .catch(() => ({ results: [] })),
      ])

      const livePlaces: SafePlace[] = []

      if (Array.isArray(policeRes?.results)) {
        for (const item of policeRes.results) {
          livePlaces.push({
            id: item.id || `police-${item.name}`,
            name: item.name,
            address: item.address || 'Police Station',
            distance: item.distanceKm,
            distanceText: formatDistance(item.distanceKm),
            duration: estimateDuration(item.distanceKm),
            location: item.location,
            type: 'police' as const,
            phone: '10111',
          })
        }
      }

      if (Array.isArray(hospitalRes?.results)) {
        for (const item of hospitalRes.results) {
          livePlaces.push({
            id: item.id || `hospital-${item.name}`,
            name: item.name,
            address: item.address || 'Hospital / Clinic',
            distance: item.distanceKm,
            distanceText: formatDistance(item.distanceKm),
            duration: estimateDuration(item.distanceKm),
            location: item.location,
            type: 'hospital' as const,
            phone: '10177',
          })
        }
      }

      if (livePlaces.length > 0) {
        // Merge & deduplicate by name or coordinates within 300m
        const merged = [...baseline]
        for (const live of livePlaces) {
          const isDupe = merged.some(
            (b) =>
              b.name.toLowerCase() === live.name.toLowerCase() ||
              calculateDistance(b.location.lat, b.location.lng, live.location.lat, live.location.lng) < 0.3
          )
          if (!isDupe) {
            merged.push(live)
          }
        }
        setSafePlaces(merged.sort((a, b) => a.distance - b.distance).slice(0, 40))
      }
    } catch {
      // Baseline verified hospitals and SAPS are already active
    } finally {
      setIsLoadingPlaces(false)
    }
  }, [currentLocation])

  // Search places as soon as location is available
  useEffect(() => {
    if (currentLocation) {
      searchNearbyPlaces()
    }
  }, [currentLocation, searchNearbyPlaces])

  // Get route using OSRM (free routing service)
  const getRoute = useCallback(async (place: SafePlace) => {
    if (!currentLocation) return

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${place.location.lng},${place.location.lat}?overview=full&geometries=geojson`
      )
      
      if (!response.ok) throw new Error('Failed to get route')
      
      const data = await response.json()
      
      if (data.routes && data.routes[0]) {
        const routeData = data.routes[0]
        const coordinates = routeData.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
        )
        
        setRoute({
          coordinates,
          distance: formatDistance(routeData.distance / 1000),
          duration: `${Math.round(routeData.duration / 60)} min`,
        })
        setSelectedPlace(place)
      }
    } catch (error) {
      console.log('[v0] Routing error:', error)
      // Fallback to straight line
      setSelectedPlace(place)
    }
  }, [currentLocation])

  // Clear route
  const clearRoute = () => {
    setRoute(null)
    setSelectedPlace(null)
    setIsNavigating(false)
  }

  const startInAppNavigation = async (place: SafePlace) => {
    await getRoute(place)
    setIsNavigating(true)
  }

  const stopInAppNavigation = () => {
    setIsNavigating(false)
  }

  // Open external maps for navigation
  const openExternalNavigation = (place: SafePlace) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation?.lat},${currentLocation?.lng}&destination=${place.location.lat},${place.location.lng}&travelmode=driving`
    window.open(url, '_blank')
  }

  // Share location
  const shareLocation = async () => {
    if (!currentLocation) return
    
    const message = `I need help! My location: https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Emergency - My Location',
          text: message,
        })
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(message)
      alert('Location copied to clipboard')
    }
  }

  // Filter places
  const filteredPlaces = activeFilter === 'all' 
    ? safePlaces 
    : safePlaces.filter(p => p.type === activeFilter)

  // Create custom icons
  const createIcon = (color: string, isUser?: boolean) => {
    if (typeof window === 'undefined') return undefined
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet')
    
    if (isUser) {
      return L.divIcon({
        className: 'custom-marker',
        html: `<div style="width: 20px; height: 20px; background: #0D6E6E; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
    }
    
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="width: 32px; height: 32px; background: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          ${color === '#10b981' 
            ? '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>' // Hospital icon
            : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' // Shield icon
          }
        </svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-[1000] safe-top">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">Find Safety</h1>
              <p className="text-xs text-muted-foreground">
                {currentLocation 
                  ? `${safePlaces.length} locations within 50 km` 
                  : 'Getting your location...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={shareLocation}
              disabled={!currentLocation}
              title="Share my location"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Emergency SOS Panel */}
      {showEmergencyPanel && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-destructive/20">
            <CardContent className="p-6 text-center space-y-4">
              <div className={`w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto ${sosActivated ? 'animate-pulse' : ''}`}>
                <Phone className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Emergency Help</h2>
              {currentLocation && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  Your location: {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                </p>
              )}
              <div className="space-y-2">
                {emergencyContactPhone && (
                  <Button 
                    className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={() => callNumber(emergencyContactPhone)}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call Emergency Contact
                  </Button>
                )}
                <Button 
                  className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  onClick={() => window.location.href = 'tel:10111'}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  SAPS Emergency (10111)
                </Button>
                <Button 
                  className="w-full"
                  variant="default"
                  onClick={() => window.location.href = 'tel:0800428428'}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  GBV Hotline (0800 428 428)
                </Button>
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => window.location.href = 'tel:112'}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Emergency (112)
                </Button>
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={shareLocation}
                  disabled={!currentLocation}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share My Location
                </Button>
              </div>
              <Button 
                variant="ghost" 
                className="w-full"
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

      {/* Map Container */}
      <div className="flex-1 relative min-h-[300px]">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Getting your location...</p>
            </div>
          </div>
        ) : locationError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted p-4">
            <Card>
              <CardContent className="p-6 text-center">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground font-medium">Location Access Required</p>
                <p className="text-sm text-muted-foreground mt-2">{locationError}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Press Allow if your browser asks for permission.
                </p>
                <Button 
                  className="mt-4"
                  onClick={() => requestLocation()}
                >
                  Allow Location Access
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <MapContainer
            center={[currentLocation?.lat || defaultCenter.lat, currentLocation?.lng || defaultCenter.lng]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            whenReady={() => setMapReady(true)}
          >
            <TileLayer
              attribution='&copy; Google Maps'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              maxZoom={20}
            />
            
            {/* Current location marker */}
            {currentLocation && (
              <Marker
                position={[currentLocation.lat, currentLocation.lng]}
                icon={createIcon('#0D6E6E', true)}
              >
                <Popup>You are here</Popup>
              </Marker>
            )}

            {/* Safe place markers */}
            {filteredPlaces.map((place) => (
              <Marker
                key={place.id}
                position={[place.location.lat, place.location.lng]}
                icon={createIcon(place.type === 'hospital' ? '#41b89d' : '#0D6E6E')}
                eventHandlers={{
                  click: () => setSelectedPlace(place),
                }}
              >
                <Popup>
                  <div className="min-w-[190px]">
                    <h3 className="font-semibold text-sm">{place.name}</h3>
                    <p className="text-xs text-gray-600 mt-1">{place.address}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Route className="w-3 h-3" />
                        {place.distanceText}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {place.duration}
                      </span>
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      <button
                        onClick={() => openExternalNavigation(place)}
                        className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 px-2.5 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-1"
                      >
                        <Navigation className="w-3 h-3" />
                        Google Maps
                      </button>
                      {place.phone && (
                        <button
                          onClick={() => callNumber(place.phone!)}
                          className="bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-semibold py-1.5 px-2 rounded-lg hover:bg-emerald-100 flex items-center justify-center"
                          title="Call phone"
                        >
                          <Phone className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Route polyline */}
            {route && (
              <Polyline
                positions={route.coordinates}
                pathOptions={{ color: '#0D6E6E', weight: 4 }}
              />
            )}
          </MapContainer>
        )}

        {/* Floating SOS Button */}
        <div
          id="sos-trigger-area"
          className="absolute top-4 right-4 z-[1000]"
        >
          <button
            onClick={() => setShowEmergencyPanel(true)}
            className="w-14 h-14 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center animate-pulse hover:scale-105 transition-transform"
            aria-label="Emergency SOS - tap for emergency options"
          >
            <span className="text-sm font-bold">SOS</span>
          </button>
          <p className="text-[10px] text-center text-muted-foreground mt-1 bg-background/80 rounded px-1">
            Tap for SOS
          </p>
        </div>

        {/* Current navigation card */}
        {selectedPlace && (
          <Card className="absolute bottom-4 left-4 right-4 z-[1000]">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {selectedPlace.type === 'hospital' && <Hospital className="w-4 h-4 text-emerald-700" />}
                    {selectedPlace.type === 'police' && <Shield className="w-4 h-4 text-primary" />}
                    {selectedPlace.type === 'shelter' && <Building2 className="w-4 h-4 text-primary" />}
                    <span className="font-medium text-foreground line-clamp-1">{selectedPlace.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {route 
                      ? `${route.distance} • ${route.duration}` 
                      : `${selectedPlace.distanceText} • ${selectedPlace.duration}`
                    }
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearRoute}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Button
                  className="flex-1 bg-primary hover:bg-primary/95 text-white font-bold text-xs h-9 rounded-xl shadow-xs"
                  onClick={() => openExternalNavigation(selectedPlace)}
                >
                  <Navigation className="w-4 h-4 mr-1.5" />
                  Open in Google Maps
                </Button>
                {selectedPlace.phone && (
                  <Button
                    variant="outline"
                    className="rounded-xl border-emerald-200 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 h-9 px-3"
                    onClick={() => callNumber(selectedPlace.phone!)}
                  >
                    <Phone className="w-4 h-4 mr-1 text-emerald-600" />
                    Call
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-semibold h-9 px-3"
                  onClick={() => {
                    if (isNavigating) {
                      stopInAppNavigation()
                    } else {
                      void startInAppNavigation(selectedPlace)
                    }
                  }}
                >
                  {isNavigating ? 'Clear Route' : 'In-App Route'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom Panel - Place List */}
      {!selectedPlace && (
        <div className="bg-background border-t border-border max-h-[40vh] overflow-hidden flex flex-col safe-bottom">
          {/* Filter tabs */}
          <div className="flex gap-2 p-3 border-b border-border overflow-x-auto">
            <Button
              size="sm"
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('all')}
              className="shrink-0"
            >
              All ({safePlaces.length})
            </Button>
            <Button
              size="sm"
              variant={activeFilter === 'hospital' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('hospital')}
              className="shrink-0"
            >
              <Hospital className="w-4 h-4 mr-1" />
              Hospitals
            </Button>
            <Button
              size="sm"
              variant={activeFilter === 'police' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('police')}
              className="shrink-0"
            >
              <Shield className="w-4 h-4 mr-1" />
              Police
            </Button>
          </div>

          {/* Places list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoadingPlaces ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPlaces.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No places found within 50 km</p>
              </div>
            ) : (
              filteredPlaces.map((place) => (
                <Card 
                  key={place.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => getRoute(place)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        place.type === 'hospital' ? 'bg-emerald-100' : 'bg-blue-100'
                      }`}>
                        {place.type === 'hospital' && <Hospital className="w-5 h-5 text-emerald-600" />}
                        {place.type === 'police' && <Shield className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground line-clamp-1">{place.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{place.address}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Route className="w-3 h-3" />
                            {place.distanceText}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {place.duration}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {place.phone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation()
                              callNumber(place.phone!)
                            }}
                            title={`Call ${place.name}`}
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation()
                            openExternalNavigation(place)
                          }}
                          title="Open in Google Maps"
                        >
                          <Navigation className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
