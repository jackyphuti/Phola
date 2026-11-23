/**
 * Phola Python Runtime API Client.
 * Bridges the Next.js frontend with the Python runtime service (http://127.0.0.1:8000 / /py-api).
 * Provides live Safe Ride watchdog telemetry, Section 212 SAPS sworn docket generation,
 * and real-time geospatial risk assessments.
 */

import { getApiUrl } from '@/lib/api-client'

export interface WatchdogTelemetryPayload {
  sessionId: string
  lat: number
  lng: number
  timestamp?: number
  speedKmh?: number
  heading?: number
  serviceId?: string
  destination?: string
  destLat?: number
  destLng?: number
}

export interface WatchdogTelemetryResponse {
  sessionId: string
  status: 'safe' | 'warning' | 'critical'
  safetyScore: number
  inDangerZone: boolean
  dangerZoneName: string | null
  riskLevel: 'safe' | 'moderate' | 'high'
  deviationMeters: number
  isStationary: boolean
  dwellSeconds: number
  nearestStation: {
    code: string | null
    name: string
    phone: string
    distanceMeters: number | null
    distanceKm: number | null
  }
  alerts: string[]
  breadcrumbCount: number
  lastUpdated: number
}

export interface SapsDocketResponse {
  docketNumber: string
  sha256Checksum: string
  swornStatementText: string
  sapsStation: {
    name: string
    code: string | null
    phone: string
    province: string
  }
  statutesCited: string[]
  evidenceCount: number
  generatedAt: string
}

export interface LocationRiskResponse {
  level: 'safe' | 'moderate' | 'high'
  zoneName: string
  region: string
  badgeText: string
  color: 'red' | 'amber' | 'emerald'
  advice: string
  riskFactors: string[]
  distanceToCentroidMeters: number | null
  inZone: boolean
  nearestStation?: {
    code: string | null
    name: string
    phone: string
    distanceMeters: number | null
    distanceKm: number | null
  }
}

/**
 * Resolves the service base URL.
 * Prefers relative `/py-api` (proxied by Next.js rewrites) in browser/WebView,
 * and falls back to direct `http://127.0.0.1:8000` when needed.
 */
function getApiEndpoint(path: string): string {
  return getApiUrl(`/py-api${path}`)
}

/**
 * Checks if the Phola Python background service is active and responsive.
 */
export async function checkPythonServiceHealth(): Promise<{ healthy: boolean; data?: any }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    const res = await fetch(getApiEndpoint('/health'), {
      signal: controller.signal,
      cache: 'no-store'
    })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      return { healthy: true, data }
    }
  } catch {}

  // Direct fallback probe for local dev
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1500)
    const res = await fetch('http://127.0.0.1:8000/health', {
      signal: controller.signal,
      cache: 'no-store'
    })
    clearTimeout(timeout)
    if (res.ok) {
      const data = await res.json()
      return { healthy: true, data }
    }
  } catch {}

  return { healthy: false }
}

/**
 * Streams real-time GPS telemetry to the Python watchdog engine.
 * Computes corridor cross-track deviations, stationary dwell times, and active risk scoring.
 */
export async function sendWatchdogTelemetry(
  payload: WatchdogTelemetryPayload
): Promise<WatchdogTelemetryResponse | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3500)

    const res = await fetch(getApiEndpoint('/watchdog/telemetry'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      return (await res.json()) as WatchdogTelemetryResponse
    }
  } catch {}

  // Direct localhost fallback
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch('http://127.0.0.1:8000/watchdog/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      return (await res.json()) as WatchdogTelemetryResponse
    }
  } catch {}

  return null
}

/**
 * Closes an active watchdog session in the Python engine.
 */
export async function closeWatchdogSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(getApiEndpoint('/watchdog/close'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Generates an official, court-admissible Section 212 SAPS Sworn Docket Statement
 * with SHA-256 cryptographic chain-of-custody seal and statutory clauses.
 */
export async function generateSapsDocket(incident: {
  id?: string
  incidentId?: string
  complainantName?: string
  complainantPhone?: string
  incidentType?: string
  crimeType?: string
  severity?: string | null
  description?: string | null
  location?: string | null
  dateOccurred?: string | null
  perpetratorRelationship?: string | null
  sapsStationCode?: string | null
  sapsStationName?: string | null
  evidenceFiles?: Array<any> | null
  userId?: string
}): Promise<SapsDocketResponse | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(getApiEndpoint('/docket/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      return (await res.json()) as SapsDocketResponse
    }
  } catch {}

  // Direct localhost fallback
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch('http://127.0.0.1:8000/docket/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      return (await res.json()) as SapsDocketResponse
    }
  } catch {}

  return null
}

/**
 * Evaluates real-time geospatial risk against South Africa's 45+ safety zones.
 */
export async function evaluateLocationRiskPy(
  lat: number,
  lng: number
): Promise<LocationRiskResponse | null> {
  try {
    const res = await fetch(getApiEndpoint('/safety/evaluate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    })
    if (res.ok) {
      return (await res.json()) as LocationRiskResponse
    }
  } catch {}

  return null
}
