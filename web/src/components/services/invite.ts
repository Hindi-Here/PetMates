import { API_BASE } from './cfg';
import { supabase } from './cfg';

export interface InviteData {
  inviteId: string;
  userId: string;
  userName?: string;
  projectId: string;
  projectTitle?: string;
  role: string;
  status: string;
  inviterId?: string;
  inviterName?: string;
  createdAt: string;
}

export const inviteApi = {
  // Получить входящие приглашения
  getIncoming: async (): Promise<InviteData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/invite/incoming`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка загрузки приглашений');
    return await response.json();
  },

  // Получить исходящие приглашения
  getOutgoing: async (): Promise<InviteData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/invite/outgoing`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка загрузки приглашений');
    return await response.json();
  },

  // Создать приглашение
  create: async (dto: {
    userId: string;
    projectId: string;
    role: string;
    status?: string;
  }): Promise<InviteData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/invite`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dto)
    });

    if (!response.ok) throw new Error('Ошибка создания приглашения');
    return await response.json();
  },

  // Обновить статус приглашения
  updateStatus: async (inviteId: string, status: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/invite/${inviteId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) throw new Error('Ошибка обновления статуса');
  },

  // Удалить приглашение
  delete: async (inviteId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/invite/${inviteId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Ошибка удаления приглашения');
  },
};