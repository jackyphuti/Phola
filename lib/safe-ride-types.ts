export type RideServiceId = 'uber' | 'bolt' | 'indrive' | 'taxi' | 'other'

export interface RideServiceOption {
  id: RideServiceId
  name: string
  appScheme: string
  webUrl: string
  playStoreUrl: string
  color: string
  badgeText: string
  tagline: string
}

export interface SafeRideSession {
  id: string
  serviceId: RideServiceId
  serviceName: string
  destination: string
  notes?: string
  tripLink?: string
  startedAt: string // ISO string
  expectedDurationMinutes: number
  expectedArrivalAt: string // ISO string
  status: 'active' | 'arrived' | 'overdue' | 'cancelled'
  startLocation?: {
    lat: number
    lng: number
    address?: string
  }
  contactName?: string
  contactPhone?: string
  lastCheckedInAt?: string
  vehicleNumberPlate?: string
  driverName?: string
  vehicleModel?: string
  checkInCount?: number
  checkInTimestamps?: string[]
}
