'use client'

import { useEffect, useMemo, useState } from 'react'
import { Share2, WifiOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppBottomNav } from '@/components/app-bottom-nav'

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

const CACHE_KEY = 'news-cache-v1'

export function NewsFeed() {
  const [category, setCategory] = useState<NewsCategory>('top')
  const [items, setItems] = useState<NewsItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/news?category=${category}&limit=20`)
        const data = await response.json()
        const nextItems = Array.isArray(data?.items) ? data.items : []

        setItems(nextItems)
        setFromCache(false)

        if (typeof window !== 'undefined') {
          const cacheRaw = window.localStorage.getItem(CACHE_KEY)
          const cache = cacheRaw ? JSON.parse(cacheRaw) : {}
          cache[category] = nextItems.slice(0, 20)
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
        }
      } catch {
        if (typeof window !== 'undefined') {
          const cacheRaw = window.localStorage.getItem(CACHE_KEY)
          const cache = cacheRaw ? JSON.parse(cacheRaw) : {}
          const cachedItems = Array.isArray(cache[category]) ? cache[category] : []
          setItems(cachedItems)
          setFromCache(true)
        }
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [category])

  const shareToWhatsApp = (item: NewsItem) => {
    const text = `${item.title}\n${item.url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  const headerText = useMemo(() => categories.find((entry) => entry.value === category)?.label || 'News', [category])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pb-24 safe-top safe-bottom">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">News</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">SA News</h1>
          <p className="mt-2 text-sm text-muted-foreground">{headerText}</p>
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
          <Card className="border-emerald-100 bg-emerald-50">
            <CardContent className="flex items-center gap-2 p-3 text-xs text-emerald-800">
              <WifiOff className="h-4 w-4" />
              Showing cached offline articles
            </CardContent>
          </Card>
        )}

        <section className="space-y-2">
          {isLoading ? (
            <Card className="border-emerald-100 bg-white shadow-sm"><CardContent className="p-4 text-sm text-muted-foreground">Loading news...</CardContent></Card>
          ) : items.length === 0 ? (
            <Card className="border-emerald-100 bg-white shadow-sm"><CardContent className="p-4 text-sm text-muted-foreground">No articles available right now.</CardContent></Card>
          ) : (
            items.map((item) => (
              <Card key={item.url} className="border-emerald-100 bg-white shadow-sm">
                <CardContent className="space-y-3 p-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{item.source}</p>
                    <p className="text-base font-medium text-foreground">{item.title}</p>
                    {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-primary text-white shadow-sm hover:bg-primary/90" onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}>Read article</Button>
                    <Button variant="outline" className="border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50" onClick={() => shareToWhatsApp(item)}>
                      <Share2 className="h-4 w-4" />
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
