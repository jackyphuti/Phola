import { captureException } from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse, withTimeout } from '@/lib/api'

export const runtime = 'edge'

type LoadsheddingPayload = {
  areaName: string
  stage: string
  nextOutage: string | null
  nextRestore: string | null
  source: 'eskomsepush' | 'fallback'
}

function fallbackPayload(areaName = 'Your area'): LoadsheddingPayload {
  return {
    areaName,
    stage: 'Stage 2',
    nextOutage: null,
    nextRestore: null,
    source: 'fallback',
  }
}

function guessAreaName(lat: number, lng: number): string {
  if (lat < -33.5) return 'Cape Town Metro'
  if (lat < -29.5 && lng > 30) return 'eThekwini Metro'
  if (lat < -25 && lng > 27) return 'Johannesburg Metro'
  return 'South Africa'
}

function parseCoordinate(raw: string | null, fallback: number, min: number, max: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min || value > max) {
    return fallback
  }

  return value
}

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'api:loadshedding', { limit: 120, windowMs: 5 * 60 * 1000 })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  const key = process.env.ESKOMSEPUSH_API_KEY || process.env.ESKOM_SE_PUSH_API_KEY
  const lat = parseCoordinate(request.nextUrl.searchParams.get('lat'), -26.2041, -90, 90)
  const lng = parseCoordinate(request.nextUrl.searchParams.get('lng'), 28.0473, -180, 180)
  const areaName = guessAreaName(lat, lng)

  if (!key) {
    return NextResponse.json(fallbackPayload(areaName))
  }

  try {
    const areaSearch = await withTimeout(`https://developer.sepush.co.za/business/2.0/areas_search?text=${encodeURIComponent(areaName)}`, {
      headers: {
        token: key,
      },
    }, 12000)

    if (!areaSearch.ok) {
      throw new Error('area search failed')
    }

    const searchData = await areaSearch.json()
    const firstArea = Array.isArray(searchData?.areas) ? searchData.areas[0] : null

    if (!firstArea?.id) {
      return NextResponse.json(fallbackPayload(areaName))
    }

    const statusResponse = await withTimeout(`https://developer.sepush.co.za/business/2.0/area?id=${encodeURIComponent(String(firstArea.id))}`, {
      headers: {
        token: key,
      },
    }, 12000)

    if (!statusResponse.ok) {
      throw new Error('area status failed')
    }

    const statusData = await statusResponse.json()
    const events = statusData?.events || {}
    const info = statusData?.info || {}

    return NextResponse.json({
      areaName: firstArea.name || areaName,
      stage: info?.stage ? `Stage ${info.stage}` : 'Unknown',
      nextOutage: events?.next || null,
      nextRestore: events?.end || null,
      source: 'eskomsepush',
    } satisfies LoadsheddingPayload)
  } catch (error) {
    captureException(error)
    return NextResponse.json(fallbackPayload(areaName))
  }
}
