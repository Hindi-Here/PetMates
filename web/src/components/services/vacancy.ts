import { API_BASE } from './cfg';
import { supabase } from './cfg';

export interface VacancyData {
  vacancyId: string;
  projectId: string;
  projectTitle?: string;
  projectShortDesc?: string;
  title: string;
  role: string;
  description: string;
  requiredTags: string[];
  isOpen?: boolean;
  publishedAt?: string;
  membersCount?: number;
  ratingCount?: number;
}

export interface VacancySearchParams {
  search?: string;
  searchField?: string;
  sortField?: string;
  sortAsc?: boolean;
  showBannedOnly?: boolean;
}

export const vacanciesApi = {
  // Получить все открытые заявки
  getAll: async (params?: VacancySearchParams): Promise<VacancyData[]> => {
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

    const response = await fetch(`${API_BASE}/api/vacancy?${query.toString()}`, {
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });
    if (!response.ok) throw new Error('Ошибка загрузки заявок');
      return await response.json();
  },

  // Получить заявки проекта
  getByProject: async (projectId: string): Promise<VacancyData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/vacancy/project/${projectId}`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка загрузки заявок проекта');
    return await response.json();
  },

  // Создать заявку
  create: async (dto: {
    projectId: string;
    title: string;
    role: string;
    description: string;
    requiredTags: string[];
  }): Promise<VacancyData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/vacancy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dto)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка создания заявки');
    }
    return await response.json();
  },

  // Обновить заявку
  update: async (vacancyId: string, dto: Partial<{
    title: string;
    role: string;
    description: string;
    requiredTags: string[];
    isOpen: boolean;
  }>): Promise<VacancyData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/vacancy/${vacancyId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dto)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка обновления заявки');
    }
    return await response.json();
  },

  // Удалить заявку
  delete: async (vacancyId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/vacancy/${vacancyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Ошибка удаления заявки');
  },
};