import { QueryClient } from '@tanstack/react-query'

export const STALE = {
  none: 0,  
  short: 30 * 1000, 
  medium: 2 * 60 * 1000, 
} as const

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.short,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 1
      },
      retryDelay: 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: { retry: 0 },
  },
})