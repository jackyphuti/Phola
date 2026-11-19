'use client'

import { useMemo, useState } from 'react'
import { Briefcase, GraduationCap, MapPin, Search, ExternalLink, Sparkles, Building2, HeartHandshake, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppBottomNav } from '@/components/app-bottom-nav'

type JobCategory = 'all' | 'formal' | 'community' | 'youth_bursaries'

type JobItem = {
  id: string
  title: string
  organization: string
  location: string
  type: 'formal' | 'community' | 'youth_bursaries'
  requirements: string
  stipendOrSalary: string
  applyUrl: string
}

const SA_OPPORTUNITIES: JobItem[] = [
  {
    id: '1',
    title: 'Presidential Youth Employment Initiative (PYEI) & Entry Roles',
    organization: 'SA Youth (Harambee)',
    location: 'National (Gauteng, KZN, Western Cape, Eastern Cape)',
    type: 'youth_bursaries',
    requirements: 'Ages 18–34 • South African ID • Free zero-rated portal',
    stipendOrSalary: 'Entry-level / Stipend',
    applyUrl: 'https://sayouth.mobi/',
  },
  {
    id: '2',
    title: 'YES4Youth 12-Month Corporate Work Experience Programme',
    organization: 'Youth Employment Service (YES)',
    location: 'Johannesburg, Pretoria, Cape Town, Durban',
    type: 'youth_bursaries',
    requirements: 'Unemployed youth 18–34 • Matric required',
    stipendOrSalary: 'Monthly Stipend',
    applyUrl: 'https://www.yes4youth.co.za/',
  },
  {
    id: '3',
    title: 'Retail & Customer Service Assistant',
    organization: 'National Retail Group via SAYouth',
    location: 'Soweto, Tshwane & Johannesburg Metro',
    type: 'formal',
    requirements: 'Matric preferred • Good communication skills',
    stipendOrSalary: 'Market Related',
    applyUrl: 'https://sayouth.mobi/',
  },
  {
    id: '4',
    title: 'Community Social Auxiliary & GBV Support Volunteer',
    organization: 'POWA / Community Crisis Network',
    location: 'Gauteng & Regional Centres',
    type: 'community',
    requirements: 'Passion for community safety & survivor empowerment',
    stipendOrSalary: 'Volunteer / Community Stipend',
    applyUrl: 'https://www.powa.co.za/',
  },
  {
    id: '5',
    title: 'Admin Clerk & Digital Data Capturer Intern',
    organization: 'Employment Services of South Africa (ESSA)',
    location: 'Pretoria CBD & Hatfield',
    type: 'formal',
    requirements: 'Matric • Basic computer literacy',
    stipendOrSalary: 'R4,500 – R7,500 pm',
    applyUrl: 'https://essa.labour.gov.za/',
  },
  {
    id: '6',
    title: 'NSFAS Tertiary Bursary & TVET College Funding',
    organization: 'National Student Financial Aid Scheme',
    location: 'All SA Public Universities & TVET Colleges',
    type: 'youth_bursaries',
    requirements: 'Household income under threshold or SASSA recipient',
    stipendOrSalary: 'Full Tuition + Living Allowance',
    applyUrl: 'https://www.nsfas.org.za/',
  },
]

export function JobsBoard() {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<JobCategory>('all')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return SA_OPPORTUNITIES.filter((job) => {
      if (activeTab !== 'all' && job.type !== activeTab) return false
      if (!q) return true
      return `${job.title} ${job.organization} ${job.location} ${job.requirements}`.toLowerCase().includes(q)
    })
  }, [query, activeTab])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4 sm:px-6">
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_50px_rgba(5,40,40,0.05)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="mr-1 h-3 w-3 text-primary" />
                Economic Empowerment
              </Badge>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Jobs, Youth Portals & SASSA Support
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verified South African employment portals, youth learnerships, bursaries, and financial independence resources.
              </p>
            </div>
          </div>
        </section>

        {/* Search & Filter */}
        <section className="space-y-2.5">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-primary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-9 h-11 rounded-2xl border-emerald-200 bg-white text-xs shadow-2xs"
              placeholder="Search by role, province, Pretoria, Soweto, Matric, learnership..."
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 text-muted-foreground hover:text-foreground p-1 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Opportunities' },
              { id: 'formal', label: 'Formal Jobs' },
              { id: 'youth_bursaries', label: 'Youth & Bursaries' },
              { id: 'community', label: 'Community Roles' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as JobCategory)}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white border border-emerald-100 text-slate-700 hover:bg-emerald-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Quick National Support Cards */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card
            onClick={() => window.open('https://srd.sassa.gov.za/', '_blank', 'noopener,noreferrer')}
            className="border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white hover:border-emerald-400 cursor-pointer transition shadow-2xs rounded-2xl"
          >
            <CardContent className="space-y-1.5 p-4">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-950">
                  <HeartHandshake className="h-4 w-4 text-primary" />
                  SASSA SRD & Grants Portal
                </p>
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                Apply for or check your SASSA Social Relief of Distress (SRD), Child Support, and Disability grant status online.
              </p>
            </CardContent>
          </Card>

          <Card
            onClick={() => window.open('https://sayouth.mobi/', '_blank', 'noopener,noreferrer')}
            className="border-amber-200 bg-gradient-to-br from-amber-50/70 to-white hover:border-amber-400 cursor-pointer transition shadow-2xs rounded-2xl"
          >
            <CardContent className="space-y-1.5 p-4">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-sm font-bold text-amber-950">
                  <GraduationCap className="h-4 w-4 text-amber-600" />
                  SA Youth.mobi (Zero-Rated)
                </p>
                <ExternalLink className="h-3.5 w-3.5 text-amber-700" />
              </div>
              <p className="text-xs text-muted-foreground">
                Data-free national network connecting young South Africans to verified entry-level jobs and learnerships.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Listings */}
        <section className="space-y-2.5">
          {filtered.map((job) => (
            <Card key={job.id} className="border-emerald-100 bg-white shadow-2xs hover:border-emerald-300 transition rounded-2xl">
              <CardContent className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-foreground">{job.title}</p>
                    <p className="text-xs font-medium text-primary flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3" />
                      {job.organization}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] font-bold ${
                      job.type === 'formal'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : job.type === 'youth_bursaries'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    {job.type === 'formal' ? 'Formal Role' : job.type === 'youth_bursaries' ? 'Youth / Bursary' : 'Community'}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {job.location}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
                    {job.stipendOrSalary}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <p className="text-xs text-muted-foreground">{job.requirements}</p>
                  <Button
                    size="sm"
                    onClick={() => window.open(job.applyUrl, '_blank', 'noopener,noreferrer')}
                    className="rounded-xl bg-primary hover:bg-primary/90 text-white text-xs h-8 px-3 shrink-0"
                  >
                    Apply / Info
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <AppBottomNav />
    </div>
  )
}
