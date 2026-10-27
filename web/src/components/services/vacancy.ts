import { authFetch, readError } from './http'

export interface VacancyData {
  vacancyId: string; projectId: string; projectTitle?: string; projectShortDesc?: string;
  title: string; role: string; description: string; requiredTags: string[];
  isOpen?: boolean; publishedAt?: string; membersCount?: number; ratingCount?: number;
  ownerId?: string; ownerSystemRole?: string; ownerIsBanned?: boolean;
}

export interface VacancySearchParams {
  search?: string; searchField?: string; sortField?: string; sortAsc?: boolean; showBannedOnly?: boolean;
}

export const vacanciesApi = {
  // Получить все открытые заявки
  getAll: async (params?: VacancySearchParams): Promise<VacancyData[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.searchField) query.set('searchField', params.searchField);
    if (params?.sortField) query.set('sortField', params.sortField);
    if (params?.sortAsc !== undefined) query.set('sortAsc', String(params.sortAsc));
    if (params?.showBannedOnly !== undefined) query.set('showBannedOnly', String(params.showBannedOnly));

    const r = await authFetch(`/api/vacancy?${query.toString()}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки заявок'));
    return await r.json();
  },

  // Получить заявки проекта
  getByProject: async (projectId: string): Promise<VacancyData[]> => {
    const r = await authFetch(`/api/vacancy/project/${projectId}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки заявок проекта'));
    return await r.json();
  },

  // Создать заявку
  create: async (dto: { projectId: string; title: string; role: string; description: string; requiredTags: string[] }): Promise<VacancyData> => {
    const r = await authFetch('/api/vacancy', { method: 'POST', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка создания заявки'));
    return await r.json();
  },

  // Обновить заявку
  update: async (vacancyId: string, dto: Partial<{ title: string; role: string; description: string; requiredTags: string[]; isOpen: boolean }>): Promise<VacancyData> => {
    const r = await authFetch(`/api/vacancy/${vacancyId}`, { method: 'PUT', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка обновления заявки'));
    return await r.json();
  },

  // Удалить заявку
  delete: async (vacancyId: string): Promise<void> => {
    const r = await authFetch(`/api/vacancy/${vacancyId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления заявки'));
  },
};