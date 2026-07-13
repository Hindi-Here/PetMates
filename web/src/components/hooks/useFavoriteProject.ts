import { useEffect, useState, useCallback } from 'react';
import { projectsApi } from '../services/project';
import type { ProjectData } from '../services/project';

export const useFavoriteProjects = (userId?: string | null) => {
  const [favorites, setFavorites] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.getUserFavorites(userId);
      setFavorites(data);
    }
    catch (err) {
      console.error('Favorites fetch error:', err);
      setError('Не удалось загрузить избранные проекты');
      setFavorites([]);
    }
    finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return { 
    favorites, 
    loading, 
    error, 
    refresh: fetchFavorites 
  };
};