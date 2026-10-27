import { authFetch, readError } from './http'

export interface ResponseData {
  responseId: string; userId: string; userNickname: string; vacancyId: string;
  vacancyTitle: string; projectId: string; projectTitle: string; status: string; createdAt: string;
}

export const responseApi = {
  // Получить все отклики на вакансии проекта
  getByProject: async (projectId: string): Promise<ResponseData[]> => {
    const r = await authFetch(`/api/response/project/${projectId}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки откликов'));
    return await r.json();
  },

  // Получить отклики на другие вакансии
  getOutgoing: async (userId: string): Promise<ResponseData[]> => {
    const r = await authFetch(`/api/response/outgoing/${userId}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки исходящих откликов'));
    return await r.json();
  },

  // Проверить, есть ли уже отклик
  checkResponse: async (vacancyId: string): Promise<{ hasResponded: boolean }> => {
    const r = await authFetch(`/api/response/check/${vacancyId}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка проверки отклика'));
    return await r.json();
  },

  // Создать отклик
  create: async (dto: { userId: string; vacancyId: string; status?: string }): Promise<ResponseData> => {
    const r = await authFetch('/api/response', { method: 'POST', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка создания отклика'));
    return await r.json();
  },

  // Удалить отклик
  delete: async (responseId: string): Promise<void> => {
    const r = await authFetch(`/api/response/${responseId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления отклика'));
  },

  // Принять
  accept: async (responseId: string): Promise<void> => {
    const r = await authFetch(`/api/response/${responseId}/accept`, { method: 'POST' });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось принять отклик'));
  },

  // Отклонить
  decline: async (responseId: string): Promise<void> => {
    const r = await authFetch(`/api/response/${responseId}/decline`, { method: 'POST' });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось отклонить отклик'));
  },
};