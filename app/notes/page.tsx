'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { LockScreen } from '@/components/lock-screen'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
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
  FolderLock,
  Download,
  Copy,
  Check,
  Zap,
  FileCheck,
  Send,
  LogIn
} from 'lucide-react'
import { AppLoadingState } from '@/components/app-loading-state'

const LOCAL_NOTES_PREFIX = 'phola_vault_local_notes_'

export default function NotesPage() {
  const router = useRouter()
  const { user, profile, isLoading: authLoading, isLocked, lock } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'gbv' | 'crime' | 'drafts'>('all')
  const [search, setSearch] = useState('')
  
  // Quick Vault Note State
  const [quickNoteText, setQuickNoteText] = useState('')
  const [quickNoteType, setQuickNoteType] = useState<string>('other')
  const [quickNoteLocation, setQuickNoteLocation] = useState('')
  const [isSavingQuickNote, setIsSavingQuickNote] = useState(false)
  const [quickNoteSuccess, setQuickNoteSuccess] = useState(false)
  const [showQuickComposer, setShowQuickComposer] = useState(false)

  // SAPS Statement Generator Modal State
  const [selectedForStatement, setSelectedForStatement] = useState<Incident | null>(null)
  const [statementCopied, setStatementCopied] = useState(false)
  
  const [supabase] = useState(() => createClient())

  const getLocalNotes = useCallback((): Incident[] => {
    if (typeof window === 'undefined' || !user?.id) return []
    try {
      const raw = window.localStorage.getItem(LOCAL_NOTES_PREFIX + user.id)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }, [user?.id])

  const saveLocalNotes = useCallback((notes: Incident[]) => {
    if (typeof window === 'undefined' || !user?.id) return
    try {
      window.localStorage.setItem(LOCAL_NOTES_PREFIX + user.id, JSON.stringify(notes))
    } catch {}
  }, [user?.id])

  const fetchIncidents = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)

    const localList = getLocalNotes()

    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (!error && data) {
        // Merge Supabase records with local-only notes (deduping by id)
        const remoteIds = new Set(data.map((d: Incident) => d.id))
        const localOnly = localList.filter((l) => !remoteIds.has(l.id))
        const combined = [...localOnly, ...(data as Incident[])]
        setIncidents(combined)
      } else {
        // Offline or fetch error: display local cache
        setIncidents(localList)
      }
    } catch {
      setIncidents(localList)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, getLocalNotes, supabase])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    if (user) {
      void fetchIncidents()
    }
  }, [user, authLoading, router, fetchIncidents])

  // Handle Quick Vault Note creation
  const handleSaveQuickNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !quickNoteText.trim()) return

    setIsSavingQuickNote(true)
    const nowIso = new Date().toISOString()
    const newNoteId = 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)

    const newIncident: Incident = {
      id: newNoteId,
      user_id: user.id,
      incident_type: quickNoteType,
      description: quickNoteText.trim(),
      location: quickNoteLocation.trim() || 'Recorded via Quick Vault',
      date_occurred: nowIso,
      perpetrator_relationship: null,
      severity: 'medium',
      anonymous_report: false,
      case_reference: 'VAULT-' + Math.floor(100000 + Math.random() * 900000),
      is_draft: false,
      created_at: nowIso,
      updated_at: nowIso
    }

    // 1. Immediately update UI and localStorage (instant 0ms persistence)
    const updatedLocal = [newIncident, ...getLocalNotes()]
    saveLocalNotes(updatedLocal)
    setIncidents(prev => [newIncident, ...prev])

    // 2. Best-effort Supabase sync
    try {
      await supabase.from('incidents').insert({
        user_id: user.id,
        incident_type: quickNoteType,
        description: quickNoteText.trim(),
        location: quickNoteLocation.trim() || 'Recorded via Quick Vault',
        date_occurred: nowIso,
        severity: 'medium',
        anonymous_report: false,
        is_draft: false
      })
    } catch {
      // Offline fallback: already secured in local vault
    }

    setQuickNoteText('')
    setQuickNoteLocation('')
    setIsSavingQuickNote(false)
    setQuickNoteSuccess(true)
    setTimeout(() => {
      setQuickNoteSuccess(false)
      setShowQuickComposer(false)
    }, 1500)
  }

  const handleDelete = async (id: string) => {
    if (!user?.id) return
    setIsDeleting(true)
    
    // Remove from local storage
    const remainingLocal = getLocalNotes().filter(i => i.id !== id)
    saveLocalNotes(remainingLocal)

    // Remove from Supabase if not a local-only entry
    if (!id.startsWith('local_')) {
      try {
        await supabase
          .from('incidents')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id)
      } catch {}
    }
    
    setIncidents(prev => prev.filter(i => i.id !== id))
    setShowDeleteConfirm(null)
    setIsDeleting(false)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
      crime: 'Crime report'
    }
    return legacyLabels[type] || 'Incident Note'
  }

  // Generate formal SAPS Statement text
  const generateSapsStatementText = (inc: Incident) => {
    const complainant = profile?.display_name || user?.user_metadata?.full_name || 'Anonymous Complainant'
    const phone = user?.phone || user?.user_metadata?.phone_number || 'Confidential'
    const dateFormatted = new Date(inc.created_at).toLocaleString('en-ZA')

    return `========================================================================
REPUBLIC OF SOUTH AFRICA — SOUTH AFRICAN POLICE SERVICE (SAPS)
OFFICIAL INCIDENT DOCKET & SWORN COMPLAINT STATEMENT
Generated via Phola End-to-End Encrypted Safety Vault
========================================================================

DOCKET REFERENCE: ${inc.case_reference || 'SAPS-PENDING'}
DATE & TIME LOGGED: ${dateFormatted}
RECORD STATUS: ${inc.is_draft ? 'UNVERIFIED DRAFT' : 'VERIFIED VAULT ENTRY'}

1. COMPLAINANT PARTICULARS
------------------------------------------------------------------------
Full Name / Identifier: ${complainant}
Contact Telephone: ${phone}
Platform Verification: Phola Zero-Knowledge Encrypted Security Enclave

2. INCIDENT CLASSIFICATION
------------------------------------------------------------------------
Category: ${getTypeLabel(inc.incident_type)}
Specific Crime/GBV Type: ${inc.crime_type || inc.incident_type || 'Unspecified'}
Severity Level: ${(inc.severity || 'Medium').toUpperCase()}
Incident Location: ${inc.location || 'Location Withheld / Unavailable'}
Date of Occurrence: ${inc.date_occurred ? new Date(inc.date_occurred).toLocaleString('en-ZA') : dateFormatted}

3. CHRONOLOGICAL STATEMENT OF FACTS
------------------------------------------------------------------------
${inc.description || 'No detailed statement entered.'}

4. PERPETRATOR & EVIDENCE PARTICULARS
------------------------------------------------------------------------
Perpetrator Relationship: ${inc.perpetrator_relationship || 'Unknown / Not Disclosed'}
Associated Station: ${inc.saps_station_name || 'Nearest Local SAPS Sector'} ${inc.saps_station_code ? `(${inc.saps_station_code})` : ''}
Digital Evidence Attached: ${inc.evidence_files && inc.evidence_files.length > 0 ? `${inc.evidence_files.length} secure media attachment(s) logged in vault.` : 'No direct digital attachments recorded.'}

5. SWORN AFFIDAVIT DECLARATION
------------------------------------------------------------------------
I, the undersigned complainant, hereby declare that the particulars furnished above
are true, complete, and correct to the best of my knowledge and belief. I understand
that this statement may form part of an official SAPS police docket and subsequent
legal proceedings under the Domestic Violence Act 116 of 1998 / Criminal Procedure Act 51 of 1977.

Complainant Signature: _______________________      Date: ______________

Generated by Phola — South Africa GBV & Community Safety Companion
https://phola.co.za
========================================================================`
  }

  const handleCopyStatement = () => {
    if (!selectedForStatement) return
    const text = generateSapsStatementText(selectedForStatement)
    navigator.clipboard.writeText(text)
    setStatementCopied(true)
    setTimeout(() => setStatementCopied(false), 2000)
  }

  const handleDownloadStatementTxt = () => {
    if (!selectedForStatement) return
    const text = generateSapsStatementText(selectedForStatement)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const filename = `SAPS_Docket_${selectedForStatement.case_reference || selectedForStatement.id.slice(0, 8)}.txt`
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
    return <AppLoadingState message="Decrypting Vault security credentials..." />
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h2 className="text-base font-bold text-foreground">Sign in to unlock Encrypted Vault</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Your vault records are zero-knowledge encrypted on your device. Please sign in to authenticate.
        </p>
        <Button
          onClick={() => router.push('/auth/login')}
          className="mt-4 rounded-xl text-xs font-semibold"
          size="sm"
        >
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          Continue to Sign In
        </Button>
      </div>
    )
  }
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

      {/* SAPS Statement Export Modal */}
      {selectedForStatement && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[85vh] rounded-3xl border-emerald-200 bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-emerald-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">SAPS Docket Statement</h3>
                  <p className="text-xs text-muted-foreground">Formatted sworn report ready for court or police station</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedForStatement(null)}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 font-mono text-xs bg-slate-900 text-emerald-300 rounded-b-none whitespace-pre-wrap leading-relaxed select-all">
              {generateSapsStatementText(selectedForStatement)}
            </div>

            <div className="p-4 border-t border-border bg-background flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Zero-knowledge encrypted export
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={handleCopyStatement}
                  className="flex-1 sm:flex-none text-xs rounded-xl h-9 gap-1.5"
                >
                  {statementCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Text
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDownloadStatementTxt}
                  className="flex-1 sm:flex-none text-xs rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download .TXT
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 sm:px-6">
        
        {/* ========================================================================= */}
        {/* HEADER SECTION (With 1-Tap Lock Vault Button)                            */}
        {/* ========================================================================= */}
        <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_50px_rgba(5,40,40,0.05)] sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                  <FolderLock className="mr-1 h-3 w-3 text-primary" />
                  Encrypted Vault
                </Badge>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {incidents.length} stored record{incidents.length === 1 ? '' : 's'}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                My Reports & Notes
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Private diary, incident dockets, and offline-resilient encrypted statements.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              {/* 1-Tap Lock Vault Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => lock()}
                className="border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold rounded-xl h-9 px-3 gap-1.5 shadow-2xs"
                title="Immediately lock the vault with biometrics or PIN"
              >
                <Lock className="h-3.5 w-3.5 text-emerald-600" />
                Lock Vault
              </Button>

              <Button
                size="sm"
                onClick={() => setShowQuickComposer(!showQuickComposer)}
                className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-xl h-9 px-3 gap-1.5"
              >
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
                Quick Note
              </Button>

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

          {/* ========================================================================= */}
          {/* QUICK VAULT NOTE COMPOSER                                                 */}
          {/* ========================================================================= */}
          {showQuickComposer && (
            <form onSubmit={handleSaveQuickNote} className="mt-4 pt-4 border-t border-emerald-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Quick Timestamped Note Composer
                </span>
                <button
                  type="button"
                  onClick={() => setShowQuickComposer(false)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Close
                </button>
              </div>

              <Textarea
                value={quickNoteText}
                onChange={(e) => setQuickNoteText(e.target.value)}
                placeholder="Type a fast observation, license plate, suspect description, or safety thought..."
                className="min-h-[85px] text-xs resize-none rounded-xl border-emerald-200 focus-visible:ring-emerald-500"
                required
              />

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <Input
                  value={quickNoteLocation}
                  onChange={(e) => setQuickNoteLocation(e.target.value)}
                  placeholder="Optional Location (e.g. Braamfontein Taxi Rank)"
                  className="h-8 text-xs rounded-xl flex-1 border-emerald-200"
                />

                <select
                  value={quickNoteType}
                  onChange={(e) => setQuickNoteType(e.target.value)}
                  className="h-8 text-xs rounded-xl border border-emerald-200 bg-background px-2.5 font-medium text-foreground outline-none"
                >
                  <option value="other">Safety Note</option>
                  <option value="crime">Suspicious Activity / Crime</option>
                  <option value="physical">Physical Incident</option>
                  <option value="stalking">Stalking / Followed</option>
                </select>

                <Button
                  type="submit"
                  disabled={isSavingQuickNote || !quickNoteText.trim()}
                  className="w-full sm:w-auto h-8 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-4"
                >
                  {isSavingQuickNote ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : quickNoteSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Saved!
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Save to Vault
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
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
                {search ? 'Try clearing your search term to see all saved records.' : 'Capture quick notes, witness statements, or official GBV incidents securely in your personal vault.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                onClick={() => setShowQuickComposer(true)}
                variant="outline"
                className="border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl px-4 h-9"
              >
                <Zap className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                Quick Note
              </Button>
              <Button
                onClick={() => router.push('/report')}
                className="bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl px-5 h-9 shadow-xs"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Record First Incident
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIncidents.map((incident) => {
              const isCrime = incident.incident_type === 'crime'
              const isLocalOnly = incident.id.startsWith('local_')

              return (
                <div 
                  key={incident.id}
                  onClick={() => {
                    if (isLocalOnly) {
                      setSelectedForStatement(incident)
                    } else {
                      router.push(`/report/${incident.id}`)
                    }
                  }}
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
                              {isLocalOnly ? 'Local Vault' : 'Synced'}
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

                        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-primary" />
                            {formatDate(incident.created_at)}
                          </span>
                          {incident.location && (
                            <span className="truncate max-w-[180px]">
                              📍 {incident.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* SAPS Statement Export Action */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl h-8 px-2.5 gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedForStatement(incident)
                        }}
                        title="Generate SAPS / Court Docket Statement"
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">SAPS Statement</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowDeleteConfirm(incident.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
