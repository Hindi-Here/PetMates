import { API_BASE } from './cfg';
import { supabase } from './cfg';

export interface ResponseData {
  responseId: string;
  userId: string;
  userNickname: string;
  vacancyId: string;
  vacancyTitle: string;
  projectId: string;
  projectTitle: string;
  status: string;
  createdAt: string;
}

export const responseApi = {
  // Получить все отклики на вакансии проекта
  getByProject: async (projectId: string): Promise<ResponseData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/response/project/${projectId}`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка загрузки откликов');
    return await response.json();
  },

  // Получить отклики на другие вакансии
  getOutgoing: async (userId: string): Promise<ResponseData[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${API_BASE}/api/response/outgoing/${userId}`, {
    headers: { 
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json' 
    },
  });

  if (!response.ok) throw new Error('Ошибка загрузки исходящих откликов');
  return await response.json();
},

  // Проверить, есть ли уже отклик
  checkResponse: async (vacancyId: string): Promise<{ hasResponded: boolean }> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/response/check/${vacancyId}`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка проверки отклика');
    return await response.json();
  },

  // Создать отклик
  create: async (dto: {
    userId: string;
    vacancyId: string;
    status?: string;
  }): Promise<ResponseData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/response`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dto)
    });

    if (!response.ok) throw new Error('Ошибка создания отклика');
    return await response.json();
  },

  // Удалить отклик
  delete: async (responseId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/response/${responseId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Ошибка удаления отклика');
  },
};