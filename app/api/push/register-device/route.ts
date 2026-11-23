import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { z } from 'zod'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key)
}

const registerSchema = z.object({
  token: z.string().trim().min(5),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
})

const unregisterSchema = z.object({
  token: z.string().trim().min(5),
})

export async function POST(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request)
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid device registration data' }, { status: 400 })
    }

    const { token, platform } = parsed.data
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server database credentials not configured' }, { status: 500 })
    }

    const { error: dbError } = await supabaseAdmin
      .from('device_push_tokens')
      .upsert(
        {
          user_id: user.id,
          token,
          platform,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, token' }
      )

    if (dbError) {
      console.warn('[register-device] Upsert error:', dbError.message)
      return NextResponse.json({ error: 'Failed to register device token' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Device push token registered successfully.' })
  } catch (err) {
    console.error('[register-device] Error processing request:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await getAuthenticatedUser(request)
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = unregisterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const { token } = parsed.data
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server database credentials not configured' }, { status: 500 })
    }

    await supabaseAdmin
      .from('device_push_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('token', token)

    return NextResponse.json({ success: true, message: 'Device push token unregistered.' })
  } catch (err) {
    console.error('[register-device] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
