'use client'

import { useEffect, useMemo, useState } from 'react'
import { Share2, WifiOff, ExternalLink, Flame, Newspaper, RefreshCw, LogOut, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  { value: 'top', label: 'Top Stories' },
  { value: 'politics', label: 'Politics' },
  { value: 'economy', label: 'Economy' },
  { value: 'crime', label: 'Crime & Safety' },
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
    } catch {}
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
          } catch {}
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
    const text = `*${item.title}*\nSource: ${item.source}\n${item.url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] safe-top">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        
        {/* ========================================================================= */}
        {/* HEADER SECTION                                                            */}
        {/* ========================================================================= */}
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_50px_rgba(5,40,40,0.05)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                  <Flame className="mr-1 h-3 w-3 text-primary" />
                  Live South Africa Feed
                </Badge>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Mzansi News & Updates
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Curated daily headlines across South Africa from verified media sources.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CATEGORY CHIPS                                                            */}
        {/* ========================================================================= */}
        <section className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((entry) => {
            const isSelected = entry.value === category
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => setCategory(entry.value)}
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  isSelected 
                    ? 'bg-primary text-white shadow-2xs' 
                    : 'bg-white border border-emerald-100 text-slate-700 hover:bg-emerald-50'
                }`}
              >
                {entry.label}
              </button>
            )
          })}
        </section>

        {/* Offline Warning Banner */}
        {fromCache && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-2xs">
            <WifiOff className="h-4 w-4 shrink-0 text-amber-700" />
            <span>You are currently viewing cached headlines while offline.</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* NEWS STORIES GRID                                                         */}
        {/* ========================================================================= */}
        <section className="space-y-3">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse rounded-2xl border-emerald-100 bg-white p-4">
                  <div className="h-3 bg-slate-100 rounded w-1/4 mb-2" />
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </Card>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-center space-y-3 shadow-2xs">
              <Newspaper className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">No articles found in this category.</p>
              <Button size="sm" variant="outline" onClick={() => setCategory('top')} className="rounded-xl text-xs">
                Back to Top Stories
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((item, idx) => (
                <div
                  key={`${item.url}-${idx}`}
                  className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                        {item.source}
                      </span>
                      {item.publishedAt && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(item.publishedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>

                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block font-bold text-sm text-foreground hover:text-primary transition line-clamp-2 leading-snug"
                    >
                      {item.title}
                    </a>

                    {item.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold hover:underline flex items-center"
                    >
                      Read Story <ExternalLink className="ml-1 h-3 w-3" />
                    </a>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-xl border-emerald-200 text-xs text-emerald-900 hover:bg-emerald-50 px-2.5"
                      onClick={() => shareToWhatsApp(item)}
                    >
                      <Share2 className="mr-1 h-3 w-3 text-emerald-600" />
                      Share
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      <AppBottomNav />
    </div>
  )
}
