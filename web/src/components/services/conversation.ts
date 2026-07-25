import { API_BASE } from './cfg';
import { supabase } from './cfg';

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

const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };
};

export const conversationApi = {
  // Получение списка переписок пользователя
  getConversations: async (): Promise<ConversationData[]> => {
    const response = await fetch(`${API_BASE}/api/conversation`, { headers: await authHeaders() });
    if (!response.ok) throw new Error('Ошибка загрузки переписок');
    return await response.json();
  },

  // Начало новой переписки или получение существующей
  startConversation: async (targetUserId: string): Promise<{ conversationId: string }> => {
    const response = await fetch(`${API_BASE}/api/conversation/start`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ targetUserId }),
    });
    if (!response.ok) throw new Error('Ошибка создания переписки');
    return await response.json();
  },

  // Получение истории сообщений чата
  getMessages: async (conversationId: string): Promise<MessagesResponse> => {
    const response = await fetch(`${API_BASE}/api/conversation/${conversationId}/messages`, { headers: await authHeaders() });
    if (!response.ok) throw new Error('Ошибка загрузки сообщений');
    return await response.json();
  },

  // Отправка нового сообщения в чат
  sendMessage: async (conversationId: string, content: string, parentMessageId?: string): Promise<MessageData> => {
    const response = await fetch(`${API_BASE}/api/conversation/message`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ conversationId, content, parentMessageId }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Ошибка отправки сообщения');
    }
    return await response.json();
  },

  // Редактирование своего сообщения
  updateMessage: async (messageId: string, content: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/conversation/message/${messageId}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error('Ошибка редактирования сообщения');
  },

  // Удаление своего сообщения для всех участников
  deleteMessage: async (messageId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/conversation/message/${messageId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (!response.ok) throw new Error('Ошибка удаления сообщения');
  },

  // Удаление сообщения (своего или чужого)
  deleteMessageForMe: async (messageId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/conversation/message/${messageId}/for-me`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (!response.ok) throw new Error('Ошибка удаления сообщения');
  },

  // Пересылка сообщения в другой чат
  forwardMessage: async (sourceMessageId: string, targetConversationId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/conversation/message/forward`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ sourceMessageId, targetConversationId }),
    });
    if (!response.ok) throw new Error('Ошибка пересылки сообщения');
  },

  // Закрепление или открепление чата в списке
  togglePin: async (conversationId: string): Promise<{ isPinned: boolean }> => {
    const response = await fetch(`${API_BASE}/api/conversation/${conversationId}/pin`, {
      method: 'PUT',
      headers: await authHeaders(),
    });
    if (!response.ok) throw new Error('Ошибка закрепления');
    return await response.json();
  },

  // Скрытие переписки из списка (удаление только у себя)
  hideConversation: async (conversationId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/conversation/${conversationId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (!response.ok) throw new Error('Ошибка удаления переписки');
  },
};