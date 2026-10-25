'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { LockScreen } from '@/components/lock-screen'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { INCIDENT_TYPE_LABELS, type Incident, type IncidentType } from '@/lib/types'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { 
  ArrowLeft, 
  Plus, 
  Clock, 
  FileText,
  Loader2,
  Trash2,
  X,
  ShieldCheck,
  ShieldAlert,
  FileWarning,
  Search,
  Lock,
  ChevronRight,
  LogOut,
  FolderLock
} from 'lucide-react'

export default function NotesPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isLocked } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'gbv' | 'crime' | 'drafts'>('all')
  const [search, setSearch] = useState('')
  
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    if (user) {
      void fetchIncidents()
    }
  }, [user, authLoading, router])

  const fetchIncidents = async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (data) {
      setIncidents(data as Incident[])
    }
    setIsLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!user?.id) return
    setIsDeleting(true)
    
    await supabase
      .from('incidents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    
    setIncidents(prev => prev.filter(i => i.id !== id))
    setShowDeleteConfirm(null)
    setIsDeleting(false)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getTypeLabel = (type: string) => {
    if (type in INCIDENT_TYPE_LABELS) {
      return INCIDENT_TYPE_LABELS[type as IncidentType]
    }
    const legacyLabels: Record<string, string> = {
      physical: 'Physical incident',
      emotional: 'Emotional abuse note',
      sexual: 'Private entry',
      financial: 'Financial abuse note',
      digital: 'Digital harassment',
      stalking: 'Stalking record',
      other: 'Safety note',
    }
    return legacyLabels[type] || 'Incident Note'
  }

  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      // Category filter
      if (filter === 'drafts' && !item.is_draft) return false
      if (filter === 'gbv' && item.incident_type === 'crime') return false
      if (filter === 'crime' && item.incident_type !== 'crime') return false

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase()
        const desc = (item.description || '').toLowerCase()
        const type = (item.incident_type || '').toLowerCase()
        const location = (item.location || '').toLowerCase()
        return desc.includes(q) || type.includes(q) || location.includes(q)
      }

      return true
    })
  }, [incidents, filter, search])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null
  if (isLocked) return <LockScreen />

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,110,110,0.08),_transparent_34%),linear-gradient(180deg,#f7fffc_0%,#ffffff_46%,#f5fbf8_100%)] pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full rounded-3xl border-emerald-100 bg-white shadow-2xl p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Delete this Incident Note?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This record and attached metadata will be permanently removed from your vault. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 font-semibold"
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 sm:px-6">
        
        {/* ========================================================================= */}
        {/* HEADER SECTION                                                            */}
        {/* ========================================================================= */}
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_50px_rgba(5,40,40,0.05)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                  <FolderLock className="mr-1 h-3 w-3 text-primary" />
                  Encrypted Vault
                </Badge>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                My Reports & Notes
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Private diary, incident dockets, and evidence stored securely on your account.
              </p>
            </div>

            <div className="self-start sm:self-center">
              <Button
                size="sm"
                onClick={() => router.push('/report')}
                className="bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl h-9 px-3.5 shadow-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Report
              </Button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SEARCH & CATEGORY FILTERS                                                 */}
        {/* ========================================================================= */}
        <div className="space-y-2">
          {/* Search bar */}
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-white px-3.5 py-2.5 shadow-2xs">
            <Search className="h-4 w-4 text-primary shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by keywords, location, or case..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button 
                type="button" 
                onClick={() => setSearch('')}
                className="text-xs text-muted-foreground hover:text-foreground font-medium px-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Entries', count: incidents.length },
              { id: 'gbv', label: 'GBV Vault', count: incidents.filter(i => i.incident_type !== 'crime').length },
              { id: 'crime', label: 'Crime Reports', count: incidents.filter(i => i.incident_type === 'crime').length },
              { id: 'drafts', label: 'Drafts', count: incidents.filter(i => i.is_draft).length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as 'all' | 'gbv' | 'crime' | 'drafts')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold shrink-0 transition ${
                  filter === tab.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-white border border-emerald-100 text-slate-600 hover:bg-emerald-50'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INCIDENT LIST / EMPTY STATE                                               */}
        {/* ========================================================================= */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse rounded-2xl border-emerald-100 bg-white p-4">
                <div className="h-4 bg-slate-100 rounded w-1/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </Card>
            ))}
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-center space-y-4 shadow-2xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-primary">
              <FileText className="h-7 w-7" />
            </div>
            <div className="max-w-sm mx-auto">
              <h3 className="text-base font-bold text-foreground">No Incident Notes Found</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {search ? 'Try clearing your search term to see all saved records.' : 'Capture notes, witness statements, or official GBV incidents securely in your personal vault.'}
              </p>
            </div>
            <Button
              onClick={() => router.push('/report')}
              className="bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl px-5 h-9 shadow-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Record First Incident
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIncidents.map((incident) => {
              const isCrime = incident.incident_type === 'crime'
              return (
                <div 
                  key={incident.id}
                  onClick={() => router.push(`/report/${incident.id}`)}
                  className="group rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:shadow-sm cursor-pointer transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-primary mt-0.5 group-hover:bg-primary group-hover:text-white transition">
                        {isCrime ? <FileWarning className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-sm text-foreground">
                            {getTypeLabel(incident.incident_type)}
                          </span>
                          {incident.is_draft ? (
                            <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600">
                              Draft
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-800">
                              Submitted
                            </Badge>
                          )}
                          {incident.case_reference && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">
                              CAS {incident.case_reference}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {incident.description || 'No written description entered.'}
                        </p>

                        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-primary" />
                            {formatDate(incident.created_at)}
                          </span>
                          {incident.location && (
                            <span className="truncate max-w-[150px]">
                              📍 {incident.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl h-8 w-8 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowDeleteConfirm(incident.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </main>

      <AppBottomNav />
    </div>
  )
}
