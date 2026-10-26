export const queryKeys = {
  profile: {
    all: ['profile'] as const,
    me: (userId?: string | null) => [...queryKeys.profile.all, 'me', userId ?? undefined] as const,
  },
  
  projects: {
    all: ['projects'] as const,
    byUser: (userId: string) => [...queryKeys.projects.all, 'byUser', userId] as const,
    members: (projectId: string) => [...queryKeys.projects.all, 'members', projectId] as const,
    team:    (projectId: string) => [...queryKeys.projects.all, 'team', projectId] as const, 
    favorites: (userId: string) => [...queryKeys.projects.all, 'favorites', userId] as const,
    byId: (projectId: string) => [...queryKeys.projects.all, 'byId', projectId] as const,
  },
  
  responses: {
    all: ['responses'] as const,
    byUser: (userId: string) => [...queryKeys.responses.all, 'byUser', userId] as const,
    byProject: (projectId: string) => [...queryKeys.responses.all, 'byProject', projectId] as const,
    incoming: (userId: string) => [...queryKeys.responses.all, 'incoming', userId] as const,
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
    search: (q: string) => [...queryKeys.users.all, 'search', q] as const,
    byId: (userId: string) => [...queryKeys.users.all, 'byId', userId] as const,
    activity: (userId: string) => [...queryKeys.users.all, 'activity', userId] as const,
  },

  notifications: {
    all: ['notifications'] as const,                                                  
    byCategory: (category: string) => ['notifications', category] as const,
  },

  conversations: {
    all: ['conversations'] as const,
  },

  messages: {
    byConversation: (conversationId: string) => ['messages', conversationId] as const,
  },

  events: {
    all: ['events'] as const,
    byUser: (userId: string) => [...queryKeys.events.all, 'byUser', userId] as const,
    memberEvents: (userId: string) => [...queryKeys.events.all, 'member', userId] as const,
    favorites: (userId: string) => [...queryKeys.events.all, 'favorites', userId] as const,
    byId: (eventId: string) => [...queryKeys.events.all, 'byId', eventId] as const,
    members: (eventId: string) => [...queryKeys.events.all, 'members', eventId] as const,
    myApplication: (eventId: string) => [...queryKeys.events.all, 'myApplication', eventId] as const,
    applications: (eventId: string) => [...queryKeys.events.all, 'applications', eventId] as const,
    application: (eventId: string, applicationId: string) => [...queryKeys.events.all, 'application', eventId, applicationId] as const,
    draft: (eventId: string) => [...queryKeys.events.all, 'draft', eventId] as const,
    list: () => [...queryKeys.events.all, 'list'] as const,
  },

  comments: {  
    all: ['comments'] as const,
    byRef: (type: string, id: string) => ['comments', type, id] as const,
  },
}