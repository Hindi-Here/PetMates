import { useState, useEffect } from 'react';
import { inviteApi, type InviteData } from '../services/invite';

// Хук для получения входящих и исходящих приглашений пользователя
export const useInvites = (type: 'incoming' | 'outgoing') => {
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = type === 'incoming' 
          ? await inviteApi.getIncoming()
          : await inviteApi.getOutgoing();
        
        setInvites(data);
      }
      catch (err: unknown) {
        console.error('Ошибка загрузки приглашений:', err);
        const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
        setError(message);
      }
      finally {
        setLoading(false);
      }
    };

    fetchInvites();
  }, [type]);

  return { invites, loading, error };
};