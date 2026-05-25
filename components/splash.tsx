"use client"

import { useEffect, useState } from 'react'

const SPLASH_MS = 1800
let splashShown = false

export default function Splash() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Mode: 'once' (default) or 'always' — controlled via NEXT_PUBLIC_PHOLA_SPLASH_MODE
    const mode = (process.env.NEXT_PUBLIC_PHOLA_SPLASH_MODE as string) || 'once'

    if (mode === 'once' && splashShown) {
      return
    }

    setVisible(true)
    // add class to dim/blurr app content while splash shows
    document.documentElement.classList.add('phola-splash-active')

    const t = setTimeout(() => {
      setVisible(false)
      document.documentElement.classList.remove('phola-splash-active')
      splashShown = true
    }, SPLASH_MS)

    return () => {
      clearTimeout(t)
      document.documentElement.classList.remove('phola-splash-active')
    }
  }, [])

  if (!visible) return null

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="animate-splash flex items-center justify-center rounded-lg p-2">
        <img src="/phola-icon.svg" alt="Phola" className="w-28 h-28" />
      </div>
    </div>
  )
}
