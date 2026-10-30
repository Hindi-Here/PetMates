import { authFetch, readError } from './http'

export interface ConversationData {
  conversationId: string;
  otherUserId: string;
  otherUserNickname: string | null;
  otherUserAvatarUrl: string | null;
  isPinned: boolean;
  lastMessage: string | null;
  lastMessageAt: string | null;
  hasUnread: boolean;
}

export interface MessageData {
  messageId: string;
  senderId: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  content: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  parentMessageId: string | null;
  parentContent: string | null;
  parentNickname: string | null;
  isForwarded: boolean;
  forwardedFromNickname: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface MessagesResponse {
  messages: MessageData[];
  previousLastReadAt: string | null;
  otherLastReadAt: string | null;
}

export const conversationApi = {
  // Получение списка переписок пользователя
  getConversations: async (): Promise<ConversationData[]> => {
    const r = await authFetch('/api/conversation');
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки переписок'));
    return await r.json();
  },

  // Начало новой переписки или получение существующей
  startConversation: async (targetUserId: string): Promise<{ conversationId: string }> => {
    const r = await authFetch('/api/conversation/start', { method: 'POST', body: JSON.stringify({ targetUserId }) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка создания переписки'));
    return await r.json();
  },

  // Получение истории сообщений чата
  getMessages: async (conversationId: string): Promise<MessagesResponse> => {
    const r = await authFetch(`/api/conversation/${conversationId}/messages`);
    if (!r.ok) throw new Error(await readError(r, 'Ошибка загрузки сообщений'));
    return await r.json();
  },

  // Отправка нового сообщения в чат
  sendMessage: async (conversationId: string, content: string, parentMessageId?: string): Promise<MessageData> => {
    const r = await authFetch('/api/conversation/message', { 
      method: 'POST', 
      body: JSON.stringify({ conversationId, content, parentMessageId }) 
    });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка отправки сообщения'));
    return await r.json();
  },

  // Редактирование своего сообщения
  updateMessage: async (messageId: string, content: string): Promise<void> => {
    const r = await authFetch(`/api/conversation/message/${messageId}`, { method: 'PUT', body: JSON.stringify({ content }) });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка редактирования сообщения'));
  },

  // Удаление своего сообщения для всех участников
  deleteMessage: async (messageId: string): Promise<void> => {
    const r = await authFetch(`/api/conversation/message/${messageId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления сообщения'));
  },

  // Удаление сообщения (своего или чужого)
  deleteMessageForMe: async (messageId: string): Promise<void> => {
    const r = await authFetch(`/api/conversation/message/${messageId}/for-me`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления сообщения'));
  },

  // Пересылка сообщения в другой чат
  forwardMessage: async (sourceMessageId: string, targetConversationId: string): Promise<void> => {
    const r = await authFetch(`/api/conversation/message/${sourceMessageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ sourceMessageId, targetConversationId })
    });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка пересылки сообщения'));
  },

  // Закрепление или открепление чата в списке
  togglePin: async (conversationId: string): Promise<{ isPinned: boolean }> => {
    const r = await authFetch(`/api/conversation/${conversationId}/pin`, { method: 'PUT' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка закрепления'));
    return await r.json();
  },

  // Скрытие переписки из списка (удаление только у себя)
  hideConversation: async (conversationId: string): Promise<void> => {
    const r = await authFetch(`/api/conversation/${conversationId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления переписки'));
  },
};