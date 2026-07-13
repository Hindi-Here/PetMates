import { useEffect, useState, useCallback } from 'react';
import { projectsApi } from '../services/project';
import type { ProjectData } from '../services/project';

export const useMemberProjects = (userId?: string | null) => {
  const [memberProjects, setMemberProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemberProjects = useCallback(async () => {
    if (!userId) {
      setMemberProjects([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.getUserMemberProjects(userId);
      setMemberProjects(data);
    }
    catch (err) {
      console.error('Member projects fetch error:', err);
      setError('Не удалось загрузить проекты участника');
      setMemberProjects([]);
    }
    finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMemberProjects();
  }, [fetchMemberProjects]);

  return { 
    memberProjects, 
    loading, 
    error, 
    refresh: fetchMemberProjects 
  };
};