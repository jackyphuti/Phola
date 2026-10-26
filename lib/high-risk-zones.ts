/**
 * South Africa High-Risk Danger Zones Geofencing & Alert System.
 * Monitors user GPS location continuously in the background and sends
 * high-priority system notifications when entering designated high-risk zones.
 */

export interface HighRiskZone {
  id: string
  name: string
  region: string
  lat: number
  lng: number
  radiusMeters: number
  riskFactors: string[]
}

/**
 * Exact official high-risk warning message.
 */
export const HIGH_RISK_ZONE_ALERT_MESSAGE =
  'You are currently entering a high-risk zone known for elevated levels of violent crime, armed robberies, and carjackings. Please remain highly vigilant and exercise extreme caution if you are in or near the Pretoria (Tshwane) central and property-crime hotspots, the Pietermaritzburg metropolitan area, or the Johannesburg Central Business District (CBD) and surrounding neighborhoods like Hillbrow and Alexandra. High-alert warnings are also active for major sectors of Durban, Gqeberha (Port Elizabeth)—specifically around Korsten, New Brighton, and KwaZakhele—as well as prominent Western Cape townships such as Nyanga and Khayelitsha, and KwaZulu-Natal areas like KwaMashu. Keep your vehicle doors locked, windows rolled up, valuables completely out of sight, and avoid walking alone after dark'

/**
 * Comprehensive South African High-Risk Danger Zones.
 */
export const SOUTH_AFRICA_HIGH_RISK_ZONES: HighRiskZone[] = [
  // ---------------------------------------------------------------------------
  // 1. PRETORIA (TSHWANE) CENTRAL & PROPERTY-CRIME HOTSPOTS
  // ---------------------------------------------------------------------------
  {
    id: 'pta-cbd',
    name: 'Pretoria Central (CBD) & Property-Crime Hotspot',
    region: 'Gauteng - Tshwane',
    lat: -25.7479,
    lng: 28.1893,
    radiusMeters: 4000,
    riskFactors: ['Armed robbery', 'Smash-and-grab', 'Carjacking', 'Theft out of motor vehicles'],
  },
  {
    id: 'pta-sunnyside',
    name: 'Sunnyside & Berea Park (Pretoria)',
    region: 'Gauteng - Tshwane',
    lat: -25.7533,
    lng: 28.2094,
    radiusMeters: 2500,
    riskFactors: ['Street robbery', 'Mugging', 'Vehicle hijacking'],
  },
  {
    id: 'pta-marabastad',
    name: 'Marabastad & Belle Ombre (Pretoria)',
    region: 'Gauteng - Tshwane',
    lat: -25.7388,
    lng: 28.1798,
    radiusMeters: 2500,
    riskFactors: ['Violent mugging', 'Transit crimes', 'Extortion'],
  },
  {
    id: 'pta-west',
    name: 'Pretoria West & Industrial Corridor',
    region: 'Gauteng - Tshwane',
    lat: -25.755,
    lng: 28.14,
    radiusMeters: 3500,
    riskFactors: ['Carjacking', 'Armed assault', 'Robbery'],
  },
  {
    id: 'pta-mamelodi',
    name: 'Mamelodi East & West (Tshwane)',
    region: 'Gauteng - Tshwane',
    lat: -25.713,
    lng: 28.368,
    radiusMeters: 6000,
    riskFactors: ['Violent assault', 'Carjacking', 'Armed robbery'],
  },
  {
    id: 'pta-soshanguve',
    name: 'Soshanguve (Tshwane)',
    region: 'Gauteng - Tshwane',
    lat: -25.525,
    lng: 28.105,
    radiusMeters: 6500,
    riskFactors: ['Armed robbery', 'Vehicle theft', 'Violent crime'],
  },
  {
    id: 'pta-atteridgeville',
    name: 'Atteridgeville (Tshwane)',
    region: 'Gauteng - Tshwane',
    lat: -25.772,
    lng: 28.075,
    radiusMeters: 4500,
    riskFactors: ['Armed robbery', 'Carjacking'],
  },

  // ---------------------------------------------------------------------------
  // 2. JOHANNESBURG CBD & SURROUNDING NEIGHBORHOODS
  // ---------------------------------------------------------------------------
  {
    id: 'jhb-cbd',
    name: 'Johannesburg Central Business District (CBD)',
    region: 'Gauteng - Johannesburg',
    lat: -26.2041,
    lng: 28.0473,
    radiusMeters: 4000,
    riskFactors: ['Armed robbery', 'Mugging', 'Smash-and-grab', 'Carjacking'],
  },
  {
    id: 'jhb-hillbrow',
    name: 'Hillbrow (Johannesburg)',
    region: 'Gauteng - Johannesburg',
    lat: -26.1884,
    lng: 28.0494,
    radiusMeters: 2500,
    riskFactors: ['Violent crime', 'Armed mugging', 'Hijacking'],
  },
  {
    id: 'jhb-alexandra',
    name: 'Alexandra (Johannesburg)',
    region: 'Gauteng - Johannesburg',
    lat: -26.1056,
    lng: 28.1006,
    radiusMeters: 3500,
    riskFactors: ['Violent crime', 'Armed robbery', 'Carjacking'],
  },
  {
    id: 'jhb-berea-yeoville',
    name: 'Berea & Yeoville (Johannesburg)',
    region: 'Gauteng - Johannesburg',
    lat: -26.183,
    lng: 28.06,
    radiusMeters: 3000,
    riskFactors: ['Street mugging', 'Violent robbery'],
  },
  {
    id: 'jhb-jeppestown',
    name: 'Jeppestown & Doornfontein (Johannesburg)',
    region: 'Gauteng - Johannesburg',
    lat: -26.203,
    lng: 28.067,
    radiusMeters: 2500,
    riskFactors: ['Armed robbery', 'Vehicle hijacking'],
  },
  {
    id: 'jhb-tembisa',
    name: 'Tembisa (Ekurhuleni)',
    region: 'Gauteng - Ekurhuleni',
    lat: -25.9964,
    lng: 28.2268,
    radiusMeters: 6000,
    riskFactors: ['Violent crime', 'Carjacking', 'Armed assault'],
  },
  {
    id: 'jhb-diepsloot',
    name: 'Diepsloot (Johannesburg North)',
    region: 'Gauteng - Johannesburg',
    lat: -25.9333,
    lng: 28.0167,
    radiusMeters: 5000,
    riskFactors: ['Violent robbery', 'Sexual assault', 'Mugging'],
  },

  // ---------------------------------------------------------------------------
  // 3. PIETERMARITZBURG METROPOLITAN AREA
  // ---------------------------------------------------------------------------
  {
    id: 'pmb-cbd',
    name: 'Pietermaritzburg Metropolitan / CBD Area',
    region: 'KwaZulu-Natal - Pietermaritzburg',
    lat: -29.6006,
    lng: 30.3794,
    radiusMeters: 4500,
    riskFactors: ['Violent robbery', 'Armed street crime', 'Carjacking'],
  },
  {
    id: 'pmb-imbali',
    name: 'Imbali (Pietermaritzburg)',
    region: 'KwaZulu-Natal - Pietermaritzburg',
    lat: -29.6644,
    lng: 30.3475,
    radiusMeters: 5000,
    riskFactors: ['Violent assault', 'Armed robbery', 'Homicide hotspot'],
  },
  {
    id: 'pmb-edendale',
    name: 'Edendale (Pietermaritzburg)',
    region: 'KwaZulu-Natal - Pietermaritzburg',
    lat: -29.645,
    lng: 30.308,
    radiusMeters: 5000,
    riskFactors: ['Armed robbery', 'Carjacking', 'Mugging'],
  },

  // ---------------------------------------------------------------------------
  // 4. DURBAN MAJOR SECTORS
  // ---------------------------------------------------------------------------
  {
    id: 'dbn-cbd',
    name: 'Durban Central / Warwick Sector',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.8587,
    lng: 31.0218,
    radiusMeters: 4000,
    riskFactors: ['Armed mugging', 'Violent robbery', 'Vehicle theft'],
  },
  {
    id: 'dbn-point-southbeach',
    name: 'Point & South Beach Sector (Durban)',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.865,
    lng: 31.04,
    radiusMeters: 3000,
    riskFactors: ['Armed street crime', 'Mugging', 'Theft'],
  },
  {
    id: 'dbn-umlazi',
    name: 'Umlazi (eThekwini)',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.9678,
    lng: 30.8872,
    radiusMeters: 6000,
    riskFactors: ['Violent crime', 'Carjacking', 'Armed assault'],
  },

  // ---------------------------------------------------------------------------
  // 5. KWAMASHU & INK CORRIDOR (KWAZULU-NATAL)
  // ---------------------------------------------------------------------------
  {
    id: 'kzn-kwamashu',
    name: 'KwaMashu (KwaZulu-Natal)',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.7533,
    lng: 30.9856,
    radiusMeters: 4500,
    riskFactors: ['Violent assault', 'Carjacking', 'Armed robbery', 'Homicide hotspot'],
  },
  {
    id: 'kzn-inanda-ntuzuma',
    name: 'Inanda & Ntuzuma (KwaZulu-Natal)',
    region: 'KwaZulu-Natal - eThekwini',
    lat: -29.71,
    lng: 30.935,
    radiusMeters: 5500,
    riskFactors: ['Violent crime', 'GBV hotspot', 'Armed robbery'],
  },

  // ---------------------------------------------------------------------------
  // 6. GQEBERHA (PORT ELIZABETH) - KORSTEN, NEW BRIGHTON, KWAZAKHELE
  // ---------------------------------------------------------------------------
  {
    id: 'plz-korsten',
    name: 'Korsten (Gqeberha / Port Elizabeth)',
    region: 'Eastern Cape - Nelson Mandela Bay',
    lat: -33.928,
    lng: 25.578,
    radiusMeters: 3000,
    riskFactors: ['Armed robbery', 'Carjacking', 'Violent mugging'],
  },
  {
    id: 'plz-new-brighton',
    name: 'New Brighton (Gqeberha / Port Elizabeth)',
    region: 'Eastern Cape - Nelson Mandela Bay',
    lat: -33.902,
    lng: 25.602,
    radiusMeters: 3500,
    riskFactors: ['Violent crime', 'Armed robbery', 'Carjacking'],
  },
  {
    id: 'plz-kwazakhele',
    name: 'KwaZakhele (Gqeberha / Port Elizabeth)',
    region: 'Eastern Cape - Nelson Mandela Bay',
    lat: -33.885,
    lng: 25.59,
    radiusMeters: 3500,
    riskFactors: ['Violent assault', 'Armed robbery', 'Vehicle theft'],
  },
  {
    id: 'plz-gelvandale-bethelsdorp',
    name: 'Gelvandale & Bethelsdorp (Gqeberha)',
    region: 'Eastern Cape - Nelson Mandela Bay',
    lat: -33.91,
    lng: 25.54,
    radiusMeters: 4500,
    riskFactors: ['Gang violence', 'Armed robbery', 'Carjacking'],
  },

  // ---------------------------------------------------------------------------
  // 7. PROMINENT WESTERN CAPE TOWNSHIPS (NYANGA, KHAYELITSHA, ETC.)
  // ---------------------------------------------------------------------------
  {
    id: 'wc-nyanga',
    name: 'Nyanga (Western Cape)',
    region: 'Western Cape - Cape Town',
    lat: -33.9961,
    lng: 18.5872,
    radiusMeters: 3500,
    riskFactors: ['Homicide hotspot', 'Armed carjacking', 'Robbery', 'Violent assault'],
  },
  {
    id: 'wc-khayelitsha',
    name: 'Khayelitsha (Western Cape)',
    region: 'Western Cape - Cape Town',
    lat: -34.0383,
    lng: 18.675,
    radiusMeters: 6000,
    riskFactors: ['Violent crime', 'Armed robbery', 'Carjacking', 'GBV hotspot'],
  },
  {
    id: 'wc-gugulethu',
    name: 'Gugulethu (Western Cape)',
    region: 'Western Cape - Cape Town',
    lat: -33.978,
    lng: 18.572,
    radiusMeters: 3500,
    riskFactors: ['Violent robbery', 'Armed carjacking'],
  },
  {
    id: 'wc-mitchells-plain',
    name: 'Mitchells Plain (Western Cape)',
    region: 'Western Cape - Cape Town',
    lat: -34.048,
    lng: 18.622,
    radiusMeters: 5000,
    riskFactors: ['Gang activity', 'Armed robbery', 'Violent crime'],
  },
  {
    id: 'wc-philippi',
    name: 'Philippi & Browns Farm (Western Cape)',
    region: 'Western Cape - Cape Town',
    lat: -34.015,
    lng: 18.555,
    radiusMeters: 4000,
    riskFactors: ['Violent hijacking', 'Armed assault', 'Murder hotspot'],
  },
  {
    id: 'wc-delft',
    name: 'Delft (Western Cape)',
    region: 'Western Cape - Cape Town',
    lat: -33.985,
    lng: 18.643,
    radiusMeters: 4000,
    riskFactors: ['Violent robbery', 'Carjacking', 'Gang violence'],
  },
]

/**
 * Calculates Great-Circle distance in meters between two lat/lng coordinates (Haversine formula).
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth's mean radius in meters
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
 * Evaluates whether a location is inside any defined South African high-risk zone.
 * Returns the matching zone or null.
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

const ALERT_THROTTLE_MS = 25 * 60 * 1000 // 25-minute alert cooldown per zone

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
  } catch {
    // ignore storage error
  }
  return false
}

export function recordAlertSent(zoneId: string) {
  if (typeof window === 'undefined') return
  try {
    const key = `phola_danger_zone_last_alert_${zoneId}`
    const now = Date.now().toString()
    window.localStorage.setItem(key, now)
    window.sessionStorage.setItem(key, now)
  } catch {
    // ignore storage error
  }
}

/**
 * Dispatches the official high-risk safety notification across all available channels:
 * 1. Web Notification / Service Worker Notification API
 * 2. Device Vibration pattern
 * 3. Native audio warning via SpeechSynthesis or Audio
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
              body: HIGH_RISK_ZONE_ALERT_MESSAGE,
              icon: '/phola-icon.svg',
              badge: '/phola-icon.svg',
              tag: `phola-danger-${zone.id}`,
              data: {
                zoneId: zone.id,
                url: '/safe-ride',
              },
            } as NotificationOptions)
            return
          }
        }

        new Notification(title, {
          body: HIGH_RISK_ZONE_ALERT_MESSAGE,
          icon: '/phola-icon.svg',
          tag: `phola-danger-${zone.id}`,
        })
      } else if (Notification.permission === 'default') {
        // Request permission if not yet decided
        const res = await Notification.requestPermission()
        if (res === 'granted') {
          new Notification(title, {
            body: HIGH_RISK_ZONE_ALERT_MESSAGE,
            icon: '/phola-icon.svg',
            tag: `phola-danger-${zone.id}`,
          })
        }
      }
    }
  } catch (err) {
    console.warn('[Phola Safety] Notification dispatch error:', err)
  }
}
