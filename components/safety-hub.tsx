'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ShieldAlert, 
  FileWarning, 
  MapPinned, 
  ListChecks, 
  Siren, 
  Info, 
  Car, 
  Phone, 
  Lock, 
  HeartHandshake, 
  ChevronRight, 
  ExternalLink, 
  ShieldCheck, 
  AlertTriangle,
  HelpCircle,
  FileCheck2,
  Scale,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppBottomNav } from '@/components/app-bottom-nav'

const NATIONAL_HOTLINES = [
  {
    title: 'GBV Command Centre',
    phone: '0800 428 428',
    alt: 'Free SMS *120*7867#',
    description: 'National 24/7 toll-free crisis intervention, trauma counselling, and shelter placement.',
    tag: 'Toll-Free 24/7',
  },
  {
    title: 'SAPS Flying Squad',
    phone: '10111',
    alt: 'National Police Dispatch',
    description: 'Emergency police response unit for immediate danger, armed crime, or assault.',
    tag: 'Emergency Police',
  },
  {
    title: 'Suicide Crisis Helpline (SADAG)',
    phone: '0800 567 567',
    alt: 'SMS 31393',
    description: 'South African Depression and Anxiety Group free 24-hour mental health crisis lifeline.',
    tag: 'Mental Health 24/7',
  },
  {
    title: 'Childline South Africa',
    phone: '116',
    alt: 'Toll-Free All Networks',
    description: 'Protecting children and supporting youth facing abuse, neglect, or violence.',
    tag: 'Child Protection',
  },
]

const SAFETY_RIGHTS = [
  {
    title: 'How to obtain a Protection Order',
    content: 'You can apply at any local Magistrate’s Court for free without needing a lawyer. In urgent danger, you can request an interim protection order the same day.',
  },
  {
    title: 'Your rights at a SAPS police station',
    content: 'Under South African law, police must open a docket if you report a crime or GBV. You are entitled to a Victim Friendly Room (VFR) and medical referral form (J88).',
  },
  {
    title: 'E-Hailing (Uber/Bolt) verification rule',
    content: 'Always match the number plate and driver face before entering. Use Phola Safe Ride Watchdog so trusted contacts are alerted if you don’t arrive on time.',
  },
]

export function SafetyHub() {
  const router = useRouter()
  const [openGuideIndex, setOpenGuideIndex] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        
        {/* ========================================================================= */}
        {/* HERO TITLE & DISGUISE ACTION                                              */}
        {/* ========================================================================= */}
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_60px_rgba(5,40,40,0.05)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="mr-1 h-3 w-3 text-primary" />
                  Mzansi Safety Network
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Safety & Emergency Hub
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Proactive transit protection, confidential incident logging, and instant national crisis lifelines.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* URGENT PROTECTION PILLAR (Safe Ride & SOS Map)                             */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            Immediate Protection & Transit
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* 1. Safe Ride Watchdog Card */}
            <div 
              onClick={() => router.push('/safe-ride')}
              className="group flex flex-col justify-between rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white p-5 shadow-2xs hover:border-primary hover:shadow-sm cursor-pointer transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
                    <Car className="h-6 w-6" />
                  </div>
                  <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold tracking-wider">
                    Recommended
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-foreground">Safe Ride Watchdog</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Taking an <strong>Uber</strong>, <strong>Bolt</strong>, or <strong>inDrive</strong>? Set an arrival timer. Phola monitors your trip and alerts contacts if you don't arrive safely.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-emerald-100">
                <span className="text-xs font-bold text-primary flex items-center">
                  Launch Safe Ride <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition" />
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">1-Tap Watchdog</span>
              </div>
            </div>

            {/* 2. Emergency SOS & Safe Haven Map */}
            <div 
              onClick={() => router.push('/sos')}
              className="group flex flex-col justify-between rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-teal-50/50 via-emerald-50/20 to-white p-5 shadow-2xs hover:border-primary hover:shadow-sm cursor-pointer transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-800 text-white shadow-xs">
                    <Siren className="h-6 w-6" />
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 text-[10px] uppercase font-bold tracking-wider">
                    GPS Heatmap
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-foreground">Emergency SOS & Safe Places</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Interactive radar locating verified SAPS police stations, 24-hour trauma units, hospitals, and designated Thuthuzela Care Centres near you.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-emerald-100">
                <span className="text-xs font-bold text-primary flex items-center">
                  Open Safety Map <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition" />
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">Direct Directions</span>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* STRUCTURED REPORTING & VAULT PILLAR                                       */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            Incident Reporting & Encrypted Vault
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Card 1: Report GBV */}
            <div 
              onClick={() => router.push('/report')}
              className="group rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm cursor-pointer transition"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-primary mb-3 group-hover:bg-primary group-hover:text-white transition">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Report GBV</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                Confidential structured reporting with anonymous filing option and evidence locker.
              </p>
              <div className="mt-3 text-xs font-semibold text-primary flex items-center">
                Start Report <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </div>
            </div>

            {/* Card 2: Report Crime */}
            <div 
              onClick={() => router.push('/report')}
              className="group rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm cursor-pointer transition"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-primary mb-3 group-hover:bg-primary group-hover:text-white transition">
                <FileWarning className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Report Crime</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                Robbery, assault, vehicle theft, housebreaking, or police misconduct documentation.
              </p>
              <div className="mt-3 text-xs font-semibold text-primary flex items-center">
                Start Report <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </div>
            </div>

            {/* Card 3: My Encrypted Reports */}
            <div 
              onClick={() => router.push('/notes')}
              className="group rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm cursor-pointer transition"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-primary mb-3 group-hover:bg-primary group-hover:text-white transition">
                <ListChecks className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">My Reports Vault</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                Access your encrypted incident notes, submitted reports, and SAPS station auto-links.
              </p>
              <div className="mt-3 text-xs font-semibold text-primary flex items-center">
                View Vault <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* 24/7 NATIONAL CRISIS HELPLINES (SOUTH AFRICA)                             */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              National Emergency Helplines (Toll-Free South Africa)
            </h2>
            <Badge variant="outline" className="border-emerald-200 text-emerald-800 text-[10px]">
              24/7 Active
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NATIONAL_HOTLINES.map((hotline) => (
              <Card key={hotline.phone} className="border-emerald-100 bg-white shadow-2xs rounded-2xl overflow-hidden">
                <CardContent className="p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">{hotline.title}</span>
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-900 text-[10px] font-semibold">
                        {hotline.tag}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {hotline.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <p className="font-mono text-sm font-bold text-primary">{hotline.phone}</p>
                      <p className="text-[10px] text-muted-foreground">{hotline.alt}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => window.location.href = `tel:${hotline.phone.replace(/[^\d+]/g, '')}`}
                      className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded-xl h-8 px-3"
                    >
                      <Phone className="mr-1.5 h-3.5 w-3.5" />
                      Call Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* LEGAL RIGHTS & PROTECTION ORDER GUIDES                                    */}
        {/* ========================================================================= */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            Legal Rights & Safety Guidelines (South Africa)
          </h2>

          <div className="space-y-2">
            {SAFETY_RIGHTS.map((guide, idx) => {
              const isOpen = openGuideIndex === idx
              return (
                <div 
                  key={guide.title}
                  className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenGuideIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Scale className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold text-foreground">{guide.title}</span>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground border-t border-slate-100 pt-3">
                      {guide.content}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Security / Privacy Guarantee Banner */}
        <section>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 flex items-start gap-3 shadow-2xs">
            <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Your Privacy & Safety Are Non-Negotiable</p>
              <p className="text-emerald-900 mt-0.5 leading-relaxed">
                Phola does not sell or share your data. All incident notes, Safe Ride sessions, and reports are protected by your personal device encryption and row-level database security.
              </p>
            </div>
          </div>
        </section>

      </main>

      <AppBottomNav />
    </div>
  )
}
