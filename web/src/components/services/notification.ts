import { API_BASE } from './cfg';
import { supabase } from './cfg';

export interface NotificationData {
  notificationId: string;
  userId: string;
  referenceType: 'project' | 'response' | 'invite' | 'system';
  referenceId: string;
  contextData: {
    projectName?: string;
    vacancyName?: string; 
    role?: string;
    nickname?: string;
    status?: string;
    eventType?: string;
  };
  isRead: boolean;
  createdAt: string;
}

export const notificationApi = {
  // Получить все уведомления
  getAll: async (referenceType?: string): Promise<NotificationData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    let url = `${API_BASE}/api/notification`;
    if (referenceType) {
      url += `?referenceType=${referenceType}`;
    }
    
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Ошибка загрузки уведомлений:', error);
      throw new Error(error.message || 'Ошибка загрузки уведомлений');
    }
    return await response.json();
  },

  // Пометка чтения
  markAsRead: async (notificationId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/notification/${notificationId}/read`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Ошибка обновления статуса');
  },

  // Пометить все, как прочитанное
  markAllAsRead: async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/notification/mark-all-read`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Ошибка обновления статуса');
  },

  // Удалить уведомление
  delete: async (notificationId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/notification/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Ошибка удаления уведомления');
  },

  // Создать уведомление
  create: async (dto: {
    userId: string;
    referenceType: string;
    referenceId: string;
    contextData: any;
  }): Promise<NotificationData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dto)
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { message: responseText || `HTTP ${response.status}` };
      }
      console.error('Notification creation failed:', errorData);
      throw new Error(errorData.message || 'Ошибка создания уведомления');
    }

    try {
      const data = JSON.parse(responseText);
      return data;
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      throw new Error('Неверный формат ответа сервера');
    }
  },
};