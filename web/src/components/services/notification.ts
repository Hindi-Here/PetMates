import { authFetch, readError } from './http'

export interface NotificationData {
  notificationId: string; userId: string;
  referenceType: 'project' | 'response' | 'invite' | 'system' | 'event' | 'application' | 'comment';
  referenceId: string;
  contextData: {
    projectName?: string; eventName?: string; vacancyName?: string; role?: string;
    nickname?: string; status?: string; eventType?: string; reason?: string;
  };
  isRead: boolean; createdAt: string;
}

export const notificationApi = {
  // Получить все уведомления
  getAll: async (referenceType?: string): Promise<NotificationData[]> => {
    const url = referenceType ? `/api/notification?referenceType=${referenceType}` : '/api/notification';
    const r = await authFetch(url);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки уведомлений'));
    return await r.json();
  },

  // Пометить, как прочитанное
  markAsRead: async (notificationId: string): Promise<void> => {
    const r = await authFetch(`/api/notification/${notificationId}/read`, { method: 'PUT' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка обновления статуса'));
  },

  // Пометить все, как прочитанное
  markAllAsRead: async (): Promise<void> => {
    const r = await authFetch('/api/notification/mark-all-read', { method: 'PUT' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка обновления статуса'));
  },

  // Удалить уведомление
  delete: async (notificationId: string): Promise<void> => {
    const r = await authFetch(`/api/notification/${notificationId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления уведомления'));
  },

  // Создать уведомление
  create: async (dto: { userId: string; referenceType: string; referenceId: string; contextData: any }): Promise<NotificationData> => {
    const r = await authFetch('/api/notification', { method: 'POST', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка создания уведомления'));
    return await r.json();
  },
};