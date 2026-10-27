import { authFetch, readError } from './http'

export interface ProjectMemberData {
  memberId: string; projectId: string; userId: string; role: string; joinedAt?: string;
  nickname?: string; avatarUrl?: string; realName?: string; age?: number; city?: string;
  workplace?: string; profileRole?: string; systemRole?: string; isBanned?: boolean;
  hardSkills?: string | string[]; softSkills?: string | string[]; lastOnlineAt?: string;
  isOnline?: boolean; lastSeen?: string;
}

export const projectMembersApi = {
  // Получить всех участников проекта
  getByProject: async (projectId: string): Promise<ProjectMemberData[]> => {
    const r = await authFetch(`/api/projectmember/project/${projectId}`);
    if (!r.ok) throw new Error(await readError(r, 'Не удалось загрузить участников'));
    return await r.json();
  },

  // Добавить участника
  addMember: async (data: { projectId: string; userId: string; role: string }) => {
    const r = await authFetch('/api/projectmember', { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}));
      throw {
        status: r.status,
        message: errData.title || errData.message || errData.error || 'Ошибка добавления участника',
        details: errData
      };
    }
    return await r.json();
  },

  // Удалить участника
  removeMember: async (memberId: string): Promise<void> => {
    const r = await authFetch(`/api/projectmember/${memberId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления участника'));
  },

  // Обновить роль участника
  updateMemberRole: async (memberId: string, newRole: string): Promise<ProjectMemberData> => {
    const r = await authFetch(`/api/projectmember/${memberId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка обновления роли'));
    return await r.json();
  },

  // Покинуть проект
  leave: async (memberId: string): Promise<void> => {
    const r = await authFetch(`/api/projectmember/${memberId}/leave`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось покинуть проект'));
  },
};