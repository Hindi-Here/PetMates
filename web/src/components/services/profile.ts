import { API_BASE, supabase } from './cfg'
import { authFetch, readError } from './http'
import type { ProfileData } from '../hooks/useProfile';

export interface ThirdProfileData {
  userId: string; nickname: string; avatarUrl?: string; realName?: string;
  age?: number; gender?: string; country?: string; city?: string; workplace?: string;
  profileRole?: string; description?: string; hardSkills?: string[]; softSkills?: string[];
  contacts?: string; lastOnlineAt?: string; createdAt?: string; isOnline: boolean; lastSeen: string;
}

export const profileApi = {
  // Получить свой профиль
  getMe: async (): Promise<ProfileData> => {
    const r = await authFetch('/api/profile/me');
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки профиля'));
    return await r.json();
  },

  // Обновить профиль
  updateMe: async (updateData: ProfileData) => {  
    const r = await authFetch('/api/profile/me', { method: 'PUT', body: JSON.stringify(updateData) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка обновления профиля'));
    return await r.json();
  },

  // Загрузить аватар (FormData)
  uploadAvatar: async (file: File): Promise<{ avatarUrl: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch(`${API_BASE}/api/profile/me/avatar`, {
      method: 'POST',
      headers: { ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
      body: formData,
    });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки аватара'));
    return await r.json();
  },

  // Получить чужой профиль
  getUserById: async (userId: string): Promise<ThirdProfileData> => {
    const r = await authFetch(`/api/user/${userId}`);
    if (!r.ok) {
      if (r.status === 404) throw new Error('Пользователь не найден');
      throw new Error(await readError(r, 'Ошибка загрузки профиля'));
    }
    return await r.json(); 
  },
};