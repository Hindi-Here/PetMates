import { API_BASE } from './cfg';
import { supabase } from './cfg';

export interface ProjectMemberData {
  memberId: string;
  projectId: string;
  userId: string;
  role: string;
  joinedAt?: string;
}

export interface AddProjectMemberDto {
  projectId: string;
  userId: string;
  role?: string;
}

export const projectMembersApi = {
  // Получить всех участников проекта
  getByProject: async (projectId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projectmembers/project/${projectId}`, {
      headers: {
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        'Content-Type': 'application/json'
      },
    });
    if (!response.ok) throw new Error('Не удалось загрузить участников');
    return await response.json();
  },

  // Добавить участника
  addMember: async (data: { projectId: string; userId: string; role: string }) => {
    const { data: { session } } = await supabase.auth.getSession()
    
    const response = await fetch(`${API_BASE}/api/projectmembers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify(data)
    })
    
    const responseData = await response.json().catch(() => ({}))
    
    if (!response.ok) {
      throw {
        status: response.status,
        message: responseData.title || responseData.message || responseData.error || 'Ошибка добавления участника',
        details: responseData
      }
    }
    
    return responseData
  },

  // Удалить участника
  removeMember: async (memberId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projectmembers/${memberId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка удаления участника');
  },

  // Обновить роль участника
  updateMemberRole: async (memberId: string, newRole: string): Promise<ProjectMemberData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projectmembers/${memberId}/role`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: newRole })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка обновления роли');
    }
    return await response.json();
  },
};