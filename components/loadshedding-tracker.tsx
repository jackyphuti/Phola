'use client'

import { useEffect, useState } from 'react'
import { Clock3, Search, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { requestNotificationPermission, scheduleLoadsheddingReminder, subscribeForProductionPush, triggerLoadsheddingPushEvent } from '@/lib/push-notifications'

type LoadsheddingInfo = {
  areaName: string
  stage: string
  nextOutage: string | null
  nextRestore: string | null
  source: 'eskomsepush' | 'fallback'
}

export function LoadsheddingTracker() {
  const [info, setInfo] = useState<LoadsheddingInfo | null>(null)
  const [manualArea, setManualArea] = useState('')
  const [alertsEnabled, setAlertsEnabled] = useState(false)

  useEffect(() => {
    void subscribeForProductionPush().then((enabled) => {
      setAlertsEnabled(enabled)
    })
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      void fetch('/api/loadshedding').then((res) => res.json()).then((data) => setInfo(data as LoadsheddingInfo))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void fetch(`/api/loadshedding?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`)
          .then((res) => res.json())
          .then((data) => {
            const parsed = data as LoadsheddingInfo
            setInfo(parsed)
            if (alertsEnabled) {
              void scheduleLoadsheddingReminder({
                areaName: parsed.areaName,
                stage: parsed.stage,
                nextOutage: parsed.nextOutage,
              })
              void triggerLoadsheddingPushEvent({
                areaName: parsed.areaName,
                stage: parsed.stage,
                nextOutage: parsed.nextOutage,
              })
            }
          })
      },
      () => {
        void fetch('/api/loadshedding').then((res) => res.json()).then((data) => setInfo(data as LoadsheddingInfo))
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    )
  }, [])

  const runManualLookup = async () => {
    const query = manualArea.trim()
    if (!query) return
    const response = await fetch('/api/loadshedding')
    const data = (await response.json()) as LoadsheddingInfo
    const parsed = { ...data, areaName: query }
    setInfo(parsed)
    if (alertsEnabled) {
      await scheduleLoadsheddingReminder({
        areaName: parsed.areaName,
        stage: parsed.stage,
        nextOutage: parsed.nextOutage,
      })
      await triggerLoadsheddingPushEvent({
        areaName: parsed.areaName,
        stage: parsed.stage,
        nextOutage: parsed.nextOutage,
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#ECE9E4] pb-24 safe-top safe-bottom">
      <main className="mx-auto w-full max-w-3xl space-y-3 p-4">
        <section>
          <h1 className="text-xl font-semibold text-foreground">Loadshedding</h1>
          <p className="text-sm text-muted-foreground">Track outage windows for your area</p>
        </section>

        <Card className="border-[#FF8A42]/40 bg-[#3A2318]">
          <CardContent className="space-y-2 p-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-[#FBE9DE]"><Zap className="h-4 w-4 text-[#FF8A42]" />{info?.stage || 'Checking stage...'}</p>
            <p className="text-xs text-[#EBC6AF]">{info?.areaName || 'Detecting your municipality...'}</p>
            <div className="space-y-1 text-xs text-[#EBC6AF]">
              <p className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Next outage: {info?.nextOutage ? new Date(info.nextOutage).toLocaleString() : 'Not available'}</p>
              <p className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Next restore: {info?.nextRestore ? new Date(info.nextRestore).toLocaleString() : 'Not available'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#D4D6DA] bg-[#262A2F]">
          <CardContent className="space-y-2 p-3">
            <p className="text-sm font-medium text-[#F2F3F5]">Manual area search</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7A818C]" />
                <Input className="pl-9 border-[#3A3F46] bg-[#202328] text-[#F2F3F5]" value={manualArea} onChange={(e) => setManualArea(e.target.value)} placeholder="Search area for family members" />
              </div>
              <Button className="bg-[#F97316] hover:bg-[#EA6B0A] text-white" onClick={() => void runManualLookup()}>Search</Button>
            </div>
            <Button
              type="button"
              variant={alertsEnabled ? 'default' : 'outline'}
              className={alertsEnabled ? 'bg-[#F97316] hover:bg-[#EA6B0A] text-white' : 'border-[#59606A] text-[#D6DAE0]'}
              onClick={() => {
                void subscribeForProductionPush().then((enabled) => {
                  if (enabled) {
                    setAlertsEnabled(true)
                    return
                  }
                  void requestNotificationPermission().then((permission) => {
                    setAlertsEnabled(permission === 'granted')
                  })
                })
              }}
            >
              {alertsEnabled ? 'Alerts Enabled' : 'Enable 30 min Alerts'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#D4D6DA] bg-[#262A2F]">
          <CardContent className="space-y-1 p-3 text-xs text-[#BFC4CC]">
            <p className="font-medium text-[#F2F3F5]">Preparation tips</p>
            <p>Charge devices 30-60 minutes before outage.</p>
            <p>Keep drinking water and a torch ready.</p>
            <p>Store essential meds and emergency contacts offline.</p>
          </CardContent>
        </Card>
      </main>

      <AppBottomNav />
    </div>
  )
}
