import { useProfile } from './useProfile'
import { useAuth } from './useAuth'

// Хук для получения системной роли пользователя
export const useSystemRole = () => {
  const { isAuthenticated } = useAuth()
  const { data: profile } = useProfile(isAuthenticated)
  return (profile as any)?.systemRole as 'user' | 'moderator' | 'admin' | undefined
}