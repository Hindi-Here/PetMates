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
  isPrivate?: boolean;
}

export interface CreateProjectDto {
  title: string;
  shortDescription?: string;
  fullDescription?: string;
  status?: string;
  isPrivate?: boolean;
}

export interface ProjectDraftData {
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  status?: string;
  isPrivate?: boolean;
  vacancies?: {
    vacancyId: string;
    title: string;
    description: string;
    requiredTags: string[];
    isNew: boolean;
    isModified: boolean;
  }[];
  deletedVacancyIds?: string[];
  deletedMemberIds?: string[];
  editedRoles?: Record<string, string>;
  deletedMediaFiles?: string[];
}

export interface CommitProjectDto {
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  status?: string;
  isPrivate?: boolean;
}

export const projectsApi = {
   // Получить проекты текущего пользователя
  getMyProjects: async (): Promise<ProjectData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/my`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(await response.text() || 'Ошибка загрузки проектов');
    return await response.json();
  },

  // Получить информацию о конкретном проекте
  getProject: async (projectId: string): Promise<ProjectData> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(await response.text() || 'Ошибка загрузки проекта');
    return await response.json();
  },

  // Получить проекты конкретного пользователя
  getProjectsByUser: async (userId: string): Promise<ProjectData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/by-user/${userId}`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(await response.text() || 'Ошибка загрузки проектов пользователя');
    return await response.json();
  },

  // Создать новый проект
  createProject: async (dto: CreateProjectDto): Promise<ProjectData> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw new Error(await response.text() || 'Ошибка создания проекта');
    return await response.json();
  },

  // Удалить проект
  deleteProject: async (projectId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(await response.text() || 'Ошибка удаления проекта');
  },

  // Получить статус оценки проекта текущим пользователем
  getUserRating: async (projectId: string): Promise<{ hasRated: boolean }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/rating`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Ошибка получения статуса оценки');
    return await response.json();
  },

  // Оценить проект
  addRating: async (projectId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/rating`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Ошибка оценки проекта');
    return await response.json();
  },

  // Отменить оценку проекта
  removeRating: async (projectId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/rating`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Ошибка отмены оценки: ${response.status}`);
    return await response.json();
  },

  // Переключить статус оценки проекта (оценить/отменить)
  toggleRating: async (projectId: string, currentHasRated: boolean): Promise<{ success: boolean; ratingCount: number; hasRated: boolean }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (currentHasRated) {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/rating`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Ошибка отмены оценки');
      const data = await response.json();
      return { ...data, hasRated: false };
    } else {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/rating`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Ошибка оценки');
      const data = await response.json();
      return { ...data, hasRated: true };
    }
  },

  // Получить избранные проекты пользователя
  getUserFavorites: async (userId: string): Promise<ProjectData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/user/${userId}/favorites`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(await response.text() || 'Ошибка загрузки избранных');
    return await response.json();
  },

  // Получить проекты, в которых пользователь является участником
  getUserMemberProjects: async (userId: string): Promise<ProjectData[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/user/${userId}/member`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(await response.text() || 'Ошибка загрузки проектов участника');
    return await response.json();
  },

  // Загрузить медиа в черновик
  uploadDraftMedia: async (projectId: string, file: File): Promise<{ url: string; fileName: string; size: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/api/projects/${projectId}/media/draft`, {
      method: 'POST',
      headers: {
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка загрузки чернового изображения');
    }
    return await response.json();
  },

  // Получить медиа
  getMedia: async (projectId: string): Promise<Array<{
    name: string;
    url: string;
    size: number;
    uploadedAt: string;
    isDraft: boolean;
  }>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/media`, {
      headers: {
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка получения списка медиа');
    }
    return await response.json();
  },

  // Удалить медиа
  deleteMedia: async (projectId: string, fileName: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/media/${encodeURIComponent(fileName)}`, {
      method: 'DELETE',
      headers: {
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка удаления файла');
    }
  }
};

export const projectDraftApi = {
  // Получить черновик проекта
  getDraft: async (projectId: string): Promise<ProjectDraftData | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/draft`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`, 
        'Content-Type': 'application/json' 
      },
    });
    
    if (response.status === 404 || response.status === 204)
      return null;
    if (!response.ok)
      throw new Error('Ошибка загрузки черновика');

    const text = await response.text();
    if (!text || text.trim() === '') return null;

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Не удалось распарсить ответ черновика (возможно, пустой ответ от сервера):', text);
      return null;
    }
  },

  // Сохранить черновик проекта
  saveDraft: async (projectId: string, dto: ProjectDraftData): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/draft`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw new Error('Ошибка сохранения черновика');
  },

  // Отменить (удалить) черновик проекта
  discardDraft: async (projectId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/draft`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Ошибка отмены черновика');
  },

  // Применить (сохранить) изменения из черновика в проект
  commitDraft: async (projectId: string, dto: CommitProjectDto): Promise<any> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/commit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка сохранения проекта');
    }
    return await response.json();
  },

  // Загрузить медиа в черновик
  uploadDraftMedia: async (projectId: string, file: File): Promise<{ url: string; fileName: string; size: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/api/projects/${projectId}/media/draft`, {
      method: 'POST',
      headers: {
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка загрузки чернового изображения');
    }
    return await response.json();
  },

  // Удалить медиа черновика
  deleteMedia: async (projectId: string, fileName: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/media/${encodeURIComponent(fileName)}`, {
      method: 'DELETE',
      headers: {
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка удаления файла');
    }
  },
};