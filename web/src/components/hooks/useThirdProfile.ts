import { useEffect, useState, useCallback } from 'react';
import { profileApi } from '../services/profile';

export interface ThirdProfileData {
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

export const useUserProfile = (userId: string | undefined) => {
  const [data, setData] = useState<ThirdProfileData | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    
    try {
      const responseData = await profileApi.getUserById(userId);
      setData(responseData);
    } catch (err) {
      setData(null);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchProfile();
    } else {
      setData(null);
    }
  }, [userId, fetchProfile]);

  return {
    data,
    refresh: fetchProfile, 
  };
};