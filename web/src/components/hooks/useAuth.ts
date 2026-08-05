import { useState, useEffect } from 'react';
import { supabase } from '../services/cfg';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const hasAuthParams =
      window.location.search.includes('code=') ||
      window.location.hash.includes('access_token');

    const resolveSession = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsAuthenticated(!!session);
        setUserId(session?.user?.id ?? null);

        if (hasAuthParams) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    };

    resolveSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isAuthenticated, userId };
};