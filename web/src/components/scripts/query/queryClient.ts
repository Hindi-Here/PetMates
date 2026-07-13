import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   
      gcTime: 5 * 60 * 1000,
      retry: 1,
      retryDelay: 1000,

      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      placeholderData: undefined,
    },
    mutations: {
      retry: 0,
    },
  },
})