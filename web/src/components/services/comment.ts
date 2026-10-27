import { authFetch, readError } from './http'

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
  authorSystemRole?: string | null;
  deletedByModerator?: boolean;
}

export const commentApi = {
  // Получить комментарии к указанному объекту
  getComments: async (referenceType: string, referenceId: string): Promise<CommentData[]> => {
    const r = await authFetch(`/api/comment/${referenceType}/${referenceId}`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки комментариев'));
    return await r.json();
  },

  // Создать новый комментарий (или ответ на комментарий)
  create: async (dto: { referenceType: string; referenceId: string; content: string; parentCommentId?: string }): Promise<CommentData> => {
    const r = await authFetch('/api/comment', { method: 'POST', body: JSON.stringify(dto) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка создания комментария'));
    return await r.json();
  },

  // Обновить (отредактировать) комментарий
  update: async (commentId: string, content: string): Promise<void> => {
    const r = await authFetch(`/api/comment/${commentId}`, { method: 'PUT', body: JSON.stringify({ content }) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка редактирования комментария'));
  },

  // Удалить комментарий
  delete: async (commentId: string): Promise<void> => {
    const r = await authFetch(`/api/comment/${commentId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления комментария'));
  },
};