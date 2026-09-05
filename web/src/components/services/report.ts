import { API_BASE } from './cfg';
import { supabase } from './cfg';

export type ReportType = 'bug' | 'complaint' | 'suggestion' | 'opinion';

export const reportApi = {
  // Отправить сообщение от пользователя (bug страница)
  send: async (
    message: string,
    isAnonymous: boolean,
    nickname: string | undefined,
    type: ReportType,
    files: File[]
  ) => {
    const { data: { session } } = await supabase.auth.getSession();

    const formData = new FormData();
    formData.append('Message', message);
    formData.append('IsAnonymous', String(isAnonymous));
    if (nickname) formData.append('Nickname', nickname);
    formData.append('Type', type);
    files.forEach(file => formData.append('Files', file));

    const response = await fetch(`${API_BASE}/api/report/send`, {
      method: 'POST',
      headers: {
        ...(session?.access_token
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Ошибка отправки');
    }

    return await response.json();
  },
};