"use client"

import { useEffect, useState, useRef } from 'react'

type MediaItem = { src: string; type: 'image' | 'video' }

export default function GBVIntro() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const touchStartY = useRef<number | null>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/gbv/list.json')
        if (!res.ok) throw new Error('no list')
        const list: string[] = await res.json()
        setItems(
          list.map((f) => ({
            src: `/gbv/${f}`,
            type: /\.(mp4|mov|m4v)$/i.test(f) ? 'video' : 'image',
          }))
        )
      } catch {
        setItems([])
      }
    }
    load()
  }, [])

  useEffect(() => {
    // auto-hide after user has seen once in this session
    try {
      if (sessionStorage.getItem('pholaGvbSeen')) {
        setVisible(false)
      }
    } catch {}
  }, [])

  function close() {
    setVisible(false)
    try {
      sessionStorage.setItem('pholaGvbSeen', '1')
    } catch {}
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStartY.current = t.clientY
    touchStartX.current = t.clientX
  }

  function onTouchMove(e: React.TouchEvent) {
    // prevent scrolling while intro
    e.preventDefault()
  }

  function onTouchEnd(e: React.TouchEvent) {
    const t = e.changedTouches[0]
    const dy = touchStartY.current !== null ? t.clientY - touchStartY.current : 0
    const dx = touchStartX.current !== null ? t.clientX - touchStartX.current : 0
    // swipe down to dismiss
    if (dy > 120 && Math.abs(dy) > Math.abs(dx)) {
      close()
      return
    }
    // horizontal swipe to change
    if (dx < -40) {
      setIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (dx > 40) {
      setIndex((i) => Math.max(i - 1, 0))
    }
  }

  if (!visible) return null
  if (items.length === 0) return null

  const current = items[index]

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="w-full h-full flex items-center justify-center relative">
        <div className="absolute top-4 left-4 text-white">
          <button onClick={close} className="px-3 py-1 bg-white/10 rounded">Skip</button>
        </div>
        <div className="max-w-full max-h-full flex items-center justify-center">
          {current.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.src} alt={`GBV ${index + 1}`} className="object-contain max-w-full max-h-full" />
          ) : (
            <video src={current.src} controls className="max-w-full max-h-full" />
          )}
        </div>
        <div className="absolute bottom-8 w-full text-center text-white/90">
          <div className="mb-2">Swipe left/right to navigate • Swipe down to skip</div>
          <div className="flex items-center justify-center gap-2">
            {items.map((_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
