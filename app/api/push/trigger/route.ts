export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendWebPushBatch } from '@/lib/server-web-push'

type PushEventType = 'sos' | 'loadshedding' | 'incident'

type TriggerBody = {
  eventType: PushEventType
  title?: string
  message?: string
  href?: string
  metadata?: Record<string, unknown>
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

function buildDefaultPayload(eventType: PushEventType) {
  if (eventType === 'sos') {
    return {
      title: 'SOS Activated',
      message: 'Emergency mode is active. Keep location sharing on.',
      href: '/sos',
    }
  }

  if (eventType === 'loadshedding') {
    return {
      title: 'Loadshedding Update',
      message: 'Your outage schedule has a new update.',
      href: '/loadshedding',
    }
  }

  return {
    title: 'Incident Submitted',
    message: 'Your report was submitted successfully.',
    href: '/notes',
  }
}

export async function POST(request: NextRequest) {
  const env = getEnv()
  if (!env) {
    return NextResponse.json({ error: 'Push trigger API is not configured' }, { status: 500 })
  }

  const { userId, error: authError } = await getAuthenticatedUser(request)
  if (!userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as TriggerBody | null
  if (!body?.eventType) {
    return NextResponse.json({ error: 'eventType is required' }, { status: 400 })
  }

  const defaults = buildDefaultPayload(body.eventType)
  const payload = {
    title: body.title || defaults.title,
    body: body.message || defaults.message,
    href: body.href || defaults.href,
    eventType: body.eventType,
    metadata: body.metadata || {},
    sentAt: new Date().toISOString(),
  }

  const supabaseAdmin = createClient(env.supabaseUrl, env.serviceRoleKey)

  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, content_encoding')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (subscriptionsError) {
    return NextResponse.json({ error: subscriptionsError.message }, { status: 500 })
  }

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const result = await sendWebPushBatch(subscriptions, payload)

  if (result.successIds.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({
        last_success_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .in('id', result.successIds)
  }

  if (result.staleIds.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({
        is_active: false,
        last_error: 'Push endpoint expired',
        updated_at: new Date().toISOString(),
      })
      .in('id', result.staleIds)
  }

  if (result.failures.length > 0) {
    for (const failure of result.failures) {
      await supabaseAdmin
        .from('push_subscriptions')
        .update({
          last_error: failure.reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', failure.id)
    }
  }

  return NextResponse.json({
    ok: true,
    sent: result.successIds.length,
    stale: result.staleIds.length,
    failed: result.failures.length,
  })
}
