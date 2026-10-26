import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '../services/project'
import { queryKeys } from '../scripts/query/queryKeys'
import { STALE } from '../scripts/query/queryClient'

export const useMyProjectIds = (userId?: string | null) =>
  useQuery({
    queryKey: [...queryKeys.projects.all, 'myIds', userId],
    queryFn: async () => {
      const [owned, member] = await Promise.all([
        projectsApi.getProjectsByUser(userId!),
        projectsApi.getUserMemberProjects(userId!),
      ])
      return new Set([...owned, ...member].map(p => p.projectId))
    },
    enabled: !!userId,
    staleTime: STALE.medium,
  })