import { EmergencyContact } from './types'

const GLOBAL_STORAGE_KEY = 'phola_emergency_contacts'

export function getStoredEmergencyContacts(userId?: string): EmergencyContact[] {
  if (typeof window === 'undefined') return []
  try {
    const userKey = userId ? `${GLOBAL_STORAGE_KEY}_${userId}` : GLOBAL_STORAGE_KEY
    const raw = window.localStorage.getItem(userKey) || window.localStorage.getItem(GLOBAL_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredEmergencyContacts(contacts: EmergencyContact[], userId?: string): void {
  if (typeof window === 'undefined') return
  try {
    const userKey = userId ? `${GLOBAL_STORAGE_KEY}_${userId}` : GLOBAL_STORAGE_KEY
    window.localStorage.setItem(userKey, JSON.stringify(contacts))
    // Also save to global key for offline/fallback access across components
    window.localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(contacts))
  } catch {
    // ignore quota error
  }
}
