import { useEffect, useState, useCallback } from 'react';
import { usersApi } from '../services/users';
import type { UserData } from '../services/users';
import { TIMING } from '../scripts/limits'

// Хук для получения списка пользователей с возможностью обновления
export const useUsers = () => {
  const [users, setUsers] = useState<UserData[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (err) {
      console.error('Users fetch error:', err);
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, TIMING.usersRefreshMs);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  return { users, refresh: fetchUsers };
};