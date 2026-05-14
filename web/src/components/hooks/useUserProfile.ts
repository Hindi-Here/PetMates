import { useEffect, useState, useCallback } from 'react';
import { profileApi } from '../services/profile';

export interface UserProfileData {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  realName?: string;
  age?: number;
  gender?: string;
  country?: string;
  city?: string;
  workplace?: string;
  profileRole?: string;
  description?: string;
  hardSkills?: string[];
  softSkills?: string[];
  contacts?: string; 
  lastOnlineAt?: string;
  createdAt?: string;
  isOnline: boolean;
  lastSeen: string;
}

interface UseUserProfileReturn {
  data: UserProfileData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useUserProfile = (userId: string | undefined): UseUserProfileReturn => {
  const [data, setData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const responseData = await profileApi.getUserById(userId);
      setData(responseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchProfile();
    } else {
      setData(null);
      setError(null);
      setLoading(false);
    }
  }, [userId, fetchProfile]);

  return {
    data,
    loading,
    error,
    refresh: fetchProfile, 
  };
};