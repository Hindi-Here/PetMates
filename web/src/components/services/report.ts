import { API_BASE, supabase } from './cfg'
import { readError } from './http'

export type ReportType = 'bug' | 'complaint' | 'suggestion' | 'opinion';

export const reportApi = {
  // Отправить сообщение от пользователя (bug страница)
  send: async (message: string, isAnonymous: boolean, nickname: string | undefined, type: ReportType, files: File[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('Message', message);
    formData.append('IsAnonymous', String(isAnonymous));
    if (nickname) formData.append('Nickname', nickname);
    formData.append('Type', type);
    files.forEach(file => formData.append('Files', file));

    const r = await fetch(`${API_BASE}/api/report/send`, {
      method: 'POST',
      headers: { ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
      body: formData,
    });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка отправки'));
    return await r.json();
  },
};