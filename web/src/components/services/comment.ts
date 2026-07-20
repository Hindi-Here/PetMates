import { API_BASE } from './cfg';
import { supabase } from './cfg';

export interface CommentData {
  commentId: string;
  userId: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  parentCommentId: string | null;
  content: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const commentApi = {
  // Получить комментарии к указанному объекту
  getComments: async (referenceType: string, referenceId: string): Promise<CommentData[]> => {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${API_BASE}/api/comment/${referenceType}/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) throw new Error('Ошибка загрузки комментариев');
    return await response.json();
  },

  // Создать новый комментарий (или ответ на комментарий)
  create: async (dto: {
    referenceType: string;
    referenceId: string;
    content: string;
    parentCommentId?: string;
  }): Promise<CommentData> => {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${API_BASE}/api/comment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка создания комментария');
    }
    return await response.json();
  },

  // Обновить (отредактировать) комментарий
  update: async (commentId: string, content: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${API_BASE}/api/comment/${commentId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка редактирования комментария');
    }
  },

  // Удалить комментарий
  delete: async (commentId: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${API_BASE}/api/comment/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка удаления комментария');
    }
  },
};