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

export interface UserSearchResult {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface UserSearchParams {
  search?: string;
  searchField?: string;
  sortField?: string;
  sortAsc?: boolean;
  showBannedOnly?: boolean;
  showStaffOnly?: boolean;
}

export const usersApi = {
  // Получить всех пользователей
  getAll: async (params?: UserSearchParams): Promise<UserData[]> => {
    const { data: { session } } = await supabase.auth.getSession();

    const query = new URLSearchParams();
    if (params?.search)
      query.set('search', params.search);
    if (params?.searchField)
      query.set('searchField', params.searchField);
    if (params?.sortField)
      query.set('sortField', params.sortField);
    if (params?.sortAsc !== undefined)
      query.set('sortAsc', String(params.sortAsc));
    if (params?.showBannedOnly !== undefined)
      query.set('showBannedOnly', String(params.showBannedOnly));
    if (params?.showStaffOnly !== undefined)
      query.set('showStaffOnly', String(params.showStaffOnly));

    const response = await fetch(`${API_BASE}/api/users?${query.toString()}`, {
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

  // Поиск пользователя
  searchUsers: async (query: string): Promise<UserSearchResult[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/users/search?query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Ошибка поиска пользователей');
    return await response.json();
  },
};