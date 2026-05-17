'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Incident } from '@/lib/types'
import { 
  Plus, 
  BookOpen, 
  Phone, 
  Settings, 
  Clock,
  FileText,
  ChevronRight,
  LogOut,
  X,
  MapPin
} from 'lucide-react'

export function Dashboard() {
  const router = useRouter()
  const { profile, signOut, lock } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSafeExit, setShowSafeExit] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    const fetchIncidents = async () => {
      const { data } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (data) {
        setIncidents(data as Incident[])
      }
      setIsLoading(false)
    }

    fetchIncidents()
  }, [supabase])

  // Safe exit - clears screen immediately
  const handleSafeExit = () => {
    // Navigate to Google as a safe redirect
    window.location.href = 'https://www.google.com'
  }

  const handleQuickReport = () => {
    router.push('/report')
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
    })
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Safe Exit Overlay */}
      {showSafeExit && (
        <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-6">
          <div className="text-center space-y-6 max-w-sm">
            <p className="text-lg text-foreground">Leave this app quickly?</p>
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

      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-40">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm text-muted-foreground">{greeting()}</p>
            <h1 className="text-xl font-semibold text-foreground">My Notes</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSafeExit(true)}
              className="text-muted-foreground"
              aria-label="Quick exit"
            >
              <X className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/settings')}
              className="text-muted-foreground"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-6 pb-24">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          {/* Quick Report - disguised as "New Note" */}
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors border-primary/20"
            onClick={handleQuickReport}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <span className="font-medium text-foreground">New Note</span>
              <span className="text-xs text-muted-foreground">Quick entry</span>
            </CardContent>
          </Card>

          {/* Resources - disguised as "Reference" */}
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => router.push('/resources')}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-2">
                <BookOpen className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="font-medium text-foreground">Reference</span>
              <span className="text-xs text-muted-foreground">Help & info</span>
            </CardContent>
          </Card>
        </div>

        {/* SOS / Find Safety Card */}
        <Card 
          className="cursor-pointer hover:bg-destructive/5 transition-colors border-destructive/20 bg-destructive/5"
          onClick={() => router.push('/sos')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Find Safety</p>
              <p className="text-sm text-muted-foreground">Nearby hospitals & help</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-destructive flex items-center justify-center animate-pulse">
              <span className="text-xs font-bold text-destructive-foreground">SOS</span>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact Card - disguised */}
        <Card 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push('/resources#emergency')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
              <Phone className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Quick Contacts</p>
              <p className="text-sm text-muted-foreground">Important numbers</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>

        {/* Recent Notes (Incidents) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">Recent Notes</h2>
            {incidents.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/notes')}
                className="text-muted-foreground"
              >
                View all
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">No notes yet</p>
                <Button 
                  variant="link" 
                  onClick={handleQuickReport}
                  className="mt-2"
                >
                  Create your first note
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {incidents.map((incident) => (
                <Card 
                  key={incident.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => router.push(`/report/${incident.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground truncate">
                            {incident.incident_type === 'physical' ? 'Personal note' :
                             incident.incident_type === 'emotional' ? 'Thoughts' :
                             incident.incident_type === 'financial' ? 'Budget note' :
                             'Note'}
                          </span>
                          {incident.is_draft && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {incident.description || 'No description'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatDate(incident.created_at)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-bottom">
        <div className="flex items-center justify-around py-2">
          <Button
            variant="ghost"
            className="flex-1 flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => router.push('/dashboard')}
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs">Notes</span>
          </Button>
          
          <Button
            variant="ghost"
            className="flex-1 flex flex-col items-center gap-1 h-auto py-2"
            onClick={handleQuickReport}
          >
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center -mt-6 shadow-lg">
              <Plus className="w-6 h-6 text-primary-foreground" />
            </div>
          </Button>
          
          <Button
            variant="ghost"
            className="flex-1 flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => {
              lock()
              signOut()
            }}
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xs">Lock</span>
          </Button>
        </div>
      </nav>
    </div>
  )
}
