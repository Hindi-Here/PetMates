import { API_BASE } from './cfg';
import { supabase } from './cfg';

export const moderationApi = {
  // Заблокировать пользователя
  banUser: async (userId: string, reason: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/usermoderation/${userId}/ban`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason }),
    });
    
    if (!response.ok) throw new Error('Не удалось заблокировать пользователя');
  },

  // Разблокировать пользователя
  unbanUser: async (userId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/usermoderation/${userId}/unban`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });
    
    if (!response.ok) throw new Error('Не удалось разблокировать пользователя');
  },

  // Изменить роль
  setRole: async (userId: string, role: 'user' | 'moderator' | 'admin'): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/usermoderation/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role }),
    });
    
    if (!response.ok) throw new Error('Не удалось изменить роль');
  },

  // Удалить заявку
  deleteVacancy: async (vacancyId: string, reason: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/vacancymoderation/${vacancyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason }),
    });
    
    if (!response.ok) throw new Error('Не удалось удалить заявку');
  },

  // Удалить проект
  deleteProject: async (projectId: string, reason: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projectmoderation/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason }),
    });
    
    if (!response.ok) throw new Error('Не удалось удалить проект');
  },
};