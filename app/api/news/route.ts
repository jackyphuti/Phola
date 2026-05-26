import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

type NewsItem = {
  title: string
  description: string
  source: string
  url: string
  imageUrl?: string
  publishedAt?: string
  category: string
}

const FALLBACK_NEWS: Record<string, NewsItem[]> = {
  top: [
    {
      title: 'Community Safety Networks Expand Across Gauteng',
      description: 'Local organizations are strengthening neighborhood support systems and emergency response plans.',
      source: 'Community Wire',
      url: 'https://www.sanews.gov.za/',
      category: 'top',
    },
    {
      title: 'Local Clinics Extend Weekend Service Hours',
      description: 'Several public clinics announced pilot programs to improve healthcare access.',
      source: 'SABC News',
      url: 'https://www.sabcnews.com/',
      category: 'top',
    },
  ],
  politics: [
    {
      title: 'Parliament Debates New Community Protection Measures',
      description: 'MPs discussed updates aimed at improving justice outcomes for survivors.',
      source: 'News24',
      url: 'https://www.news24.com/',
      category: 'politics',
    },
  ],
  economy: [
    {
      title: 'Small Business Grants Expanded for Township Entrepreneurs',
      description: 'New funding windows target youth-owned and women-owned ventures.',
      source: 'Daily Maverick',
      url: 'https://www.dailymaverick.co.za/',
      category: 'economy',
    },
  ],
  crime: [
    {
      title: 'Community Patrol Initiatives Scale Up in Metro Areas',
      description: 'Partnerships between residents and local safety structures are increasing.',
      source: 'TimesLIVE',
      url: 'https://www.timeslive.co.za/',
      category: 'crime',
    },
  ],
  sports: [
    {
      title: 'Bafana Prepare for Crucial Qualifier Fixtures',
      description: 'Coaching staff confirmed a strong training camp focus for upcoming matches.',
      source: 'SABC Sport',
      url: 'https://www.sabcsport.com/',
      category: 'sports',
    },
  ],
  entertainment: [
    {
      title: 'Mzansi Creators Spotlight Community Stories on New Platforms',
      description: 'Independent creators are using digital channels to tell local stories.',
      source: 'GroundUp',
      url: 'https://www.groundup.org.za/',
      category: 'entertainment',
    },
  ],
  community: [
    {
      title: 'Regional Service Directory Updated for Local Residents',
      description: 'Community-led groups published refreshed contact lists for essential services.',
      source: 'Local Bulletin',
      url: 'https://www.gov.za/',
      category: 'community',
    },
  ],
}

function normalizeCategory(raw: string | null): string {
  const value = (raw || 'top').toLowerCase()
  const allowed = ['top', 'politics', 'economy', 'crime', 'sports', 'entertainment', 'community']
  return allowed.includes(value) ? value : 'top'
}

function mapNewsApiCategory(category: string): string {
  if (category === 'sports') return 'sports'
  if (category === 'entertainment') return 'entertainment'
  if (category === 'economy') return 'business'
  return 'general'
}

function getSourceWhitelist(): string[] {
  return [
    'news24',
    'daily-maverick',
    'sabc-news',
    'timeslive',
    'groundup',
  ]
}

export async function GET(request: NextRequest) {
  const category = normalizeCategory(request.nextUrl.searchParams.get('category'))
  const limit = Number(request.nextUrl.searchParams.get('limit') || '10')
  const apiKey = process.env.NEWS_API_KEY || process.env.NEWSAPI_KEY

  if (!apiKey) {
    return NextResponse.json({
      items: (FALLBACK_NEWS[category] || FALLBACK_NEWS.top).slice(0, limit),
      source: 'fallback',
    })
  }

  const newsApiCategory = mapNewsApiCategory(category)
  const language = 'en'
  const pageSize = Math.max(1, Math.min(limit, 20))

  const params = new URLSearchParams({
    country: 'za',
    category: newsApiCategory,
    language,
    pageSize: String(pageSize),
    apiKey,
  })

  try {
    const response = await fetch(`https://newsapi.org/v2/top-headlines?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('news api request failed')
    }

    const data = await response.json()
    const sourceWhitelist = getSourceWhitelist()

    const items: NewsItem[] = Array.isArray(data?.articles)
      ? data.articles
          .filter((article: { source?: { id?: string; name?: string } }) => {
            const sourceId = (article?.source?.id || '').toLowerCase()
            if (!sourceId) return true
            return sourceWhitelist.includes(sourceId)
          })
          .map((article: { title?: string; description?: string; url?: string; urlToImage?: string; publishedAt?: string; source?: { name?: string } }) => ({
            title: article.title || 'Untitled article',
            description: article.description || '',
            source: article.source?.name || 'Unknown source',
            url: article.url || '',
            imageUrl: article.urlToImage || undefined,
            publishedAt: article.publishedAt || undefined,
            category,
          }))
          .filter((article: NewsItem) => Boolean(article.url))
      : []

    if (items.length === 0) {
      return NextResponse.json({
        items: (FALLBACK_NEWS[category] || FALLBACK_NEWS.top).slice(0, limit),
        source: 'fallback',
      })
    }

    return NextResponse.json({ items, source: 'newsapi' })
  } catch {
    return NextResponse.json({
      items: (FALLBACK_NEWS[category] || FALLBACK_NEWS.top).slice(0, limit),
      source: 'fallback',
    })
  }
}
