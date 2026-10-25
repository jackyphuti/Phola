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
  Clock, 
  Route, 
  Share2 
} from 'lucide-react'

// Mapbox Token configuration (supports NEXT_PUBLIC_MAPBOX_TOKEN and NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)
const MAPBOX_TOKEN = 
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || 
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || 
  ''

mapboxgl.accessToken = MAPBOX_TOKEN

// Default South Africa Map Center [lng, lat] (Mapbox uses [lng, lat])
const DEFAULT_SA_CENTER: [number, number] = [28.0473, -26.2041]

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

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`
  }
  return `${km.toFixed(1)} km`
}

function estimateDuration(km: number): string {
  const hours = km / 30
  const minutes = Math.round(hours * 60)
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min`
  }
  return `${Math.floor(hours)}h ${minutes % 60}m`
}

export function SOSMap() {
  const router = useRouter()
  const { user } = useAuth()
  const [supabase] = useState(() => createClient())

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const placesMarkersRef = useRef<mapboxgl.Marker[]>([])

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'loading' | 'active' | 'denied'>('loading')
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([])
  const [selectedPlace, setSelectedPlace] = useState<SafePlace | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'hospital' | 'police'>('all')
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

    // If Mapbox token is present, use official Mapbox Streets style;
    // Otherwise fallback smoothly to high-speed CartoDB Voyager raster tiles through Mapbox GL
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

    mapRef.current = map

    // Resize observer to ensure map canvas never collapses
    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    resizeObserver.observe(mapContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // 4. Resolve Live Coordinates
  useEffect(() => {
    let isMounted = true

    // Check fast cache first
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
        // Fallback default coordinates
        setCurrentLocation(DEFAULT_SOUTH_AFRICA_LOCATION)
        setLocationStatus('denied')
        loadSafePlacesForLocation(DEFAULT_SOUTH_AFRICA_LOCATION.lat, DEFAULT_SOUTH_AFRICA_LOCATION.lng)
      }
    })

    return () => {
      isMounted = false
    }
  }, [loadSafePlacesForLocation])

  // 5. Update Pulsing User Marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || !currentLocation) return

    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'pulse-emergency-marker'
      el.title = 'Your Emergency Location'

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 18 }).setHTML(
            `<div style="font-size:12px; font-weight:600; color:#ef4444;">🚨 You Are Here (Emergency Location)</div>
             <div style="font-size:11px; color:#64748b; margin-top:2px;">${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}</div>`
          )
        )
        .addTo(map)

      userMarkerRef.current = marker
    } else {
      userMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat])
    }
  }, [currentLocation])

  // 6. Update Safe Places Markers (SAPS Police & Hospitals)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old markers
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
        <div style="min-width: 180px; font-family: inherit;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${place.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${place.address}</div>
          <div style="display:flex; align-items:center; gap: 8px; font-size: 11px; color: #0D6E6E; font-weight: 600; margin-top: 6px;">
            <span>📍 ${place.distanceText}</span>
            <span>⏱️ ${place.duration}</span>
          </div>
          <div style="margin-top: 8px; display: flex; gap: 6px;">
            ${place.phone ? `<a href="tel:${place.phone}" style="flex:1; background:#0D6E6E; color:#fff; text-align:center; padding: 5px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; text-decoration:none;">Call</a>` : ''}
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
      })

      placesMarkersRef.current.push(marker)
    })
  }, [safePlaces, activeFilter])

  // 7. Route Polyline Handling
  const getRoute = useCallback(async (place: SafePlace) => {
    if (!currentLocation) return

    try {
      const routingUrl = MAPBOX_TOKEN
        ? `https://api.mapbox.com/directions/v5/mapbox/driving/${currentLocation.lng},${currentLocation.lat};${place.location.lng},${place.location.lat}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
        : `https://router.project-osrm.org/route/v1/driving/${currentLocation.lng},${currentLocation.lat};${place.location.lng},${place.location.lat}?overview=full&geometries=geojson`

      const response = await fetch(routingUrl)
      if (!response.ok) throw new Error('Routing request failed')

      const data = await response.json()
      if (data.routes && data.routes[0]) {
        const routeData = data.routes[0]
        const coords = routeData.geometry.coordinates as [number, number][]

        setRoute({
          coordinates: coords,
          distance: formatDistance(routeData.distance / 1000),
          duration: `${Math.round(routeData.duration / 60)} min`,
        })
        setSelectedPlace(place)

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
                'line-width': 5,
                'line-opacity': 0.85,
              },
            })
          }

          // Fit bounds to show route
          const bounds = coords.reduce(
            (b, c) => b.extend(c as [number, number]),
            new mapboxgl.LngLatBounds(coords[0], coords[0])
          )
          map.fitBounds(bounds, { padding: 50, duration: 800 })
        }
      }
    } catch (e) {
      console.warn('Failed to calculate route:', e)
      setSelectedPlace(place)
    }
  }, [currentLocation])

  const clearRoute = () => {
    setRoute(null)
    setSelectedPlace(null)
    setIsNavigating(false)

    const map = mapRef.current
    if (map && map.getSource('route-source')) {
      const src = map.getSource('route-source') as mapboxgl.GeoJSONSource
      src.setData({
        type: 'FeatureCollection',
        features: [],
      })
    }
  }

  // 8. External Directions (Mobile intent or OpenStreetMap)
  const openExternalNavigation = (place: SafePlace) => {
    const lat = place.location.lat
    const lng = place.location.lng
    const name = encodeURIComponent(place.name)
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile) {
      window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${name})`
    } else {
      const originParam = currentLocation ? `${currentLocation.lat}%2C${currentLocation.lng}` : ''
      window.open(
        `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${originParam}%3B${lat}%2C${lng}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  }

  // 9. Emergency Share Location
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
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

      {/* Main Map & Interface */}
      <div className="flex-1 flex flex-col p-3 sm:p-4 max-w-5xl mx-auto w-full gap-3">
        {/* Map Container with Explicit Height and Width */}
        <div className="w-full h-[350px] min-h-[350px] sm:h-[450px] sm:min-h-[450px] rounded-2xl overflow-hidden relative border border-emerald-100 shadow-sm bg-slate-100">
          {/* Mapbox Canvas Container */}
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

          {/* Fallback Status Badge */}
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

          {/* Floating SOS Panic Button */}
          <div className="absolute top-3 right-3 z-10 flex flex-col items-center">
            <button
              onClick={handleSOS}
              className="w-14 h-14 rounded-full bg-destructive text-white shadow-xl flex items-center justify-center animate-pulse hover:scale-105 transition-transform border-2 border-white"
              aria-label="Emergency SOS - tap for instant panic dialer"
            >
              <span className="text-sm font-black tracking-wider">SOS</span>
            </button>
            <span className="text-[10px] font-bold text-destructive bg-white/95 px-1.5 py-0.5 rounded-full shadow-xs mt-1">
              Tap for Help
            </span>
          </div>

          {/* Selected Place Overlay Card */}
          {selectedPlace && (
            <Card className="absolute bottom-3 left-3 right-3 z-10 border-emerald-200 bg-white/95 backdrop-blur-md shadow-lg rounded-2xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {selectedPlace.type === 'hospital' ? (
                        <Hospital className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Shield className="w-4 h-4 text-primary" />
                      )}
                      <span className="font-bold text-foreground text-sm sm:text-base line-clamp-1">
                        {selectedPlace.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{selectedPlace.address}</p>
                    <p className="text-xs font-semibold text-primary mt-1">
                      {route ? `${route.distance} • ${route.duration}` : `${selectedPlace.distanceText} • ${selectedPlace.duration}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={clearRoute}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold text-xs h-9 rounded-xl"
                    onClick={() => openExternalNavigation(selectedPlace)}
                  >
                    <Navigation className="w-3.5 h-3.5 mr-1" />
                    Start Directions
                  </Button>
                  {selectedPlace.phone && (
                    <Button
                      variant="outline"
                      className="border-emerald-200 text-emerald-900 hover:bg-emerald-50 text-xs font-semibold h-9 rounded-xl px-3"
                      onClick={() => callNumber(selectedPlace.phone!)}
                    >
                      <Phone className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Call
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

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
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            Nearest Emergency Facilities
          </h2>
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
                onClick={() => getRoute(place)}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-primary hover:bg-primary/10 rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation()
                        openExternalNavigation(place)
                      }}
                      title="Navigate"
                    >
                      <Navigation className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Emergency Help Modal / Drawer */}
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
