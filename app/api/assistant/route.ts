import { NextRequest, NextResponse } from 'next/server'
import { buildGeminiPrompt, type GeminiAssistantRequest, type GeminiAssistantResponse } from '@/lib/gemini'

export const runtime = 'edge'

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

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as GeminiAssistantRequest | null
  const message = body?.message?.trim()

  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  const prompt = buildGeminiPrompt({
    message,
    language: body?.language,
    mode: body?.mode,
  })

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
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
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Gemini request failed.' }, { status: 502 })
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') ?? ''

  return NextResponse.json(safeJsonParse(text))
}
