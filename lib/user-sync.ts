import { createClient } from '@/lib/supabase/client'
import { EmergencyContact } from './types'
import { getStoredEmergencyContacts, saveStoredEmergencyContacts } from './emergency-contacts-storage'

export type SOSCallTarget = 'police' | 'contact'

const SOS_TARGET_KEY = 'phola_sos_call_target'
const ONBOARDING_COMPLETED_KEY = 'phola_safety_onboarding_completed'

/**
 * Returns the user's preferred SOS call action:
 * - 'police': Emergency SOS calls SAPS 10111
 * - 'contact': Emergency SOS calls user's Primary Emergency Contact
 * Defaults to 'police' if unconfigured.
 */
export function getSOSCallPreference(): SOSCallTarget {
  if (typeof window === 'undefined') return 'police'
  try {
    const stored = window.localStorage.getItem(SOS_TARGET_KEY)
    if (stored === 'contact' || stored === 'police') {
      return stored
    }
  } catch {}
  return 'police'
}

/**
 * Saves the user's SOS call preference locally and to Supabase metadata.
 */
export async function setSOSCallPreference(
  target: SOSCallTarget,
  userId?: string,
  supabaseClient?: any
): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SOS_TARGET_KEY, target)
      if (userId) {
        window.localStorage.setItem(`${SOS_TARGET_KEY}_${userId}`, target)
      }
    } catch {}
  }

  const supabase = supabaseClient || createClient()
  if (userId) {
    try {
      await supabase.auth.updateUser({
        data: { sos_call_target: target },
      })
      await supabase.from('profiles').update({
        updated_at: new Date().toISOString(),
      }).eq('id', userId)
    } catch (err) {
      console.warn('Failed to sync SOS preference to Supabase:', err)
    }
  }
}

/**
 * Checks whether the user has completed safety onboarding
 * (configured primary contact and SOS preference).
 */
export function isSafetyOnboardingCompleted(userId?: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    const key = userId ? `${ONBOARDING_COMPLETED_KEY}_${userId}` : ONBOARDING_COMPLETED_KEY
    const isCompleted = window.localStorage.getItem(key) === 'true'
    if (isCompleted) return true

    // Check if contacts already exist locally
    const contacts = getStoredEmergencyContacts(userId)
    if (contacts.length > 0) return true
  } catch {}
  return false
}

export function markSafetyOnboardingCompleted(userId?: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = userId ? `${ONBOARDING_COMPLETED_KEY}_${userId}` : ONBOARDING_COMPLETED_KEY
    window.localStorage.setItem(key, 'true')
    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
  } catch {}
}

/**
 * Full Cross-Platform User Data Sync:
 * Synchronizes emergency contacts and safety preferences between
 * Supabase cloud database and device local storage (Web, iOS, Android).
 */
export async function syncUserData(
  userId: string,
  supabaseClient?: any
): Promise<{ contacts: EmergencyContact[]; sosTarget: SOSCallTarget }> {
  const supabase = supabaseClient || createClient()
  let syncedContacts: EmergencyContact[] = getStoredEmergencyContacts(userId)
  let sosTarget: SOSCallTarget = getSOSCallPreference()

  try {
    // 1. Fetch user's profile and user_metadata for SOS preference
    const { data: authUser } = await supabase.auth.getUser()
    if (authUser?.user?.user_metadata?.sos_call_target) {
      sosTarget = authUser.user.user_metadata.sos_call_target as SOSCallTarget
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SOS_TARGET_KEY, sosTarget)
        window.localStorage.setItem(`${SOS_TARGET_KEY}_${userId}`, sosTarget)
      }
    }

    // 2. Fetch all emergency contacts for this user from Supabase
    const { data: cloudContacts, error: fetchErr } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    if (!fetchErr && Array.isArray(cloudContacts) && cloudContacts.length > 0) {
      syncedContacts = cloudContacts as EmergencyContact[]
      saveStoredEmergencyContacts(syncedContacts, userId)
      markSafetyOnboardingCompleted(userId)
    } else if (syncedContacts.length > 0) {
      // 3. Cloud had no contacts, but local device has contacts!
      // Push local contacts to Supabase so other devices (phone/web) receive them
      for (const localContact of syncedContacts) {
        try {
          await supabase.from('emergency_contacts').insert({
            user_id: userId,
            name: localContact.name,
            phone: localContact.phone,
            relationship: localContact.relationship,
            is_primary: localContact.is_primary ?? false,
          })
        } catch (insertErr) {
          console.warn('Failed pushing local contact to Supabase:', insertErr)
        }
      }

      // Re-fetch to get canonical IDs
      const { data: refetched } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })

      if (refetched && Array.isArray(refetched) && refetched.length > 0) {
        syncedContacts = refetched as EmergencyContact[]
        saveStoredEmergencyContacts(syncedContacts, userId)
      }
    }
  } catch (err) {
    console.warn('Cross-platform sync warning:', err)
  }

  return { contacts: syncedContacts, sosTarget }
}

/**
 * Saves a new emergency contact both locally (0ms instant) and persists to Supabase cloud.
 */
export async function saveEmergencyContactBoth(
  contact: {
    name: string
    phone: string
    relationship?: string | null
    is_primary?: boolean
  },
  userId: string,
  supabaseClient?: any
): Promise<EmergencyContact> {
  const localContacts = getStoredEmergencyContacts(userId)
  const isPrimary = contact.is_primary || localContacts.length === 0

  const localId = `ec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const newContact: EmergencyContact = {
    id: localId,
    user_id: userId,
    name: contact.name.trim(),
    phone: contact.phone.trim(),
    relationship: contact.relationship?.trim() || null,
    is_primary: isPrimary,
    created_at: new Date().toISOString(),
  }

  // 1. Immediately update local storage (0ms - instant)
  let updated = isPrimary
    ? localContacts.map((c) => ({ ...c, is_primary: false }))
    : [...localContacts]
  updated = [newContact, ...updated]
  saveStoredEmergencyContacts(updated, userId)
  markSafetyOnboardingCompleted(userId)

  // 2. Persist to Supabase
  const supabase = supabaseClient || createClient()
  try {
    if (isPrimary) {
      await supabase
        .from('emergency_contacts')
        .update({ is_primary: false })
        .eq('user_id', userId)
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: userId,
        name: newContact.name,
        phone: newContact.phone,
        relationship: newContact.relationship,
        is_primary: newContact.is_primary,
      })
      .select()
      .single()

    if (!error && data) {
      const canonicalContact = data as EmergencyContact
      const remapped = updated.map((c) => (c.id === localId ? canonicalContact : c))
      saveStoredEmergencyContacts(remapped, userId)
      return canonicalContact
    }
  } catch (err) {
    console.warn('Failed to insert contact in Supabase, kept local copy:', err)
  }

  return newContact
}
