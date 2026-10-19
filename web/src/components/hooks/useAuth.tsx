import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/cfg'

interface AuthState {
  isAuthenticated: boolean | null
  userId: string | null
}

const AuthContext = createContext<AuthState>({ isAuthenticated: null, userId: null })

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ isAuthenticated: null, userId: null })
  const lastUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const apply = (session: Session | null) => {
      const id = session?.user?.id ?? null
      if (lastUserId.current !== undefined && lastUserId.current !== id) queryClient.clear()
      lastUserId.current = id
      setState(prev =>
        prev.userId === id && prev.isAuthenticated === !!session
          ? prev
          : { isAuthenticated: !!session, userId: id })
    }

    const hasAuthParams =
      window.location.search.includes('code=') || window.location.hash.includes('access_token')

    supabase.auth.getSession().then(({ data: { session } }) => {
      apply(session)
      if (hasAuthParams) window.history.replaceState({}, '', window.location.pathname)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)