import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Passkey storage is not configured' }, { status: 500 })
  }

  const { user, userId, error: authError } = await getAuthenticatedUser(request)
  if (!user || !userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { credentialId, publicKey, counter, transports } = body

  if (!credentialId || !publicKey) {
    return NextResponse.json({ error: 'Missing passkey data' }, { status: 400 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  // Upsert passkey to database for verified user
  const { error: upsertError } = await supabaseAdmin
    .from('passkeys')
    .upsert({
      user_id: userId,
      credential_id: credentialId,
      public_key: publicKey,
      counter: counter || 0,
      transports: transports || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'credential_id',
    })

  if (upsertError) {
    console.error('Passkey upsert error:', upsertError)
    return NextResponse.json({ error: 'Failed to save passkey' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Passkey storage is not configured' }, { status: 500 })
  }

  const { user, userId, error: authError } = await getAuthenticatedUser(request)
  if (!user || !userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const { data: passkeys, error } = await supabaseAdmin
    .from('passkeys')
    .select('credential_id, public_key, counter, transports, created_at')
    .eq('user_id', userId)

  if (error) {
    console.error('Passkey fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch passkeys' }, { status: 500 })
  }

  return NextResponse.json({ passkeys: passkeys || [] })
}

export async function DELETE(request: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Passkey storage is not configured' }, { status: 500 })
  }

  const { user, userId, error: authError } = await getAuthenticatedUser(request)
  if (!user || !userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const credentialId = searchParams.get('credentialId')

  if (!credentialId) {
    return NextResponse.json({ error: 'Missing credentialId' }, { status: 400 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const { error } = await supabaseAdmin
    .from('passkeys')
    .delete()
    .eq('user_id', userId)
    .eq('credential_id', credentialId)

  if (error) {
    console.error('Passkey delete error:', error)
    return NextResponse.json({ error: 'Failed to delete passkey' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
