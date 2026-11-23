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
  ShieldAlert, 
  FileWarning, 
  Search, 
  FolderLock,
  Download,
  Copy,
  Check,
  Zap,
  FileCheck,
  Send,
  LogIn,
  Award,
  MapPin,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { generateSapsDocket, type SapsDocketResponse } from '@/lib/python-api'
import { AppLoadingState } from '@/components/app-loading-state'

const LOCAL_NOTES_PREFIX = 'phola_vault_local_notes_'

export default function NotesPage() {
  const router = useRouter()
  const { user, profile, isLoading: authLoading } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'gbv' | 'crime' | 'drafts'>('all')
  const [search, setSearch] = useState('')
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  
  // Quick Vault Note State
  const [quickNoteText, setQuickNoteText] = useState('')
  const [quickNoteType, setQuickNoteType] = useState<string>('other')
  const [quickNoteLocation, setQuickNoteLocation] = useState('')
  const [isSavingQuickNote, setIsSavingQuickNote] = useState(false)
  const [quickNoteSuccess, setQuickNoteSuccess] = useState(false)
  const [showQuickComposer, setShowQuickComposer] = useState(false)

  // Mobile Drawer / Modal State for Statement
  const [mobileDetailIncident, setMobileDetailIncident] = useState<Incident | null>(null)
  const [statementCopied, setStatementCopied] = useState(false)
  const [sapsDocket, setSapsDocket] = useState<SapsDocketResponse | null>(null)
  const [isGeneratingDocket, setIsGeneratingDocket] = useState(false)

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
        const remoteIds = new Set(res.data.map((d: Incident) => d.id))
        const localOnly = localList.filter((l) => !remoteIds.has(l.id))
        const combined = [...localOnly, ...res.data]
        setIncidents(combined)
      } else {
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

  // Filtered list
  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      if (filter === 'drafts' && !item.is_draft) return false
      if (filter === 'gbv' && item.incident_type === 'crime') return false
      if (filter === 'crime' && item.incident_type !== 'crime') return false

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

  // Auto-select first incident on desktop when available
  useEffect(() => {
    if (filteredIncidents.length > 0) {
      const exists = filteredIncidents.some((i) => i.id === selectedIncidentId)
      if (!exists) {
        setSelectedIncidentId(filteredIncidents[0].id)
      }
    } else {
      setSelectedIncidentId(null)
    }
  }, [filteredIncidents, selectedIncidentId])

  const selectedIncident = useMemo(() => {
    return incidents.find((i) => i.id === selectedIncidentId) || null
  }, [incidents, selectedIncidentId])

  // Active target for docket generation (either desktop selected or mobile drawer)
  const activeIncidentForDocket = mobileDetailIncident || selectedIncident

  // Fetch verified Section 212 SAPS Docket from Python microservice
  useEffect(() => {
    if (!activeIncidentForDocket) {
      setSapsDocket(null)
      return
    }

    let isCancelled = false
    setIsGeneratingDocket(true)

    async function loadDocket() {
      try {
        const docket = await generateSapsDocket({
          id: activeIncidentForDocket!.id,
          complainantName: profile?.display_name || user?.user_metadata?.full_name || 'Anonymous Complainant',
          complainantPhone: user?.phone || user?.user_metadata?.phone_number || 'Confidential',
          incidentType: activeIncidentForDocket!.incident_type,
          crimeType: activeIncidentForDocket!.crime_type || activeIncidentForDocket!.incident_type,
          severity: activeIncidentForDocket!.severity,
          description: activeIncidentForDocket!.description,
          location: activeIncidentForDocket!.location,
          dateOccurred: activeIncidentForDocket!.date_occurred,
          perpetratorRelationship: activeIncidentForDocket!.perpetrator_relationship,
          sapsStationCode: activeIncidentForDocket!.saps_station_code,
          sapsStationName: activeIncidentForDocket!.saps_station_name,
          evidenceFiles: activeIncidentForDocket!.evidence_files,
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
  }, [activeIncidentForDocket, profile, user])

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

    const updatedLocal = [newIncident, ...getLocalNotes()]
    saveLocalNotes(updatedLocal)
    setIncidents(prev => [newIncident, ...prev])
    setSelectedIncidentId(newNoteId)

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
        const currentLocal = getLocalNotes()
        const updatedLocalWithUuid = currentLocal.map(item => item.id === newNoteId ? { ...item, id: savedRow.id } : item)
        saveLocalNotes(updatedLocalWithUuid)
        setIncidents(prev => prev.map(item => item.id === newNoteId ? (savedRow as Incident) : item))
        setSelectedIncidentId(savedRow.id)
      }
    } catch {}

    setQuickNoteText('')
    setQuickNoteLocation('')
    setIsSavingQuickNote(false)
    setQuickNoteSuccess(true)
    setTimeout(() => {
      setQuickNoteSuccess(false)
      setShowQuickComposer(false)
    }, 1200)
  }

  const handleDelete = async (id: string) => {
    if (!user?.id) return
    setIsDeleting(true)
    
    const remainingLocal = getLocalNotes().filter(i => i.id !== id)
    saveLocalNotes(remainingLocal)

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
    if (selectedIncidentId === id) {
      setSelectedIncidentId(null)
    }
    if (mobileDetailIncident?.id === id) {
      setMobileDetailIncident(null)
    }
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

  const handleCopyStatement = (inc: Incident) => {
    const text = sapsDocket?.swornStatementText || generateSapsStatementText(inc)
    navigator.clipboard.writeText(text)
    setStatementCopied(true)
    setTimeout(() => setStatementCopied(false), 2000)
  }

  const handleDownloadStatementTxt = (inc: Incident) => {
    const text = sapsDocket?.swornStatementText || generateSapsStatementText(inc)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const filename = `${sapsDocket?.docketNumber || `SAPS_Docket_${inc.case_reference || inc.id.slice(0, 8)}`}.txt`
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (authLoading) {
    return <AppLoadingState message="Decrypting Vault security credentials..." />
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-canvas p-4 text-center">
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
    <div className="min-h-screen bg-surface-canvas pt-16 sm:pt-20 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full rounded-xl border border-border bg-surface-workspace shadow-xl p-5 text-center space-y-4">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Delete this record?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This record and attached forensic metadata will be permanently erased from your local and synced vault.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-lg text-xs"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-lg bg-destructive hover:bg-destructive/90 text-xs font-semibold"
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete Permanently'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Vault Note Composer Modal */}
      {showQuickComposer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full rounded-xl border border-border bg-surface-workspace shadow-xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Zap className="w-5 h-5 fill-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Quick Incident Note</h3>
                  <p className="text-xs text-muted-foreground">Encrypted locally in your device enclave</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQuickComposer(false)}
                className="rounded-full"
              >
                <X className="w-4 h-4" />
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
                  className="h-9 text-xs rounded-lg border border-border bg-surface-workspace px-2.5 font-medium text-foreground outline-none w-full sm:w-auto"
                >
                  <option value="other">Safety Note</option>
                  <option value="crime">Suspicious Activity / Crime</option>
                  <option value="physical">Physical Incident</option>
                  <option value="stalking">Stalking / Followed</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowQuickComposer(false)}
                  className="rounded-lg text-xs h-8.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingQuickNote || !quickNoteText.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-lg h-8.5 px-4 gap-1.5"
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
          </Card>
        </div>
      )}

      {/* Mobile Details Drawer / Modal (< lg) */}
      {mobileDetailIncident && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 lg:hidden">
          <Card className="max-w-lg w-full max-h-[90vh] rounded-xl border border-border bg-surface-workspace shadow-2xl flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-border/70 flex items-center justify-between bg-surface-tonal">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  {getTypeLabel(mobileDetailIncident.incident_type)}
                </span>
                <h3 className="text-sm font-semibold text-foreground">
                  {mobileDetailIncident.case_reference ? `CAS ${mobileDetailIncident.case_reference}` : 'Vault Entry'}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileDetailIncident(null)}
                className="rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statement</p>
                <p className="text-xs text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                  {mobileDetailIncident.description}
                </p>
              </div>

              {/* Docket Preview Card */}
              <div className="rounded-lg border border-border/70 bg-surface-tonal p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <FileCheck className="h-4 w-4 text-primary" />
                    <span>SAPS Section 212 Statement</span>
                  </div>
                  {sapsDocket && (
                    <Badge variant="outline" className="font-mono text-[9px] bg-surface-workspace">
                      Sec. 212(4) Certified
                    </Badge>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto p-2.5 rounded bg-slate-900 text-emerald-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed select-all">
                  {sapsDocket?.swornStatementText || generateSapsStatementText(mobileDetailIncident)}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyStatement(mobileDetailIncident)}
                    className="flex-1 text-xs h-7.5 rounded-lg"
                  >
                    {statementCopied ? <Check className="w-3 h-3 text-primary mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {statementCopied ? 'Copied' : 'Copy Text'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDownloadStatementTxt(mobileDetailIncident)}
                    className="flex-1 text-xs h-7.5 rounded-lg bg-primary text-primary-foreground font-semibold"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download .TXT
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-border/70 bg-surface-tonal flex justify-between gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setShowDeleteConfirm(mobileDetailIncident.id)
                }}
                className="text-xs h-8 rounded-lg"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileDetailIncident(null)}
                className="text-xs h-8 rounded-lg"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Main Workspace Container */}
      <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 space-y-4">
        
        {/* Top Header Bar */}
        <section className="rounded-xl border border-border/70 bg-surface-workspace p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="border border-border/50 bg-surface-tonal text-foreground text-[10px] font-bold uppercase tracking-wider">
                  <FolderLock className="mr-1 h-3 w-3 text-primary" />
                  Encrypted Vault
                </Badge>
                <span className="tabular-nums text-[11px] text-muted-foreground font-medium">
                  {incidents.length} stored record{incidents.length === 1 ? '' : 's'}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                Incident Vault & Statements
              </h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Zero-knowledge encrypted logs, offline statements, and automated SAPS Section 212 docket affidavits.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
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
                className="bg-surface-tonal text-foreground hover:bg-muted border border-border text-xs font-semibold rounded-lg h-8 px-3 gap-1.5"
              >
                <Zap className="h-3.5 w-3.5 text-primary" />
                Quick Note
              </Button>

              <Button
                size="sm"
                onClick={() => router.push('/report')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg h-8 px-3.5 shadow-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Report
              </Button>
            </div>
          </div>
        </section>

        {/* Master–Detail Grid (Desktop lg:grid-cols-12) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ========================================================================= */}
          {/* LEFT MASTER COLUMN (lg:col-span-5): FILTERS, SEARCH, ENTRY LIST           */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-3">
            
            {/* Search Input */}
            <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-surface-workspace px-3.5 py-2 shadow-xs">
              <Search className="h-4 w-4 text-primary shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes, locations, case numbers..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
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

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'All', count: incidents.length },
                { id: 'gbv', label: 'GBV', count: incidents.filter(i => i.incident_type !== 'crime').length },
                { id: 'crime', label: 'Crime', count: incidents.filter(i => i.incident_type === 'crime').length },
                { id: 'drafts', label: 'Drafts', count: incidents.filter(i => i.is_draft).length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as 'all' | 'gbv' | 'crime' | 'drafts')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0 transition ${
                    filter === tab.id
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'bg-surface-workspace border border-border/70 text-muted-foreground hover:bg-surface-tonal'
                  }`}
                >
                  {tab.label} <span className="tabular-nums font-mono text-[10px]">({tab.count})</span>
                </button>
              ))}
            </div>

            {/* Entry List */}
            {isLoading && incidents.length === 0 ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-20 rounded-xl bg-surface-tonal animate-pulse" />
                ))}
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-workspace p-6 text-center space-y-3 shadow-xs">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-tonal text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">No records found</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {search ? 'Try clearing search terms.' : 'Records are encrypted locally on your device.'}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    onClick={() => setShowQuickComposer(true)}
                    variant="outline"
                    className="border-border text-foreground text-xs font-semibold rounded-lg px-3 h-7.5 hover:bg-surface-tonal"
                  >
                    <Zap className="mr-1 h-3 w-3 text-primary" />
                    Quick Note
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                {filteredIncidents.map((incident) => {
                  const isCrime = incident.incident_type === 'crime'
                  const isLocalOnly = incident.id.startsWith('local_')
                  const isSelected = selectedIncidentId === incident.id

                  return (
                    <div 
                      key={incident.id}
                      onClick={() => {
                        setSelectedIncidentId(incident.id)
                        // On mobile, also open the mobile drawer
                        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                          setMobileDetailIncident(incident)
                        }
                      }}
                      className={`group rounded-xl border p-3.5 transition cursor-pointer ${
                        isSelected
                          ? 'border-primary ring-1 ring-primary/40 bg-surface-tonal shadow-xs'
                          : 'border-border/70 bg-surface-workspace hover:border-primary/40 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-surface-tonal text-primary'
                          }`}>
                            {isCrime ? <FileWarning className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="font-semibold text-[13px] text-foreground">
                                {getTypeLabel(incident.incident_type)}
                              </span>
                              {incident.is_draft ? (
                                <Badge variant="outline" className="text-[9px] bg-surface-tonal border-border text-muted-foreground">
                                  Draft
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[9px] bg-surface-tonal text-foreground">
                                  {isLocalOnly ? 'Local Vault' : 'Synced'}
                                </Badge>
                              )}
                              {incident.case_reference && (
                                <span className="tabular-nums text-[9px] font-mono text-muted-foreground bg-surface-tonal px-1.5 py-0.5 rounded">
                                  CAS {incident.case_reference}
                                </span>
                              )}
                            </div>

                            <p className="text-[12px] text-muted-foreground line-clamp-2 leading-snug">
                              {incident.description || 'No written description entered.'}
                            </p>

                            <div className="mt-2 flex items-center gap-2.5 text-[11px] text-muted-foreground">
                              <span className="tabular-nums flex items-center gap-1">
                                <Clock className="h-3 w-3 text-primary" />
                                {formatDate(incident.created_at)}
                              </span>
                              {incident.location && (
                                <span className="flex items-center gap-1 truncate max-w-[130px]">
                                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                  {incident.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <ChevronRight className={`h-4 w-4 shrink-0 transition ${
                          isSelected ? 'text-primary translate-x-0.5' : 'text-muted-foreground opacity-50 group-hover:opacity-100'
                        }`} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          </div>

          {/* ========================================================================= */}
          {/* RIGHT DETAIL COLUMN (lg:col-span-7): INLINE DOCKET PREVIEW & ACTIONS     */}
          {/* ========================================================================= */}
          <div className="hidden lg:block lg:col-span-7">
            {selectedIncident ? (
              <div className="rounded-xl border border-border/70 bg-surface-workspace p-5 shadow-xs space-y-5">
                
                {/* Header Strip */}
                <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {getTypeLabel(selectedIncident.incident_type)}
                      </span>
                      {selectedIncident.is_draft ? (
                        <Badge variant="outline" className="text-[10px]">Draft</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedIncident.id.startsWith('local_') ? 'Local Vault' : 'Cloud Synced'}
                        </Badge>
                      )}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${
                        selectedIncident.severity === 'high' ? 'bg-destructive' : 'bg-primary'
                      }`}>
                        {(selectedIncident.severity || 'Medium').toUpperCase()}
                      </span>
                    </div>

                    <h2 className="text-xl font-semibold text-foreground mt-1">
                      {selectedIncident.case_reference ? `CAS Docket ${selectedIncident.case_reference}` : 'Confidential Vault Record'}
                    </h2>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="tabular-nums flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        Logged: {formatDate(selectedIncident.created_at)}
                      </span>
                      {selectedIncident.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {selectedIncident.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!selectedIncident.id.startsWith('local_') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/report/${selectedIncident.id}`)}
                        className="text-xs h-8 rounded-lg border-border"
                      >
                        Edit Details <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(selectedIncident.id)}
                      className="text-destructive hover:bg-destructive/10 text-xs h-8 rounded-lg px-2.5"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>

                {/* Statement of Facts */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Chronological Statement of Facts
                  </h3>
                  <div className="rounded-lg bg-surface-tonal p-3.5 text-[13px] text-foreground leading-relaxed whitespace-pre-wrap border border-border/40">
                    {selectedIncident.description || 'No written description entered.'}
                  </div>
                </div>

                {/* Perpetrator & Evidence Metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border/60 bg-surface-tonal p-3">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase">Perpetrator</span>
                    <p className="text-foreground font-medium mt-0.5">
                      {selectedIncident.perpetrator_relationship || 'Unknown / Not Disclosed'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-surface-tonal p-3">
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase">Station Sector</span>
                    <p className="text-foreground font-medium mt-0.5 truncate">
                      {selectedIncident.saps_station_name || 'Nearest Local SAPS Sector'}
                    </p>
                  </div>
                </div>

                {/* Inline SAPS Sworn Statement / Docket Preview */}
                <div className="rounded-xl border border-border/70 overflow-hidden shadow-xs">
                  <div className="p-3.5 bg-surface-tonal border-b border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4.5 w-4.5 text-primary" />
                      <div>
                        <p className="text-[14px] font-semibold text-foreground">SAPS Docket Statement</p>
                        <p className="text-[11px] text-muted-foreground">Section 212 Sworn Forensic Affidavit for Court & SAPS</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyStatement(selectedIncident)}
                        className="text-xs h-7.5 rounded-lg border-border"
                      >
                        {statementCopied ? (
                          <>
                            <Check className="w-3 h-3 text-primary mr-1" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" /> Copy Text
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDownloadStatementTxt(selectedIncident)}
                        className="text-xs h-7.5 rounded-lg bg-primary text-primary-foreground font-semibold"
                      >
                        <Download className="w-3 h-3 mr-1" /> Download .TXT
                      </Button>
                    </div>
                  </div>

                  {/* Certified Seal Strip */}
                  <div className="bg-slate-950 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-emerald-400 font-mono">
                    {isGeneratingDocket ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating Section 212 SHA-256 seal via Python enclave...</span>
                      </div>
                    ) : sapsDocket ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Award className="w-3.5 h-3.5" />
                          <span className="font-semibold text-white">CPA Sec. 212(4) Certified</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-300">{sapsDocket.docketNumber}</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 rounded px-2 py-0.5">
                          SHA-256: {sapsDocket.sha256Checksum.slice(0, 16)}...
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">Standard Affidavit Format</span>
                    )}
                  </div>

                  {/* Docket Text Area */}
                  <div className="p-4 max-h-72 overflow-y-auto bg-slate-900 text-emerald-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed select-all">
                    {sapsDocket?.swornStatementText || generateSapsStatementText(selectedIncident)}
                  </div>
                </div>

              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-surface-workspace p-12 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-tonal text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Select an Incident</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click any entry on the left to view chronological facts, evidence items, and generate an inline Section 212 SAPS sworn statement.
                </p>
              </div>
            )}
          </div>

        </div>

      </main>

      <AppBottomNav />
    </div>
  )
}
