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
  Compass, 
  Menu, 
  X, 
  LogOut,
  Car,
  Siren,
  CloudSun,
  Sun,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { LanguageSelector } from '@/components/language-selector'
import { safeExit } from '@/lib/safe-exit'
import { triggerHapticFeedback } from '@/lib/biometric'
import { UniversalSearch } from '@/components/universal-search'

interface NavItem {
  label: string
  href: string
  icon: typeof Home
  exact?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Emergency',
    items: [
      { label: 'Home', href: '/dashboard', icon: Home, exact: true },
      { label: 'SOS Map', href: '/sos', icon: Siren },
      { label: 'Safe Ride', href: '/safe-ride', icon: Car },
    ],
  },
  {
    title: 'Personal',
    items: [
      { label: 'Incident Vault', href: '/reports', icon: FileText },
      { label: 'Safety Guide', href: '/assistant', icon: Compass },
      { label: 'Safety Hub', href: '/safety', icon: Shield },
    ],
  },
  {
    title: 'Local',
    items: [
      { label: 'Nearby Services', href: '/nearby', icon: MapPin },
      { label: 'South Africa News', href: '/news', icon: Newspaper },
      { label: 'Settings', href: '/settings', icon: User },
    ],
  },
]

export function AppBottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { signOut } = useAuth()
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [isRailCollapsed, setIsRailCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Global Stealth Weather Decoy State
  const [isDecoyActive, setIsDecoyActive] = useState(false)
  const [decoyTapCount, setDecoyTapCount] = useState(0)

  // Initialize and persist rail state
  useEffect(() => {
    setIsMounted(true)
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('phola_nav_rail_collapsed') === 'true'
      setIsRailCollapsed(saved)
      document.documentElement.setAttribute('data-rail', saved ? 'collapsed' : 'expanded')
    }
  }, [])

  const toggleRail = () => {
    const next = !isRailCollapsed
    setIsRailCollapsed(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('phola_nav_rail_collapsed', String(next))
      document.documentElement.setAttribute('data-rail', next ? 'collapsed' : 'expanded')
    }
    triggerHapticFeedback('light')
  }

  const handleSafeExit = () => {
    triggerHapticFeedback('heavy')
    safeExit()
  }

  const handleDecoyTap = () => {
    const next = decoyTapCount + 1
    if (next >= 3) {
      setIsDecoyActive(false)
      setDecoyTapCount(0)
    } else {
      setDecoyTapCount(next)
      setTimeout(() => setDecoyTapCount(0), 1200)
    }
  }

  const handleSignOut = async () => {
    setIsMobileDrawerOpen(false)
    await signOut()
    router.replace('/auth/login')
  }

  // Auto-close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileDrawerOpen(false)
  }, [pathname])

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileDrawerOpen(false)
        if (isDecoyActive) setIsDecoyActive(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDecoyActive])

  // Hide on auth or public landing pages
  if (pathname && (pathname === '/' || pathname.startsWith('/auth/'))) {
    return null
  }

  if (!isMounted) return null

  return (
    <>
      {/* ========================================================================= */}
      {/* STEALTH WEATHER DECOY FULL-SCREEN CAMOUFLAGE                              */}
      {/* ========================================================================= */}
      {isDecoyActive && (
        <div className="fixed inset-0 z-[100] bg-[#f7f9fa] text-slate-800 flex flex-col justify-between p-6 select-none font-sans animate-in fade-in duration-150">
          <div className="space-y-6 max-w-md mx-auto w-full pt-8">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-medium">Johannesburg, Gauteng</span>
              <span>Updated 2m ago</span>
            </div>

            <div 
              onClick={handleDecoyTap} 
              className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col items-center cursor-pointer active:scale-98 transition"
            >
              <Sun className="w-16 h-16 text-amber-500 mb-2 animate-pulse" />
              <span className="text-5xl font-light text-slate-900 tracking-tight">24°C</span>
              <span className="text-sm font-medium text-slate-600 mt-1">Sunny & Mild</span>
              <span className="text-[10px] text-slate-400 mt-3 bg-slate-100 px-3 py-1 rounded-full">
                Tap 3x to return
              </span>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-2.5 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Forecast</h4>
              <div className="flex justify-between text-xs text-slate-600 pt-1">
                <span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span><span>Mon</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-slate-800">
                <span>24°</span><span>26°</span><span>22°</span><span>25°</span><span>27°</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-2 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Grocery Notes</h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>Brown bread & 2L low-fat milk</li>
                <li>Rooibos tea & brown sugar</li>
                <li>Bananas & Golden Delicious apples</li>
              </ul>
            </div>
          </div>

          <div className="text-center pb-4">
            <button
              type="button"
              onClick={() => setIsDecoyActive(false)}
              className="text-[11px] text-slate-400 hover:text-slate-600 underline"
            >
              Exit Decoy View
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PINNED TOP APP BAR (All Breakpoints)                                      */}
      {/* ========================================================================= */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 sm:h-16 items-center justify-between border-b border-border bg-card/95 px-3 sm:px-6 shadow-2xs backdrop-blur-md safe-top">
        {/* Left: Rail Collapse Toggle (Desktop) or Brand & Mobile Drawer Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Desktop Rail Toggle */}
          <button
            type="button"
            onClick={toggleRail}
            className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title={isRailCollapsed ? 'Expand Navigation Rail' : 'Collapse Navigation Rail'}
            aria-label="Toggle Navigation Rail"
          >
            {isRailCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>

          {/* Mobile Drawer Button */}
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors"
            title="Open Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Brand Logo & Name */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary/10 shadow-2xs">
              <Image
                src="/phola-icon.svg"
                alt="Phola"
                width={24}
                height={24}
                className="h-5 w-5"
                priority
              />
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Phola
            </span>
          </Link>
        </div>

        {/* Center: Universal Search Bar */}
        <div className="flex-1 max-w-lg mx-3 sm:mx-6">
          <UniversalSearch />
        </div>

        {/* Right: Language Selector + Stealth Cloak + Quick Safe Exit */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden xs:flex">
            <LanguageSelector minimal />
          </div>

          <button
            type="button"
            onClick={() => setIsDecoyActive(true)}
            className="inline-flex items-center justify-center h-8 sm:h-9 px-2 sm:px-2.5 rounded-full text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800 hover:bg-amber-100/80 active:scale-95 transition-all shadow-2xs"
            title="Stealth Cloak (Disguise screen as weather)"
            aria-label="Stealth Decoy"
          >
            <CloudSun className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="hidden md:inline ml-1 text-[11px]">Stealth</span>
          </button>

          <button
            type="button"
            onClick={handleSafeExit}
            className="inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-full text-xs font-bold text-destructive-foreground bg-destructive hover:bg-destructive/90 active:scale-95 transition-all shadow-2xs"
            title="Safe Exit"
            aria-label="Quick Safe Exit"
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Safe Exit</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* DESKTOP NAVIGATION RAIL (lg: and up, persistent & collapsible)              */}
      {/* ========================================================================= */}
      <aside
        className={`hidden lg:flex fixed left-0 top-14 sm:top-16 bottom-0 z-30 flex-col bg-card border-r border-border transition-all duration-200 ease-in-out ${
          isRailCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              {!isRailCollapsed && (
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`) ||
                    (item.href === '/reports' && pathname === '/notes')
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => triggerHapticFeedback('light')}
                    title={isRailCollapsed ? item.label : undefined}
                    className={`flex items-center rounded-lg transition-all ${
                      isRailCollapsed
                        ? 'justify-center h-10 w-10 mx-auto'
                        : 'justify-between px-3 py-2 text-[13px] font-semibold'
                    } ${
                      isActive
                        ? 'bg-surface-tonal text-primary font-bold shadow-2xs'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      {!isRailCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isRailCollapsed && isActive && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Rail Footer */}
        <div className="p-2 border-t border-border shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            title={isRailCollapsed ? 'Sign Out' : undefined}
            className={`w-full text-destructive hover:bg-destructive/10 rounded-lg text-xs font-semibold ${
              isRailCollapsed ? 'justify-center p-0 h-10' : 'justify-start px-3'
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0 text-destructive" />
            {!isRailCollapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE SLIDE-OVER DRAWER (For Secondary Routes & "More" Tab)              */}
      {/* ========================================================================= */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          <aside className="fixed left-0 top-0 bottom-0 z-50 flex flex-col w-72 bg-card border-r border-border shadow-2xl safe-top safe-bottom animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="flex h-14 items-center justify-between px-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                  <Image src="/phola-icon.svg" alt="Phola" width={20} height={20} className="h-4 w-4" />
                </div>
                <span className="text-base font-bold text-foreground">Phola Navigation</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title} className="space-y-1">
                  <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </div>
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || (item.href === '/reports' && pathname === '/notes')
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileDrawerOpen(false)}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
                          isActive
                            ? 'bg-surface-tonal text-primary font-bold'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span>{item.label}</span>
                        </div>
                        {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border space-y-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="w-full justify-start rounded-lg text-xs font-semibold text-destructive border-border hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 mr-2 text-destructive" />
                Sign Out
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">Phola Safety Network • South Africa</p>
            </div>
          </aside>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5-TAB MOBILE BOTTOM NAVIGATION BAR (< lg: fixed bottom)                   */}
      {/* ========================================================================= */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden flex items-center justify-around h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] pt-1 bg-card/95 border-t border-border shadow-lg backdrop-blur-xl px-2"
      >
        {/* Tab 1: Home */}
        <Link
          href="/dashboard"
          onClick={() => triggerHapticFeedback('light')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all ${
            pathname === '/dashboard' ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Home className={`h-5 w-5 ${pathname === '/dashboard' ? 'text-primary stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5 font-medium">Home</span>
        </Link>

        {/* Tab 2: SOS (Crimson High-Contrast) */}
        <Link
          href="/sos"
          onClick={() => triggerHapticFeedback('medium')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all ${
            pathname === '/sos' ? 'text-destructive font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Siren className={`h-5 w-5 ${pathname === '/sos' ? 'text-destructive stroke-[2.5]' : 'text-destructive/80'}`} />
          <span className="text-[10px] mt-0.5 font-bold text-destructive">SOS</span>
        </Link>

        {/* Tab 3: Safe Ride */}
        <Link
          href="/safe-ride"
          onClick={() => triggerHapticFeedback('light')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all ${
            pathname === '/safe-ride' ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Car className={`h-5 w-5 ${pathname === '/safe-ride' ? 'text-primary stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5 font-medium">Safe Ride</span>
        </Link>

        {/* Tab 4: Vault */}
        <Link
          href="/reports"
          onClick={() => triggerHapticFeedback('light')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-all ${
            pathname === '/reports' || pathname === '/notes' ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className={`h-5 w-5 ${pathname === '/reports' || pathname === '/notes' ? 'text-primary stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5 font-medium">Vault</span>
        </Link>

        {/* Tab 5: More (Opens Slide-over Drawer) */}
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light')
            setIsMobileDrawerOpen(true)
          }}
          className="flex flex-col items-center justify-center flex-1 py-1 text-center text-muted-foreground hover:text-foreground transition-all"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium">More</span>
        </button>
      </nav>
    </>
  )
}

export { AppBottomNav as AppSideNav }
