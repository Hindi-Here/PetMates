export type SystemRole = 'user' | 'moderator' | 'admin'

const roleRank: Record<string, number> = { user: 0, moderator: 1, admin: 2 }

// Иерархия ролей
export const canModerateTarget = (
  currentRole: string | undefined,
  targetRole: string | undefined | null
): boolean => {
  if (currentRole === 'admin')
    return true
  if (currentRole === 'moderator')
    return (roleRank[targetRole ?? 'user'] ?? 0) === 0
  
  return false
}