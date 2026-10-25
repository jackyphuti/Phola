'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const supabase = createClient()

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (data) {
      const p = data as Profile
      setProfile(p)
      if (p.pin_hash) {
        const isSessionUnlocked = typeof window !== 'undefined' && window.sessionStorage.getItem(`phola_unlocked_${userId}`) === 'true'
        setIsLocked(!isSessionUnlocked)
      } else {
        setIsLocked(false)
      }
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id)
    }
  }, [user?.id, fetchProfile])

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        if (user) {
          await fetchProfile(user.id)
        } else {
          setIsLocked(false)
        }
      } catch (error) {
        console.error('Failed to initialize Supabase auth session', error)
        setUser(null)
        setProfile(null)
        setIsLocked(false)
      } finally {
        setIsLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
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

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  useEffect(() => {
    if (!user) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      return
    }

    const idleMs = 5 * 60 * 1000

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }

      idleTimerRef.current = setTimeout(() => {
        if (profile?.pin_hash) {
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(`phola_unlocked_${user.id}`)
          }
          setIsLocked(true)
        }
      }, idleMs)
    }

    const lockOnHide = () => {
      if (document.visibilityState === 'hidden' && profile?.pin_hash) {
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(`phola_unlocked_${user.id}`)
        }
        setIsLocked(true)
      }
    }

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }))
    document.addEventListener('visibilitychange', lockOnHide)
    window.addEventListener('blur', lockOnHide)

    resetIdleTimer()

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }

      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer))
      document.removeEventListener('visibilitychange', lockOnHide)
      window.removeEventListener('blur', lockOnHide)
    }
  }, [user, profile?.pin_hash])

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
      window.sessionStorage.clear()
    }
    await supabase.auth.signOut()
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
