export type SAPSStation = {
  code: string
  name: string
  lat: number
  lng: number
  province: string
  phone?: string
}

export const SAPS_STATIONS: SAPSStation[] = [
  // Gauteng
  { code: 'GP-JHB-CENTRAL', name: 'Johannesburg Central SAPS', lat: -26.2049, lng: 28.0473, province: 'Gauteng', phone: '0113755911' },
  { code: 'GP-MOROKA', name: 'Moroka SAPS (Soweto)', lat: -26.2674, lng: 27.8582, province: 'Gauteng', phone: '0119388601' },
  { code: 'GP-ORLANDO', name: 'Orlando SAPS (Soweto)', lat: -26.2335, lng: 27.9152, province: 'Gauteng', phone: '0119358200' },
  { code: 'GP-SANDTON', name: 'Sandton SAPS', lat: -26.1076, lng: 28.0567, province: 'Gauteng', phone: '0117228800' },
  { code: 'GP-ALEXANDRA', name: 'Alexandra SAPS', lat: -26.1042, lng: 28.0935, province: 'Gauteng', phone: '0113217600' },
  { code: 'GP-ROSEBANK', name: 'Rosebank SAPS', lat: -26.1472, lng: 28.0416, province: 'Gauteng', phone: '0117784700' },
  { code: 'GP-PRETORIA-CENTRAL', name: 'Pretoria Central SAPS', lat: -25.7516, lng: 28.1878, province: 'Gauteng', phone: '0123534000' },
  { code: 'GP-HATFIELD', name: 'Hatfield SAPS (Pretoria)', lat: -25.7486, lng: 28.2380, province: 'Gauteng', phone: '0123661700' },
  { code: 'GP-GARSFONTEIN', name: 'Garsfontein SAPS', lat: -25.7956, lng: 28.2994, province: 'Gauteng', phone: '0124704200' },
  { code: 'GP-SUNNYSIDE', name: 'Sunnyside SAPS', lat: -25.7562, lng: 28.2125, province: 'Gauteng', phone: '0124223600' },
  { code: 'GP-BROOKLYN', name: 'Brooklyn SAPS', lat: -25.7725, lng: 28.2394, province: 'Gauteng', phone: '0123661700' },
  { code: 'GP-MIDRAND', name: 'Midrand SAPS', lat: -25.9984, lng: 28.1278, province: 'Gauteng', phone: '0113471600' },
  { code: 'GP-TEMBISA', name: 'Tembisa SAPS', lat: -26.0125, lng: 28.2255, province: 'Gauteng', phone: '0119262970' },

  // Western Cape
  { code: 'WC-CPT-CENTRAL', name: 'Cape Town Central SAPS', lat: -33.9249, lng: 18.4241, province: 'Western Cape', phone: '0214678000' },
  { code: 'WC-SEA-POINT', name: 'Sea Point SAPS', lat: -33.9142, lng: 18.3912, province: 'Western Cape', phone: '0214303700' },
  { code: 'WC-WOODSTOCK', name: 'Woodstock SAPS', lat: -33.9298, lng: 18.4526, province: 'Western Cape', phone: '0214421200' },
  { code: 'WC-CLAREMONT', name: 'Claremont SAPS', lat: -33.9818, lng: 18.4682, province: 'Western Cape', phone: '0216572240' },
  { code: 'WC-BELLVILLE', name: 'Bellville SAPS', lat: -33.8986, lng: 18.6292, province: 'Western Cape', phone: '0219183000' },
  { code: 'WC-MITCHELLS-PLAIN', name: 'Mitchells Plain SAPS', lat: -34.0494, lng: 18.6272, province: 'Western Cape', phone: '0213701600' },
  { code: 'WC-KHAYELITSHA', name: 'Khayelitsha SAPS', lat: -34.0363, lng: 18.6761, province: 'Western Cape', phone: '0213601600' },

  // KwaZulu-Natal
  { code: 'KZN-DURBAN-CENTRAL', name: 'Durban Central SAPS', lat: -29.8587, lng: 31.0218, province: 'KwaZulu-Natal', phone: '0313254200' },
  { code: 'KZN-BEREA', name: 'Berea SAPS', lat: -29.8452, lng: 30.9984, province: 'KwaZulu-Natal', phone: '0312771060' },
  { code: 'KZN-POINT', name: 'Point SAPS', lat: -29.8665, lng: 31.0412, province: 'KwaZulu-Natal', phone: '0313674000' },
  { code: 'KZN-UMHLANGA', name: 'Durban North / Umhlanga SAPS', lat: -29.7785, lng: 31.0345, province: 'KwaZulu-Natal', phone: '0315608000' },
  { code: 'KZN-PIETERMARITZBURG', name: 'Pietermaritzburg SAPS', lat: -29.6006, lng: 30.3794, province: 'KwaZulu-Natal', phone: '0338452400' },

  // Eastern Cape
  { code: 'EC-GQEBERHA', name: 'Humewood SAPS (Gqeberha)', lat: -33.9651, lng: 25.6374, province: 'Eastern Cape', phone: '0414027000' },
  { code: 'EC-MOUNT-ROAD', name: 'Mount Road SAPS (Gqeberha)', lat: -33.9458, lng: 25.5991, province: 'Eastern Cape', phone: '0413946000' },
  { code: 'EC-EAST-LONDON', name: 'East London SAPS', lat: -33.0153, lng: 27.9116, province: 'Eastern Cape', phone: '0437070145' },

  // Free State
  { code: 'FS-BLOEMFONTEIN', name: 'Parkweg SAPS (Bloemfontein)', lat: -29.1183, lng: 26.216, province: 'Free State', phone: '0515076600' },

  // Limpopo
  { code: 'LP-POLOKWANE', name: 'Polokwane SAPS', lat: -23.9045, lng: 29.4689, province: 'Limpopo', phone: '0152901000' },

  // Mpumalanga
  { code: 'MP-NELSPRUIT', name: 'Nelspruit SAPS (Mbombela)', lat: -25.4753, lng: 30.9694, province: 'Mpumalanga', phone: '0137591008' },

  // North West
  { code: 'NW-RUSTENBURG', name: 'Rustenburg SAPS', lat: -25.6676, lng: 27.242, province: 'North West', phone: '0145938400' },
]

export const POPULAR_SA_MALLS = [
  // Gauteng
  { id: 'sandton-city', name: 'Sandton City & Nelson Mandela Square', lat: -26.1086, lng: 28.0531, address: '83 Rivonia Rd, Sandhurst, Sandton' },
  { id: 'mall-of-africa', name: 'Mall of Africa', lat: -25.9984, lng: 28.1062, address: 'Magwa Cres, Waterval City, Midrand' },
  { id: 'rosebank-mall', name: 'Rosebank Mall', lat: -26.1465, lng: 28.0412, address: '50 Bath Ave, Rosebank, Johannesburg' },
  { id: 'eastgate-mall', name: 'Eastgate Shopping Centre', lat: -26.1802, lng: 28.1185, address: '43 Bradford Rd, Bedfordview, Germiston' },
  { id: 'crestas-centre', name: 'Cresta Shopping Centre', lat: -26.1332, lng: 27.9715, address: 'Beyers Naudé Dr, Cresta, Randburg' },
  { id: 'menlyn-park', name: 'Menlyn Park Shopping Centre', lat: -25.7825, lng: 28.2755, address: 'Atterbury Rd & Lois Ave, Menlyn, Pretoria' },
  { id: 'hatfield-plaza', name: 'Hatfield Mall Plaza', lat: -25.7495, lng: 28.2385, address: '1122 Burnett St, Hatfield, Pretoria' },
  { id: 'loftus-park', name: 'Loftus Park', lat: -25.7532, lng: 28.2256, address: '416 Kirkness St, Arcadia, Pretoria' },
  { id: 'brooklyn-mall', name: 'Brooklyn Mall', lat: -25.7715, lng: 28.2355, address: 'Cnr Veale & Fehrsen St, Nieuw Muckleneuk, Pretoria' },
  { id: 'maponya-mall', name: 'Maponya Mall (Soweto)', lat: -26.2625, lng: 27.8992, address: '2127 Chris Hani Rd, Klipspruit Ext 5, Soweto' },

  // Western Cape
  { id: 'canal-walk', name: 'Canal Walk Shopping Centre', lat: -33.8925, lng: 18.5122, address: 'Century Blvd, Century City, Cape Town' },
  { id: 'va-waterfront', name: 'V&A Waterfront', lat: -33.9036, lng: 18.4206, address: '19 Dock Rd, Cape Town' },
  { id: 'tygervalley', name: 'Tyger Valley Shopping Centre', lat: -33.8745, lng: 18.6342, address: 'Willie Van Schoor Dr, Bellville, Cape Town' },
  { id: 'cavendish-square', name: 'Cavendish Square', lat: -33.9814, lng: 18.4632, address: 'Dreyer St, Claremont, Cape Town' },

  // KwaZulu-Natal
  { id: 'gateway-theatre', name: 'Gateway Theatre of Shopping', lat: -29.7125, lng: 31.0664, address: '1 Palm Blvd, Umhlanga Ridge, Umhlanga' },
  { id: 'pavilion-mall', name: 'The Pavilion Shopping Centre', lat: -29.8492, lng: 30.9348, address: 'Jack Martens Dr, Dawncliffe, Westville' },

  // Eastern Cape
  { id: 'walmer-park', name: 'Walmer Park Shopping Centre', lat: -33.9812, lng: 25.5684, address: 'Main Rd, Walmer, Gqeberha' },
]

function toRad(value: number): number {
  return (value * Math.PI) / 180
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

export function getNearbySAPSStations(
  lat: number,
  lng: number,
  limit = 15
): Array<SAPSStation & { distanceKm: number }> {
  return SAPS_STATIONS.map((station) => ({
    ...station,
    distanceKm: distanceKm(lat, lng, station.lat, station.lng),
  }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}

export function getNearbyMalls(
  lat: number,
  lng: number,
  limit = 15
): Array<{ id: string; name: string; lat: number; lng: number; address: string; distanceKm: number }> {
  return POPULAR_SA_MALLS.map((mall) => ({
    ...mall,
    distanceKm: distanceKm(lat, lng, mall.lat, mall.lng),
  }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}
