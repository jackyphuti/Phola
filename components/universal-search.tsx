'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  Car, 
  Siren, 
  FileText, 
  Compass, 
  Shield, 
  MapPin, 
  Newspaper, 
  User, 
  PhoneCall, 
  Building2, 
  X,
  ArrowRight
} from 'lucide-react'

interface SearchItem {
  id: string
  title: string
  subtitle: string
  category: 'Tools' | 'Services' | 'Emergency'
  icon: typeof Search
  href?: string
  action?: () => void
  keywords: string[]
}

export function UniversalSearch() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const items: SearchItem[] = useMemo(() => [
    // Emergency
    {
      id: 'sos-map',
      title: 'Emergency SOS Map',
      subtitle: 'Live GPS coordinate sharing, beacon broadcast & route guidance',
      category: 'Emergency',
      icon: Siren,
      href: '/sos',
      keywords: ['sos', 'emergency', 'help', 'panic', 'danger', 'map', 'alarm', 'police', '10111'],
    },
    {
      id: 'safe-ride',
      title: 'Safe Ride Watchdog',
      subtitle: 'Transit timer, Uber/Bolt trip tracking & check-in alarm',
      category: 'Emergency',
      icon: Car,
      href: '/safe-ride',
      keywords: ['safe ride', 'uber', 'bolt', 'indrive', 'taxi', 'trip', 'commute', 'watchdog', 'transit'],
    },
    {
      id: 'gbv-call',
      title: 'Call GBV Command Centre (0800 428 428)',
      subtitle: '24/7 Toll-free national crisis lifeline & emergency counseling',
      category: 'Emergency',
      icon: PhoneCall,
      action: () => { window.location.href = 'tel:0800428428' },
      keywords: ['gbv', 'command centre', '0800', 'crisis', 'helpline', 'counseling', 'abuse', 'violence', 'call'],
    },
    {
      id: 'police-call',
      title: 'Call SAPS Flying Squad (10111)',
      subtitle: 'Direct nationwide police emergency dispatch',
      category: 'Emergency',
      icon: PhoneCall,
      action: () => { window.location.href = 'tel:10111' },
      keywords: ['police', 'saps', '10111', 'flying squad', 'cops', 'crime'],
    },

    // Tools
    {
      id: 'vault',
      title: 'Incident Vault & Docket',
      subtitle: 'Encrypted evidence, photo records & Section 212 statements',
      category: 'Tools',
      icon: FileText,
      href: '/reports',
      keywords: ['vault', 'incident', 'report', 'evidence', 'docket', 'notes', 'diary', 'affidavit', 'statement'],
    },
    {
      id: 'safety-guide',
      title: 'Safety Guide',
      subtitle: 'Private advisory session on legal rights, J88 forms & protection orders',
      category: 'Tools',
      icon: Compass,
      href: '/assistant',
      keywords: ['safety guide', 'assistant', 'rights', 'legal', 'j88', 'protection order', 'advice', 'help'],
    },
    {
      id: 'safety-hub',
      title: 'Safety Hub & Readiness',
      subtitle: 'Stealth decoy, tactical escape checklist & national directories',
      category: 'Tools',
      icon: Shield,
      href: '/safety',
      keywords: ['safety hub', 'stealth', 'decoy', 'readiness', 'checklist', 'go-bag', 'shelter', 'thuthuzela'],
    },

    // Services
    {
      id: 'nearby-saps',
      title: 'Nearby SAPS Police Stations',
      subtitle: 'Find closest verified police sectors with direct phone numbers',
      category: 'Services',
      icon: Building2,
      href: '/nearby?query=police',
      keywords: ['police stations', 'saps stations', 'police station near me', 'charge office', 'constable'],
    },
    {
      id: 'nearby-clinics',
      title: 'Nearby Clinics & Hospitals',
      subtitle: 'Emergency trauma rooms, 24/7 district clinics & healthcare facilities',
      category: 'Services',
      icon: MapPin,
      href: '/nearby?query=clinic',
      keywords: ['clinics', 'hospitals', 'medical', 'doctors', 'healthcare', 'trauma', 'j88 exam'],
    },
    {
      id: 'nearby-ranks',
      title: 'Nearby Taxi Ranks & Transit Hubs',
      subtitle: 'Local commuter ranks, Gautrain & Metro stations',
      category: 'Services',
      icon: MapPin,
      href: '/nearby?query=taxi',
      keywords: ['taxi rank', 'transit', 'gautrain', 'train station', 'bus station', 'taxi'],
    },
    {
      id: 'nearby-services',
      title: 'Nearby Services Explorer',
      subtitle: 'Full GPS radar for public utility, safe havens & community stations',
      category: 'Services',
      icon: MapPin,
      href: '/nearby',
      keywords: ['nearby', 'services', 'radar', 'finder', 'gps', 'places', 'map'],
    },
    {
      id: 'sa-news',
      title: 'South Africa News & Headlines',
      subtitle: 'Curated daily civic & community safety headlines',
      category: 'Tools',
      icon: Newspaper,
      href: '/news',
      keywords: ['news', 'headlines', 'mzansi', 'south africa', 'updates', 'current affairs'],
    },
    {
      id: 'settings',
      title: 'Settings & Security',
      subtitle: 'Guardian contacts, PIN lock, biometrics & offline data',
      category: 'Tools',
      icon: User,
      href: '/settings',
      keywords: ['settings', 'profile', 'contacts', 'pin', 'biometrics', 'security', 'language', 'account'],
    },
  ], [])

  // Keyboard shortcut: / or Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'k' && (e.metaKey || e.ctrlKey)) ||
        (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')
      ) {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) {
      // Default suggested items
      return items.slice(0, 7)
    }
    return items.filter(item => {
      return (
        item.title.toLowerCase().includes(trimmed) ||
        item.subtitle.toLowerCase().includes(trimmed) ||
        item.keywords.some(k => k.includes(trimmed))
      )
    })
  }, [items, query])

  const handleSelect = (item: SearchItem) => {
    setIsOpen(false)
    setQuery('')
    inputRef.current?.blur()
    if (item.action) {
      item.action()
    } else if (item.href) {
      router.push(item.href)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex])
      }
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md sm:max-w-lg lg:max-w-xl mx-auto">
      {/* Search Input Pill */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedIndex(0)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search tools, SAPS stations, clinics, taxi ranks..."
          className="w-full h-9 sm:h-10 pl-9.5 pr-14 sm:pr-16 text-xs sm:text-[13px] rounded-full bg-surface-tonal dark:bg-muted/60 border border-transparent focus:border-border focus:bg-background text-foreground placeholder:text-muted-foreground outline-none transition-all shadow-2xs"
          aria-label="Universal Search"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            className="absolute right-3 p-1 rounded-full text-muted-foreground hover:text-foreground"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="pointer-events-none absolute right-2.5 flex items-center gap-1">
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-2xs">
              /
            </kbd>
          </div>
        )}
      </div>

      {/* Dropdown Results Window */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-[380px] overflow-y-auto rounded-xl border border-border bg-card shadow-xl p-2 animate-in fade-in zoom-in-98 duration-100">
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-1">
            <span>{query ? 'Matching Results' : 'Suggested Shortcuts'}</span>
            <span className="text-[10px] font-normal normal-case">Press Esc to close</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No results found for &quot;{query}&quot;. Try &quot;police&quot;, &quot;safe ride&quot;, or &quot;vault&quot;.
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredItems.map((item, index) => {
                const isSelected = index === selectedIndex
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-surface-tonal text-foreground ring-1 ring-border'
                        : 'text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        item.category === 'Emergency'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate leading-snug">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate leading-tight">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pl-2 shrink-0">
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        item.category === 'Emergency'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {item.category}
                      </span>
                      {isSelected && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
