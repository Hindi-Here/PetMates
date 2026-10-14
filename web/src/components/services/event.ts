import { API_BASE } from './cfg'
import { supabase } from './cfg'
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

const authHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }
}

const authOnly = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

const readError = async (response: Response, fallback: string) => {
  const text = await response.text().catch(() => '')
  try {
    return JSON.parse(text).message || fallback
  } catch {
    return text || fallback
  }
}

export const eventApi = {
  // Мероприятия пользователя (владелец)
  getByUser: async (userId: string): Promise<EventData[]> => {
    const response = await fetch(`${API_BASE}/api/event/by-user/${userId}`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка загрузки мероприятий пользователя')
    return await response.json()
  },

  // Мероприятия, в которых пользователь участник
  getMemberEvents: async (userId: string): Promise<EventData[]> => {
    const response = await fetch(`${API_BASE}/api/event/user/${userId}/member`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка загрузки мероприятий участника')
    return await response.json()
  },

  // Избранные мероприятия пользователя
  getFavorites: async (userId: string): Promise<EventData[]> => {
    const response = await fetch(`${API_BASE}/api/event/user/${userId}/favorites`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка загрузки избранных мероприятий')
    return await response.json()
  },

  // Создать мероприятие
  create: async (dto: CreateEventDto): Promise<EventData> => {
    const response = await fetch(`${API_BASE}/api/event`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(dto),
    })
    if (!response.ok) throw new Error(await readError(response, 'Ошибка создания мероприятия'))
    return await response.json()
  },

  // Удалить своё мероприятие
  delete: async (eventId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error(await readError(response, 'Ошибка удаления мероприятия'))
  },

  // Удалить мероприятие (модерация)
  moderationDelete: async (eventId: string, reason: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/moderation`, {
      method: 'DELETE',
      headers: await authHeaders(),
      body: JSON.stringify({ reason }),
    })
    if (!response.ok) throw new Error('Не удалось удалить мероприятие')
  },

  // Оценки
  getUserRating: async (eventId: string): Promise<{ hasRated: boolean }> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/rating`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка получения статуса оценки')
    return await response.json()
  },

  // Поставить оценку мероприятию
  addRating: async (eventId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/rating`, {
      method: 'POST',
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error('Ошибка оценки мероприятия')
    return await response.json()
  },

  // Отменить оценку мероприятию
  removeRating: async (eventId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/rating`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error('Ошибка отмены оценки')
    return await response.json()
  },

  // Получить детали мероприятия
  getEvent: async (eventId: string): Promise<EventDetails> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка загрузки мероприятия')
    return await response.json()
  },

  // Обновить детали мероприятия
  update: async (eventId: string, dto: UpdateEventDto): Promise<EventDetails> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(dto),
    })
    if (!response.ok) throw new Error(await readError(response, 'Ошибка сохранения мероприятия'))
    return await response.json()
  },

  // Получить медиафайлы мероприятия по секции
  getMedia: async (eventId: string, section: EventMediaSection): Promise<EventMediaItem[]> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/media/${section}`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка получения списка медиа')
    return await response.json()
  },

  // Загрузить медиафайл для мероприятия в указанную секцию
  uploadMedia: async (eventId: string, section: EventMediaSection, file: File): Promise<{ url: string; fileName: string; size: number }> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_BASE}/api/event/${eventId}/media/${section}`, {
      method: 'POST',
      headers: await authOnly(),
      body: formData,
    })
    if (!response.ok) throw new Error(await readError(response, 'Ошибка загрузки изображения'))
    return await response.json()
  },

  // Удалить медиафайл мероприятия из указанной секции
  deleteMedia: async (eventId: string, section: EventMediaSection, fileName: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/media/${section}/${encodeURIComponent(fileName)}`, {
      method: 'DELETE',
      headers: await authOnly(),
    })
    if (!response.ok) throw new Error(await readError(response, 'Ошибка удаления файла'))
  },

  // Обновить форму мероприятия
  updateForm: async (eventId: string, fields: EventFormField[]): Promise<EventDetails> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/form`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ fields }),
    })
    if (!response.ok) throw new Error(await readError(response, 'Ошибка сохранения формы'))
    return await response.json()
  },

  // Получить участников мероприятия (организатор + участники)
  getMembers: async (eventId: string): Promise<{ organizer: UserData; members: UserData[] }> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/members`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка загрузки участников')
    return await response.json()
  },

  // Обновить результаты мероприятия
  updateResults: async (eventId: string, results: string): Promise<EventDetails> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/results`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ results }),
    })
    if (!response.ok) throw new Error(await readError(response, 'Ошибка сохранения результатов'))
    return await response.json()
  },

  // Получить заявку текущего пользователя на мероприятие
  getMyApplication: async (eventId: string): Promise<MyApplication | null> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/applications/me`, { headers: await authHeaders() })
    if (response.status === 204) return null
    if (!response.ok) throw new Error('Ошибка загрузки заявки')
    return await response.json()
  },

  // Отправить заявку на мероприятие
  submitApplication: async (eventId: string, answers: { fieldId: string; value: string }[]): Promise<MyApplication> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/applications`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ answers }),
    })
    if (!response.ok) throw new Error(await readError(response, 'Не удалось отправить заявку'))
    return await response.json()
  },

  // Повторно отправить заявку на мероприятие
  resubmitApplication: async (eventId: string, answers: { fieldId: string; value: string }[]): Promise<MyApplication> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/applications/me`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ answers }),
    })
    if (!response.ok) throw new Error(await readError(response, 'Не удалось отправить заявку'))
    return await response.json()
  },

  // Отозвать заявку на мероприятие
  withdrawApplication: async (eventId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/applications/me`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error(await readError(response, 'Не удалось отозвать заявку'))
  },

  // Получить список заявок на мероприятие (для организатора)
  getApplications: async (eventId: string): Promise<ApplicationListItem[]> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/applications`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка загрузки заявок')
    return await response.json()
  },

  // Получить детали конкретной заявки на мероприятие (для организатора)
  getApplication: async (eventId: string, applicationId: string): Promise<ApplicationDetail> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/applications/${applicationId}`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Заявка не найдена')
    return await response.json()
  },

  // Принять/отклонить заявку на мероприятие (для организатора)
  decideApplication: async (
    eventId: string,
    applicationId: string,
    decision: ApplicationDecision,
    comment?: string
  ): Promise<ApplicationDetail> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/applications/${applicationId}/decision`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ decision, comment }),
    })
    if (!response.ok) throw new Error(await readError(response, 'Не удалось применить решение'))
    return await response.json()
  },

  // Получить черновик мероприятия
  getDraft: async (eventId: string): Promise<EventDrafts> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/draft`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка загрузки черновика')
    return await response.json()
  },

  // Сохранить черновик мероприятия
  saveDraft: async (eventId: string, section: EventDraftSection, data: unknown): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/draft/${section}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('Ошибка сохранения черновика')
  },

  // Отменить черновик мероприятия
  discardDraft: async (eventId: string, section: EventDraftSection): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/event/${eventId}/draft/${section}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    })
    if (!response.ok) throw new Error('Ошибка отмены черновика')
  },

  // Получить список мероприятий с возможностью поиска, фильтрации и сортировки
  getAll: async (params?: EventSearchParams): Promise<EventData[]> => {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.searchField) query.set('searchField', params.searchField)
    if (params?.sortField) query.set('sortField', params.sortField)
    if (params?.sortAsc !== undefined) query.set('sortAsc', String(params.sortAsc))
    if (params?.showBannedOnly !== undefined) query.set('showBannedOnly', String(params.showBannedOnly))

    const response = await fetch(`${API_BASE}/api/event?${query.toString()}`, { headers: await authHeaders() })
    if (!response.ok) throw new Error('Ошибка загрузки мероприятий')
    return await response.json()
  },
}