import { API_BASE } from './cfg';
import { supabase } from './cfg';

export interface UserData {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  realName?: string;
  age?: number;
  city?: string;
  workplace?: string;
  profileRole?: string;
  hardSkills?: string[];
  lastOnlineAt?: string;
  isOnline: boolean;
  lastSeen: string;
}

export const usersApi = {
  // Получить всех пользователей
  getAll: async (): Promise<UserData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/users`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка загрузки пользователей');
    return await response.json();
  },

  // Получить конкретного пользователя
   getUserById: async (userId: string): Promise<UserData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/users/${userId}`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка загрузки пользователя');
    return await response.json();
  },

  // Поиск по email
  findByEmail: async (email: string): Promise<UserData | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projectmembers/find-by-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Ошибка поиска пользователя');
    
    return await response.json();
  },
};