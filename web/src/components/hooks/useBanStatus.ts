import { useAuth } from './useAuth'
import { useQuery } from '@tanstack/react-query'
import { usersApi, type UserData } from '../services/users'
import { STALE } from '../scripts/query/queryClient'
import { queryKeys } from '../scripts/query/queryKeys'

// Хук для получения статуса блокировки пользователя
export const useBanStatus = () => {
  const { userId, isAuthenticated } = useAuth()

  const { data: userData, isLoading } = useQuery<UserData | undefined>({
    queryKey: queryKeys.users.byId(userId!),
    queryFn: () => usersApi.getUserById(userId!),
    enabled: Boolean(isAuthenticated && userId),
    retry: 1,
    staleTime: STALE.short,
    refetchInterval: 60_000,
  })

  const isBanned = userData?.isBanned === true
  const bannedReason = userData?.bannedReason

  const isResolving =
    isAuthenticated === null ||
    (isAuthenticated && !userData && isLoading)

  return {
    isResolving,
    isBanned,
    bannedReason,
  }
}