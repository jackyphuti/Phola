export type SAPSStation = {
  code: string
  name: string
  lat: number
  lng: number
  province: string
  phone?: string
}

export const SAPS_STATIONS: SAPSStation[] = [
  { code: 'GP-JHB-CENTRAL', name: 'Johannesburg Central SAPS', lat: -26.2049, lng: 28.0473, province: 'Gauteng', phone: '0113755911' },
  { code: 'GP-MOROKA', name: 'Moroka SAPS', lat: -26.2674, lng: 27.8582, province: 'Gauteng', phone: '0119388601' },
  { code: 'GP-SANDTON', name: 'Sandton SAPS', lat: -26.1076, lng: 28.0567, province: 'Gauteng', phone: '0117228800' },
  { code: 'WC-CPT-CENTRAL', name: 'Cape Town Central SAPS', lat: -33.9249, lng: 18.4241, province: 'Western Cape', phone: '0214678000' },
  { code: 'WC-KHAYELITSHA', name: 'Khayelitsha SAPS', lat: -34.0363, lng: 18.6761, province: 'Western Cape', phone: '0213601600' },
  { code: 'KZN-DURBAN-CENTRAL', name: 'Durban Central SAPS', lat: -29.8587, lng: 31.0218, province: 'KwaZulu-Natal', phone: '0313254200' },
  { code: 'LP-POLOKWANE', name: 'Polokwane SAPS', lat: -23.9045, lng: 29.4689, province: 'Limpopo', phone: '0152901000' },
  { code: 'EC-GQEBERHA', name: 'Humewood SAPS', lat: -33.9651, lng: 25.6374, province: 'Eastern Cape', phone: '0414027000' },
  { code: 'FS-BLOEMFONTEIN', name: 'Parkweg SAPS', lat: -29.1183, lng: 26.216, province: 'Free State', phone: '0515076600' },
  { code: 'NW-RUSTENBURG', name: 'Rustenburg SAPS', lat: -25.6676, lng: 27.242, province: 'North West', phone: '0145938400' },
]

function toRad(value: number): number {
  return (value * Math.PI) / 180
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function getNearestSAPSStation(lat: number, lng: number): SAPSStation | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  let nearest: SAPSStation | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const station of SAPS_STATIONS) {
    const km = distanceKm(lat, lng, station.lat, station.lng)
    if (km < bestDistance) {
      nearest = station
      bestDistance = km
    }
  }

  return nearest
}
