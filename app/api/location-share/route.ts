import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { z } from 'zod'

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

// GET /api/location-share: Fetch user's active, incoming, and outgoing shares
export async function GET(request: NextRequest) {
  try {
    const { user, userId, error: authError } = await getAuthenticatedUser(request)
    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = (user.email || '').toLowerCase().trim()
    const supabase = await createServerSupabaseClient()

    // Query all shares where current user is either sender or receiver
    const { data: shares, error } = await supabase
      .from('location_shares')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId},receiver_email.ilike.${userEmail}`)
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
      const isReceiver = s.receiver_id === userId || s.receiver_email.toLowerCase() === userEmail

      if (s.status === 'accepted') {
        // Mutual buddy view
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

    return NextResponse.json({
      active: activeList,
      incoming: incomingList,
      outgoing: outgoingList,
    })
  } catch (err: any) {
    console.error('[location-share GET] unexpected error:', err)
    return NextResponse.json({ active: [], incoming: [], outgoing: [] }, { status: 500 })
  }
}

// POST /api/location-share: Handle invite, accept/decline, coordinate updates, and revoke
export async function POST(request: NextRequest) {
  try {
    const { user, userId, error: authError } = await getAuthenticatedUser(request)
    if (!user || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = (user.email || '').toLowerCase().trim()
    const body = await request.json()
    const supabase = await createServerSupabaseClient()

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

      // Check for existing pending or active share
      const { data: existing } = await supabase
        .from('location_shares')
        .select('id, status')
        .or(`and(sender_id.eq.${userId},receiver_email.ilike.${receiverEmail}),and(sender_email.ilike.${receiverEmail},receiver_id.eq.${userId})`)
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

      // Lookup receiver name if available in profiles
      let receiverName: string | null = null
      let receiverId: string | null = null

      // Insert new pending invite
      const { data: newShare, error: insertError } = await supabase
        .from('location_shares')
        .insert({
          sender_id: userId,
          sender_email: userEmail,
          sender_name: parsed.data.senderName || user.user_metadata?.full_name || userEmail.split('@')[0],
          receiver_email: receiverEmail,
          receiver_name: receiverName,
          receiver_id: receiverId,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        console.warn('[location-share] Insert error:', insertError.message)
        return NextResponse.json({ error: 'Failed to create location share invite' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Location sharing invite sent to ${receiverEmail}. They must accept to start mutual sharing.`,
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

      const { data: updated, error: updateError } = await supabase
        .from('location_shares')
        .update({
          status: newStatus,
          receiver_id: userId,
          receiver_name: user.user_metadata?.full_name || userEmail.split('@')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', shareId)
        .or(`receiver_id.eq.${userId},receiver_email.ilike.${userEmail}`)
        .select()
        .single()

      if (updateError) {
        console.warn('[location-share] Respond update error:', updateError.message)
        return NextResponse.json({ error: 'Failed to respond to invite' }, { status: 500 })
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

      // Update as sender
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

      // Update as receiver
      await supabase
        .from('location_shares')
        .update({
          receiver_lat: lat,
          receiver_lng: lng,
          receiver_updated_at: now,
          updated_at: now,
        })
        .or(`receiver_id.eq.${userId},receiver_email.ilike.${userEmail}`)
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
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId},receiver_email.ilike.${userEmail}`)

      return NextResponse.json({ success: true, message: 'Location sharing stopped.' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[location-share POST] unexpected error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
