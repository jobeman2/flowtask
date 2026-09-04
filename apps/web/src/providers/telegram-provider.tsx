'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTelegram } from '../hooks/use-telegram';
import { apiClient } from '../lib/api-client';

interface UserSubscription {
  planCode: string;
  status: string;
  currentPeriodEnd: string | null;
}

interface AuthContextType {
  user: any | null;
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
  setMockUser: (profile: 'jovany' | 'tumim' | 'dev') => void;
  subscription: UserSubscription | null;
  setSubscription: (sub: UserSubscription | null) => void;
  isLoading: boolean;
  error: string | null;
}

const TelegramAuthContext = createContext<AuthContextType>({
  user: null,
  workspaceId: null,
  setWorkspaceId: () => {},
  setMockUser: () => {},
  subscription: null,
  setSubscription: () => {},
  isLoading: true,
  error: null,
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const { initData, isReady } = useTelegram();
  const [user, setUser] = useState<any | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function authenticate() {
      if (!isReady) return;

      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const explicitUser = activeProfile || urlParams?.get('user');
      const targetWsId = urlParams?.get('workspaceId') || urlParams?.get('tgWebAppStartParam');
      // If running inside Telegram, NEVER fallback to dev_user_jovany
      const isTg = typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData);
      const actualInitData = initData || (typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '');

      let payload = actualInitData;
      if (!payload) {
        if (isTg) {
          // Inside Telegram WebApp: Wait for initData or report error, DO NOT login as jovany!
          return;
        }
        // Only outside Telegram in desktop browser localhost/dev:
        payload = explicitUser ? `dev_user_${explicitUser}` : 'dev_user_jovany';
      }

      try {
        setIsLoading(true);
        const res = await apiClient.authWithTelegram(payload);
        if (res.error) {
          setError(res.error);
        } else if (res.data) {
          apiClient.setToken(res.data.accessToken);
          setUser(res.data.user);

          // Restore subscription from auth response (works cross-device)
          if (res.data.subscription) {
            setSubscription(res.data.subscription);
          } else {
            setSubscription(null);
          }

          // User-specific workspace storage (NEVER leak another account's workspace on shared device)
          const userStorageKey = `flowtask_active_ws_${res.data.user.id}`;
          const savedWsId = typeof window !== 'undefined' ? localStorage.getItem(userStorageKey) : null;
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
    if (typeof window !== 'undefined' && user?.id) {
      localStorage.setItem(`flowtask_active_ws_${user.id}`, id);
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
        subscription,
        setSubscription,
        isLoading,
        error,
      }}
    >
      {children}
    </TelegramAuthContext.Provider>
  );
}

export const useAuth = () => useContext(TelegramAuthContext);
