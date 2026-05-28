'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, MapPin, Shield, Newspaper, User } from 'lucide-react'

const tabs = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Nearby', href: '/nearby', icon: MapPin },
  { label: 'Safety', href: '/safety', icon: Shield },
  { label: 'News', href: '/news', icon: Newspaper },
  { label: 'Profile', href: '/settings', icon: User },
]

export function AppBottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-100 bg-white/95 backdrop-blur-xl safe-bottom shadow-[0_-10px_30px_rgba(5,40,40,0.06)]">
      <div className="mx-auto grid max-w-2xl grid-cols-5 px-1 py-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`)
          const Icon = tab.icon

          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => router.push(tab.href)}
              className={`flex flex-col items-center justify-center rounded-md py-2 text-[11px] transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label={tab.label}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
