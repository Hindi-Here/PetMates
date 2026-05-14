import { API_BASE } from './cfg';
import { supabase } from './cfg';
import type { ProfileData } from '../hooks/useProfile';
import type { UserProfileData } from '../hooks/useUserProfile'; 

export const profileApi = {
   getMe: async (): Promise<ProfileData> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/profile/me`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
    });
    if (!response.ok) throw new Error('Ошибка загрузки профиля');
    return await response.json();
  },

  updateMe: async (updateData: any) => {  
  const { data: { session } } = await supabase.auth.getSession();  
  
  const response = await fetch(`${API_BASE}/api/profile/me`, {
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Ошибка обновления профиля');
  }
  
  return await response.json();
},

getUserById: async (userId: string): Promise<UserProfileData> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/users/${userId}`, {
      headers: { 
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error('Пользователь не найден');
      throw new Error('Ошибка загрузки профиля');
    }
    return await response.json(); 
  },
};