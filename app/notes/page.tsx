'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { LockScreen } from '@/components/lock-screen'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Incident } from '@/lib/types'
import { 
  ArrowLeft, 
  Plus, 
  Clock, 
  FileText,
  Loader2,
  Trash2,
  X
} from 'lucide-react'

export default function NotesPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isLocked } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSafeExit, setShowSafeExit] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    if (user) {
      fetchIncidents()
    }
  }, [user, authLoading, router])

  const fetchIncidents = async () => {
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) {
      setIncidents(data as Incident[])
    }
    setIsLoading(false)
  }

  const handleSafeExit = () => {
    window.location.href = 'https://www.google.com'
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    
    await supabase
      .from('incidents')
      .delete()
      .eq('id', id)
    
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
    const labels: Record<string, string> = {
      physical: 'Personal note',
      emotional: 'Thoughts',
      sexual: 'Private entry',
      financial: 'Budget note',
      digital: 'Digital note',
      stalking: 'Safety note',
      other: 'Note',
    }
    return labels[type] || 'Note'
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (isLocked) {
    return <LockScreen />
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Safe Exit Overlay */}
      {showSafeExit && (
        <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-sm">
            <p className="text-lg text-foreground">Leave this page quickly?</p>
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowSafeExit(false)}
              >
                Stay
              </Button>
              <Button 
                className="flex-1"
                onClick={handleSafeExit}
              >
                Exit Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <Card className="max-w-sm w-full">
            <CardContent className="p-6 space-y-4">
              <p className="text-foreground">Delete this note?</p>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleDelete(showDeleteConfirm)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-40">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">All Notes</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSafeExit(true)}
              className="text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              onClick={() => router.push('/report')}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-8">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No notes yet</p>
            <Button onClick={() => router.push('/report')}>
              <Plus className="w-4 h-4 mr-2" />
              Create your first note
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((incident) => (
              <Card 
                key={incident.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors group"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 min-w-0"
                      onClick={() => router.push(`/report/${incident.id}`)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground truncate">
                          {getTypeLabel(incident.incident_type)}
                        </span>
                        {incident.is_draft && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {incident.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDate(incident.created_at)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowDeleteConfirm(incident.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
