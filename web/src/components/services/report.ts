import { API_BASE } from './cfg';
import { supabase } from './cfg';

export const reportApi = {
  send: async (message: string, isAnonymous: boolean, nickname?: string) => {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${API_BASE}/api/report/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token 
          ? { 'Authorization': `Bearer ${session.access_token}` } 
          : {}),
      },
      body: JSON.stringify({ message, isAnonymous, nickname }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Ошибка отправки');
    }

    return await response.json();
  },
};