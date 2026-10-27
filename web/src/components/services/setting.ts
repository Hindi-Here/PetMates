import { authFetch, readError } from './http'

export const settingApi = {
  // Сменить пароль
  changePassword: async (oldPassword: string, newPassword: string, confirmPassword: string) => {
    const r = await authFetch('/api/setting/password', { 
      method: 'PUT', 
      body: JSON.stringify({ oldPassword, newPassword, confirmPassword }) 
    });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка смены пароля'));
    return await r.json();
  },

  // Сменить почту
  changeEmail: async (newEmail: string, confirmCode: string) => {
    const r = await authFetch('/api/setting/email', { 
      method: 'PUT', 
      body: JSON.stringify({ newEmail, confirmCode }) 
    });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка смены почты'));
    return await r.json();
  },

  // Удалить аккаунт
  deleteAccount: async (nickname: string, password: string) => {
    const r = await authFetch('/api/setting/account', { 
      method: 'DELETE', 
      body: JSON.stringify({ nickname, password }) 
    });
    if (!r.ok) throw new Error(await readError(r, 'Ошибка удаления аккаунта'));
    return await r.json();
  },
};