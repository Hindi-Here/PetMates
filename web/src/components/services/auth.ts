import { API_BASE } from './cfg';
import { supabase } from './cfg';

export const authApi = {

  register: async (nickname: string, email: string, password: string) => {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Ошибка сети' }));
      throw new Error(error.message || 'Не удалось зарегистрироваться');
    }

    const data = await response.json();
    if (data.accessToken) {
      await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });
    }

    return await data;
  },

   login: async (email: string, password: string, rememberMe: boolean = false) => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Ошибка сети' }));
      throw new Error(error.message || 'Не удалось войти');
    }

    const data = await response.json();
    
    if (data.accessToken) {
      const { error } = await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });
      
      if (error) throw error;
    }
    
    return data;
  },

  signInWithGitHub: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      console.error('GitHub OAuth error:', error);
      throw error;
    }

    return data;
  },

  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
        scopes: 'email profile', 
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    if (error) throw error;
    return data;
  },

  signInWithTwitch: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          scope: 'user:read:email',
        },
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