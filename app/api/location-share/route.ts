import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { sendWebPushBatch, type StoredPushSubscription } from '@/lib/server-web-push'
import { z } from 'zod'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key)
}

// Server-side fallback cache mapping userId or email -> push subscription
const globalForPush = globalThis as unknown as {
  __pholaPushByUser?: Map<string, StoredPushSubscription>
  __pholaPushByEmail?: Map<string, StoredPushSubscription>
}
const pushByUser = globalForPush.__pholaPushByUser || new Map<string, StoredPushSubscription>()
const pushByEmail = globalForPush.__pholaPushByEmail || new Map<string, StoredPushSubscription>()
globalForPush.__pholaPushByUser = pushByUser
globalForPush.__pholaPushByEmail = pushByEmail

async function dispatchPushToRecipients(params: {
  supabase: any
  userIds: string[]
  emails: string[]
  payload: Record<string, unknown>
}) {
  const { supabase, userIds, emails, payload } = params
  const collected: StoredPushSubscription[] = []

  // 1. Collect from in-memory cache by userId and email
  for (const uid of userIds) {
    const sub = pushByUser.get(uid)
    if (sub) collected.push(sub)
  }
  for (const em of emails) {
    const sub = pushByEmail.get(em.toLowerCase().trim())
    if (sub) collected.push(sub)
  }

  // 2. Collect from push_subscriptions table in Supabase
  if (userIds.length > 0) {
    try {
      const dbClient = getSupabaseAdmin() || supabase
      const { data: subs } = await dbClient
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, content_encoding')
        .in('user_id', userIds)
        .eq('is_active', true)

      if (Array.isArray(subs)) {
        for (const s of subs) {
          collected.push(s)
        }
      }
    } catch (err) {
      console.warn('[location-share] push_subscriptions query warning:', err)
    }
  }

  if (collected.length > 0) {
    try {
      await sendWebPushBatch(collected, payload)
    } catch (err) {
      console.warn('[location-share] sendWebPushBatch warning:', err)
    }
  }
}

const inviteSchema = z.object({
  action: z.literal('invite'),
  receiverEmail: z.string().trim().email(),
  senderName: z.string().trim().optional(),
})

const respondSchema = z.object({
  action: z.literal('respond'),
  shareId: z.string().trim().uuid(),
  accept: z.boolean(),
})

const updateCoordsSchema = z.object({
  action: z.literal('update_coords'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const stopSchema = z.object({
  action: z.literal('stop'),
  shareId: z.string().trim().uuid(),
})

const pingUnsafeSchema = z.object({
  action: z.literal('ping_unsafe'),
  message: z.string().trim().max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

const resolvePingSchema = z.object({
  action: z.literal('resolve_ping'),
})

const syncPushSchema = z.object({
  action: z.literal('sync_push'),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
})

// GET /api/location-share: Fetch user's active, incoming, and outgoing shares
export async function GET(request: NextRequest) {
  try {
    const { user, userId } = await getAuthenticatedUser(request)
    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = (user.email || '').toLowerCase().trim()
    const supabase = await createServerSupabaseClient()

    const { data: shares, error } = await supabase
      .from('location_shares')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId},receiver_email.ilike."${userEmail}"`)
      .order('updated_at', { ascending: false })

    if (error) {
      console.warn('[location-share GET] Supabase query error:', error.message)
      return NextResponse.json({ active: [], incoming: [], outgoing: [] })
    }

    const activeList = []
    const incomingList = []
    const outgoingList = []

    for (const s of shares || []) {
      const isSender = s.sender_id === userId
      const isReceiver = s.receiver_id === userId || s.receiver_email?.toLowerCase() === userEmail

      if (s.status === 'accepted') {
        const isBuddyDistress = Boolean(isSender ? s.receiver_distress : s.sender_distress)
        const buddyDistressMsg = isSender ? s.receiver_distress_message : s.sender_distress_message
        const buddyDistressAt = isSender ? s.receiver_distress_at : s.sender_distress_at
        const isMyDistress = Boolean(isSender ? s.sender_distress : s.receiver_distress)

        activeList.push({
          shareId: s.id,
          buddyName: isSender ? (s.receiver_name || s.receiver_email) : (s.sender_name || s.sender_email),
          buddyEmail: isSender ? s.receiver_email : s.sender_email,
          buddyRole: isSender ? 'receiver' : 'sender',
          buddyLat: isSender ? s.receiver_lat : s.sender_lat,
          buddyLng: isSender ? s.receiver_lng : s.sender_lng,
          buddyUpdatedAt: isSender ? s.receiver_updated_at : s.sender_updated_at,
          myLat: isSender ? s.sender_lat : s.receiver_lat,
          myLng: isSender ? s.sender_lng : s.receiver_lng,
          buddyDistress: isBuddyDistress,
          buddyDistressMessage: buddyDistressMsg,
          buddyDistressAt: buddyDistressAt,
          myDistress: isMyDistress,
          status: 'accepted',
          updatedAt: s.updated_at,
        })
      } else if (s.status === 'pending') {
        if (isReceiver && !isSender) {
          incomingList.push({
            shareId: s.id,
            fromName: s.sender_name || s.sender_email,
            fromEmail: s.sender_email,
            createdAt: s.created_at,
          })
        } else if (isSender) {
          outgoingList.push({
            shareId: s.id,
            toEmail: s.receiver_email,
            toName: s.receiver_name,
            createdAt: s.created_at,
          })
        }
      }
    }

    const activeDistressPings = activeList.filter((b) => b.buddyDistress)
    const myActiveDistress = activeList.some((b) => b.myDistress)

    return NextResponse.json({
      active: activeList,
      incoming: incomingList,
      outgoing: outgoingList,
      activeDistressPings,
      myActiveDistress,
    })
  } catch (err: any) {
    console.error('[location-share GET] unexpected error:', err)
    return NextResponse.json({ active: [], incoming: [], outgoing: [] }, { status: 500 })
  }
}

// POST /api/location-share: Handle invite, accept/decline, coordinate updates, push sync, and distress pings
export async function POST(request: NextRequest) {
  try {
    const { user, userId } = await getAuthenticatedUser(request)
    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = (user.email || '').toLowerCase().trim()
    const body = await request.json()
    const supabase = await createServerSupabaseClient()

    // 0. ACTION: SYNC PUSH SUBSCRIPTION
    if (body.action === 'sync_push') {
      const parsed = syncPushSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
      }
      const sub: StoredPushSubscription = {
        id: `mem_${userId}`,
        endpoint: parsed.data.subscription.endpoint,
        p256dh: parsed.data.subscription.keys.p256dh,
        auth: parsed.data.subscription.keys.auth,
        content_encoding: 'aesgcm',
      }
      pushByUser.set(userId, sub)
      if (userEmail) pushByEmail.set(userEmail, sub)

      // Also upsert into push_subscriptions table
      try {
        const dbClient = getSupabaseAdmin() || supabase
        await dbClient.from('push_subscriptions').upsert(
          {
            user_id: userId,
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
            content_encoding: 'aesgcm',
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' }
        )
      } catch {}

      return NextResponse.json({ ok: true })
    }

    // 1. ACTION: INVITE
    if (body.action === 'invite') {
      const parsed = inviteSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid invite parameters' }, { status: 400 })
      }

      const receiverEmail = parsed.data.receiverEmail.toLowerCase().trim()
      if (receiverEmail === userEmail) {
        return NextResponse.json({ error: 'You cannot invite yourself to share locations.' }, { status: 400 })
      }

      const { data: existing } = await supabase
        .from('location_shares')
        .select('id, status')
        .or(`and(sender_id.eq.${userId},receiver_email.ilike."${receiverEmail}"),and(sender_email.ilike."${receiverEmail}",receiver_id.eq.${userId})`)
        .in('status', ['pending', 'accepted'])
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({
          message: existing[0].status === 'accepted'
            ? 'You are already mutually sharing live location with this user.'
            : 'A pending location share invite already exists with this user.',
          shareId: existing[0].id,
          status: existing[0].status,
        })
      }

      const senderDisplayName =
        parsed.data.senderName || user.user_metadata?.full_name || userEmail.split('@')[0]

      const { data: newShare, error: insertError } = await supabase
        .from('location_shares')
        .insert({
          sender_id: userId,
          sender_email: userEmail,
          sender_name: senderDisplayName,
          receiver_email: receiverEmail,
          receiver_name: null,
          receiver_id: null,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        console.warn('[location-share] Insert error:', insertError.message)
        return NextResponse.json({ error: insertError.message || 'Failed to create location share invite' }, { status: 500 })
      }

      // Send Push Notification to Receiver if subscribed
      await dispatchPushToRecipients({
        supabase,
        userIds: [],
        emails: [receiverEmail],
        payload: {
          title: `Guardian Circle Invite from ${senderDisplayName}`,
          body: `${senderDisplayName} (${userEmail}) invited you to share live GPS locations on Phola. Tap to accept.`,
          href: '/sos',
          eventType: 'invite',
          distress: false,
          sentAt: new Date().toISOString(),
        },
      })

      return NextResponse.json({
        success: true,
        message: `Location sharing invite sent to ${receiverEmail}. They will receive a notification to accept.`,
        share: newShare,
      })
    }

    // 2. ACTION: RESPOND (ACCEPT / DECLINE)
    if (body.action === 'respond') {
      const parsed = respondSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid respond parameters' }, { status: 400 })
      }

      const { shareId, accept } = parsed.data
      const newStatus = accept ? 'accepted' : 'declined'
      const receiverDisplayName = user.user_metadata?.full_name || userEmail.split('@')[0]

      const { data: updated, error: updateError } = await supabase
        .from('location_shares')
        .update({
          status: newStatus,
          receiver_id: userId,
          receiver_name: receiverDisplayName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shareId)
        .or(`receiver_id.eq.${userId},receiver_email.ilike."${userEmail}"`)
        .select()
        .single()

      if (updateError) {
        console.warn('[location-share] Respond update error:', updateError.message)
        return NextResponse.json({ error: 'Failed to respond to invite' }, { status: 500 })
      }

      if (accept && updated) {
        await dispatchPushToRecipients({
          supabase,
          userIds: updated.sender_id ? [updated.sender_id] : [],
          emails: updated.sender_email ? [updated.sender_email] : [],
          payload: {
            title: `${receiverDisplayName} Accepted Your Location Share!`,
            body: `You and ${receiverDisplayName} can now view each other's live GPS location on the Phola map.`,
            href: `/sos?focusBuddy=${updated.id}`,
            eventType: 'invite_accepted',
            distress: false,
            sentAt: new Date().toISOString(),
          },
        })
      }

      return NextResponse.json({
        success: true,
        status: newStatus,
        message: accept ? 'Location sharing accepted! You can now both view each other live.' : 'Invite declined.',
        share: updated,
      })
    }

    // 3. ACTION: UPDATE COORDS (BROADCAST MY LIVE LOCATION)
    if (body.action === 'update_coords') {
      const parsed = updateCoordsSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
      }

      const { lat, lng } = parsed.data
      const now = new Date().toISOString()

      await supabase
        .from('location_shares')
        .update({
          sender_lat: lat,
          sender_lng: lng,
          sender_updated_at: now,
          updated_at: now,
        })
        .eq('sender_id', userId)
        .eq('status', 'accepted')

      await supabase
        .from('location_shares')
        .update({
          receiver_lat: lat,
          receiver_lng: lng,
          receiver_updated_at: now,
          updated_at: now,
        })
        .or(`receiver_id.eq.${userId},receiver_email.ilike."${userEmail}"`)
        .eq('status', 'accepted')

      return NextResponse.json({ success: true, timestamp: now })
    }

    // 4. ACTION: STOP / REVOKE SHARING
    if (body.action === 'stop') {
      const parsed = stopSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid stop parameters' }, { status: 400 })
      }

      await supabase
        .from('location_shares')
        .update({
          status: 'stopped',
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.shareId)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId},receiver_email.ilike."${userEmail}"`)

      return NextResponse.json({ success: true, message: 'Location sharing stopped.' })
    }

    // 5. ACTION: PING UNSAFE (TRIGGER AUDIBLE DISTRESS ALARM & PUSH NOTIFICATIONS ON ALL BUDDY DEVICES)
    if (body.action === 'ping_unsafe') {
      const parsed = pingUnsafeSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid ping parameters' }, { status: 400 })
      }

      const distressMessage =
        parsed.data.message ||
        'I feel unsafe right now! Please check my live location and contact me immediately.'
      const now = new Date().toISOString()

      const senderUpdatePayload: Record<string, any> = {
        sender_distress: true,
        sender_distress_message: distressMessage,
        sender_distress_at: now,
        updated_at: now,
      }
      if (typeof parsed.data.lat === 'number' && typeof parsed.data.lng === 'number') {
        senderUpdatePayload.sender_lat = parsed.data.lat
        senderUpdatePayload.sender_lng = parsed.data.lng
        senderUpdatePayload.sender_updated_at = now
      }

      const receiverUpdatePayload: Record<string, any> = {
        receiver_distress: true,
        receiver_distress_message: distressMessage,
        receiver_distress_at: now,
        updated_at: now,
      }
      if (typeof parsed.data.lat === 'number' && typeof parsed.data.lng === 'number') {
        receiverUpdatePayload.receiver_lat = parsed.data.lat
        receiverUpdatePayload.receiver_lng = parsed.data.lng
        receiverUpdatePayload.receiver_updated_at = now
      }

      const { data: updatedSender } = await supabase
        .from('location_shares')
        .update(senderUpdatePayload)
        .eq('sender_id', userId)
        .eq('status', 'accepted')
        .select('id')

      const { data: updatedReceiver } = await supabase
        .from('location_shares')
        .update(receiverUpdatePayload)
        .or(`receiver_id.eq.${userId},receiver_email.ilike."${userEmail}"`)
        .eq('status', 'accepted')
        .select('id')

      const totalNotified = (updatedSender?.length || 0) + (updatedReceiver?.length || 0)

      // Dispatch Web Push Notifications to all connected buddies
      const myDisplayName = user.user_metadata?.full_name || userEmail.split('@')[0] || 'Your Guardian'
      const { data: acceptedShares } = await supabase
        .from('location_shares')
        .select('id, sender_id, receiver_id, sender_email, receiver_email')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId},receiver_email.ilike."${userEmail}"`)
        .eq('status', 'accepted')

      const buddyUserIds: string[] = []
      const buddyEmails: string[] = []
      for (const s of acceptedShares || []) {
        if (s.sender_id === userId) {
          if (s.receiver_id) buddyUserIds.push(s.receiver_id)
          if (s.receiver_email) buddyEmails.push(s.receiver_email)
        } else {
          if (s.sender_id) buddyUserIds.push(s.sender_id)
          if (s.sender_email) buddyEmails.push(s.sender_email)
        }
      }

      await dispatchPushToRecipients({
        supabase,
        userIds: buddyUserIds,
        emails: buddyEmails,
        payload: {
          title: `EMERGENCY: ${myDisplayName} Feels Unsafe!`,
          body: `Distress Alert: "${distressMessage}". Tap to track live GPS location on map.`,
          href: `/sos`,
          eventType: 'sos',
          distress: true,
          senderName: myDisplayName,
          sentAt: now,
        },
      })

      return NextResponse.json({
        success: true,
        totalNotified,
        message: totalNotified > 0
          ? `Emergency distress ping sent! Ringing ${totalNotified} guardian device(s) and sending push notifications.`
          : 'Distress ping activated. Invite and connect with guardians in your circle to ring their devices in real-time.',
        timestamp: now,
      })
    }

    // 6. ACTION: RESOLVE PING (I AM SAFE NOW)
    if (body.action === 'resolve_ping') {
      const now = new Date().toISOString()
      const myDisplayName = user.user_metadata?.full_name || userEmail.split('@')[0] || 'Your Guardian'

      await supabase
        .from('location_shares')
        .update({
          sender_distress: false,
          sender_distress_message: null,
          updated_at: now,
        })
        .eq('sender_id', userId)
        .eq('status', 'accepted')

      await supabase
        .from('location_shares')
        .update({
          receiver_distress: false,
          receiver_distress_message: null,
          updated_at: now,
        })
        .or(`receiver_id.eq.${userId},receiver_email.ilike."${userEmail}"`)
        .eq('status', 'accepted')

      // Notify buddies via Push that user is safe now
      const { data: acceptedShares } = await supabase
        .from('location_shares')
        .select('id, sender_id, receiver_id, sender_email, receiver_email')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId},receiver_email.ilike."${userEmail}"`)
        .eq('status', 'accepted')

      const buddyUserIds: string[] = []
      const buddyEmails: string[] = []
      for (const s of acceptedShares || []) {
        if (s.sender_id === userId) {
          if (s.receiver_id) buddyUserIds.push(s.receiver_id)
          if (s.receiver_email) buddyEmails.push(s.receiver_email)
        } else {
          if (s.sender_id) buddyUserIds.push(s.sender_id)
          if (s.sender_email) buddyEmails.push(s.sender_email)
        }
      }

      await dispatchPushToRecipients({
        supabase,
        userIds: buddyUserIds,
        emails: buddyEmails,
        payload: {
          title: `${myDisplayName} is Safe Now`,
          body: `${myDisplayName} marked themselves safe and cleared the emergency distress alarm.`,
          href: `/sos`,
          eventType: 'resolved',
          distress: false,
          sentAt: now,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Distress ping cleared. Your Guardian Circle has been notified that you are safe.',
        timestamp: now,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[location-share POST] unexpected error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
