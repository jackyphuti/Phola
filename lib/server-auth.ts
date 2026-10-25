import { NextRequest } from 'next/server'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'

export type AuthResult = {
  user: User | null
  userId: string | null
  error: string | null
}

export async function getAuthenticatedUser(request?: Request | NextRequest): Promise<AuthResult> {
  // 1. Check Next.js cookie session first
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (user && !error) {
      return { user, userId: user.id, error: null }
    }
  } catch {
    // Cookie store might be unavailable in certain contexts
  }

  // 2. Fall back to Bearer token header if present
  if (request) {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    if (token) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && supabaseAnonKey) {
        const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: {
            persistSession: false,
          },
        })

        const { data: { user }, error } = await client.auth.getUser()
        if (user && !error) {
          return { user, userId: user.id, error: null }
        }
      }
    }
  }

  return { user: null, userId: null, error: 'Unauthorized: Valid session or token required' }
}
