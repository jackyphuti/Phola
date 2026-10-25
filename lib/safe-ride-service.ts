export type { RideServiceId, RideServiceOption, SafeRideSession } from './safe-ride-types'
import { RideServiceId, RideServiceOption, SafeRideSession } from './safe-ride-types'

export const RIDE_SERVICES: RideServiceOption[] = [
  {
    id: 'uber',
    name: 'Uber',
    appScheme: 'uber://',
    webUrl: 'https://m.uber.com/ul/',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.ubercab',
    color: '#000000',
    badgeText: 'Uber',
    tagline: 'Connects to Uber App directly'
  },
  {
    id: 'bolt',
    name: 'Bolt',
    appScheme: 'bolt://',
    webUrl: 'https://bolt.eu/',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=ee.mtakso.client',
    color: '#34d186',
    badgeText: 'Bolt',
    tagline: 'Connects to Bolt App directly'
  },
  {
    id: 'indrive',
    name: 'inDrive',
    appScheme: 'indriver://',
    webUrl: 'https://indrive.com/',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=sinet.startup.inDriver',
    color: '#22c55e',
    badgeText: 'inDrive',
    tagline: 'Connects to inDrive App directly'
  },
  {
    id: 'taxi',
    name: 'Taxi / Other',
    appScheme: '',
    webUrl: '',
    playStoreUrl: '',
    color: '#0d9488',
    badgeText: 'Taxi',
    tagline: 'Metered, minibus, or private ride'
  }
]

export const SAFE_RIDE_STORAGE_KEY = 'phola_active_safe_ride'

export function getActiveSafeRide(): SafeRideSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SAFE_RIDE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SafeRideSession
    if (!parsed || !parsed.id || !parsed.expectedArrivalAt) {
      window.localStorage.removeItem(SAFE_RIDE_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveActiveSafeRide(session: SafeRideSession): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SAFE_RIDE_STORAGE_KEY, JSON.stringify(session))
  } catch {}
}

export function clearActiveSafeRide(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SAFE_RIDE_STORAGE_KEY)
  } catch {}
}

export function startSafeRideSession(params: {
  serviceId: RideServiceId
  destination: string
  expectedDurationMinutes: number
  notes?: string
  tripLink?: string
  startLocation?: { lat: number; lng: number; address?: string }
  contactName?: string
  contactPhone?: string
}): SafeRideSession {
  const service = RIDE_SERVICES.find((s) => s.id === params.serviceId) || RIDE_SERVICES[3]
  const now = new Date()
  const arrival = new Date(now.getTime() + params.expectedDurationMinutes * 60 * 1000)

  const session: SafeRideSession = {
    id: `ride_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    serviceId: params.serviceId,
    serviceName: service.name,
    destination: params.destination.trim() || 'My Destination',
    notes: params.notes?.trim() || undefined,
    tripLink: params.tripLink?.trim() || undefined,
    startedAt: now.toISOString(),
    expectedDurationMinutes: params.expectedDurationMinutes,
    expectedArrivalAt: arrival.toISOString(),
    status: 'active',
    startLocation: params.startLocation,
    contactName: params.contactName,
    contactPhone: params.contactPhone,
    lastCheckedInAt: now.toISOString()
  }

  saveActiveSafeRide(session)
  return session
}

export function extendSafeRideSession(additionalMinutes: number): SafeRideSession | null {
  const active = getActiveSafeRide()
  if (!active) return null

  const currentArrival = new Date(active.expectedArrivalAt).getTime()
  const baseTime = Math.max(currentArrival, Date.now())
  const newArrival = new Date(baseTime + additionalMinutes * 60 * 1000)

  const updated: SafeRideSession = {
    ...active,
    status: 'active',
    expectedDurationMinutes: active.expectedDurationMinutes + additionalMinutes,
    expectedArrivalAt: newArrival.toISOString()
  }

  saveActiveSafeRide(updated)
  return updated
}

export function calculateRemainingSeconds(session: SafeRideSession): number {
  const arrival = new Date(session.expectedArrivalAt).getTime()
  const now = Date.now()
  return Math.floor((arrival - now) / 1000)
}

export function formatCountdown(totalSeconds: number): string {
  const isNegative = totalSeconds < 0
  const absSeconds = Math.abs(totalSeconds)
  const hours = Math.floor(absSeconds / 3600)
  const minutes = Math.floor((absSeconds % 3600) / 60)
  const seconds = absSeconds % 60

  const paddedM = String(minutes).padStart(2, '0')
  const paddedS = String(seconds).padStart(2, '0')

  if (hours > 0) {
    const paddedH = String(hours).padStart(2, '0')
    return `${isNegative ? '-' : ''}${paddedH}:${paddedM}:${paddedS}`
  }
  return `${isNegative ? '-' : ''}${paddedM}:${paddedS}`
}

export function launchRideApp(serviceId: RideServiceId): void {
  if (typeof window === 'undefined') return
  const service = RIDE_SERVICES.find((s) => s.id === serviceId)
  if (!service || !service.appScheme) return

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isMobile) {
    // Try launching the native app via deep link
    window.location.href = service.appScheme
    // Fallback to web link if native app is not installed
    setTimeout(() => {
      if (document.hidden) return
      window.open(service.webUrl, '_blank')
    }, 1500)
  } else {
    window.open(service.webUrl, '_blank')
  }
}

export function generateWhatsAppDispatch(session: SafeRideSession): string {
  const destination = session.destination || 'my destination'
  const service = session.serviceName
  const remainingMins = Math.max(1, Math.round(calculateRemainingSeconds(session) / 60))

  let msg = `Phola Safe Ride Alert:\nI am taking a ${service} to ${destination}.\nExpected arrival: ~${remainingMins} mins.`

  if (session.startLocation) {
    msg += `\nPickup GPS: https://maps.google.com/?q=${session.startLocation.lat.toFixed(5)},${session.startLocation.lng.toFixed(5)}`
  }

  if (session.tripLink) {
    msg += `\nLive Trip Tracking Link: ${session.tripLink}`
  }

  msg += `\nPhola Watchdog is active. If I don't check in safely, this app will send an emergency dispatch.`
  return msg
}

export function triggerSafetyVibration(type: 'warning' | 'urgent'): void {
  if (typeof window === 'undefined' || !navigator.vibrate) return
  try {
    if (type === 'urgent') {
      navigator.vibrate([400, 200, 400, 200, 600])
    } else {
      navigator.vibrate([200, 100, 200])
    }
  } catch {}
}

export function triggerSafetyAlertAudio(): void {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35)

    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}
