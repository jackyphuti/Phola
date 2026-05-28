'use client'

import { useRouter } from 'next/navigation'
import { ShieldAlert, FileWarning, MapPinned, ListChecks, Siren, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppBottomNav } from '@/components/app-bottom-nav'

export function SafetyHub() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pb-24 safe-top safe-bottom">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Safety</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Safety</h1>
          <p className="mt-2 text-sm text-muted-foreground">GBV reporting remains at the heart of your safety tools.</p>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => router.push('/report')} className="rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50">
            <ShieldAlert className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">Report GBV</p>
            <p className="text-xs text-muted-foreground">Confidential structured reporting</p>
          </button>
          <button type="button" onClick={() => router.push('/report')} className="rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50">
            <FileWarning className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">Report Crime</p>
            <p className="text-xs text-muted-foreground">Robbery, assault, corruption and more</p>
          </button>
          <button type="button" onClick={() => router.push('/sos')} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100">
            <Siren className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">Emergency SOS</p>
            <p className="text-xs text-muted-foreground">Nearest safe places and emergency actions</p>
          </button>
          <button type="button" onClick={() => router.push('/notes')} className="rounded-2xl border border-emerald-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50">
            <ListChecks className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">My Reports</p>
            <p className="text-xs text-muted-foreground">Track saved and submitted reports</p>
          </button>
        </section>

        <Card className="border-emerald-100 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">Crime Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>GBV, Assault, Robbery, Vehicle theft, Housebreaking, Drug activity, Suspicious behaviour, Police misconduct, Corruption.</p>
            <p className="text-xs">Use Report Crime to capture the incident now. Full custom form branching can be layered on your current report module next.</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">Community Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">View location-based incidents and nearby response points on the map.</p>
            <Button className="bg-primary text-white shadow-sm hover:bg-primary/90" onClick={() => router.push('/sos')}>
              <MapPinned className="mr-2 h-4 w-4" />
              Open Safety Map
            </Button>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50 shadow-sm">
          <CardContent className="flex items-start gap-2 p-3 text-sm text-emerald-900">
            <Info className="mt-0.5 h-4 w-4 text-primary" />
            Anonymous reporting, media evidence metadata stamping, and SAPS station auto-linking can be layered on top of this hub in the next iteration.
          </CardContent>
        </Card>
      </main>

      <AppBottomNav />
    </div>
  )
}
