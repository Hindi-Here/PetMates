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
};