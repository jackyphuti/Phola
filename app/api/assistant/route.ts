import { captureException } from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { buildGeminiPrompt, type GeminiAssistantRequest, type GeminiAssistantResponse } from '@/lib/gemini'
import { checkRateLimit, rateLimitResponse, validateJsonBody, withTimeout } from '@/lib/api'
import { z } from 'zod'


const assistantRequestSchema = z.object({
  message: z.string().trim().min(1),
  language: z.string().trim().optional(),
  mode: z.string().trim().optional(),
})

function safeJsonParse(rawText: string): GeminiAssistantResponse {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as GeminiAssistantResponse
    return {
      reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'I am ready to help.',
      emergency: Boolean(parsed.emergency),
      actions: Array.isArray(parsed.actions)
        ? parsed.actions
            .filter((action) => action && typeof action.label === 'string')
            .map((action) => ({
              label: action.label,
              href: typeof action.href === 'string' ? action.href : undefined,
            }))
        : [],
    }
  } catch {
    // Try extracting a JSON object substring if model added preamble text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as GeminiAssistantResponse
        if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
          return {
            reply: parsed.reply.trim(),
            emergency: Boolean(parsed.emergency),
            actions: Array.isArray(parsed.actions)
              ? parsed.actions
                  .filter((action) => action && typeof action.label === 'string')
                  .map((action) => ({
                    label: action.label,
                    href: typeof action.href === 'string' ? action.href : undefined,
                  }))
              : [],
          }
        }
      } catch {}
    }

    return {
      reply: cleaned || 'I am ready to help.',
      emergency: false,
      actions: [],
    }
  }
}

function buildFallbackResponse(message: string, mode?: string): GeminiAssistantResponse {
  const normalized = message.toLowerCase()
  const emergencyKeywords = ['help now', 'danger', 'hurt', 'unsafe', 'emergency', 'attack', 'threat', 'following', 'followed', 'weapon', 'gun', 'knife', 'beat']
  const legalKeywords = ['protection order', 'j88', 'docket', 'refused', 'police', 'court', 'lawyer', 'legal', 'rights', 'bail', 'arrest']
  const escapeKeywords = ['go-bag', 'gobag', 'pack', 'leave', 'escape', 'code word', 'codeword', 'cash', 'id copies', 'documents', 'plan']
  const shelterKeywords = ['shelter', 'thuthuzela', 'hotline', 'helpline', 'counselling', 'counseling', 'stay tonight', 'children', 'clinic', 'hospital', 'trauma']
  const reportingKeywords = ['report', 'statement', 'document', 'evidence', 'vault']

  if (emergencyKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      reply:
        '• Prioritise your immediate physical safety: move toward a well-lit public space, security guard, shop, or trusted neighbour.\n' +
        '• If you are being followed in a vehicle or taxi, drive or ask to be dropped at the nearest SAPS Police Station or busy petrol station forecourt.\n' +
        '• Call SAPS Flying Squad on 10111 or the 24/7 GBV Command Centre on 0800 428 428.\n' +
        '• Tap "Open SOS Map" below to ping your Guardian Circle with an audible distress alarm and navigate to the nearest safe haven.',
      emergency: true,
      actions: [
        { label: 'Open SOS Map', href: '/sos' },
        { label: 'Safe Ride Watchdog', href: '/safe-ride' },
        { label: 'Safety Hub & Hotlines', href: '/safety' },
      ],
    }
  }

  if (mode === 'legal_rights' || legalKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      reply:
        '• Protection Orders (Domestic Violence Act 116 of 1998): You can apply for an Interim Protection Order (Form 2) at any nearest Magistrate’s Court for FREE — no lawyer is required, and urgent orders can be issued the same day.\n' +
        '• J88 Medical Evidence Form: If assaulted, visit a public hospital, clinic, or Thuthuzela Care Centre immediately. A doctor must complete the official J88 form to document injuries for court.\n' +
        '• Your SAPS Rights: Under National Instruction 7/1999, no police officer may turn you away. You have the right to be assisted in a private Victim Friendly Room (VFR) and receive a CAS docket number.',
      emergency: false,
      actions: [
        { label: 'Open Encrypted Vault', href: '/reports' },
        { label: 'Log Crime / Incident', href: '/report' },
        { label: 'Nearest SAPS Stations', href: '/nearby?category=police_stations' },
      ],
    }
  }

  if (mode === 'escape_plan' || escapeKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      reply:
        '• Emergency Go-Bag Essentials: Pack certified copies of your SA ID/passport, children’s birth certificates, clinic cards, R200–R500 cash in small notes, spare keys, a power bank, and 3 days of chronic medication.\n' +
        '• Store Outside the Home: Keep your go-bag with a trusted friend, neighbour, or at work so it cannot be discovered.\n' +
        '• Secret Distress Code Word: Agree on an innocent phrase (e.g. "The laundry is ready") with your family or Guardian Circle that means "Call 10111 and come fetch me immediately."',
      emergency: false,
      actions: [
        { label: 'Go-Bag Checklist & Decoy', href: '/safety' },
        { label: 'Encrypted Vault Notes', href: '/reports' },
      ],
    }
  }

  if (mode === 'shelters_care' || shelterKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      reply:
        '• 24/7 Shelter & Crisis Placement: Call the National GBV Command Centre toll-free on 0800 428 428 (or dial *120*7867# for a free callback) for immediate social worker and safe shelter referral.\n' +
        '• Thuthuzela Care Centres (TCCs): Located at public hospitals across SA, providing free emergency medical care, trauma counselling, and police statement taking under one roof.\n' +
        '• Free Counselling Lifelines: SADAG 24hr Trauma Helpline (0800 567 567), Lifeline SA (0861 322 322), POWA (011 642 4345), and Childline (116).',
      emergency: false,
      actions: [
        { label: 'Find Clinics & Hospitals', href: '/nearby?category=clinics_hospitals' },
        { label: 'Find Shelters & NGOs', href: '/nearby?category=shelters_ngos' },
        { label: '24/7 Hotlines & Safety Hub', href: '/safety' },
      ],
    }
  }

  if (reportingKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      reply:
        '• Record Facts Chronologically: Log the date, time, exact location, suspect description or relationship, vehicle registration, and any witnesses while details are fresh.\n' +
        '• Zero-Knowledge Vault: Entries saved in your Phola Vault are stored locally and can be exported into an official SAPS Sworn Affidavit & Docket Statement ready for a police station.',
      emergency: false,
      actions: [
        { label: 'Open Encrypted Vault', href: '/reports' },
        { label: 'New Crime Report', href: '/report' },
      ],
    }
  }

  return {
    reply:
      '• Immediate Safety: Keep your Guardian Circle connected on the SOS Map and share your live GPS before travelling.\n' +
      '• Safe Transport: Use the Safe Ride Watchdog whenever boarding an Uber, Bolt, or minibus taxi to track your arrival countdown.\n' +
      '• 24/7 Support: Call SAPS on 10111 or the GBV Command Centre on 0800 428 428 at any time.',
    emergency: false,
    actions: [
      { label: 'Open Emergency SOS Map', href: '/sos' },
      { label: 'Safe Ride Watchdog', href: '/safe-ride' },
      { label: 'Safety Hub', href: '/safety' },
    ],
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'api:assistant', { limit: 30, windowMs: 5 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const parsedBody = validateJsonBody(await request.json().catch(() => null), assistantRequestSchema)
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 })
  }

  const body = parsedBody.data as GeminiAssistantRequest
  const message = body.message.trim()

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
  const rawModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const model = rawModel.includes('3.8') ? 'gemini-2.5-flash' : rawModel

  if (!apiKey) {
    return NextResponse.json(buildFallbackResponse(message, body?.mode))
  }

  const prompt = buildGeminiPrompt({
    message,
    language: body?.language,
    mode: body?.mode,
  })

  try {
    const response = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 512,
        },
      }),
    }, 8000)

    if (!response.ok) {
      return NextResponse.json(buildFallbackResponse(message, body?.mode))
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') ?? ''

    if (!text.trim()) {
      return NextResponse.json(buildFallbackResponse(message, body?.mode))
    }

    return NextResponse.json(safeJsonParse(text))
  } catch (error) {
    captureException(error)
    return NextResponse.json(buildFallbackResponse(message, body?.mode))
  }
}
