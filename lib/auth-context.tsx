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
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
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

        const hasSecurity = hasConfiguredPin(p) || Boolean(p.biometric_enabled)
        if (hasSecurity) {
          const isSessionUnlocked =
            typeof window !== 'undefined' &&
            window.sessionStorage.getItem(`phola_unlocked_${userId}`) === 'true'
          setIsLocked(!isSessionUnlocked)
        } else {
          setIsLocked(false)
        }
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
    let didComplete = false

    const getUser = async () => {
      // 1. Instant Synchronous Session Check (0ms local storage lookup)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
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
          setIsLoading(false)
          void syncUserData(sessionUser.id, supabase)
        }
      } catch {}

      const sessionInit = (async () => {
        try {
          const { data, error } = await supabase.auth.getUser()
          didComplete = true
          if (error) {
            const errorMsg = error.message?.toLowerCase() || ''
            if (
              errorMsg.includes('invalid refresh token') ||
              errorMsg.includes('refresh_token_not_found') ||
              errorMsg.includes('jwt expired')
            ) {
              purgeStaleSupabaseStorage()
              await supabase.auth.signOut().catch(() => {})
            }
            if (isMounted) {
              setUser(null)
              setProfile(null)
              setIsLocked(false)
            }
            return
          }

          if (isMounted) {
            setUser(data.user)
            if (data.user) {
              // Wrap profile fetch with a quick 1.5s timeout so DB slowness doesn't hang the app
              await Promise.race([
                fetchProfile(data.user.id),
                new Promise((resolve) => setTimeout(resolve, 1500)),
              ])
              void syncUserData(data.user.id, supabase)
            } else {
              setIsLocked(false)
            }
          }
        } catch (error: any) {
          didComplete = true
          console.error('Failed to initialize Supabase auth session', error)
          purgeStaleSupabaseStorage()
          await supabase.auth.signOut().catch(() => {})
          if (isMounted) {
            setUser(null)
            setProfile(null)
            setIsLocked(false)
          }
        } finally {
          if (isMounted) {
            setIsLoading(false)
          }
        }
      })()

      const timeoutFallback = new Promise<void>((resolve) =>
        setTimeout(() => {
          if (!didComplete) {
            console.warn('Supabase auth initialization reached soft timeout.')
          }
          if (isMounted) {
            setIsLoading(false)
          }
          resolve()
        }, 2500)
      )

      await Promise.race([sessionInit, timeoutFallback])

      if (isMounted) {
        setIsLoading(false)
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
            const hasSecurity = hasConfiguredPin(p) || Boolean(p?.biometric_enabled)
            if (hasSecurity) {
              // User has configured a PIN or biometrics: require unlock on sign-in
              if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem(`phola_unlocked_${session.user.id}`)
              }
              setIsLocked(true)
            } else {
              // User has no PIN and no biometrics: never lock
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem(`phola_unlocked_${session.user.id}`, 'true')
              }
              setIsLocked(false)
            }
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

    const hasSecurity = hasConfiguredPin(profile) || Boolean(profile?.biometric_enabled)
    if (!hasSecurity) {
      // User has not configured PIN or biometric lock - never lock
      setIsLocked(false)
      return
    }

    const idleMs = 5 * 60 * 1000

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }

      idleTimerRef.current = setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(`phola_unlocked_${user.id}`)
        }
        setIsLocked(true)
      }, idleMs)
    }

    const lockOnHide = () => {
      if (document.visibilityState === 'hidden') {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(`phola_unlocked_${user.id}`)
        }
        setIsLocked(true)
      }
    }

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }))
    document.addEventListener('visibilitychange', lockOnHide)

    resetIdleTimer()

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }

      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer))
      document.removeEventListener('visibilitychange', lockOnHide)
    }
  }, [user, profile])

  const unlock = useCallback(() => {
    if (user?.id && typeof window !== 'undefined') {
      window.sessionStorage.setItem(`phola_unlocked_${user.id}`, 'true')
    }
    setIsLocked(false)
  }, [user?.id])

  const lock = useCallback(() => {
    if (user?.id && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(`phola_unlocked_${user.id}`)
    }
    setIsLocked(true)
  }, [user?.id])

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
