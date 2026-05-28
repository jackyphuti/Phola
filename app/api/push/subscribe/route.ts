export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { captureException } from '@sentry/nextjs'
import { checkRateLimit, rateLimitResponse, validateJsonBody } from '@/lib/api'
import { z } from 'zod'

type PushSubscriptionPayload = {
  endpoint: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

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

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return null
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey }
}

async function getAuthenticatedUser(request: NextRequest) {
  const env = getEnv()
  if (!env) return { userId: null, error: 'Supabase env vars are missing' }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return { userId: null, error: 'Missing access token' }
  }

  const supabaseAuth = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const { data, error } = await supabaseAuth.auth.getUser()
  if (error || !data.user) {
    return { userId: null, error: 'Invalid access token' }
  }

  return { userId: data.user.id, error: null }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'api:push-subscribe', { limit: 20, windowMs: 10 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const env = getEnv()
  if (!env) {
    return NextResponse.json({ error: 'Push subscription API is not configured' }, { status: 500 })
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

  const supabaseAdmin = createClient(env.supabaseUrl, env.serviceRoleKey)

  const { error } = await supabaseAdmin
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

  const env = getEnv()
  if (!env) {
    return NextResponse.json({ error: 'Push subscription API is not configured' }, { status: 500 })
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

  const supabaseAdmin = createClient(env.supabaseUrl, env.serviceRoleKey)

  const { error } = await supabaseAdmin
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
