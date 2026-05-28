import { captureException } from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { buildGeminiPrompt, type GeminiAssistantRequest, type GeminiAssistantResponse } from '@/lib/gemini'
import { checkRateLimit, rateLimitResponse, validateJsonBody, withTimeout } from '@/lib/api'
import { z } from 'zod'

export const runtime = 'edge'

const assistantRequestSchema = z.object({
  message: z.string().trim().min(1),
  language: z.string().trim().optional(),
  mode: z.string().trim().optional(),
})

function safeJsonParse(rawText: string): GeminiAssistantResponse {
  try {
    const parsed = JSON.parse(rawText) as GeminiAssistantResponse
    return {
      reply: typeof parsed.reply === 'string' ? parsed.reply : 'I am ready to help.',
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
    return {
      reply: rawText.trim() || 'I am ready to help.',
      emergency: false,
      actions: [],
    }
  }
}

function buildFallbackResponse(message: string): GeminiAssistantResponse {
  const normalized = message.toLowerCase()
  const emergencyKeywords = ['help now', 'danger', 'hurt', 'unsafe', 'emergency', 'attack', 'threat']
  const reportingKeywords = ['report', 'statement', 'document', 'evidence']
  const resourceKeywords = ['shelter', 'hotline', 'lawyer', 'resources', 'clinic', 'hospital']

  if (emergencyKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      reply:
        'You are not alone. Move to a safer place now if possible, contact someone you trust, and use SOS for urgent help. Keep your phone charged and location sharing on if you can.',
      emergency: true,
      actions: [
        { label: 'Open SOS', href: '/sos' },
        { label: 'Find Resources', href: '/resources' },
      ],
    }
  }

  if (reportingKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      reply:
        'Start with a short timeline: what happened, when, where, and who was involved. Save what you remember now, then add details later when you feel ready.',
      emergency: false,
      actions: [
        { label: 'Open Report Form', href: '/report' },
        { label: 'Open Notes', href: '/notes' },
      ],
    }
  }

  if (resourceKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      reply:
        'You can check nearby support options and trusted contacts now. If you feel unsafe, prioritize places with people around and clear transport routes.',
      emergency: false,
      actions: [
        { label: 'Open Resources', href: '/resources' },
        { label: 'Open SOS', href: '/sos' },
      ],
    }
  }

  return {
    reply:
      'I can still help with a quick safety plan: identify your safest exit, message one trusted person, and keep essential documents and contacts easy to reach.',
    emergency: false,
    actions: [
      { label: 'Open Dashboard', href: '/dashboard' },
      { label: 'Open Resources', href: '/resources' },
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
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

  if (!apiKey) {
    return NextResponse.json(buildFallbackResponse(message))
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
    }, 10000)

    if (!response.ok) {
      return NextResponse.json(buildFallbackResponse(message))
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') ?? ''

    if (!text.trim()) {
      return NextResponse.json(buildFallbackResponse(message))
    }

    return NextResponse.json(safeJsonParse(text))
  } catch (error) {
    captureException(error)
    return NextResponse.json(buildFallbackResponse(message))
  }
}
