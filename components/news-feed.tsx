'use client'

import { useEffect, useMemo, useState } from 'react'
import { Share2, WifiOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { getApiUrl } from '@/lib/api-client'

type NewsCategory = 'top' | 'politics' | 'economy' | 'crime' | 'sports' | 'entertainment' | 'community'

type NewsItem = {
  title: string
  description: string
  source: string
  url: string
  imageUrl?: string
  publishedAt?: string
  category: string
}

const categories: Array<{ value: NewsCategory; label: string }> = [
  { value: 'top', label: 'Top stories' },
  { value: 'politics', label: 'Politics' },
  { value: 'economy', label: 'Economy' },
  { value: 'crime', label: 'Crime & safety' },
  { value: 'sports', label: 'Sports' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'community', label: 'Community' },
]

const CACHE_KEY = 'phola-news-cache-v1'

function safeReadCache(): Record<string, NewsItem[]> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(CACHE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, NewsItem[]>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    try {
      window.localStorage.removeItem(CACHE_KEY)
    } catch {
      // ignore
    }
    return {}
  }
}

export function NewsFeed() {
  const [category, setCategory] = useState<NewsCategory>('top')
  const [items, setItems] = useState<NewsItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setIsLoading(true)
      try {
        const url = getApiUrl(`/api/news?category=${category}&limit=20`)
        const response = await fetch(url)
        const data = await response.json()
        const nextItems = Array.isArray(data?.items) ? data.items : []

        if (!isMounted) return

        setItems(nextItems)
        setFromCache(false)

        if (typeof window !== 'undefined' && nextItems.length > 0) {
          try {
            const cache = safeReadCache()
            cache[category] = nextItems.slice(0, 20)
            window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
          } catch {
            // ignore storage quota
          }
        }
      } catch {
        if (!isMounted) return
        const cache = safeReadCache()
        const cachedItems = Array.isArray(cache[category]) ? cache[category] : []
        setItems(cachedItems)
        setFromCache(true)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [category])

  const shareToWhatsApp = (item: NewsItem) => {
    const text = `${item.title}\n${item.url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  const headerText = useMemo(() => categories.find((entry) => entry.value === category)?.label || 'News', [category])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] safe-top">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="pl-12 sm:pl-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">News</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">SA News</h1>
            <p className="mt-2 text-sm text-muted-foreground">{headerText}</p>
          </div>
        </section>

        <section className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((entry) => (
            <Button
              key={entry.value}
              size="sm"
              variant={entry.value === category ? 'default' : 'outline'}
              className={`shrink-0 rounded-full ${entry.value === category ? 'bg-primary text-white shadow-sm' : 'border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50'}`}
              onClick={() => setCategory(entry.value)}
            >
              {entry.label}
            </Button>
          ))}
        </section>

        {fromCache && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>Showing cached news while offline.</span>
          </div>
        )}

        <section className="space-y-3">
          {items.length === 0 && !isLoading ? (
            <Card className="border-emerald-100 bg-white shadow-sm">
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                No articles found in this category.
              </CardContent>
            </Card>
          ) : (
            items.map((item, idx) => (
              <Card key={`${item.url}-${idx}`} className="border-emerald-100 bg-white shadow-sm">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-primary">{item.source}</p>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-semibold text-foreground hover:underline">
                        {item.title}
                      </a>
                    </div>
                  </div>
                  {item.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-muted-foreground">{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ''}</span>
                    <Button size="sm" variant="outline" className="h-7 border-emerald-200 text-xs" onClick={() => shareToWhatsApp(item)}>
                      <Share2 className="mr-1.5 h-3 w-3" />Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </main>

      <AppBottomNav />
    </div>
  )
}
