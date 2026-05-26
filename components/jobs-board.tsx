'use client'

import { useMemo, useState } from 'react'
import { Briefcase, GraduationCap, MapPin, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AppBottomNav } from '@/components/app-bottom-nav'

type JobItem = {
  id: string
  title: string
  location: string
  type: 'formal' | 'community'
  requirements: string
}

const seedJobs: JobItem[] = [
  { id: '1', title: 'Retail Assistant', location: 'Soweto', type: 'formal', requirements: 'Matric preferred' },
  { id: '2', title: 'Garden Service Helper', location: 'Diepkloof', type: 'community', requirements: 'No experience required' },
  { id: '3', title: 'Delivery Rider', location: 'Johannesburg CBD', type: 'community', requirements: 'Valid learner or license' },
  { id: '4', title: 'Admin Clerk Intern', location: 'Pretoria', type: 'formal', requirements: 'Matric only' },
]

export function JobsBoard() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return seedJobs
    return seedJobs.filter((job) => `${job.title} ${job.location} ${job.requirements}`.toLowerCase().includes(q))
  }, [query])

  return (
    <div className="min-h-screen bg-[#ECE9E4] pb-24 safe-top safe-bottom">
      <main className="mx-auto w-full max-w-3xl space-y-3 p-4">
        <section>
          <h1 className="text-xl font-semibold text-foreground">Jobs & Opportunities</h1>
          <p className="text-sm text-muted-foreground">Formal listings + hyperlocal community board</p>
        </section>

        <section className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7A818C]" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 border-[#C9CDD3] bg-[#F4F2EE]" placeholder="Search by role, location, requirement" />
        </section>

        <section className="space-y-2">
          {filtered.map((job) => (
            <Card key={job.id} className="border-[#D4D6DA] bg-[#262A2F]">
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-[#F2F3F5]">{job.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${job.type === 'formal' ? 'bg-[#F97316]/20 text-[#FFD0AA]' : 'bg-[#D0A04F]/20 text-[#F6D9A6]'}`}>
                    {job.type === 'formal' ? 'Formal' : 'Community'}
                  </span>
                </div>
                <p className="inline-flex items-center gap-1 text-xs text-[#BFC4CC]"><MapPin className="h-3 w-3" />{job.location}</p>
                <p className="text-sm text-[#BFC4CC]">{job.requirements}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Card className="border-[#D4D6DA] bg-[#262A2F]">
            <CardContent className="space-y-2 p-3">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-[#F2F3F5]"><Briefcase className="h-4 w-4 text-[#F97316]" />SASSA info</p>
              <p className="text-xs text-[#BFC4CC]">View grant types, application steps, and nearby offices.</p>
            </CardContent>
          </Card>
          <Card className="border-[#D4D6DA] bg-[#262A2F]">
            <CardContent className="space-y-2 p-3">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-[#F2F3F5]"><GraduationCap className="h-4 w-4 text-[#F97316]" />Bursaries & Learnerships</p>
              <p className="text-xs text-[#BFC4CC]">Explore youth programs and matric-friendly opportunities.</p>
            </CardContent>
          </Card>
        </section>
      </main>

      <AppBottomNav />
    </div>
  )
}
