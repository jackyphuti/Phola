'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { LockScreen } from '@/components/lock-screen'
import { ReportForm } from '@/components/report-form'
import { Loader2 } from 'lucide-react'
import type { Incident } from '@/lib/types'

export default function EditReportPage() {
  const router = useRouter()
  const params = useParams()
  const { user, isLoading: authLoading, isLocked } = useAuth()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }

    if (user && params.id) {
      const fetchIncident = async () => {
        const { data } = await supabase
          .from('incidents')
          .select('*')
          .eq('id', params.id)
          .eq('user_id', user.id)
          .single()
        
        if (data) {
          setIncident(data as Incident)
        } else {
          router.push('/dashboard')
        }
        setIsLoading(false)
      }
      
      fetchIncident()
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

  if (isLocked) {
    return <LockScreen />
  }

  if (!incident) {
    return null
  }

  return (
    <ReportForm 
      incidentId={incident.id}
      initialData={{
        incident_type: incident.incident_type,
        description: incident.description,
        location: incident.location,
        date_occurred: incident.date_occurred,
        perpetrator_relationship: incident.perpetrator_relationship,
        severity: incident.severity,
        is_draft: incident.is_draft,
      }}
    />
  )
}
