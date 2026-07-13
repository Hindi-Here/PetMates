export const queryKeys = {
  profile: {
    all: ['profile'] as const,
    me: (userId?: string | null) => [...queryKeys.profile.all, 'me', userId ?? undefined] as const,
    byId: (profileId: string) => [...queryKeys.profile.all, 'byId', profileId] as const,
  },
  
  projects: {
    all: ['projects'] as const,
    byUser: (userId: string) => [...queryKeys.projects.all, 'byUser', userId] as const,
    memberProjects: (userId: string) => [...queryKeys.projects.all, 'member', userId] as const,
    favorites: (userId: string) => [...queryKeys.projects.all, 'favorites', userId] as const,
    byId: (projectId: string) => [...queryKeys.projects.all, 'byId', projectId] as const,
  },
  
  responses: {
    all: ['responses'] as const,
    byUser: (userId: string) => [...queryKeys.responses.all, 'byUser', userId] as const,
    byProject: (projectId: string) => [...queryKeys.responses.all, 'byProject', projectId] as const,
    outgoing: (userId: string) => [...queryKeys.responses.all, 'outgoing', userId] as const,
  },
  
  invites: {
    all: ['invites'] as const,
    incoming: (userId: string) => [...queryKeys.invites.all, 'incoming', userId] as const,
    outgoing: (userId: string) => [...queryKeys.invites.all, 'outgoing', userId] as const,
  },
  
  vacancies: {
    all: ['vacancies'] as const,
    allList: () => [...queryKeys.vacancies.all, 'list'] as const,
    byProject: (projectId: string) => [...queryKeys.vacancies.all, 'byProject', projectId] as const,
  },
  
  users: {
    all: ['users'] as const,
    allList: () => [...queryKeys.users.all, 'list'] as const,
    byId: (userId: string) => [...queryKeys.users.all, 'byId', userId] as const,
    activity: (userId: string) => [...queryKeys.users.all, 'activity', userId] as const,
  },

  notifications: {
    all: ['notifications'],
    byCategory: (category: string) => ['notifications', category],
  },
}