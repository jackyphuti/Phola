export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const EVIDENCE_BUCKET = 'incident-evidence'

type UploadedEvidenceItem = {
  path: string
  contentType: string
  size: number
  originalName: string
  uploadedAt: string
  metadata: Record<string, unknown>
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Evidence upload is not configured' }, { status: 500 })
  }

  const formData = await request.formData()
  const files = formData.getAll('evidence') as File[]
  const userId = (formData.get('userId') as string | null) || 'anonymous'
  const incidentType = (formData.get('incidentType') as string | null) || 'unknown'
  const metadataRaw = (formData.get('metadata') as string | null) || '{}'

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ items: [] })
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
