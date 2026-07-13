import { useEffect, useState, useCallback } from 'react';
import { projectsApi } from '../services/project';
import type { ProjectData } from '../services/project';
import { useAuth } from './useAuth'; 

export const useProjects = (ownerId?: string | null) => {
  const { userId: authUserId } = useAuth();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    
    if (!ownerId) {
      setProjects([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      let data: ProjectData[];
      
      if (ownerId === authUserId) {
        data = await projectsApi.getMyProjects();
      }
      else {
        data = await projectsApi.getProjectsByUser(ownerId);
      }
      
      setProjects(data);
    }
    catch (err) {
      console.error('Projects fetch error:', err);
      setError('Не удалось загрузить проекты');
      setProjects([]);
    }
    finally {
      setLoading(false);
    }
  }, [ownerId, authUserId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { 
    projects, 
    loading, 
    error, 
    refresh: fetchProjects 
  };
};