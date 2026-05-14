import { useEffect, useState, useCallback } from 'react';
import { profileApi } from '../services/profile';

export interface ProfileData {
  userId?: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
  realName?: string;
  age?: number | null;
  gender?: string;
  country?: string;
  city?: string;
  workplace?: string;
  profileRole?: string;
  systemRole?: string;
  description?: string;
  hardSkills?: string;
  softSkills?: string;
  contacts?: string;
  lastOnlineAt?: string | null;
  createdAt?: string | null;
}

interface UseProfileReturn {
  data: ProfileData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useProfile = (isAuth: boolean): UseProfileReturn => {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!isAuth) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const responseData = await profileApi.getMe();
      setData(responseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAuth]);

  useEffect(() => {
    if (isAuth) {
      fetchProfile();
    } else {
      setData(null);
      setError(null);
      setLoading(false);
    }
  }, [isAuth, fetchProfile]);

  return {
    data,
    loading,
    error,
    refresh: fetchProfile, 
  };
};