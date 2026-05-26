import { NextRequest, NextResponse } from 'next/server'

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

export async function GET(request: NextRequest) {
  const key = process.env.ESKOMSEPUSH_API_KEY || process.env.ESKOM_SE_PUSH_API_KEY
  const lat = Number(request.nextUrl.searchParams.get('lat') || '-26.2041')
  const lng = Number(request.nextUrl.searchParams.get('lng') || '28.0473')
  const areaName = guessAreaName(lat, lng)

  if (!key) {
    return NextResponse.json(fallbackPayload(areaName))
  }

  try {
    const areaSearch = await fetch(`https://developer.sepush.co.za/business/2.0/areas_search?text=${encodeURIComponent(areaName)}`, {
      headers: {
        token: key,
      },
      cache: 'no-store',
    })

    if (!areaSearch.ok) {
      throw new Error('area search failed')
    }

    const searchData = await areaSearch.json()
    const firstArea = Array.isArray(searchData?.areas) ? searchData.areas[0] : null

    if (!firstArea?.id) {
      return NextResponse.json(fallbackPayload(areaName))
    }

    const statusResponse = await fetch(`https://developer.sepush.co.za/business/2.0/area?id=${encodeURIComponent(String(firstArea.id))}`, {
      headers: {
        token: key,
      },
      cache: 'no-store',
    })

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
  } catch {
    return NextResponse.json(fallbackPayload(areaName))
  }
}
