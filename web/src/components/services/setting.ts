import { API_BASE } from './cfg';
import { supabase } from './cfg';

export const settingApi = {
  changePassword: async (oldPassword: string, newPassword: string, confirmPassword: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/setting/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка смены пароля');
    }
    return response.json();
  },

  changeEmail: async (newEmail: string, confirmCode: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/setting/email`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ newEmail, confirmCode }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка смены почты');
    }
    return response.json();
  },
};