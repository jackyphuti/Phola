/**
 * Client-side service for Mutual Live Guardian Location Sharing (Find My / Guardian Circle).
 * Allows users to invite each other by email, accept invites, and stream live GPS coordinates.
 */

export interface LocationBuddy {
  shareId: string
  buddyName: string
  buddyEmail: string
  buddyRole: 'sender' | 'receiver'
  buddyLat: number | null
  buddyLng: number | null
  buddyUpdatedAt: string | null
  myLat?: number | null
  myLng?: number | null
  buddyDistress?: boolean
  buddyDistressMessage?: string | null
  buddyDistressAt?: string | null
  myDistress?: boolean
  status: 'accepted'
  updatedAt: string
}

export interface IncomingShareInvite {
  shareId: string
  fromName: string
  fromEmail: string
  createdAt: string
}

export interface OutgoingShareInvite {
  shareId: string
  toEmail: string
  toName?: string | null
  createdAt: string
}

export interface LocationSharesState {
  active: LocationBuddy[]
  incoming: IncomingShareInvite[]
  outgoing: OutgoingShareInvite[]
  activeDistressPings?: LocationBuddy[]
  myActiveDistress?: boolean
}

const LOCAL_STORAGE_KEY = 'phola_cached_location_buddies'

export function getCachedBuddies(): LocationBuddy[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as LocationBuddy[]
  } catch {}
  return []
}

export function saveCachedBuddies(buddies: LocationBuddy[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(buddies))
  } catch {}
}

/**
 * Fetch all active buddies, incoming pending requests, and outgoing invites.
 */
export async function fetchLocationShares(): Promise<LocationSharesState> {
  try {
    const res = await fetch('/api/location-share', { credentials: 'include' })
    if (res.ok) {
      const data: LocationSharesState = await res.json()
      if (Array.isArray(data.active)) {
        saveCachedBuddies(data.active)
      }
      return data
    }
  } catch (err) {
    console.warn('[LocationSharing] fetch error, using cache:', err)
  }

  return {
    active: getCachedBuddies(),
    incoming: [],
    outgoing: [],
  }
}

/**
 * Send invite to another registered user by email.
 */
export async function sendLocationShareInvite(receiverEmail: string, senderName?: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/location-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'invite',
        receiverEmail: receiverEmail.trim().toLowerCase(),
        senderName: senderName?.trim(),
      }),
      credentials: 'include',
    })

    const data = await res.json()
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to send invite' }
    }

    return {
      success: true,
      message: data.message || `Invite sent to ${receiverEmail}! Once they accept, you will both see each other live.`,
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error sending invite' }
  }
}

/**
 * Accept or decline an incoming location share request.
 */
export async function respondToLocationShare(shareId: string, accept: boolean): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/location-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'respond',
        shareId,
        accept,
      }),
      credentials: 'include',
    })

    const data = await res.json()
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to update response' }
    }

    return {
      success: true,
      message: data.message || (accept ? 'Location share accepted!' : 'Invite declined.'),
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error responding to invite' }
  }
}

let lastBroadcastTime = 0

/**
 * Periodically broadcast user coordinates to all accepted buddies (throttled to at most once per 6 seconds).
 */
export async function broadcastLiveLocation(coords: { lat: number; lng: number }): Promise<void> {
  const now = Date.now()
  if (now - lastBroadcastTime < 6000) return
  lastBroadcastTime = now

  try {
    await fetch('/api/location-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_coords',
        lat: coords.lat,
        lng: coords.lng,
      }),
      credentials: 'include',
    })
  } catch (err) {
    console.warn('[LocationSharing] Coordinate broadcast failed:', err)
  }
}

/**
 * Stop / Revoke mutual location sharing.
 */
export async function stopLocationShare(shareId: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/location-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'stop',
        shareId,
      }),
      credentials: 'include',
    })

    const data = await res.json()
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to stop sharing' }
    }

    // Remove from local cache
    const cached = getCachedBuddies().filter((b) => b.shareId !== shareId)
    saveCachedBuddies(cached)

    return { success: true, message: 'Location sharing stopped.' }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' }
  }
}

/**
 * Send an emergency distress ping to all accepted guardians.
 * Triggers their devices to audibly ring and display your live GPS location.
 */
export async function pingUnsafeBuddies(params?: {
  lat?: number
  lng?: number
  message?: string
}): Promise<{ success: boolean; totalNotified?: number; message: string }> {
  try {
    const res = await fetch('/api/location-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ping_unsafe',
        message: params?.message || 'I feel unsafe right now! Please check my live location and contact me.',
        lat: params?.lat,
        lng: params?.lng,
      }),
      credentials: 'include',
    })

    const data = await res.json()
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to send distress ping' }
    }

    return {
      success: true,
      totalNotified: data.totalNotified,
      message: data.message || 'Distress ping sent! Ringing guardian devices.',
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error sending distress ping' }
  }
}

/**
 * Clear the distress ping after user is safe again.
 */
export async function resolveDistressPing(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/location-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resolve_ping',
      }),
      credentials: 'include',
    })

    const data = await res.json()
    if (!res.ok) {
      return { success: false, message: data.error || 'Failed to clear distress status' }
    }

    return {
      success: true,
      message: data.message || 'Distress status cleared. Your guardians know you are safe.',
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' }
  }
}
