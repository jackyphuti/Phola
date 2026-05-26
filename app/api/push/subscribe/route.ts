export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type PushSubscriptionPayload = {
  endpoint: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

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
  const env = getEnv()
  if (!env) {
    return NextResponse.json({ error: 'Push subscription API is not configured' }, { status: 500 })
  }

  const { userId, error: authError } = await getAuthenticatedUser(request)
  if (!userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { subscription?: PushSubscriptionPayload } | null
  const subscription = body?.subscription

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: 'Invalid push subscription payload' }, { status: 400 })
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const env = getEnv()
  if (!env) {
    return NextResponse.json({ error: 'Push subscription API is not configured' }, { status: 500 })
  }

  const { userId, error: authError } = await getAuthenticatedUser(request)
  if (!userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null
  if (!body?.endpoint) {
    return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 })
  }

  const supabaseAdmin = createClient(env.supabaseUrl, env.serviceRoleKey)

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
      last_error: 'Unsubscribed by client',
    })
    .eq('user_id', userId)
    .eq('endpoint', body.endpoint)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
