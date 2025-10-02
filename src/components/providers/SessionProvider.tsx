'use client'

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface SessionContextValue {
  session: Session | null
  user: User | null
  status: AuthStatus
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined)

interface SessionProviderProps {
  initialSession?: Session | null
  children: React.ReactNode
}

export function SessionProvider({ initialSession = null, children }: SessionProviderProps) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [session, setSession] = useState<Session | null>(initialSession)
  const [status, setStatus] = useState<AuthStatus>(initialSession ? 'authenticated' : 'loading')

  useEffect(() => {
    let isMounted = true

    const hydrateSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!isMounted) return

        if (error) {
          console.error('[SessionProvider] Unable to fetch session:', error)
          setSession(null)
          setStatus('unauthenticated')
          return
        }

        setSession(data.session ?? null)
        setStatus(data.session ? 'authenticated' : 'unauthenticated')
      } catch (err) {
        console.error('[SessionProvider] Unexpected error while hydrating session:', err)
        if (!isMounted) return
        setSession(null)
        setStatus('unauthenticated')
      }
    }

    hydrateSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return

      setSession(nextSession ?? null)
      setStatus(nextSession ? 'authenticated' : 'unauthenticated')

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        router.refresh()
      }

      if (event === 'SIGNED_OUT') {
        router.refresh()
      }
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [router, supabase])

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error('[SessionProvider] Failed to refresh session:', error)
        setSession(null)
        setStatus('unauthenticated')
        return
      }
      setSession(data.session ?? null)
      setStatus(data.session ? 'authenticated' : 'unauthenticated')
    } catch (err) {
      console.error('[SessionProvider] Unexpected error during refresh:', err)
      setSession(null)
      setStatus('unauthenticated')
    }
  }, [supabase])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (err) {
      console.error('[SessionProvider] Error during sign out:', err)
    } finally {
      setSession(null)
      setStatus('unauthenticated')
      router.refresh()
      router.push('/')
    }
  }, [router, supabase])

  const value = useMemo<SessionContextValue>(() => ({
    session,
    user: session?.user ?? null,
    status,
    refresh,
    signOut,
  }), [session, status, refresh, signOut])

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
