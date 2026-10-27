import { authFetch, readError } from './http'

export interface InviteData {
  inviteId: string; userId: string; userName?: string; projectId: string;
  projectTitle?: string; role: string; status: string; inviterId?: string;
  inviterName?: string; createdAt: string;
}

export const inviteApi = {
  // Получить входящие приглашения
  getIncoming: async (): Promise<InviteData[]> => {
    const r = await authFetch('/api/invite/incoming');
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки приглашений'));
    return await r.json();
  },

  // Получить исходящие приглашения
  getOutgoing: async (): Promise<InviteData[]> => {
    const r = await authFetch('/api/invite/outgoing');
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки приглашений'));
    return await r.json();
  },

  // Создать приглашение
  create: async (dto: { userId: string; projectId: string; role: string; status?: string }): Promise<InviteData> => {
    const r = await authFetch('/api/invite', { method: 'POST', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка создания приглашения'));
    return await r.json();
  },

  // Удалить приглашение
  delete: async (inviteId: string): Promise<void> => {
    const r = await authFetch(`/api/invite/${inviteId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления приглашения'));
  },

  // Принять
  accept: async (inviteId: string): Promise<void> => {
    const r = await authFetch(`/api/invite/${inviteId}/accept`, { method: 'POST' });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось принять приглашение'));
  },

  // Отклонить
  decline: async (inviteId: string): Promise<void> => {
    const r = await authFetch(`/api/invite/${inviteId}/decline`, { method: 'POST' });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось отклонить приглашение'));
  },
};