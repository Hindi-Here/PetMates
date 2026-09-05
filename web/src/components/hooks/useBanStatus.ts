import { useAuth } from './useAuth'
import { useQuery } from '@tanstack/react-query'
import { usersApi } from '../services/users'

export const useBanStatus = () => {
  const { userId, isAuthenticated } = useAuth()

  const { data: userData, isLoading, error } = useQuery({
    queryKey: ['users', 'byId', userId],
    queryFn: () => usersApi.getUserById(userId!),
    enabled: Boolean(isAuthenticated && userId),
  })

  const isBanned = (userData as any)?.isBanned === true
  const bannedReason = (userData as any)?.bannedReason as string | undefined

  const isResolving =
    isAuthenticated === null ||
    (isAuthenticated && !userData && isLoading)

  return {
    isResolving,
    isBanned: isBanned || Boolean(error && isAuthenticated),
    bannedReason,
  }
}