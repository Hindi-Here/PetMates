import { useProfile } from './useProfile'
import { useAuth } from './useAuth'

// Хук для получения системной роли пользователя
export const useSystemRole = (): 'user' | 'moderator' | 'admin' | undefined => {
  const { isAuthenticated } = useAuth()
  const { data: profile } = useProfile(isAuthenticated)
  
  return profile?.systemRole as 'user' | 'moderator' | 'admin' | undefined
}