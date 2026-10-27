import { authFetch, readError } from './http'

export interface UserData {
  userId: string; nickname: string; avatarUrl?: string; realName?: string; age?: number;
  city?: string; workplace?: string; profileRole?: string; systemRole?: string;
  isBanned?: boolean; bannedReason?: string; hardSkills?: string[]; lastOnlineAt?: string;
  isOnline: boolean; lastSeen: string; createdAt?: string; activityCount?: number;
}

export interface UserSearchResult {
  userId: string; nickname: string; avatarUrl: string | null;
}

export interface UserSearchParams {
  search?: string; searchField?: string; sortField?: string; sortAsc?: boolean;
  showBannedOnly?: boolean; showStaffOnly?: boolean;
}

export const usersApi = {
  // Получить всех пользователей
  getAll: async (params?: UserSearchParams): Promise<UserData[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.searchField) query.set('searchField', params.searchField);
    if (params?.sortField) query.set('sortField', params.sortField);
    if (params?.sortAsc !== undefined) query.set('sortAsc', String(params.sortAsc));
    if (params?.showBannedOnly !== undefined) query.set('showBannedOnly', String(params.showBannedOnly));
    if (params?.showStaffOnly !== undefined) query.set('showStaffOnly', String(params.showStaffOnly));

    const r = await authFetch(`/api/user?${query.toString()}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки пользователей'));
    return await r.json();
  },

  // Получить конкретного пользователя
  getUserById: async (userId: string): Promise<UserData> => {
    const r = await authFetch(`/api/user/${userId}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки пользователя'));
    return await r.json();
  },

  // Поиск по нику
  findByNickname: async (nickname: string): Promise<UserData | null> => {
    const r = await authFetch(`/api/projectmember/find-by-nickname?nickname=${encodeURIComponent(nickname)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(await readError(r, 'Ошибка поиска пользователя'));
    return await r.json();
  },

  // Поиск пользователя
  searchUsers: async (query: string): Promise<UserSearchResult[]> => {
    const r = await authFetch(`/api/user/search?query=${encodeURIComponent(query)}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка поиска пользователей'));
    return await r.json();
  },
};