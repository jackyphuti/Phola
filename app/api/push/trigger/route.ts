export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { captureException } from '@sentry/nextjs'
import { sendWebPushBatch } from '@/lib/server-web-push'
import { sendNativePushBatch } from '@/lib/server-fcm'
import { checkRateLimit, rateLimitResponse, validateJsonBody } from '@/lib/api'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

type PushEventType = 'sos' | 'incident'

type TriggerBody = {
  eventType: PushEventType
  title?: string
  message?: string
  href?: string
  metadata?: Record<string, unknown>
}

const triggerSchema = z.object({
  eventType: z.enum(['sos', 'incident']),
  title: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
  href: z.string().trim().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
})

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
}

function buildDefaultPayload(eventType: PushEventType) {
  if (eventType === 'sos') {
    return {
      title: 'SOS Activated',
      message: 'Emergency mode is active. Keep location sharing on.',
      href: '/sos',
    }
  }

  return {
    title: 'Incident Submitted',
    message: 'Your report was submitted successfully to your Encrypted Vault.',
    href: '/reports',
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'api:push-trigger', { limit: 30, windowMs: 10 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const { userId, error: authError } = await getAuthenticatedUser(request)
  if (!userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const parsedBody = validateJsonBody(await request.json().catch(() => null), triggerSchema)
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 })
  }

  const body = parsedBody.data as TriggerBody

  const defaults = buildDefaultPayload(body.eventType)
  const payload = {
    title: body.title || defaults.title,
    body: body.message || defaults.message,
    href: body.href || defaults.href,
    eventType: body.eventType,
    distress: body.eventType === 'sos',
    metadata: body.metadata || {},
    sentAt: new Date().toISOString(),
  }

  const dbClient = getSupabaseAdmin() || (await createServerSupabaseClient())

  const { data: subscriptions, error: subscriptionsError } = await dbClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, content_encoding')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (subscriptionsError) {
    captureException(new Error(subscriptionsError.message))
    return NextResponse.json({ error: subscriptionsError.message }, { status: 500 })
  }

  let webSent = 0
  let webStale = 0
  let webFailed = 0

  if (Array.isArray(subscriptions) && subscriptions.length > 0) {
    const result = await sendWebPushBatch(subscriptions, payload)
    webSent = result.successIds.length
    webStale = result.staleIds.length
    webFailed = result.failures.length

    if (result.successIds.length > 0) {
      await dbClient
        .from('push_subscriptions')
        .update({
          last_success_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .in('id', result.successIds)
    }

    if (result.staleIds.length > 0) {
      await dbClient
        .from('push_subscriptions')
        .update({
          is_active: false,
          last_error: 'Push endpoint expired',
          updated_at: new Date().toISOString(),
        })
        .in('id', result.staleIds)
    }
  }

  // Also query native device push tokens (FCM/APNs)
  let nativeSent = 0
  try {
    const { data: deviceTokens } = await dbClient
      .from('device_push_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (Array.isArray(deviceTokens) && deviceTokens.length > 0) {
      const tokens = deviceTokens.map((t: { token: string }) => t.token)
      const nativeResult = await sendNativePushBatch(
        tokens,
        {
          title: payload.title,
          body: payload.body,
          href: payload.href,
          distress: payload.distress,
        },
        async (invalidTokens) => {
          await dbClient
            .from('device_push_tokens')
            .update({ is_active: false })
            .in('token', invalidTokens)
        }
      )
      nativeSent = nativeResult.successCount
    }
  } catch (err) {
    console.warn('[push-trigger] Native push dispatch error:', err)
  }

  return NextResponse.json({
    ok: true,
    sent: webSent + nativeSent,
    webSent,
    nativeSent,
    stale: webStale,
    failed: webFailed,
  })
}
