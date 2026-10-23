import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

const inv = (qc: QueryClient, ...keys: (readonly unknown[])[]) =>
  Promise.all(keys.map(queryKey => qc.invalidateQueries({ queryKey })))

export const invalidateProjects = (qc: QueryClient) =>
  inv(qc, queryKeys.projects.all, queryKeys.vacancies.all, queryKeys.responses.all,
      queryKeys.invites.all, [...queryKeys.users.all, 'activity'], queryKeys.notifications.all)

export const invalidateRelations = (qc: QueryClient) =>
  inv(qc, queryKeys.responses.all, queryKeys.invites.all, queryKeys.notifications.all)

export const invalidateModeration = (qc: QueryClient) =>
  inv(qc, queryKeys.users.all, queryKeys.projects.all, queryKeys.vacancies.all,
      queryKeys.events.all, queryKeys.notifications.all)