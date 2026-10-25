import { createClient } from '@/lib/supabase/client'
import { triggerIncidentPushEvent } from '@/lib/push-notifications'

const INCIDENT_QUEUE_KEY = 'phola-pending-incidents'
const DB_NAME = 'phola_offline_db'
const STORE_NAME = 'incidents'

export type QueuedIncident = {
  id: string
  userId: string
  incidentId?: string
  payload: {
    incident_type: string
    crime_type?: string
    description: string
    location: string
    date_occurred: string
    perpetrator_relationship: string
    severity: string
    anonymous_report?: boolean
    case_reference?: string
    saps_station_name?: string
    saps_station_code?: string
    incident_metadata?: Record<string, unknown>
    evidence_files?: Array<Record<string, unknown>>
    is_draft: boolean
  }
  queuedAt: string
}

let cachedCount = 0

function openIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, 1)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

// Fallback localStorage handlers
function readLocalStorageQueue(): QueuedIncident[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(INCIDENT_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueuedIncident[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalStorageQueue(queue: QueuedIncident[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(INCIDENT_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // ignore
  }
}

export async function readQueue(): Promise<QueuedIncident[]> {
  const db = await openIndexedDB()
  if (!db) {
    return readLocalStorageQueue()
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const items = (request.result as QueuedIncident[]) || []
        // Migrate legacy localStorage items if present
        const legacyItems = readLocalStorageQueue()
        if (legacyItems.length > 0) {
          items.push(...legacyItems)
          try {
            window.localStorage.removeItem(INCIDENT_QUEUE_KEY)
          } catch {
            // ignore
          }
        }
        cachedCount = items.length
        resolve(items)
      }

      request.onerror = () => {
        resolve(readLocalStorageQueue())
      }
    } catch {
      resolve(readLocalStorageQueue())
    }
  })
}

export async function writeQueue(queue: QueuedIncident[]): Promise<void> {
  cachedCount = queue.length
  const db = await openIndexedDB()
  if (!db) {
    writeLocalStorageQueue(queue)
    return
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      store.clear()

      for (const item of queue) {
        store.put(item)
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => {
        writeLocalStorageQueue(queue)
        resolve()
      }
    } catch {
      writeLocalStorageQueue(queue)
      resolve()
    }
  })
}

export function getQueuedIncidentCount(): number {
  if (typeof window !== 'undefined' && cachedCount === 0) {
    // Quick sync check from storage
    const legacy = readLocalStorageQueue()
    cachedCount = legacy.length
    void readQueue().then((items) => {
      cachedCount = items.length
    })
  }
  return cachedCount
}

export async function queueIncidentSubmission(entry: Omit<QueuedIncident, 'id' | 'queuedAt'>) {
  const queue = await readQueue()
  queue.push({
    ...entry,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  })
  await writeQueue(queue)
}

export async function syncQueuedIncidentSubmissions(): Promise<number> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return 0
  }

  const queue = await readQueue()
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
      continue
    }

    if (!entry.payload.is_draft) {
      await triggerIncidentPushEvent({
        crimeType: entry.payload.crime_type || entry.payload.incident_type,
        location: entry.payload.location || undefined,
      })
    }
  }

  await writeQueue(remaining)
  return queue.length - remaining.length
}
