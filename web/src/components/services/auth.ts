import { supabase } from './cfg'
import { authFetch, readError } from './http'

export const authApi = {
  // Регистрация аккаунта
  register: async (nickname: string, email: string, password: string, confirmPassword: string) => {
    const r = await authFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nickname, email, password, confirmPassword }),
    });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось зарегистрироваться'));
    
    const data = await r.json();
    if (data.accessToken) {
      await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });
    }
    return data;
  },

  // Логин аккаунт
  login: async (email: string, password: string, rememberMe: boolean = false) => {
    const r = await authFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    });
    if (!r.ok) throw new Error(await readError(r, 'Не удалось войти'));
    
    const data = await r.json();
    if (data.accessToken) {
      const { error } = await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });
      if (error) throw error;
    }
    return data;
  },

  // OAuth вход через GitHub
  signInWithGitHub: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/vacancy` }
    });
    if (error) {
      console.error('GitHub OAuth error:', error);
      throw error;
    }
    return data;
  },

  // OAuth вход через Google
  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { access_type: 'offline', prompt: 'select_account' },
        scopes: 'email profile', 
        redirectTo: `${window.location.origin}/vacancy`,
      }
    });
    if (error) throw error;
    return data;
  },

  // OAuth вход через Twitch
  signInWithTwitch: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: `${window.location.origin}/vacancy`,
        queryParams: { scope: 'user:read:email' },
      }
    });
    if (error) {
      console.error('Twitch OAuth error:', error);
      throw error;
    }
    return data;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};