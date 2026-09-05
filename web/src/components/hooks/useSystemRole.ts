import { useProfile } from './useProfile'
import { useAuth } from './useAuth'

export const useSystemRole = () => {
  const { isAuthenticated } = useAuth()
  const { data: profile } = useProfile(isAuthenticated)
  return (profile as any)?.systemRole as 'user' | 'moderator' | 'admin' | undefined
}