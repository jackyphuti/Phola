'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { ReportForm } from '@/components/report-form'
import { Loader2 } from 'lucide-react'
import type { Incident } from '@/lib/types'

export default function EditReportPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isLoading: authLoading } = useAuth()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [supabase] = useState(() => createClient())

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    if (user && params.id) {
      const fetchIncident = async () => {
        const targetId = String(params.id)

        // 1. Check local vault storage first
        let localFound: Incident | null = null
        if (typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem(`phola_vault_local_notes_${user.id}`)
            if (raw) {
              const list: Incident[] = JSON.parse(raw)
              localFound = list.find((item) => item.id === targetId) || null
            }
          } catch {}
        }

        if (localFound && targetId.startsWith('local_')) {
          setIncident(localFound)
          setIsLoading(false)
          return
        }

        // 2. Query Supabase
        try {
          const { data } = await supabase
            .from('incidents')
            .select('*')
            .eq('id', targetId)
            .eq('user_id', user.id)
            .single()

          if (data) {
            setIncident(data as Incident)
          } else if (localFound) {
            setIncident(localFound)
          } else {
            router.push('/reports')
          }
        } catch {
          if (localFound) {
            setIncident(localFound)
          } else {
            router.push('/reports')
          }
        } finally {
          setIsLoading(false)
        }
      }

      void fetchIncident()
    }
  }, [user, authLoading, params.id, router, supabase])

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }



  if (!incident) {
    return null
  }

  return (
    <ReportForm
      incidentId={incident.id}
      initialData={{
        incident_type: incident.incident_type,
        crime_type: incident.crime_type,
        description: incident.description,
        location: incident.location,
        date_occurred: incident.date_occurred,
        perpetrator_relationship: incident.perpetrator_relationship,
        severity: incident.severity,
        anonymous_report: incident.anonymous_report,
        case_reference: incident.case_reference,
        incident_metadata: incident.incident_metadata,
        is_draft: incident.is_draft,
      }}
    />
  )
}
