/**
/**
 * Offline Emergency Compass & Waypoint Navigation Engine.
 * Enables stranded commuters and victims in South Africa to navigate to the
 * nearest SAPS police station or trauma clinic with zero internet / mobile data.
 */

export interface OfflineWaypointStep {
  instruction: string
  distanceMeters: number
  durationSeconds: number
  streetName: string
  type: string
  modifier?: string
  bearingDegrees: number
  compassHeading: string
  location: [number, number]
}

/**
 * Calculates initial Great-Circle compass bearing in degrees (0° - 360°)
 * between two GPS coordinates.
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI

  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const deltaLambda = toRad(lon2 - lon1)

  const y = Math.sin(deltaLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)

  const theta = Math.atan2(y, x)
  const bearing = (toDeg(theta) + 360) % 360
  return Math.round(bearing)
}

/**
 * Converts degree bearing (0° - 360°) to 16-point compass cardinal direction.
 */
export function getCompassCardinal(bearing: number): string {
  const directions = [
    'North (N)',
    'North-North-East (NNE)',
    'North-East (NE)',
    'East-North-East (ENE)',
    'East (E)',
    'East-South-East (ESE)',
    'South-East (SE)',
    'South-South-East (SSE)',
    'South (S)',
    'South-South-West (SSW)',
    'South-West (SW)',
    'West-South-West (WSW)',
    'West (W)',
    'West-North-West (WNW)',
    'North-West (NW)',
    'North-North-West (NNW)',
  ]
  const index = Math.round(bearing / 22.5) % 16
  return directions[index]
}

export function getShortCompassCardinal(bearing: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ]
  const index = Math.round(bearing / 22.5) % 16
  return directions[index]
}

/**
 * Generates structured, resilient turn-by-turn guidance steps when
 * network routing APIs (Mapbox/OSRM) are unavailable or user has no internet.
 */
export function generateOfflineSteps(
  startLat: number,
  startLng: number,
  destinationName: string,
  destLat: number,
  destLng: number,
  distanceKm: number
): OfflineWaypointStep[] {
  const bearing = calculateBearing(startLat, startLng, destLat, destLng)
  const cardinal = getCompassCardinal(bearing)
  const shortCardinal = getShortCompassCardinal(bearing)
  const totalMeters = Math.round(distanceKm * 1000)
  const estSeconds = Math.round((distanceKm / 35) * 3600) // ~35 km/h urban average

  const steps: OfflineWaypointStep[] = []

  // Step 1: Initial Bearing & Departure
  steps.push({
    instruction: `Depart towards ${shortCardinal} (${bearing}°) directly toward ${destinationName}`,
    distanceMeters: Math.round(totalMeters * 0.3),
    durationSeconds: Math.round(estSeconds * 0.3),
    streetName: `Heading ${shortCardinal}`,
    type: 'depart',
    modifier: shortCardinal.toLowerCase(),
    bearingDegrees: bearing,
    compassHeading: cardinal,
    location: [startLng, startLat],
  })

  // Step 2: Main corridor vector (if distance > 500m)
  if (totalMeters > 500) {
    steps.push({
      instruction: `Continue straight along primary road corridor on ${shortCardinal} heading (${bearing}°)`,
      distanceMeters: Math.round(totalMeters * 0.5),
      durationSeconds: Math.round(estSeconds * 0.5),
      streetName: 'Direct Safe Corridor',
      type: 'straight',
      modifier: 'straight',
      bearingDegrees: bearing,
      compassHeading: cardinal,
      location: [
        startLng + (destLng - startLng) * 0.5,
        startLat + (destLat - startLat) * 0.5,
      ],
    })
  }

  // Step 3: Final Approach & Arrival
  steps.push({
    instruction: `Approach safe haven entrance at ${destinationName}`,
    distanceMeters: Math.round(totalMeters * 0.2),
    durationSeconds: Math.round(estSeconds * 0.2),
    streetName: destinationName,
    type: 'turn',
    modifier: 'arrive',
    bearingDegrees: bearing,
    compassHeading: cardinal,
    location: [
      startLng + (destLng - startLng) * 0.85,
      startLat + (destLat - startLat) * 0.85,
    ],
  })

  // Step 4: Arrived
  steps.push({
    instruction: `Arrive at ${destinationName} (SAPS Verified Safe Haven)`,
    distanceMeters: 0,
    durationSeconds: 0,
    streetName: destinationName,
    type: 'arrive',
    modifier: 'arrive',
    bearingDegrees: bearing,
    compassHeading: cardinal,
    location: [destLng, destLat],
  })

  return steps
}
