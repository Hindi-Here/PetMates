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

let sharedProfileData: ProfileData | null = null;
const profileSubscribers = new Set<(value: ProfileData | null) => void>();

const notifyProfileSubscribers = () => {
  profileSubscribers.forEach(callback => callback(sharedProfileData));
};

const fetchSharedProfile = async (isAuth: boolean) => {
  if (!isAuth) {
    sharedProfileData = null;
    notifyProfileSubscribers();
    return null;
  }

  try {
    const responseData = await profileApi.getMe();
    sharedProfileData = responseData;
    notifyProfileSubscribers();
    return responseData;
  } catch (err) {
    console.error('Profile fetch error:', err);
    sharedProfileData = null;
    notifyProfileSubscribers();
    return null;
  }
};

export const useProfile = (isAuth: boolean) => {
  const [data, setData] = useState<ProfileData | null>(() => isAuth ? sharedProfileData : null);

  useEffect(() => {
    const callback = (value: ProfileData | null) => setData(value);
    profileSubscribers.add(callback);

    return () => {
      profileSubscribers.delete(callback);
    };
  }, []);

  useEffect(() => {
    fetchSharedProfile(isAuth);
  }, [isAuth]);

  const refresh = useCallback(async () => {
    return await fetchSharedProfile(isAuth);
  }, [isAuth]);

  return { data, refresh };
};