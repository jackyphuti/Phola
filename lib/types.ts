export interface Profile {
  id: string
  display_name: string | null
  pin_hash: string | null
  biometric_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Incident {
  id: string
  user_id: string
  incident_type: string
  description: string | null
  location: string | null
  date_occurred: string | null
  perpetrator_relationship: string | null
  severity: 'low' | 'medium' | 'high' | 'critical' | null
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
  | 'physical'
  | 'emotional'
  | 'sexual'
  | 'financial'
  | 'digital'
  | 'stalking'
  | 'other'

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
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
