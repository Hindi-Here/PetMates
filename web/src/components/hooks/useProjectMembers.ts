import { useEffect, useState, useCallback } from 'react';
import { projectMembersApi } from '../services/project_members';
import type { ProjectMemberData } from '../services/project_members';

export const useProjectMembers = (projectId: string | null) => {
  const [members, setMembers] = useState<ProjectMemberData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const data = await projectMembersApi.getByProject(projectId);
      setMembers(data);
    }
    catch (err) {
      console.error('Project members fetch error:', err);
      setMembers([]);
    }
    finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { 
    members, 
    loading,
    refresh: fetchMembers 
  };
};