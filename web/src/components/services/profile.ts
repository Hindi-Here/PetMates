import { API_BASE } from './cfg';
import { supabase } from './cfg';
import type { ProfileData } from '../hooks/useProfile';
import type { ThirdProfileData } from '../hooks/useThirdProfile'; 

export const profileApi = {
   getMe: async (): Promise<ProfileData> => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${API_BASE}/api/profile/me`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
    });
    if (!response.ok) throw new Error('Ошибка загрузки профиля');
    return await response.json();
  },

  updateMe: async (updateData: ProfileData) => {  
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
    throw new Error(error.message || 'Ошибка обновления профиля');
  }
  
  return await response.json();
},

uploadAvatar: async (file: File): Promise<{ avatarUrl: string }> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/profile/me/avatar`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) throw new Error('Ошибка загрузки аватара');
  return await response.json();
},

getUserById: async (userId: string): Promise<ThirdProfileData> => {
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