'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTelegram } from '../hooks/use-telegram';
import { apiClient } from '../lib/api-client';

interface AuthContextType {
  user: any | null;
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
  setMockUser: (profile: 'jovany' | 'tumim' | 'dev') => void;
  isLoading: boolean;
  error: string | null;
}

const TelegramAuthContext = createContext<AuthContextType>({
  user: null,
  workspaceId: null,
  setWorkspaceId: () => {},
  setMockUser: () => {},
  isLoading: true,
  error: null,
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const { initData, isReady } = useTelegram();
  const [user, setUser] = useState<any | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function authenticate() {
      if (!isReady) return;

      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const explicitUser = activeProfile || urlParams?.get('user');
      const targetWsId = urlParams?.get('workspaceId') || urlParams?.get('tgWebAppStartParam');

      const payload = initData || (explicitUser ? `dev_user_${explicitUser}` : 'dev_user_jovany');

      try {
        setIsLoading(true);
        const res = await apiClient.authWithTelegram(payload);
        if (res.error) {
          setError(res.error);
        } else if (res.data) {
          apiClient.setToken(res.data.accessToken);
          setUser(res.data.user);

          // Restore last selected workspace or fallback to default
          const savedWsId = typeof window !== 'undefined' ? localStorage.getItem('flowtask_active_workspace') : null;
          const initialWsId = targetWsId || savedWsId || res.data.defaultWorkspaceId;
          
          if (initialWsId) {
            setWorkspaceId(initialWsId);
            apiClient.setWorkspaceId(initialWsId);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    }

    authenticate();
  }, [initData, isReady, activeProfile]);

  const handleSetWorkspaceId = (id: string) => {
    setWorkspaceId(id);
    apiClient.setWorkspaceId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('flowtask_active_workspace', id);
    }
  };

  const handleSetMockUser = (profile: 'jovany' | 'tumim' | 'dev') => {
    setActiveProfile(profile);
  };

  return (
    <TelegramAuthContext.Provider
      value={{
        user,
        workspaceId,
        setWorkspaceId: handleSetWorkspaceId,
        setMockUser: handleSetMockUser,
        isLoading,
        error,
      }}
    >
      {children}
    </TelegramAuthContext.Provider>
  );
}

export const useAuth = () => useContext(TelegramAuthContext);
