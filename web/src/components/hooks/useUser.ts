import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../scripts/query/queryKeys'
import { usersApi } from '../services/users'
import { STALE } from '../scripts/query/queryClient'

export const useUser = (userId?: string | null) => {
  return useQuery({
    queryKey: queryKeys.users.byId(userId!),
    queryFn: () => usersApi.getUserById(userId!),
    enabled: !!userId,
    staleTime: STALE.medium,
  })
}