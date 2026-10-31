'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
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
  LogOut,
  Car,
  Siren,
  Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

const tabs = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Safe Ride Watchdog', href: '/safe-ride', icon: Car },
  { label: 'Safety Hub & Hotlines', href: '/safety', icon: Shield },
  { label: 'Emergency SOS Map', href: '/sos', icon: Siren },
  { label: 'Nearby Services Radar', href: '/nearby', icon: MapPin },
  { label: 'Report GBV (VAULT)', href: '/reports', icon: FileText },
  { label: 'Mzansi News', href: '/news', icon: Newspaper },
  { label: 'AI Safety Assistant', href: '/assistant', icon: Sparkles },
  { label: 'Profile & Settings', href: '/settings', icon: User },
]

export function AppBottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { signOut, lock } = useAuth()
  const [isHidden, setIsHidden] = useState<boolean>(true)
  const [isMounted, setIsMounted] = useState(false)

  const handleSignOut = async () => {
    setIsHidden(true)
    await signOut()
    router.replace('/auth/login')
  }

  useEffect(() => {
    setIsMounted(true)
    // Always start with drawer closed
    setIsHidden(true)
  }, [])

  // Auto-close drawer whenever pathname changes
  useEffect(() => {
    setIsHidden(true)
  }, [pathname])

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHidden(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Do not render on public auth pages or root landing
  if (pathname && (pathname === '/' || pathname.startsWith('/auth/'))) {
    return null
  }

  if (!isMounted) {
    return null
  }

  return (
    <>
      {/* ========================================================================= */}
      {/* GOOGLE-STYLE TOP APP BAR (Pinned header, perfectly vertically centered)    */}
      {/* ========================================================================= */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 sm:h-16 items-center justify-between border-b border-emerald-100/90 bg-white/95 px-3 sm:px-6 shadow-2xs backdrop-blur-md dark:border-border dark:bg-card/95 safe-top">
        {/* Left: Hamburger Button + Logo + Title */}
        <div className="flex items-center gap-2 sm:gap-3 my-auto">
          <button
            type="button"
            onClick={() => setIsHidden(!isHidden)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-emerald-50 active:bg-emerald-100 transition-colors dark:text-foreground dark:hover:bg-muted"
            title="Main menu"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5 text-emerald-950 dark:text-emerald-100" />
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-primary/10 shadow-2xs">
              <Image
                src="/phola-icon.svg"
                alt="Phola"
                width={26}
                height={26}
                className="h-5 w-5"
                priority
              />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Phola
            </span>
          </Link>
        </div>

        {/* Right: Quick Biometric Lock Button (Centered with explicit height, never clipped) */}
        <div className="flex items-center gap-2 shrink-0 my-auto">
          <button
            type="button"
            onClick={() => lock()}
            className="inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100/80 active:scale-95 transition-all shadow-2xs"
            title="Lock Vault & App with Biometrics"
            aria-label="Biometric Lock"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Lock App</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* DRAWER BACKDROP (z-50)                                                    */}
      {/* ========================================================================= */}
      {!isHidden && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setIsHidden(true)}
          aria-hidden="true"
        />
      )}

      {/* ========================================================================= */}
      {/* SIDE NAVIGATION DRAWER (z-50, always sits above offline banner z-30)       */}
      {/* ========================================================================= */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 flex flex-col w-72 bg-white dark:bg-card border-r border-emerald-100 dark:border-border shadow-2xl transition-transform duration-250 ease-out safe-top safe-bottom ${
          isHidden ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 border-b border-emerald-100/80 dark:border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsHidden(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
              title="Close menu"
              aria-label="Close navigation menu"
            >
              <Menu className="h-5 w-5 text-emerald-950" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                <Image
                  src="/phola-icon.svg"
                  alt="Phola"
                  width={22}
                  height={22}
                  className="h-4 w-4"
                />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">Phola</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsHidden(true)}
            className="rounded-full p-2 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
            title="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Items List - Auto-closes drawer on item click */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              pathname?.startsWith(`${tab.href}/`) ||
              (tab.href === '/reports' && pathname === '/notes') ||
              (tab.href === '/safety' && pathname === '/safe-ride')
            const Icon = tab.icon

            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => {
                  setIsHidden(true)
                  router.push(tab.href)
                }}
                className={`w-full flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-950 border border-emerald-200/80 shadow-2xs dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'text-slate-600 dark:text-muted-foreground hover:bg-emerald-50/60 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </div>
                {isActive && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Drawer Footer Actions */}
        <div className="p-3 border-t border-emerald-100/80 dark:border-border space-y-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2 text-red-600" />
            Logout
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">Phola Safety Network • South Africa</p>
        </div>
      </aside>
    </>
  )
}

// Re-export alias
export { AppBottomNav as AppSideNav }
