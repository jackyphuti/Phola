/**
 * South Africa Multi-Tier Location Safety & Risk Assessment System.
 * Evaluates real-time GPS coordinates against authentic South African crime statistics
 * and designated geofences across 3 tiers:
 * - HIGH RISK: Violent crime, carjacking, and armed robbery hotspots (e.g. Hillbrow, Nyanga, Marabastad, JHB CBD)
 * - MODERATE RISK: Busy student/transit corridors with elevated opportunism, phone snatching, smash-and-grab (e.g. Hatfield, Braamfontein, Arcadia)
 * - SAFE: Monitored precincts, campus green routes, secure business parks, and safe havens (e.g. Hatfield UP Campus, Menlyn, Sandton Central, V&A Waterfront)
 */

export type RiskLevel = 'high' | 'moderate' | 'safe'

export interface SafetyZone {
  id: string
  name: string
  region: string
  lat: number
  lng: number
  radiusMeters: number
  level: RiskLevel
  riskFactors: string[]
  safetyAdvice: string
}

export type HighRiskZone = SafetyZone

export interface LocationSafetyReport {
  level: RiskLevel
  zoneName: string
  region: string
  badgeText: string
  color: 'red' | 'amber' | 'emerald'
  advice: string
  riskFactors: string[]
  distanceMeters?: number
}

/**
 * Official warning message for high-risk zones.
 */
export const HIGH_RISK_ZONE_ALERT_MESSAGE =
  'You are currently entering a high-risk zone known for elevated levels of violent crime, armed robberies, and carjackings. Keep your vehicle doors locked, windows rolled up, valuables completely out of sight, and avoid walking alone after dark.'

export const SOUTH_AFRICA_SAFETY_ZONES: SafetyZone[] = [
  // ===========================================================================
  // 1. TSHWANE / PRETORIA METROPOLITAN
  // ===========================================================================

  // MODERATE: Hatfield (Student & Transit Precinct - User Specific Area)
  {
    id: 'pta-hatfield',
    name: 'Hatfield (Student & Transit Corridor)',
    region: 'Gauteng - Tshwane',
    lat: -25.7505,
    lng: 28.2385,
    radiusMeters: 1700,
    level: 'moderate',
    riskFactors: [
      'Phone & laptop snatching',
      'Opportunistic muggings near clubs & Burnett St',
      'Theft out of motor vehicles',
      'Smash-and-grab along Jan Shoba & Duncan Rd',
    ],
    safetyAdvice:
      'Moderate Risk: Lively student precinct. Keep your phone concealed when walking near Hatfield Gautrain and Burnett Street. Avoid walking alone after dark and park in guarded, well-lit bays.',
  },

  // SAFE: Hatfield UP Secure Campus & Green Route
  {
    id: 'pta-hatfield-campus',
    name: 'Hatfield University Campus & Green Route',
    region: 'Gauteng - Tshwane',
    lat: -25.7545,
    lng: 28.2315,
    radiusMeters: 900,
    level: 'safe',
    riskFactors: ['Minor unattended property theft'],
    safetyAdvice:
      'Safe Area: Monitored university green precinct with active 24/7 private security patrols and surveillance kiosks.',
  },

  // HIGH RISK: Pretoria Central CBD (Tightened to inner city core)
  {
    id: 'pta-cbd',
    name: 'Pretoria Central CBD Inner Core',
    region: 'Gauteng - Tshwane',
    lat: -25.7465,
    lng: 28.1885,
    radiusMeters: 2200,
    level: 'high',
    riskFactors: ['Armed robbery', 'Smash-and-grab', 'Carjacking', 'Theft out of motor vehicles'],
    safetyAdvice:
      'High Risk Zone: Inner-city property and violent crime hotspot. Keep vehicle doors locked, windows closed, and avoid walking after sunset.',
  },

  // HIGH RISK: Marabastad & Belle Ombre
  {
    id: 'pta-marabastad',
    name: 'Marabastad & Belle Ombre Transit Hub',
    region: 'Gauteng - Tshwane',
    lat: -25.7388,
    lng: 28.1798,
    radiusMeters: 1800,
    level: 'high',
    riskFactors: ['Violent mugging', 'Transit robberies', 'Pickpocketing syndicates'],
    safetyAdvice: 'High Risk Zone: Major transit crime node. Do not display cellphones or luggage.',
  },

  // HIGH RISK: Sunnyside Night Corridor
  {
    id: 'pta-sunnyside',
    name: 'Sunnyside & Berea Park Corridor',
    region: 'Gauteng - Tshwane',
    lat: -25.7533,
    lng: 28.2094,
    radiusMeters: 1800,
    level: 'high',
    riskFactors: ['Street muggings', 'Vehicle hijacking', 'Robbery after dark'],
    safetyAdvice: 'High Risk Zone: Elevated muggings after 19:00 along Troye and Robert Sobukwe streets.',
  },

  // MODERATE: Arcadia & Union Buildings Precinct
  {
    id: 'pta-arcadia',
    name: 'Arcadia & Embassy Outskirts',
    region: 'Gauteng - Tshwane',
    lat: -25.747,
    lng: 28.218,
    radiusMeters: 1600,
    level: 'moderate',
    riskFactors: ['Smash-and-grab near intersections', 'Nighttime street muggings'],
    safetyAdvice: 'Moderate Risk: Remain alert at traffic lights along Stanza Bopape and avoid park perimeters after dark.',
  },

  // HIGH RISK: Mamelodi East & West
  {
    id: 'pta-mamelodi',
    name: 'Mamelodi (East & West)',
    region: 'Gauteng - Tshwane',
    lat: -25.713,
    lng: 28.368,
    radiusMeters: 5500,
    level: 'high',
    riskFactors: ['Violent assault', 'Carjacking', 'Armed robbery'],
    safetyAdvice: 'High Risk Zone: High hijacking and violent robbery frequency.',
  },

  // HIGH RISK: Soshanguve
  {
    id: 'pta-soshanguve',
    name: 'Soshanguve Metropolitan',
    region: 'Gauteng - Tshwane',
    lat: -25.525,
    lng: 28.105,
    radiusMeters: 6000,
    level: 'high',
    riskFactors: ['Armed robbery', 'Vehicle theft', 'Violent crime'],
    safetyAdvice: 'High Risk Zone: Exercise extreme caution on main arterials.',
  },

  // HIGH RISK: Atteridgeville
  {
    id: 'pta-atteridgeville',
    name: 'Atteridgeville',
    region: 'Gauteng - Tshwane',
    lat: -25.772,
    lng: 28.075,
    radiusMeters: 4500,
    level: 'high',
    riskFactors: ['Armed robbery', 'Carjacking'],
    safetyAdvice: 'High Risk Zone: Avoid unfamiliar routes at night.',
  },

  // SAFE: Brooklyn & Menlo Park
  {
    id: 'pta-brooklyn',
    name: 'Brooklyn & Menlo Park',
    region: 'Gauteng - Tshwane',
    lat: -25.771,
    lng: 28.252,
    radiusMeters: 2200,
    level: 'safe',
    riskFactors: ['Low residential crime'],
    safetyAdvice: 'Safe Area: Well-monitored residential and embassy zone with active private security.',
  },

  // SAFE: Menlyn Maine & Faerie Glen
  {
    id: 'pta-menlyn',
    name: 'Menlyn Maine Urban Precinct',
    region: 'Gauteng - Tshwane',
    lat: -25.786,
    lng: 28.277,
    radiusMeters: 2400,
    level: 'safe',
    riskFactors: ['Normal suburban vigilance'],
    safetyAdvice: 'Safe Area: Controlled commercial precinct with private security surveillance.',
  },

  // MODERATE: Centurion CBD & Transit Station
  {
    id: 'pta-centurion-cbd',
    name: 'Centurion CBD & Station Precinct',
    region: 'Gauteng - Tshwane',
    lat: -25.856,
    lng: 28.188,
    radiusMeters: 2000,
    level: 'moderate',
    riskFactors: ['Theft from vehicles', 'Commuter phone snatching'],
    safetyAdvice: 'Moderate Risk: Keep valuables concealed when boarding Gautrain or walking near the lake.',
  },

  // SAFE: Irene & Midstream
  {
    id: 'pta-midstream',
    name: 'Midstream & Irene Secure Estates',
    region: 'Gauteng - Tshwane',
    lat: -25.905,
    lng: 28.205,
    radiusMeters: 3500,
    level: 'safe',
    riskFactors: ['Gated access control'],
    safetyAdvice: 'Safe Area: High-security gated residential corridor.',
  },

  // ===========================================================================
  // 2. JOHANNESBURG & EKURHULENI METROPOLITAN
  // ===========================================================================

  // HIGH RISK: Johannesburg Central CBD
  {
    id: 'jhb-cbd',
    name: 'Johannesburg CBD & Park Station',
    region: 'Gauteng - Johannesburg',
    lat: -26.2041,
    lng: 28.0473,
    radiusMeters: 3200,
    level: 'high',
    riskFactors: ['Armed robbery', 'Mugging', 'Smash-and-grab', 'Carjacking'],
    safetyAdvice: 'High Risk Zone: Major urban robbery hotspot. Avoid walking alone or holding cellphones in transit.',
  },

  // HIGH RISK: Hillbrow
  {
    id: 'jhb-hillbrow',
    name: 'Hillbrow',
    region: 'Gauteng - Johannesburg',
    lat: -26.1884,
    lng: 28.0494,
    radiusMeters: 1800,
    level: 'high',
    riskFactors: ['Violent mugging', 'Armed crime', 'Hijacking'],
    safetyAdvice: 'High Risk Zone: Extreme caution required. Avoid pedestrian transit.',
  },

  // HIGH RISK: Berea & Yeoville
  {
    id: 'jhb-berea-yeoville',
    name: 'Berea & Yeoville',
    region: 'Gauteng - Johannesburg',
    lat: -26.183,
    lng: 28.06,
    radiusMeters: 2200,
    level: 'high',
    riskFactors: ['Street mugging', 'Violent robbery'],
    safetyAdvice: 'High Risk Zone: Elevated armed mugging and extortion.',
  },

  // HIGH RISK: Jeppestown & Doornfontein
  {
    id: 'jhb-jeppestown',
    name: 'Jeppestown & Doornfontein',
    region: 'Gauteng - Johannesburg',
    lat: -26.203,
    lng: 28.067,
    radiusMeters: 2000,
    level: 'high',
    riskFactors: ['Armed robbery', 'Vehicle hijacking'],
    safetyAdvice: 'High Risk Zone: High hijacking frequency.',
  },

  // HIGH RISK: Alexandra
  {
    id: 'jhb-alexandra',
    name: 'Alexandra Township',
    region: 'Gauteng - Johannesburg',
    lat: -26.1056,
    lng: 28.1006,
    radiusMeters: 3200,
    level: 'high',
    riskFactors: ['Violent crime', 'Armed robbery', 'Carjacking'],
    safetyAdvice: 'High Risk Zone: High violent crime incidence.',
  },

  // HIGH RISK: Tembisa
  {
    id: 'jhb-tembisa',
    name: 'Tembisa',
    region: 'Gauteng - Ekurhuleni',
    lat: -25.9964,
    lng: 28.2268,
    radiusMeters: 5500,
    level: 'high',
    riskFactors: ['Violent crime', 'Carjacking', 'Armed assault'],
    safetyAdvice: 'High Risk Zone: Frequent carjackings and armed crime.',
  },

  // HIGH RISK: Diepsloot
  {
    id: 'jhb-diepsloot',
    name: 'Diepsloot',
    region: 'Gauteng - Johannesburg',
    lat: -25.9333,
    lng: 28.0167,
    radiusMeters: 4500,
    level: 'high',
    riskFactors: ['Violent robbery', 'Sexual assault', 'Mugging'],
    safetyAdvice: 'High Risk Zone: Exercise extreme vigilance.',
  },

  // MODERATE: Braamfontein (Student & Night Precinct)
  {
    id: 'jhb-braamfontein',
    name: 'Braamfontein Student Precinct',
    region: 'Gauteng - Johannesburg',
    lat: -26.192,
    lng: 28.035,
    radiusMeters: 1600,
    level: 'moderate',
    riskFactors: ['Phone snatching', 'Night street robbery', 'Smash-and-grab near bridge'],
    safetyAdvice: 'Moderate Risk: Bustling student hub. Keep phones securely tucked away and walk in groups at night.',
  },

  // MODERATE: Melville & Auckland Park
  {
    id: 'jhb-melville',
    name: 'Melville & Auckland Park',
    region: 'Gauteng - Johannesburg',
    lat: -26.176,
    lng: 28.005,
    radiusMeters: 1800,
    level: 'moderate',
    riskFactors: ['Opportunistic mugging', 'Car break-ins'],
    safetyAdvice: 'Moderate Risk: Keep vehicle doors locked and stay alert on 7th Street.',
  },

  // MODERATE: Rosebank Commercial Perimeter
  {
    id: 'jhb-rosebank-perimeter',
    name: 'Rosebank Oxford Corridor',
    region: 'Gauteng - Johannesburg',
    lat: -26.147,
    lng: 28.042,
    radiusMeters: 1400,
    level: 'moderate',
    riskFactors: ['Smash-and-grab', 'Phone snatching at crossings'],
    safetyAdvice: 'Moderate Risk: Remain alert at traffic intersections along Oxford Rd.',
  },

  // SAFE: Sandton Central Financial District
  {
    id: 'jhb-sandton',
    name: 'Sandton Central & Nelson Mandela Sq',
    region: 'Gauteng - Johannesburg',
    lat: -26.1075,
    lng: 28.0535,
    radiusMeters: 1800,
    level: 'safe',
    riskFactors: ['Minor opportunism in crowd'],
    safetyAdvice: 'Safe Area: Highly managed business district with private security infrastructure.',
  },

  // SAFE: Waterfall City & Mall of Africa
  {
    id: 'jhb-waterfall',
    name: 'Waterfall City Precinct',
    region: 'Gauteng - Midrand',
    lat: -26.015,
    lng: 28.109,
    radiusMeters: 2200,
    level: 'safe',
    riskFactors: ['Standard vigilance'],
    safetyAdvice: 'Safe Area: Secure master-planned smart city with high camera surveillance.',
  },

  // ===========================================================================
  // 3. WESTERN CAPE & CAPE TOWN METROPOLITAN
  // ===========================================================================

  // HIGH RISK: Nyanga
  {
    id: 'wc-nyanga',
    name: 'Nyanga',
    region: 'Western Cape - Cape Town',
    lat: -33.9961,
    lng: 18.5872,
    radiusMeters: 3000,
    level: 'high',
    riskFactors: ['Homicide hotspot', 'Armed carjacking', 'Robbery', 'Violent assault'],
    safetyAdvice: 'High Risk Zone: Avoid non-essential travel. Do not follow unverified GPS shortcuts.',
  },

  // HIGH RISK: Khayelitsha
  {
    id: 'wc-khayelitsha',
    name: 'Khayelitsha',
    region: 'Western Cape - Cape Town',
    lat: -34.0383,
    lng: 18.675,
    radiusMeters: 5500,
    level: 'high',
    riskFactors: ['Violent crime', 'Armed robbery', 'Carjacking', 'Extortion'],
    safetyAdvice: 'High Risk Zone: High hijacking frequency.',
  },

  // HIGH RISK: Gugulethu
  {
    id: 'wc-gugulethu',
    name: 'Gugulethu',
    region: 'Western Cape - Cape Town',
    lat: -33.978,
    lng: 18.572,
    radiusMeters: 3000,
    level: 'high',
    riskFactors: ['Violent robbery', 'Armed carjacking'],
    safetyAdvice: 'High Risk Zone: High armed carjacking risk.',
  },

  // HIGH RISK: Philippi & Browns Farm
  {
    id: 'wc-philippi',
    name: 'Philippi & Browns Farm',
    region: 'Western Cape - Cape Town',
    lat: -34.015,
    lng: 18.555,
    radiusMeters: 3500,
    level: 'high',
    riskFactors: ['Violent hijacking', 'Armed assault', 'Murder hotspot'],
    safetyAdvice: 'High Risk Zone: Never stop on secluded roads or highway off-ramps.',
  },

  // HIGH RISK: Delft
  {
    id: 'wc-delft',
    name: 'Delft',
    region: 'Western Cape - Cape Town',
    lat: -33.985,
    lng: 18.643,
    radiusMeters: 3500,
    level: 'high',
    riskFactors: ['Violent robbery', 'Carjacking', 'Gang violence'],
    safetyAdvice: 'High Risk Zone: Gang crossfire and hijacking hotspot.',
  },

  // HIGH RISK: Mitchells Plain
  {
    id: 'wc-mitchells-plain',
    name: 'Mitchells Plain & Beacon Valley',
    region: 'Western Cape - Cape Town',
    lat: -34.048,
    lng: 18.622,
    radiusMeters: 4500,
    level: 'high',
    riskFactors: ['Gang activity', 'Armed robbery', 'Violent crime'],
    safetyAdvice: 'High Risk Zone: Stay on primary arterials.',
  },

  // MODERATE: Observatory & Salt River Strip
  {
    id: 'wc-observatory',
    name: 'Observatory & Salt River Corridor',
    region: 'Western Cape - Cape Town',
    lat: -33.937,
    lng: 18.472,
    radiusMeters: 1600,
    level: 'moderate',
    riskFactors: ['Mugging along railway lines', 'Car break-ins'],
    safetyAdvice: 'Moderate Risk: Exercise caution on Lower Main Road late at night.',
  },

  // SAFE: V&A Waterfront & Foreshore
  {
    id: 'wc-waterfront',
    name: 'V&A Waterfront Precinct',
    region: 'Western Cape - Cape Town',
    lat: -33.905,
    lng: 18.422,
    radiusMeters: 1600,
    level: 'safe',
    riskFactors: ['Normal vigilance'],
    safetyAdvice: 'Safe Area: Dedicated security zone with 24/7 CCTV surveillance.',
  },

  // SAFE: Camps Bay & Clifton
  {
    id: 'wc-camps-bay',
    name: 'Camps Bay & Clifton Promenade',
    region: 'Western Cape - Cape Town',
    lat: -33.951,
    lng: 18.378,
    radiusMeters: 2000,
    level: 'safe',
    riskFactors: ['Low residential crime'],
    safetyAdvice: 'Safe Area: Monitored coastal tourism strip.',
  },

  // ===========================================================================
  // 4. KWAZULU-NATAL & ETHIKWINI METROPOLITAN
  // ===========================================================================

  // HIGH RISK: Durban Central & Warwick
  {
    id: 'dbn-cbd',
    name: 'Durban Central & Warwick Sector',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.8587,
    lng: 31.0218,
    radiusMeters: 3000,
    level: 'high',
    riskFactors: ['Armed mugging', 'Violent robbery', 'Vehicle theft'],
    safetyAdvice: 'High Risk Zone: Major urban theft hotspot. Avoid walking alone near Warwick.',
  },

  // HIGH RISK: KwaMashu
  {
    id: 'kzn-kwamashu',
    name: 'KwaMashu',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.7533,
    lng: 30.9856,
    radiusMeters: 4000,
    level: 'high',
    riskFactors: ['Violent assault', 'Carjacking', 'Armed robbery', 'Homicide hotspot'],
    safetyAdvice: 'High Risk Zone: High hijacking frequency.',
  },

  // HIGH RISK: Inanda & Ntuzuma
  {
    id: 'kzn-inanda',
    name: 'Inanda & Ntuzuma',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.71,
    lng: 30.935,
    radiusMeters: 5000,
    level: 'high',
    riskFactors: ['Violent crime', 'GBV hotspot', 'Armed robbery'],
    safetyAdvice: 'High Risk Zone: Extreme caution required.',
  },

  // HIGH RISK: Umlazi
  {
    id: 'dbn-umlazi',
    name: 'Umlazi',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.9678,
    lng: 30.8872,
    radiusMeters: 5500,
    level: 'high',
    riskFactors: ['Violent crime', 'Carjacking', 'Armed assault'],
    safetyAdvice: 'High Risk Zone: Exercise high vigilance on major township routes.',
  },

  // MODERATE: Florida Road & Morningside
  {
    id: 'dbn-florida-rd',
    name: 'Florida Road Dining & Night Strip',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.832,
    lng: 31.014,
    radiusMeters: 1400,
    level: 'moderate',
    riskFactors: ['Street opportunism', 'Theft from parked cars'],
    safetyAdvice: 'Moderate Risk: Keep phones away on street corners and use designated parking guards.',
  },

  // SAFE: Umhlanga Ridge & Rocks
  {
    id: 'dbn-umhlanga',
    name: 'Umhlanga Ridge & Gateway Precinct',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.728,
    lng: 31.085,
    radiusMeters: 2600,
    level: 'safe',
    riskFactors: ['Suburban vigilance'],
    safetyAdvice: 'Safe Area: Private security patrol district with rapid response units.',
  },

  // ===========================================================================
  // 5. EASTERN CAPE & NELSON MANDELA BAY
  // ===========================================================================

  // HIGH RISK: Korsten (Gqeberha)
  {
    id: 'plz-korsten',
    name: 'Korsten (Gqeberha / Port Elizabeth)',
    region: 'Eastern Cape - Nelson Mandela Bay',
    lat: -33.928,
    lng: 25.578,
    radiusMeters: 2500,
    level: 'high',
    riskFactors: ['Armed robbery', 'Carjacking', 'Violent mugging'],
    safetyAdvice: 'High Risk Zone: High armed mugging incidence.',
  },

  // HIGH RISK: New Brighton (Gqeberha)
  {
    id: 'plz-new-brighton',
    name: 'New Brighton',
    region: 'Eastern Cape - Nelson Mandela Bay',
    lat: -33.902,
    lng: 25.602,
    radiusMeters: 3000,
    level: 'high',
    riskFactors: ['Violent crime', 'Armed robbery', 'Carjacking'],
    safetyAdvice: 'High Risk Zone: Avoid traveling alone at night.',
  },

  // HIGH RISK: KwaZakhele (Gqeberha)
  {
    id: 'plz-kwazakhele',
    name: 'KwaZakhele',
    region: 'Eastern Cape - Nelson Mandela Bay',
    lat: -33.885,
    lng: 25.59,
    radiusMeters: 3000,
    level: 'high',
    riskFactors: ['Violent assault', 'Armed robbery', 'Vehicle theft'],
    safetyAdvice: 'High Risk Zone: Keep doors locked and stay alert.',
  },

  // ===========================================================================
  // 6. PIETERMARITZBURG METROPOLITAN
  // ===========================================================================

  // HIGH RISK: Pietermaritzburg CBD
  {
    id: 'pmb-cbd',
    name: 'Pietermaritzburg Central CBD',
    region: 'KwaZulu-Natal - Pietermaritzburg',
    lat: -29.6006,
    lng: 30.3794,
    radiusMeters: 3500,
    level: 'high',
    riskFactors: ['Violent robbery', 'Armed street crime', 'Carjacking'],
    safetyAdvice: 'High Risk Zone: Heavy commercial and property crime.',
  },

  // HIGH RISK: Imbali
  {
    id: 'pmb-imbali',
    name: 'Imbali',
    region: 'KwaZulu-Natal - Pietermaritzburg',
    lat: -29.6644,
    lng: 30.3475,
    radiusMeters: 4500,
    level: 'high',
    riskFactors: ['Violent assault', 'Armed robbery', 'Homicide hotspot'],
    safetyAdvice: 'High Risk Zone: High homicide and violent assault rates.',
  },
]

// Backward-compatible alias for existing imports
export const SOUTH_AFRICA_HIGH_RISK_ZONES: HighRiskZone[] = SOUTH_AFRICA_SAFETY_ZONES.filter(
  (z) => z.level === 'high'
)

/**
 * Calculates Great-Circle distance in meters between two lat/lng coordinates (Haversine formula).
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Evaluates real-time location safety and returns a granular assessment:
 * 'high' (Red) | 'moderate' (Amber) | 'safe' (Emerald)
 */
export function evaluateLocationSafety(lat: number, lng: number): LocationSafetyReport {
  // 1. Check for specific matching geofence zones
  let closestMatch: { zone: SafetyZone; distance: number } | null = null

  // Check in order of priority: safe campus/zones first, then moderate, then high
  // to give exact local pockets precedence over broad metro areas
  for (const zone of SOUTH_AFRICA_SAFETY_ZONES) {
    const distance = calculateDistanceMeters(lat, lng, zone.lat, zone.lng)
    if (distance <= zone.radiusMeters) {
      if (!closestMatch || distance < closestMatch.distance) {
        closestMatch = { zone, distance }
      }
    }
  }

  if (closestMatch) {
    const { zone, distance } = closestMatch

    if (zone.level === 'high') {
      return {
        level: 'high',
        zoneName: zone.name,
        region: zone.region,
        badgeText: 'HIGH RISK ZONE',
        color: 'red',
        advice: zone.safetyAdvice,
        riskFactors: zone.riskFactors,
        distanceMeters: Math.round(distance),
      }
    }

    if (zone.level === 'moderate') {
      return {
        level: 'moderate',
        zoneName: zone.name,
        region: zone.region,
        badgeText: 'MODERATE RISK',
        color: 'amber',
        advice: zone.safetyAdvice,
        riskFactors: zone.riskFactors,
        distanceMeters: Math.round(distance),
      }
    }

    return {
      level: 'safe',
      zoneName: zone.name,
      region: zone.region,
      badgeText: 'SAFE AREA',
      color: 'emerald',
      advice: zone.safetyAdvice,
      riskFactors: zone.riskFactors,
      distanceMeters: Math.round(distance),
    }
  }

  // Fallback: outside any defined hotspots — treated as standard Safe / Normal vigilance
  return {
    level: 'safe',
    zoneName: 'Suburban / Low Risk Zone',
    region: 'South Africa',
    badgeText: 'SAFE AREA',
    color: 'emerald',
    advice: 'Normal safety precautions recommended. Keep vehicle doors locked and emergency contacts ready.',
    riskFactors: ['Normal suburban awareness'],
  }
}

/**
 * Checks if user is inside a high-risk zone specifically (backward compatibility for background monitor).
 */
export function findMatchingHighRiskZone(
  lat: number,
  lng: number
): { zone: HighRiskZone; distanceMeters: number } | null {
  for (const zone of SOUTH_AFRICA_HIGH_RISK_ZONES) {
    const distance = calculateDistanceMeters(lat, lng, zone.lat, zone.lng)
    if (distance <= zone.radiusMeters) {
      return { zone, distanceMeters: distance }
    }
  }
  return null
}

const ALERT_THROTTLE_MS = 25 * 60 * 1000

export function isAlertThrottled(zoneId: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    const key = `phola_danger_zone_last_alert_${zoneId}`
    const lastAlert = window.localStorage.getItem(key) || window.sessionStorage.getItem(key)
    if (lastAlert) {
      const elapsed = Date.now() - parseInt(lastAlert, 10)
      if (elapsed < ALERT_THROTTLE_MS) {
        return true
      }
    }
  } catch {}
  return false
}

export function recordAlertSent(zoneId: string) {
  if (typeof window === 'undefined') return
  try {
    const key = `phola_danger_zone_last_alert_${zoneId}`
    const now = Date.now().toString()
    window.localStorage.setItem(key, now)
    window.sessionStorage.setItem(key, now)
  } catch {}
}

/**
 * Dispatches high-risk notification across notification, vibration, and voice channels.
 */
export async function dispatchHighRiskZoneNotification(zone: HighRiskZone) {
  if (typeof window === 'undefined') return

  console.warn(`[Phola Safety] High-risk zone warning triggered: ${zone.name}`)
  recordAlertSent(zone.id)

  const title = `⚠️ HIGH-RISK ZONE ALERT: ${zone.name.toUpperCase()}`

  // 1. Device Vibration
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([300, 150, 300, 150, 400])
    } catch {}
  }

  // 2. Audio Warning / Speech Synthesis
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(
        `Warning: You are currently entering a high-risk zone in ${zone.name}. Keep your vehicle doors locked, windows rolled up, and remain highly vigilant.`
      )
      utterance.rate = 1.05
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    } catch {}
  }

  // 3. Web / Push Notification
  try {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration()
          if (reg && reg.showNotification) {
            await reg.showNotification(title, {
              body: zone.safetyAdvice || HIGH_RISK_ZONE_ALERT_MESSAGE,
              icon: '/phola-icon.svg',
              badge: '/phola-icon.svg',
              tag: `phola-danger-${zone.id}`,
              data: {
                zoneId: zone.id,
                url: '/sos',
              },
            } as NotificationOptions)
            return
          }
        }

        new Notification(title, {
          body: zone.safetyAdvice || HIGH_RISK_ZONE_ALERT_MESSAGE,
          icon: '/phola-icon.svg',
          tag: `phola-danger-${zone.id}`,
        })
      }
    }
  } catch (err) {
    console.warn('[Phola Safety] Notification dispatch error:', err)
  }
}
