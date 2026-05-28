import { NextResponse } from 'next/server'
import { z } from 'zod'

export type RateLimitOptions = {
  limit: number
  windowMs: number
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
}

export function checkRateLimit(request: Request, scope: string, options: RateLimitOptions) {
  const now = Date.now()
  const key = `${scope}:${getClientIp(request)}`
  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: options.limit - 1, resetAt }
  }

  if (existing.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  rateLimitStore.set(key, existing)
  return { allowed: true, remaining: Math.max(0, options.limit - existing.count), resetAt: existing.resetAt }
}

export function rateLimitResponse(resetAt: number, message = 'Too many requests') {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}

export function validateJsonBody<T>(body: unknown, schema: z.ZodType<T>) {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message || 'Invalid request payload',
    }
  }

  return {
    ok: true as const,
    data: parsed.data,
  }
}

export async function withTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timeout)
  }
}
