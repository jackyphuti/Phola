import { createClient } from '@/lib/supabase/client'

const INCIDENT_QUEUE_KEY = 'phola-pending-incidents'

export type QueuedIncident = {
  id: string
  userId: string
  incidentId?: string
  payload: {
    incident_type: string
    description: string
    location: string
    date_occurred: string
    perpetrator_relationship: string
    severity: string
    is_draft: boolean
  }
  queuedAt: string
}

function readQueue(): QueuedIncident[] {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.localStorage.getItem(INCIDENT_QUEUE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as QueuedIncident[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedIncident[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(INCIDENT_QUEUE_KEY, JSON.stringify(queue))
}

export function getQueuedIncidentCount() {
  return readQueue().length
}

export async function queueIncidentSubmission(entry: Omit<QueuedIncident, 'id' | 'queuedAt'>) {
  const queue = readQueue()
  queue.push({
    ...entry,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  })
  writeQueue(queue)
}

export async function syncQueuedIncidentSubmissions() {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return 0
  }

  const queue = readQueue()
  if (queue.length === 0) {
    return 0
  }

  const supabase = createClient()
  const remaining: QueuedIncident[] = []

  for (const entry of queue) {
    const payload = {
      ...entry.payload,
      date_occurred: entry.payload.date_occurred || null,
      location: entry.payload.location || null,
      description: entry.payload.description || null,
    }

    const operation = entry.incidentId
      ? supabase.from('incidents').update({
          ...payload,
          updated_at: new Date().toISOString(),
        }).eq('id', entry.incidentId)
      : supabase.from('incidents').insert({
          user_id: entry.userId,
          ...payload,
        })

    const { error } = await operation
    if (error) {
      remaining.push(entry)
    }
  }

  writeQueue(remaining)
  return queue.length - remaining.length
}
