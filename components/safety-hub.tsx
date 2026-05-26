'use client'

import { useRouter } from 'next/navigation'
import { ShieldAlert, FileWarning, MapPinned, ListChecks, Siren, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppBottomNav } from '@/components/app-bottom-nav'

export function SafetyHub() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#ECE9E4] pb-24 safe-top safe-bottom">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        <section>
          <h1 className="text-xl font-semibold text-foreground">Safety</h1>
          <p className="text-sm text-muted-foreground">GBV reporting remains at the heart of your safety tools.</p>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => router.push('/report')} className="rounded-xl border border-[#D4D6DA] bg-[#262A2F] p-3 text-left hover:bg-[#2D3238]">
            <ShieldAlert className="mb-2 h-5 w-5 text-[#F97316]" />
            <p className="text-sm font-medium text-[#F2F3F5]">Report GBV</p>
            <p className="text-xs text-[#BFC4CC]">Confidential structured reporting</p>
          </button>
          <button type="button" onClick={() => router.push('/report')} className="rounded-xl border border-[#D4D6DA] bg-[#262A2F] p-3 text-left hover:bg-[#2D3238]">
            <FileWarning className="mb-2 h-5 w-5 text-[#F97316]" />
            <p className="text-sm font-medium text-[#F2F3F5]">Report Crime</p>
            <p className="text-xs text-[#BFC4CC]">Robbery, assault, corruption and more</p>
          </button>
          <button type="button" onClick={() => router.push('/sos')} className="rounded-xl border border-[#FF8A42]/50 bg-[#3A2318] p-3 text-left hover:bg-[#42291D]">
            <Siren className="mb-2 h-5 w-5 text-[#FF8A42]" />
            <p className="text-sm font-medium text-[#FBE9DE]">Emergency SOS</p>
            <p className="text-xs text-[#EBC6AF]">Nearest safe places and emergency actions</p>
          </button>
          <button type="button" onClick={() => router.push('/notes')} className="rounded-xl border border-[#D4D6DA] bg-[#262A2F] p-3 text-left hover:bg-[#2D3238]">
            <ListChecks className="mb-2 h-5 w-5 text-[#F97316]" />
            <p className="text-sm font-medium text-[#F2F3F5]">My Reports</p>
            <p className="text-xs text-[#BFC4CC]">Track saved and submitted reports</p>
          </button>
        </section>

        <Card className="border-[#D4D6DA] bg-[#262A2F]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#F2F3F5]">Crime Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#BFC4CC]">
            <p>GBV, Assault, Robbery, Vehicle theft, Housebreaking, Drug activity, Suspicious behaviour, Police misconduct, Corruption.</p>
            <p className="text-xs">Use Report Crime to capture the incident now. Full custom form branching can be layered on your current report module next.</p>
          </CardContent>
        </Card>

        <Card className="border-[#D4D6DA] bg-[#262A2F]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#F2F3F5]">Community Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[#BFC4CC]">View location-based incidents and nearby response points on the map.</p>
            <Button className="bg-[#F97316] hover:bg-[#EA6B0A] text-white" onClick={() => router.push('/sos')}>
              <MapPinned className="mr-2 h-4 w-4" />
              Open Safety Map
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#FF8A42]/40 bg-[#3A2318]">
          <CardContent className="flex items-start gap-2 p-3 text-sm text-[#EBC6AF]">
            <Info className="mt-0.5 h-4 w-4 text-[#FF8A42]" />
            Anonymous reporting, media evidence metadata stamping, and SAPS station auto-linking can be layered on top of this hub in the next iteration.
          </CardContent>
        </Card>
      </main>

      <AppBottomNav />
    </div>
  )
}
