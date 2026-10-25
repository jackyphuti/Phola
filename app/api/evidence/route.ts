import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { captureException } from '@sentry/nextjs'
import { checkRateLimit, rateLimitResponse, validateJsonBody } from '@/lib/api'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { z } from 'zod'

const EVIDENCE_BUCKET = 'incident-evidence'

type UploadedEvidenceItem = {
  path: string
  contentType: string
  size: number
  originalName: string
  uploadedAt: string
  metadata: Record<string, unknown>
}

const evidenceMetadataSchema = z.object({
  incidentType: z.string().trim().min(1).max(64),
  metadata: z.string().trim().default('{}'),
})

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'api:evidence', { limit: 10, windowMs: 10 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Evidence upload is not configured' }, { status: 500 })
  }

  const { user, userId, error: authError } = await getAuthenticatedUser(request)
  if (!user || !userId) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const files = formData.getAll('evidence') as File[]

  const parsedFields = validateJsonBody(
    {
      incidentType: (formData.get('incidentType') as string | null) || 'unknown',
      metadata: (formData.get('metadata') as string | null) || '{}',
    },
    evidenceMetadataSchema,
  )

  if (!parsedFields.ok) {
    return NextResponse.json({ error: parsedFields.error }, { status: 400 })
  }

  const { incidentType, metadata: metadataRaw } = parsedFields.data

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ items: [] })
  }

  if (files.length > 10) {
    return NextResponse.json({ error: 'Too many files uploaded' }, { status: 400 })
  }

  let metadata: Record<string, unknown> = {}
  try {
    metadata = JSON.parse(metadataRaw) as Record<string, unknown>
  } catch {
    metadata = {}
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const uploaded: UploadedEvidenceItem[] = []

  for (const file of files) {
    if (!(file instanceof File)) continue

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Each evidence file must be 10MB or smaller' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const now = new Date().toISOString()
    const safeName = sanitizeFileName(file.name || 'evidence')
    const path = `${userId}/${incidentType}/${Date.now()}-${safeName}`

    const { error } = await supabaseAdmin.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (error) {
      captureException(new Error(error.message))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    uploaded.push({
      path,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      originalName: file.name,
      uploadedAt: now,
      metadata,
    })
  }

  return NextResponse.json({ items: uploaded })
}
