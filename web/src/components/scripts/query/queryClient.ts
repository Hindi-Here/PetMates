import { QueryClient } from '@tanstack/react-query'

export const STALE = {
  none: 0,  
  short: 30 * 1000, 
  medium: 2 * 60 * 1000, 
  long: 5 * 60 * 1000, 
} as const

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.short,
      gcTime: 10 * 60 * 1000,
      retry: false,
      retryDelay: 1000,
    },
    mutations: { retry: 0 },
  },
})
