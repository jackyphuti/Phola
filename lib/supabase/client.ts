import { createBrowserClient } from '@supabase/ssr'

function getSupabaseKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.invalid'
}

export function createClient() {
  return createBrowserClient(
    getSupabaseUrl(),
    getSupabaseKey() || 'public-anon-key',
  )
}
