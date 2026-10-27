import { API_BASE, supabase } from './cfg'
import { authFetch, readError } from './http'
import type { UserData } from './users'

export interface EventData {
  eventId: string
  ownerId: string
  title: string
  shortDescription?: string | null
  status: string
  statusChangedAt?: string
  eventStartDate?: string | null
  eventEndDate?: string | null
  isPrivate: boolean
  ratingCount: number
  membersCount: number
  createdAt?: string
  ownerSystemRole?: string
  ownerIsBanned: boolean
}

export interface CreateEventDto {
  title: string
  shortDescription?: string
  status?: string
  isPrivate?: boolean
  eventStartDate?: string
  eventEndDate?: string
}

export interface EventStage {
  title: string
  startDate: string
  endDate: string
  acceptsApplications: boolean
}

export interface EventDetails extends EventData {
  description?: string | null
  participantLimit?: number | null
  stages: EventStage[]
  applicationForm: EventFormField[]
  results?: string | null
  registrationState: 'upcoming' | 'open' | 'closed'
}

export interface EventFormField {
  id: string
  label: string
  required: boolean
}

export interface UpdateEventDto {
  title: string
  shortDescription: string
  status: string
  isPrivate: boolean
  eventStartDate: string | null
  eventEndDate: string | null
  participantLimit: number | null
  description: string
  stages: EventStage[]
}

export interface EventMediaItem {
  name: string
  url: string
  size: number
  uploadedAt: string
}

export type EventMediaSection = 'description' | 'results'

export type ApplicationStatus = 'pending' | 'revision' | 'accepted' | 'rejected'
export type ApplicationDecision = 'accept' | 'reject' | 'revision'

export interface ApplicationAnswer {
  fieldId: string
  label: string
  required: boolean
  value: string
}

export interface MyApplication {
  applicationId: string
  status: ApplicationStatus
  answers: ApplicationAnswer[]
  decisionComment?: string | null
  createdAt: string
  updatedAt: string
}

export interface ApplicationListItem {
  applicationId: string
  status: ApplicationStatus
  createdAt: string
  updatedAt: string
  applicant: {
    userId: string
    nickname: string
    avatarUrl?: string | null
    profileRole?: string | null
    isBanned: boolean
  }
  snippetLabel?: string | null
  snippet?: string | null
}

export interface ApplicationDetail extends MyApplication {
  applicant: UserData & { isBanned?: boolean }
  membersCount: number
  participantLimit: number | null
}

export type EventDraftSection = 'general' | 'form' | 'results'

export interface EventDrafts {
  general: UpdateEventDto | null
  form: EventFormField[] | null
  results: string | null
}

export interface EventSearchParams {
  search?: string
  searchField?: string
  sortField?: string
  sortAsc?: boolean
  showBannedOnly?: boolean
}

export const eventApi = {
  // Мероприятия пользователя (владелец)
  getByUser: async (userId: string): Promise<EventData[]> => {
    const r = await authFetch(`/api/event/by-user/${userId}`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки мероприятий пользователя'))
    return await r.json()
  },

  // Мероприятия, в которых пользователь участник
  getMemberEvents: async (userId: string): Promise<EventData[]> => {
    const r = await authFetch(`/api/event/user/${userId}/member`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки мероприятий участника'))
    return await r.json()
  },

  // Избранные мероприятия пользователя
  getFavorites: async (userId: string): Promise<EventData[]> => {
    const r = await authFetch(`/api/event/user/${userId}/favorites`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки избранных мероприятий'))
    return await r.json()
  },

  // Создать мероприятие
  create: async (dto: CreateEventDto): Promise<EventData> => {
    const r = await authFetch('/api/event', { method: 'POST', body: JSON.stringify(dto) })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка создания мероприятия'))
    return await r.json()
  },

  // Удалить своё мероприятие
  delete: async (eventId: string): Promise<void> => {
    const r = await authFetch(`/api/event/${eventId}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления мероприятия'))
  },

  // Удалить мероприятие (модерация)
  moderationDelete: async (eventId: string, reason: string): Promise<void> => {
    const r = await authFetch(`/api/event/${eventId}/moderation`, { method: 'DELETE', body: JSON.stringify({ reason }) })
    if (!r.ok) throw new Error(await readError(r, 'Не удалось удалить мероприятие'))
  },

  // Оценки
  getUserRating: async (eventId: string): Promise<{ hasRated: boolean }> => {
    const r = await authFetch(`/api/event/${eventId}/rating`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка получения статуса оценки'))
    return await r.json()
  },

  addRating: async (eventId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const r = await authFetch(`/api/event/${eventId}/rating`, { method: 'POST' })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка оценки мероприятия'))
    return await r.json()
  },

  removeRating: async (eventId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const r = await authFetch(`/api/event/${eventId}/rating`, { method: 'DELETE' })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка отмены оценки'))
    return await r.json()
  },

  // Получить детали мероприятия
  getEvent: async (eventId: string): Promise<EventDetails> => {
    const r = await authFetch(`/api/event/${eventId}`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки мероприятия'))
    return await r.json()
  },

  // Обновить детали мероприятия
  update: async (eventId: string, dto: UpdateEventDto): Promise<EventDetails> => {
    const r = await authFetch(`/api/event/${eventId}`, { method: 'PUT', body: JSON.stringify(dto) })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка сохранения мероприятия'))
    return await r.json()
  },

  // Получить медиафайлы мероприятия по секции
  getMedia: async (eventId: string, section: EventMediaSection): Promise<EventMediaItem[]> => {
    const r = await authFetch(`/api/event/${eventId}/media/${section}`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка получения списка медиа'))
    return await r.json()
  },

  // Загрузить медиафайл для мероприятия в указанную секцию
  uploadMedia: async (eventId: string, section: EventMediaSection, file: File): Promise<{ url: string; fileName: string; size: number }> => {
    const { data: { session } } = await supabase.auth.getSession()
    const formData = new FormData()
    formData.append('file', file)
    const r = await fetch(`${API_BASE}/api/event/${eventId}/media/${section}`, {
      method: 'POST',
      headers: { ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: formData,
    })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки изображения'))
    return await r.json()
  },

  // Удалить медиафайл мероприятия из указанной секции
  deleteMedia: async (eventId: string, section: EventMediaSection, fileName: string): Promise<void> => {
    const r = await authFetch(`/api/event/${eventId}/media/${section}/${encodeURIComponent(fileName)}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления файла'))
  },

  // Обновить форму мероприятия
  updateForm: async (eventId: string, fields: EventFormField[]): Promise<EventDetails> => {
    const r = await authFetch(`/api/event/${eventId}/form`, { method: 'PUT', body: JSON.stringify({ fields }) })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка сохранения формы'))
    return await r.json()
  },

  // Получить участников мероприятия (организатор + участники)
  getMembers: async (eventId: string): Promise<{ organizer: UserData; members: UserData[] }> => {
    const r = await authFetch(`/api/event/${eventId}/members`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки участников'))
    return await r.json()
  },

  // Обновить результаты мероприятия
  updateResults: async (eventId: string, results: string): Promise<EventDetails> => {
    const r = await authFetch(`/api/event/${eventId}/results`, { method: 'PUT', body: JSON.stringify({ results }) })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка сохранения результатов'))
    return await r.json()
  },

  // Получить заявку текущего пользователя на мероприятие
  getMyApplication: async (eventId: string): Promise<MyApplication | null> => {
    const r = await authFetch(`/api/event/${eventId}/applications/me`)
    if (r.status === 204) return null
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки заявки'))
    return await r.json()
  },

  // Отправить заявку на мероприятие
  submitApplication: async (eventId: string, answers: { fieldId: string; value: string }[]): Promise<MyApplication> => {
    const r = await authFetch(`/api/event/${eventId}/applications`, { method: 'POST', body: JSON.stringify({ answers }) })
    if (!r.ok) throw new Error(await readError(r, 'Не удалось отправить заявку'))
    return await r.json()
  },

  // Повторно отправить заявку на мероприятие
  resubmitApplication: async (eventId: string, answers: { fieldId: string; value: string }[]): Promise<MyApplication> => {
    const r = await authFetch(`/api/event/${eventId}/applications/me`, { method: 'PUT', body: JSON.stringify({ answers }) })
    if (!r.ok) throw new Error(await readError(r, 'Не удалось отправить заявку'))
    return await r.json()
  },

  // Отозвать заявку на мероприятие
  withdrawApplication: async (eventId: string): Promise<void> => {
    const r = await authFetch(`/api/event/${eventId}/applications/me`, { method: 'DELETE' })
    if (!r.ok) throw new Error(await readError(r, 'Не удалось отозвать заявку'))
  },

  // Получить список заявок на мероприятие (для организатора)
  getApplications: async (eventId: string): Promise<ApplicationListItem[]> => {
    const r = await authFetch(`/api/event/${eventId}/applications`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки заявок'))
    return await r.json()
  },

  // Получить детали конкретной заявки на мероприятие (для организатора)
  getApplication: async (eventId: string, applicationId: string): Promise<ApplicationDetail> => {
    const r = await authFetch(`/api/event/${eventId}/applications/${applicationId}`)
    if (!r.ok) throw new Error(await readError(r, 'Заявка не найдена'))
    return await r.json()
  },

  // Принять/отклонить заявку на мероприятие (для организатора)
  decideApplication: async (
    eventId: string,
    applicationId: string,
    decision: ApplicationDecision,
    comment?: string
  ): Promise<ApplicationDetail> => {
    const r = await authFetch(`/api/event/${eventId}/applications/${applicationId}/decision`, {
      method: 'PUT',
      body: JSON.stringify({ decision, comment }),
    })
    if (!r.ok) throw new Error(await readError(r, 'Не удалось применить решение'))
    return await r.json()
  },

  // Получить черновик мероприятия
  getDraft: async (eventId: string): Promise<EventDrafts> => {
    const r = await authFetch(`/api/event/${eventId}/draft`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки черновика'))
    return await r.json()
  },

  // Сохранить черновик мероприятия
  saveDraft: async (eventId: string, section: EventDraftSection, data: unknown): Promise<void> => {
    const r = await authFetch(`/api/event/${eventId}/draft/${section}`, { method: 'PUT', body: JSON.stringify(data) })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка сохранения черновика'))
  },

  // Отменить черновик мероприятия
  discardDraft: async (eventId: string, section: EventDraftSection): Promise<void> => {
    const r = await authFetch(`/api/event/${eventId}/draft/${section}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(await readError(r, 'Ошибка отмены черновика'))
  },

  // Получить список мероприятий с возможностью поиска, фильтрации и сортировки
  getAll: async (params?: EventSearchParams): Promise<EventData[]> => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.searchField) query.set('searchField', params.searchField)
    if (params?.sortField) query.set('sortField', params.sortField)
    if (params?.sortAsc !== undefined) query.set('sortAsc', String(params.sortAsc))
    if (params?.showBannedOnly !== undefined) query.set('showBannedOnly', String(params.showBannedOnly))

    const r = await authFetch(`/api/event?${query.toString()}`)
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки мероприятий'))
    return await r.json()
  },
}