import { authFetch, readError } from './http'

export const moderationApi = {
  // Заблокировать пользователя
  banUser: async (userId: string, reason: string): Promise<void> => {
    const r = await authFetch(`/api/usermoderation/${userId}/ban`, { method: 'PUT', body: JSON.stringify({ reason }) });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось заблокировать пользователя'));
  },

  // Разблокировать пользователя
  unbanUser: async (userId: string): Promise<void> => {
    const r = await authFetch(`/api/usermoderation/${userId}/unban`, { method: 'PUT' });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось разблокировать пользователя'));
  },

  // Изменить роль
  setRole: async (userId: string, role: 'user' | 'moderator' | 'admin'): Promise<void> => {
    const r = await authFetch(`/api/usermoderation/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось изменить роль'));
  },

  // Удалить заявку
  deleteVacancy: async (vacancyId: string, reason: string): Promise<void> => {
    const r = await authFetch(`/api/vacancymoderation/${vacancyId}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось удалить заявку'));
  },

  // Удалить проект
  deleteProject: async (projectId: string, reason: string): Promise<void> => {
    const r = await authFetch(`/api/projectmoderation/${projectId}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось удалить проект'));
  },
};