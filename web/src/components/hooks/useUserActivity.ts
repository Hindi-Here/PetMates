import { useEffect, useState, useCallback } from 'react';
import { projectsApi } from '../services/project';

// Хук для получения активности пользователя (количество проектов, в которых он участвует или является владельцем)
export const useUserActivity = (userId?: string) => {
  const [activityCount, setActivityCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!userId) {
      setActivityCount(0);
      return;
    }

    setLoading(true);
    try {
      const ownedProjects = await projectsApi.getProjectsByUser(userId);
      const memberProjects = await projectsApi.getUserMemberProjects(userId);
      
      const totalCount = ownedProjects.length + memberProjects.length;
      setActivityCount(totalCount);
    }
    catch (error) {
      console.error('Error fetching user activity:', error);
      setActivityCount(0);
    }
    finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { activityCount, loading };
};