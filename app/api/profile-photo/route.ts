//export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { captureException } from '@sentry/nextjs'
import { checkRateLimit, rateLimitResponse, validateJsonBody } from '@/lib/api'
import { z } from 'zod'

const PHOTO_BUCKET = 'profile-photos'

const profilePhotoSchema = z.object({
  email: z.string().trim().email(),
  userId: z.string().trim().min(1).max(128),
  fullName: z.string().trim().min(1).max(120),
  photoDataUrl: z.string().trim().optional(),
})

function toBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function buildPhotoPath(email: string) {
  const emailHash = await sha256Hex(normalizeEmail(email))
  return `${emailHash}.jpg`
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, 'api:profile-photo', { limit: 10, windowMs: 15 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Photo upload is not configured' }, { status: 500 })
  }

  const parsedBody = validateJsonBody(await request.json().catch(() => null), profilePhotoSchema)
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 })
  }

  const { email, userId, fullName, photoDataUrl } = parsedBody.data

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  let photoPath: string | undefined

  if (photoDataUrl) {
    const photo = toBuffer(photoDataUrl)
    if (!photo) {
      return NextResponse.json({ error: 'Invalid photo' }, { status: 400 })
    }

    photoPath = await buildPhotoPath(email)
    const { error: uploadError } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, photo.buffer, {
        contentType: photo.contentType,
        upsert: true,
      })

    if (uploadError) {
      captureException(new Error(uploadError.message))
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }
  }

  const userMetadata: Record<string, string> = {
    display_name: fullName,
    full_name: fullName,
  }
  if (photoPath) {
    userMetadata.profile_photo_path = photoPath
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: userMetadata,
  })

  if (updateError) {
    captureException(new Error(updateError.message))
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const profileData: Record<string, unknown> = {
    id: userId,
    display_name: fullName,
    updated_at: new Date().toISOString(),
  }
  if (photoPath) {
    profileData.profile_photo_path = photoPath
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(profileData)

  if (profileError) {
    captureException(new Error(profileError.message))
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ photoPath: photoPath || null })
}
