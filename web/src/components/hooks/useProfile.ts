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
let isFetching = false;
const profileSubscribers = new Set<(value: ProfileData | null) => void>();

const notifyProfileSubscribers = () => {
  profileSubscribers.forEach(callback => callback(sharedProfileData));
};

const fetchSharedProfile = async (isAuth: boolean, force = false) => {
  if (!isAuth) {
    sharedProfileData = null;
    notifyProfileSubscribers();
    return null;
  }

  if (sharedProfileData && !force) {
    return sharedProfileData;
  }

  if (isFetching) return sharedProfileData;

  isFetching = true;
  try {
    const responseData = await profileApi.getMe();
    sharedProfileData = responseData;
    notifyProfileSubscribers();
    return responseData;
  }
  catch (err) {
    console.error('Profile fetch error:', err);
    return sharedProfileData;
  }
  finally {
    isFetching = false;
  }
};

export const useProfile = (isAuth: boolean | null) => {
  const [data, setData] = useState<ProfileData | null>(
    () => isAuth ? sharedProfileData : null
  );

  useEffect(() => {
    const callback = (value: ProfileData | null) => setData(value);
    profileSubscribers.add(callback);
    if (sharedProfileData)
      setData(sharedProfileData);
    return () => { profileSubscribers.delete(callback); };
  }, []);

  useEffect(() => {
    if (isAuth === null) return;
    if (isAuth && !sharedProfileData) {
      fetchSharedProfile(isAuth);
    }
    else if (isAuth === false) { 
      sharedProfileData = null;
      notifyProfileSubscribers();
    }
  }, [isAuth]);

  const refresh = useCallback(async () => {
    return await fetchSharedProfile(!!isAuth, true);
  }, [isAuth]);

  return { data, refresh };
};