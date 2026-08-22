'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTelegram } from '../hooks/use-telegram';
import { apiClient } from '../lib/api-client';

interface AuthContextType {
  user: any | null;
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

const TelegramAuthContext = createContext<AuthContextType>({
  user: null,
  workspaceId: null,
  setWorkspaceId: () => {},
  isLoading: true,
  error: null,
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const { initData, isReady } = useTelegram();
  const [user, setUser] = useState<any | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function authenticate() {
      if (!isReady) return;

      const payload = initData || 'dev_mock_1001';

      try {
        const res = await apiClient.authWithTelegram(payload);
        if (res.error) {
          setError(res.error);
        } else if (res.data) {
          apiClient.setToken(res.data.accessToken);
          setUser(res.data.user);
          if (res.data.defaultWorkspaceId) {
            setWorkspaceId(res.data.defaultWorkspaceId);
            apiClient.setWorkspaceId(res.data.defaultWorkspaceId);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    }

    authenticate();
  }, [initData, isReady]);

  const handleSetWorkspaceId = (id: string) => {
    setWorkspaceId(id);
    apiClient.setWorkspaceId(id);
  };

  return (
    <TelegramAuthContext.Provider
      value={{
        user,
        workspaceId,
        setWorkspaceId: handleSetWorkspaceId,
        isLoading,
        error,
      }}
    >
      {children}
    </TelegramAuthContext.Provider>
  );
}

export const useAuth = () => useContext(TelegramAuthContext);
