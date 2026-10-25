'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  Home, 
  MapPin, 
  Shield, 
  Newspaper, 
  User, 
  FileText, 
  Sparkles, 
  Menu, 
  X, 
  LogOut 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { safeExit } from '@/lib/safe-exit'

const SIDE_NAV_STORAGE_KEY = 'phola_side_tabs_hidden'

const tabs = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Nearby', href: '/nearby', icon: MapPin },
  { label: 'Safety Hub', href: '/safety', icon: Shield },
  { label: 'News Feed', href: '/news', icon: Newspaper },
  { label: 'My Notes', href: '/notes', icon: FileText },
  { label: 'AI Assistant', href: '/assistant', icon: Sparkles },
  { label: 'Profile', href: '/settings', icon: User },
]

export function AppBottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [isHidden, setIsHidden] = useState<boolean>(true)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const stored = window.localStorage.getItem(SIDE_NAV_STORAGE_KEY)
    if (stored !== null) {
      setIsHidden(stored === 'true')
    }
  }, [])

  useEffect(() => {
    setIsHidden(true)
  }, [pathname])

  const toggleHide = (hidden: boolean) => {
    setIsHidden(hidden)
    try {
      window.localStorage.setItem(SIDE_NAV_STORAGE_KEY, String(hidden))
    } catch {}
  }

  // Do not render on public auth pages
  if (pathname && (pathname === '/' || pathname.startsWith('/auth/'))) {
    return null
  }

  if (!isMounted) {
    return null
  }

  return (
    <>
      {/* 3 (-) Hamburger menu button when sidebar is closed */}
      {isHidden && (
        <button
          type="button"
          onClick={() => toggleHide(false)}
          className="fixed left-3.5 top-3.5 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/90 bg-white/95 text-emerald-900 shadow-md backdrop-blur hover:bg-emerald-50 hover:border-emerald-300 transition-all hover:scale-105 active:scale-95"
          title="Menu"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5 text-emerald-800" />
        </button>
      )}

      {/* Backdrop */}
      {!isHidden && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] transition-opacity"
          onClick={() => toggleHide(true)}
          aria-hidden="true"
        />
      )}

      {/* Side Navigation Panel */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 flex flex-col w-64 bg-white/95 dark:bg-card/95 border-r border-emerald-100 dark:border-border backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-in-out safe-top safe-bottom ${
          isHidden ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        {/* Header with App Icon and Close button */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-emerald-100/80 dark:border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
              <Image
                src="/phola-icon.svg"
                alt="Phola"
                width={28}
                height={28}
                className="h-6 w-6"
                priority
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Phola</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Navigation</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggleHide(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
            title="Close menu"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Items List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`)
            const Icon = tab.icon

            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => {
                  router.push(tab.href)
                  toggleHide(true)
                }}
                className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>{tab.label}</span>
                </div>
                {isActive && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-emerald-100/80 dark:border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start rounded-xl text-xs text-muted-foreground hover:text-foreground"
            onClick={() => safeExit()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Quick Exit
          </Button>
        </div>
      </aside>
    </>
  )
}

// Re-export alias
export { AppBottomNav as AppSideNav }
