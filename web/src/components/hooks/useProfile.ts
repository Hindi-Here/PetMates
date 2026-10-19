import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '../services/profile'
import { queryKeys } from '../scripts/query/queryKeys'
import { STALE } from '../scripts/query/queryClient'
import { useAuth } from './useAuth'
  
export interface ProfileData {
  userId?: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
  realName?: string;
  age?: number | null;
  gender?: string;
  country?: string;
  city?: string;
  workplace?: string;
  profileRole?: string;
  systemRole?: string;
  description?: string;
  hardSkills?: string;
  softSkills?: string;
  contacts?: string;
  lastOnlineAt?: string | null;
  createdAt?: string | null;
}

// Хук для получения данных профиля пользователя с возможностью обновления
export const useProfile = (isAuth: boolean | null) => {
  const { userId } = useAuth()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: queryKeys.profile.me(userId),
    queryFn: profileApi.getMe,
    enabled: isAuth === true && !!userId,
    staleTime: STALE.medium,
    retry: false,
  })

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.profile.me(userId) }),
    [queryClient, userId]
  )

  return { data: data ?? null, refresh }
}