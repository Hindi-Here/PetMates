import { API_BASE } from './cfg';
import { supabase } from './cfg';

export interface ProjectData {
  projectId: string;
  ownerId: string;
  title: string;
  shortDescription?: string;
  fullDescription?: string;
  status: string;
  statusChangedAt?: string;
  ratingCount: number;
  createdAt?: string;
  membersCount?: number;
}

export interface CreateProjectDto {
  title: string;
  shortDescription?: string;
  fullDescription?: string;
  status?: string;
}

export interface UpdateProjectDto {
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  status?: string;
}

export const projectsApi = {
  // Получить все проекты текущего пользователя
  getMyProjects: async (): Promise<ProjectData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects/my`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('API getMyProjects error', response.status, text);
      throw new Error(text || 'Ошибка загрузки проектов');
    }
    return await response.json();
  },

  // Получить проект по ID
  getProject: async (projectId: string): Promise<ProjectData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('API getProject error', response.status, text);
      throw new Error(text || 'Ошибка загрузки проекта');
    }
    return await response.json();
  },

  // Получить проект по пользователю
  getProjectsByUser: async (userId: string): Promise<ProjectData[]> => {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${API_BASE}/api/projects/by-user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('API getProjectsByUser error', response.status, text);
      throw new Error(text || 'Ошибка загрузки проектов пользователя');
    }
    return await response.json();
  },

  // Создать новый проект
  createProject: async (dto: CreateProjectDto): Promise<ProjectData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('API createProject error', response.status, text);
      throw new Error(text || 'Ошибка создания проекта');
    }
    return await response.json();
  },

  // Обновить проект
  updateProject: async (projectId: string, dto: UpdateProjectDto): Promise<ProjectData> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка обновления проекта');
    }
    return await response.json();
  },

  // Удалить проект
  deleteProject: async (projectId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('API deleteProject error', response.status, text);
      throw new Error(text || 'Ошибка удаления проекта');
    }
  },

  // Получить рейтинг проекта
  getUserRating: async (projectId: string): Promise<{ hasRated: boolean }> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/rating`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка получения статуса оценки');
    return await response.json();
  },

  // Добавить оценку
  addRating: async (projectId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/rating`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) throw new Error('Ошибка оценки проекта');
    return await response.json();
  },

  // Убрать оценку
  removeRating: async (projectId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/rating`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Ошибка отмены оценки: ${response.status} - ${responseText}`);
    }
    return JSON.parse(responseText);
  },

  // Toggle оценка (добавить/убрать)
  toggleRating: async (projectId: string, currentHasRated: boolean): Promise<{ success: boolean; ratingCount: number; hasRated: boolean }> => {
    try {
      let result;
      if (currentHasRated) {
        result = await projectsApi.removeRating(projectId);
        return { ...result, hasRated: false };
      } else {
        result = await projectsApi.addRating(projectId);
        return { ...result, hasRated: true };
      }
    } catch (error) {
      console.error('Toggle rating error:', error);
      throw error;
    }
  },

  // Получить избранные пользователя
  getUserFavorites: async (userId: string): Promise<ProjectData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects/user/${userId}/favorites`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка загрузки избранных: ${response.status} - ${errorText}`);
    }
    return await response.json();
  },

  // Получить команду по проекту
  getUserMemberProjects: async (userId: string): Promise<ProjectData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`${API_BASE}/api/projects/user/${userId}/member`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json' 
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка загрузки проектов участника: ${response.status} - ${errorText}`);
    }
    return await response.json();
  },
};