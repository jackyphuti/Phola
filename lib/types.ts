export interface Profile {
  id: string
  display_name: string | null
  profile_photo_path?: string | null
  pin_hash: string | null
  biometric_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Incident {
  id: string
  user_id: string
  incident_type: string
  crime_type?: string | null
  description: string | null
  location: string | null
  date_occurred: string | null
  perpetrator_relationship: string | null
  severity: 'low' | 'medium' | 'high' | 'critical' | null
  anonymous_report?: boolean
  case_reference?: string | null
  incident_metadata?: Record<string, unknown> | null
  evidence_files?: Array<Record<string, unknown>> | null
  saps_station_name?: string | null
  saps_station_code?: string | null
  is_draft: boolean
  created_at: string
  updated_at: string
}

export interface EmergencyContact {
  id: string
  user_id: string
  name: string
  phone: string
  relationship: string | null
  is_primary: boolean
  created_at: string
}

export type IncidentType = 
  | 'gbv'
  | 'assault'
  | 'robbery'
  | 'vehicle_theft'
  | 'housebreaking'
  | 'drug_activity'
  | 'suspicious_behaviour'
  | 'police_misconduct'
  | 'corruption'
  | 'physical'
  | 'emotional'
  | 'sexual'
  | 'financial'
  | 'digital'
  | 'stalking'
  | 'other'

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  gbv: 'GBV',
  assault: 'Assault',
  robbery: 'Robbery',
  vehicle_theft: 'Vehicle theft',
  housebreaking: 'Housebreaking',
  drug_activity: 'Drug activity',
  suspicious_behaviour: 'Suspicious behaviour',
  police_misconduct: 'Police misconduct',
  corruption: 'Corruption',
  physical: 'Physical',
  emotional: 'Emotional/Psychological',
  sexual: 'Sexual',
  financial: 'Financial/Economic',
  digital: 'Digital/Online',
  stalking: 'Stalking/Harassment',
  other: 'Other',
}

export const RELATIONSHIP_OPTIONS = [
  'Partner/Spouse',
  'Ex-Partner/Ex-Spouse',
  'Family Member',
  'Colleague',
  'Acquaintance',
  'Stranger',
  'Prefer not to say',
  'Other',
]

export const SEVERITY_OPTIONS: Array<{ value: Incident['severity']; label: string; description: string }> = [
  { value: 'low', label: 'Low', description: 'Minor incident, no immediate danger' },
  { value: 'medium', label: 'Medium', description: 'Concerning behavior, monitoring needed' },
  { value: 'high', label: 'High', description: 'Serious incident, support recommended' },
  { value: 'critical', label: 'Critical', description: 'Immediate danger, urgent help needed' },
]
