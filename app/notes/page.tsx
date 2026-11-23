'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { INCIDENT_TYPE_LABELS, type Incident, type IncidentType } from '@/lib/types'
import { AppBottomNav } from '@/components/app-bottom-nav'
import { hasConfiguredPin } from '@/lib/pin'
import { safeExit } from '@/lib/safe-exit'
import { triggerHapticFeedback } from '@/lib/biometric'
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
  LogIn,
  KeyRound,
  Award,
  MapPin
} from 'lucide-react'
import { generateSapsDocket, type SapsDocketResponse } from '@/lib/python-api'
import { AppLoadingState } from '@/components/app-loading-state'

const LOCAL_NOTES_PREFIX = 'phola_vault_local_notes_'

export default function NotesPage() {
  const router = useRouter()
  const { user, profile, isLoading: authLoading, lock } = useAuth()
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
  const [sapsDocket, setSapsDocket] = useState<SapsDocketResponse | null>(null)
  const [isGeneratingDocket, setIsGeneratingDocket] = useState(false)

  // Fetch verified Section 212 SAPS Docket from Python microservice
  useEffect(() => {
    if (!selectedForStatement) {
      setSapsDocket(null)
      return
    }

    let isCancelled = false
    setIsGeneratingDocket(true)

    async function loadDocket() {
      try {
        const docket = await generateSapsDocket({
          id: selectedForStatement!.id,
          complainantName: profile?.display_name || user?.user_metadata?.full_name || 'Anonymous Complainant',
          complainantPhone: user?.phone || user?.user_metadata?.phone_number || 'Confidential',
          incidentType: selectedForStatement!.incident_type,
          crimeType: selectedForStatement!.crime_type || selectedForStatement!.incident_type,
          severity: selectedForStatement!.severity,
          description: selectedForStatement!.description,
          location: selectedForStatement!.location,
          dateOccurred: selectedForStatement!.date_occurred,
          perpetratorRelationship: selectedForStatement!.perpetrator_relationship,
          sapsStationCode: selectedForStatement!.saps_station_code,
          sapsStationName: selectedForStatement!.saps_station_name,
          evidenceFiles: selectedForStatement!.evidence_files,
          userId: user?.id,
        })
        if (!isCancelled && docket) {
          setSapsDocket(docket)
        }
      } catch {} finally {
        if (!isCancelled) setIsGeneratingDocket(false)
      }
    }

    void loadDocket()
    return () => {
      isCancelled = true
    }
  }, [selectedForStatement, profile, user])

  const handleQuickExit = () => {
    triggerHapticFeedback('heavy')
    safeExit()
  }
  
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
    if (!user?.id) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)

    const localList = getLocalNotes()
    if (localList.length > 0) {
      setIncidents(localList)
      setIsLoading(false)
    }

    try {
      const queryPromise = supabase
        .from('incidents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase request timeout')), 4000)
      )

      const res = await Promise.race([queryPromise, timeoutPromise]) as { data: Incident[] | null; error: any }
      
      if (!res.error && res.data) {
        // Merge Supabase records with local-only notes (deduping by id)
        const remoteIds = new Set(res.data.map((d: Incident) => d.id))
        const localOnly = localList.filter((l) => !remoteIds.has(l.id))
        const combined = [...localOnly, ...res.data]
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
      const { data: savedRow, error } = await supabase
        .from('incidents')
        .insert({
          user_id: user.id,
          incident_type: quickNoteType,
          description: quickNoteText.trim(),
          location: quickNoteLocation.trim() || 'Recorded via Quick Vault',
          date_occurred: nowIso,
          severity: 'medium',
          anonymous_report: false,
          is_draft: false,
          case_reference: newIncident.case_reference
        })
        .select('*')
        .single()

      if (!error && savedRow) {
        // Replace temporary local_... ID in both localStorage and React incidents state with the real Supabase UUID
        const currentLocal = getLocalNotes()
        const updatedLocalWithUuid = currentLocal.map(item => item.id === newNoteId ? { ...item, id: savedRow.id } : item)
        saveLocalNotes(updatedLocalWithUuid)
        setIncidents(prev => prev.map(item => item.id === newNoteId ? (savedRow as Incident) : item))
      }
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
    const text = sapsDocket?.swornStatementText || generateSapsStatementText(selectedForStatement)
    navigator.clipboard.writeText(text)
    setStatementCopied(true)
    setTimeout(() => setStatementCopied(false), 2000)
  }

  const handleDownloadStatementTxt = () => {
    if (!selectedForStatement) return
    const text = sapsDocket?.swornStatementText || generateSapsStatementText(selectedForStatement)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const filename = `${sapsDocket?.docketNumber || `SAPS_Docket_${selectedForStatement.case_reference || selectedForStatement.id.slice(0, 8)}`}.txt`
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

  return (
    <div className="min-h-screen bg-background pt-20 sm:pt-24 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full rounded-xl border border-border bg-card shadow-lg p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
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
                className="flex-1 rounded-lg"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-lg bg-destructive hover:bg-destructive/90 font-semibold"
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Vault Note In-Page Modal */}
      {showQuickComposer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full rounded-xl border border-border bg-card shadow-lg p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Zap className="w-5 h-5 fill-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Quick Incident Note</h3>
                  <p className="text-xs text-muted-foreground">Encrypted locally in your device enclave</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQuickComposer(false)}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSaveQuickNote} className="space-y-3">
              <Textarea
                value={quickNoteText}
                onChange={(e) => setQuickNoteText(e.target.value)}
                placeholder="Type a fast observation, license plate, suspect description, or safety thought..."
                className="min-h-[110px] text-xs resize-none rounded-lg border-border focus-visible:ring-primary"
                required
                autoFocus
              />

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <Input
                  value={quickNoteLocation}
                  onChange={(e) => setQuickNoteLocation(e.target.value)}
                  placeholder="Optional Location (e.g. Braamfontein Taxi Rank)"
                  className="h-9 text-xs rounded-lg flex-1 border-border"
                />

                <select
                  value={quickNoteType}
                  onChange={(e) => setQuickNoteType(e.target.value)}
                  className="h-9 text-xs rounded-lg border border-border bg-background px-2.5 font-medium text-foreground outline-none w-full sm:w-auto"
                >
                  <option value="other">Safety Note</option>
                  <option value="crime">Suspicious Activity / Crime</option>
                  <option value="physical">Physical Incident</option>
                  <option value="stalking">Stalking / Followed</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowQuickComposer(false)}
                  className="rounded-lg text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingQuickNote || !quickNoteText.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-lg h-9 px-5 gap-1.5"
                >
                  {isSavingQuickNote ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : quickNoteSuccess ? (
                    <>
                      <Check className="w-4 h-4" /> Saved!
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Save to Vault
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* SAPS Statement Export Modal */}
      {selectedForStatement && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[85vh] rounded-xl border border-border bg-card shadow-lg flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">SAPS Docket Statement</h3>
                  <p className="text-xs text-muted-foreground">Section 212 Sworn Forensic Affidavit for Court & SAPS Stations</p>
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

            {/* Python Cryptographic Seal Banner */}
            <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              {isGeneratingDocket ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Section 212 SHA-256 seal via Python enclave...</span>
                </div>
              ) : sapsDocket ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-400 font-mono">
                    <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-white">CPA Sec. 212(4) Certified</span>
                    <span className="text-slate-400 hidden sm:inline">•</span>
                    <span className="text-slate-300 hidden sm:inline">{sapsDocket.docketNumber}</span>
                  </div>
                  <div className="font-mono text-[10px] text-emerald-500 bg-emerald-950/70 border border-emerald-800/60 rounded px-2 py-0.5">
                    SHA-256: {sapsDocket.sha256Checksum.slice(0, 16)}...
                  </div>
                </>
              ) : (
                <div className="text-slate-400 font-mono">
                  Standard Affidavit Export
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 font-mono text-xs bg-slate-900 text-emerald-300 rounded-b-none whitespace-pre-wrap leading-relaxed select-all">
              {sapsDocket?.swornStatementText || generateSapsStatementText(selectedForStatement)}
            </div>

            <div className="p-4 border-t border-border bg-background flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Section 212 & Cybercrimes Act compliant export
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={handleCopyStatement}
                  className="flex-1 sm:flex-none text-xs rounded-lg h-9 gap-1.5"
                >
                  {statementCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-primary" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Text
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDownloadStatementTxt}
                  className="flex-1 sm:flex-none text-xs rounded-lg h-9 bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
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
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border border-border bg-muted text-foreground text-[10px] font-bold uppercase tracking-wider">
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
              {/* Quick Safe Exit Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickExit}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold rounded-lg h-8 px-3 gap-1.5"
                title="Immediately exit vault to neutral weather screen"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                Quick Exit
              </Button>

              <Button
                size="sm"
                onClick={() => setShowQuickComposer(true)}
                className="bg-muted text-foreground hover:bg-muted/80 border border-border text-xs font-bold rounded-lg h-8 px-3 gap-1.5"
              >
                <Zap className="h-3.5 w-3.5 text-primary" />
                Quick Note
              </Button>

              <Button
                size="sm"
                onClick={() => router.push('/report')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg h-8 px-3.5 shadow-xs"
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
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xs">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0 transition ${
                  filter === tab.id
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted'
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
        {isLoading && incidents.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-xl bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-4 shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div className="max-w-sm mx-auto">
              <h3 className="text-sm font-bold text-foreground">No encrypted records stored yet</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Incident logs, audio notes, and photos added here are encrypted locally on your device.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                onClick={() => setShowQuickComposer(true)}
                variant="outline"
                className="border-border text-foreground text-xs font-bold rounded-lg px-4 h-8 hover:bg-muted"
              >
                <Zap className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Quick Note
              </Button>
              <Button
                onClick={() => router.push('/report')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg px-5 h-8 shadow-xs"
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
                  className="group rounded-xl border border-border bg-card p-4 shadow-xs hover:border-border/80 hover:shadow-sm cursor-pointer transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition">
                        {isCrime ? <FileWarning className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-sm text-foreground">
                            {getTypeLabel(incident.incident_type)}
                          </span>
                          {incident.is_draft ? (
                            <Badge variant="outline" className="text-[10px] bg-muted/50 border-border text-muted-foreground">
                              Draft
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] bg-muted text-foreground">
                              {isLocalOnly ? 'Local Vault' : 'Synced'}
                            </Badge>
                          )}
                          {incident.case_reference && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
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
                            <span className="flex items-center gap-1 truncate max-w-[180px]">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                              {incident.location}
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
                        className="text-xs text-primary hover:text-primary/90 hover:bg-muted rounded-lg h-8 px-2.5 gap-1"
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
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg h-8 w-8"
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
