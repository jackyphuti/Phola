'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'
import { hasConfiguredPin } from '@/lib/pin'
import { syncUserData } from '@/lib/user-sync'
import { getCredentialId } from '@/lib/biometric'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  isLocked: boolean
  signOut: () => Promise<void>
  unlock: () => void
  lock: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function purgeStaleSupabaseStorage() {
  if (typeof window === 'undefined') return
  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        window.localStorage.removeItem(key)
      }
    })
  } catch {
    // ignore storage errors
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const raw = window.localStorage.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw)
            return parsed?.user || parsed?.currentSession?.user || null
          }
        }
      }
    } catch {}
    return null
  })
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && key.startsWith('phola_profile_')) {
          const raw = window.localStorage.getItem(key)
          if (raw) return JSON.parse(raw) as Profile
        }
      }
    } catch {}
    return null
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      // 1. Immediately read cached profile from localStorage for 0ms render
      if (typeof window !== 'undefined') {
        const cached = window.localStorage.getItem(`phola_profile_${userId}`)
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Profile
            setProfile(parsed)
          } catch {}
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (data && !error) {
        const p = data as Profile
        setProfile(p)
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(`phola_profile_${userId}`, JSON.stringify(p))
          } catch {}
        }

        // In-app lock screen disabled: users use native device app lock (Face ID / Fingerprint / Passcode)
        setIsLocked(false)
        return p
      }
      return null
    } catch (e) {
      console.warn('Failed to fetch user profile:', e)
      return null
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id)
      void syncUserData(user.id, supabase)
    }
  }, [user?.id, fetchProfile, supabase])

  useEffect(() => {
    let isMounted = true

    const getUser = async () => {
      try {
        // Fast local session recovery via Supabase client with a 1.5s timeout
        try {
          const sessionPromise = supabase.auth.getSession()
          const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 1500)
          )
          const { data: sessionData } = await Promise.race([sessionPromise, timeoutPromise])
          if (sessionData?.session?.user && isMounted) {
            const sessionUser = sessionData.session.user
            setUser(sessionUser)
            if (typeof window !== 'undefined') {
              const cached = window.localStorage.getItem(`phola_profile_${sessionUser.id}`)
              if (cached) {
                try {
                  setProfile(JSON.parse(cached))
                } catch {}
              }
            }
            // Once we have a local session, release initial loading gate immediately
            setIsLoading(false)
            void syncUserData(sessionUser.id, supabase)
          }
        } catch (sessionErr) {
          console.warn('[AuthProvider] getSession error or timeout:', sessionErr)
        }

        // Full server-verified auth check with a hard 3.5s timeout
        const serverAuthCheck = async () => {
          try {
            const { data, error } = await supabase.auth.getUser()
            if (error) {
              const errorMsg = error.message?.toLowerCase() || ''
              if (
                errorMsg.includes('invalid refresh token') ||
                errorMsg.includes('refresh_token_not_found')
              ) {
                purgeStaleSupabaseStorage()
                await supabase.auth.signOut().catch(() => {})
                if (isMounted) {
                  setUser(null)
                  setProfile(null)
                  setIsLocked(false)
                }
              }
              return
            }

            if (isMounted && data?.user) {
              setUser(data.user)
              // Non-blocking profile hydration with 1.5s timeout
              await Promise.race([
                fetchProfile(data.user.id),
                new Promise((resolve) => setTimeout(resolve, 1500)),
              ])
              void syncUserData(data.user.id, supabase)
            }
          } catch (authErr: any) {
            console.warn('[AuthProvider] getUser error:', authErr)
            const errorMsg = authErr?.message?.toLowerCase() || ''
            if (
              errorMsg.includes('invalid refresh token') ||
              errorMsg.includes('refresh_token_not_found')
            ) {
              purgeStaleSupabaseStorage()
              await supabase.auth.signOut().catch(() => {})
              if (isMounted) {
                setUser(null)
                setProfile(null)
                setIsLocked(false)
              }
            }
          }
        }

        // Hard guarantee: finish within 3500ms maximum
        await Promise.race([
          serverAuthCheck(),
          new Promise<void>((resolve) => setTimeout(resolve, 3500)),
        ])
      } catch (err) {
        console.error('[AuthProvider] Auth hydration failed:', err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        setUser(session?.user ?? null)
        if (session?.user) {
          void syncUserData(session.user.id, supabase)
          const p = await fetchProfile(session.user.id)
          if (event === 'SIGNED_IN') {
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(`phola_unlocked_${session.user.id}`, 'true')
            }
            setIsLocked(false)
          }
        } else if (event === 'SIGNED_OUT') {
          if (typeof window !== 'undefined') {
            window.sessionStorage.clear()
          }
          setProfile(null)
          setIsLocked(false)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  // Inactivity timeout & background lock (ONLY active if user configured a PIN or biometrics)
  useEffect(() => {
    if (!user) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      return
    }

    // In-app lock screen disabled in favor of device-level app locks
    setIsLocked(false)
  }, [user])

  const unlock = useCallback(() => {
    setIsLocked(false)
  }, [])

  const lock = useCallback(() => {
    // In-app lock screen disabled: users use native device app lock
    setIsLocked(false)
  }, [])

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.clear()
        Object.keys(window.sessionStorage).forEach((key) => {
          if (key.startsWith('phola_unlocked_')) {
            window.sessionStorage.removeItem(key)
          }
        })
      } catch {
        // Storage might be restricted
      }
    }
    purgeStaleSupabaseStorage()
    await supabase.auth.signOut().catch(() => {})
    setUser(null)
    setProfile(null)
    setIsLocked(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user,
        isLocked,
        signOut,
        unlock,
        lock,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
