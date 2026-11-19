import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { captureException } from '@sentry/nextjs'
import { checkRateLimit, rateLimitResponse, validateJsonBody } from '@/lib/api'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
})

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'api:push-subscribe', { limit: 40, windowMs: 10 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const { userId, error: authError } = await getAuthenticatedUser(request)
  if (!userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const parsedBody = validateJsonBody(await request.json().catch(() => null), subscribeSchema)
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 })
  }

  const subscription = parsedBody.data.subscription
  const dbClient = getSupabaseAdmin() || (await createServerSupabaseClient())

  const { error } = await dbClient
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        content_encoding: 'aesgcm',
        user_agent: request.headers.get('user-agent'),
        is_active: true,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,endpoint',
      },
    )

  if (error) {
    captureException(new Error(error.message))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'api:push-subscribe-delete', { limit: 20, windowMs: 10 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const { userId, error: authError } = await getAuthenticatedUser(request)
  if (!userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const parsedBody = validateJsonBody(await request.json().catch(() => null), z.object({ endpoint: z.string().url() }))
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 })
  }

  const { endpoint } = parsedBody.data
  const dbClient = getSupabaseAdmin() || (await createServerSupabaseClient())

  const { error } = await dbClient
    .from('push_subscriptions')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
      last_error: 'Unsubscribed by client',
    })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)

  if (error) {
    captureException(new Error(error.message))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
