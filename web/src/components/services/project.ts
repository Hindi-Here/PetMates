import { API_BASE, supabase } from './cfg'
import { authFetch, readError } from './http'

export interface ProjectData {
  projectId: string; ownerId: string; title: string; shortDescription?: string;
  fullDescription?: string; status: string; statusChangedAt?: string; ratingCount: number;
  createdAt?: string; membersCount?: number; isPrivate?: boolean;
}

export interface CreateProjectDto {
  title: string; shortDescription?: string; fullDescription?: string; status?: string; isPrivate?: boolean;
}

export interface ProjectDraftData {
  title?: string; shortDescription?: string; fullDescription?: string; status?: string; isPrivate?: boolean;
  vacancies?: { vacancyId: string; title: string; description: string; requiredTags: string[]; isNew: boolean; isModified: boolean; }[];
  deletedVacancyIds?: string[]; deletedMemberIds?: string[]; editedRoles?: Record<string, string>; deletedMediaFiles?: string[];
}

export interface CommitProjectDto {
  title?: string; shortDescription?: string; fullDescription?: string; status?: string; isPrivate?: boolean;
  vacancies?: any[]; deletedVacancyIds?: string[]; deletedMemberIds?: string[]; editedRoles?: Record<string, string>; deletedMediaFiles?: string[];
}

export const projectsApi = {
  // Получить проекты текущего пользователя
  getMyProjects: async (): Promise<ProjectData[]> => {
    const r = await authFetch('/api/project/my');
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки проектов'));
    return await r.json();
  },

  // Получить информацию о конкретном проекте
  getProject: async (projectId: string): Promise<ProjectData> => {
    const r = await authFetch(`/api/project/${projectId}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки проекта'));
    return await r.json();
  },

  // Получить проекты конкретного пользователя
  getProjectsByUser: async (userId: string): Promise<ProjectData[]> => {
    const r = await authFetch(`/api/project/by-user/${userId}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки проектов пользователя'));
    return await r.json();
  },

  // Создать новый проект
  createProject: async (dto: CreateProjectDto): Promise<ProjectData> => {
    const r = await authFetch('/api/project', { method: 'POST', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка создания проекта'));
    return await r.json();
  },

  // Удалить проект
  deleteProject: async (projectId: string): Promise<void> => {
    const r = await authFetch(`/api/project/${projectId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления проекта'));
  },

  // Получить статус оценки проекта текущим пользователем
  getUserRating: async (projectId: string): Promise<{ hasRated: boolean }> => {
    const r = await authFetch(`/api/project/${projectId}/rating`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка получения статуса оценки'));
    return await r.json();
  },

  // Оценить проект
  addRating: async (projectId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const r = await authFetch(`/api/project/${projectId}/rating`, { method: 'POST' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка оценки проекта'));
    return await r.json();
  },

  // Отменить оценку проекта
  removeRating: async (projectId: string): Promise<{ success: boolean; ratingCount: number }> => {
    const r = await authFetch(`/api/project/${projectId}/rating`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка отмены оценки'));
    return await r.json();
  },

  // Переключить статус оценки проекта
  toggleRating: async (projectId: string, currentHasRated: boolean): Promise<{ success: boolean; ratingCount: number; hasRated: boolean }> => {
    if (currentHasRated) {
      const r = await authFetch(`/api/project/${projectId}/rating`, { method: 'DELETE' });
      if (!r.ok) throw new Error(await readError(r, 'Ошибка отмены оценки'));
      return { ...(await r.json()), hasRated: false };
    } else {
      const r = await authFetch(`/api/project/${projectId}/rating`, { method: 'POST' });
      if (!r.ok) throw new Error(await readError(r, 'Ошибка оценки'));
      return { ...(await r.json()), hasRated: true };
    }
  },

  // Получить избранные проекты пользователя
  getUserFavorites: async (userId: string): Promise<ProjectData[]> => {
    const r = await authFetch(`/api/project/user/${userId}/favorites`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки избранных'));
    return await r.json();
  },

  // Получить проекты, в которых пользователь является участником
  getUserMemberProjects: async (userId: string): Promise<ProjectData[]> => {
    const r = await authFetch(`/api/project/user/${userId}/member`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки проектов участника'));
    return await r.json();
  },

  // Загрузить медиа в черновик (FormData)
  uploadDraftMedia: async (projectId: string, file: File): Promise<{ url: string; fileName: string; size: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch(`${API_BASE}/api/project/${projectId}/media/draft`, {
      method: 'POST',
      headers: { ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
      body: formData,
    });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки чернового изображения'));
    return await r.json();
  },

  // Получить медиа
  getMedia: async (projectId: string) => {
    const r = await authFetch(`/api/project/${projectId}/media`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка получения списка медиа'));
    return await r.json();
  },

  // Удалить медиа
  deleteMedia: async (projectId: string, fileName: string): Promise<void> => {
    const r = await authFetch(`/api/project/${projectId}/media/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления файла'));
  }
};

export const projectDraftApi = {
  // Получить черновик проекта
  getDraft: async (projectId: string): Promise<ProjectDraftData | null> => {
    const r = await authFetch(`/api/project/${projectId}/draft`);
    if (r.status === 404 || r.status === 204) return null;
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки черновика'));

    const text = await r.text();
    if (!text || text.trim() === '') return null;
    try { return JSON.parse(text); } 
    catch (e) {
      console.error('Не удалось распарсить ответ черновика:', text);
      return null;
    }
  },

  // Сохранить черновик проекта
  saveDraft: async (projectId: string, dto: ProjectDraftData): Promise<void> => {
    const r = await authFetch(`/api/project/${projectId}/draft`, { method: 'PUT', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка сохранения черновика'));
  },

  // Отменить (удалить) черновик проекта
  discardDraft: async (projectId: string): Promise<void> => {
    const r = await authFetch(`/api/project/${projectId}/draft`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка отмены черновика'));
  },

  // Применить (сохранить) изменения из черновика в проект
  commitDraft: async (projectId: string, dto: CommitProjectDto): Promise<{ message: string; fullDescription?: string }> => {
    const r = await authFetch(`/api/project/${projectId}/commit`, { method: 'POST', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка сохранения проекта'));
    return await r.json();
  },

  // Загрузить медиа в черновик (FormData)
  uploadDraftMedia: async (projectId: string, file: File): Promise<{ url: string; fileName: string; size: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch(`${API_BASE}/api/project/${projectId}/media/draft`, {
      method: 'POST',
      headers: { ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
      body: formData,
    });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки чернового изображения'));
    return await r.json();
  },

  // Удалить медиа черновика
  deleteMedia: async (projectId: string, fileName: string): Promise<void> => {
    const r = await authFetch(`/api/project/${projectId}/media/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления файла'));
  },
};