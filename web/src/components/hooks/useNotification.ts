import { useState, useEffect } from 'react';
import { notificationApi, type NotificationData } from '../services/notification';

export const useNotifications = (category?: string) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await notificationApi.getAll(category);
        setNotifications(data);
      }
      catch (err: any) {
        console.error('Ошибка загрузки уведомлений:', err);
        setError(err.message);
      }
      finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [category]);

  return { notifications, loading, error };
};