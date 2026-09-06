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
      const isLocalhost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      const actualInitData = initData || (typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '');

      let payload = actualInitData;
      if (!payload) {
        if (!isLocalhost) {
          // In production: NEVER log in as Jovany or any dev user!
          setIsLoading(false);
          setUser(null);
          setWorkspaceId(null);
          apiClient.setToken(null);
          apiClient.setWorkspaceId(null);
          setError('Please open FlowTask from within Telegram to access your account.');
          return;
        }
        // Only on localhost during local dev testing:
        payload = explicitUser ? `dev_user_${explicitUser}` : 'dev_user_dev';
      }

      try {
        setIsLoading(true);
        const res = await apiClient.authWithTelegram(payload);
        if (res.error) {
          setError(res.error);
          setUser(null);
          apiClient.setToken(null);
        } else if (res.data) {
          apiClient.setToken(res.data.accessToken);
          setUser(res.data.user);

          // Restore subscription from auth response or resilient user-specific cache
          const subStorageKey = `flowtask_subscription_${res.data.user.id}`;
          if (res.data.subscription) {
            setSubscription(res.data.subscription);
            if (typeof window !== 'undefined') {
              localStorage.setItem(subStorageKey, JSON.stringify(res.data.subscription));
            }
          } else {
            const cachedSub = typeof window !== 'undefined' ? localStorage.getItem(subStorageKey) : null;
            if (cachedSub) {
              try {
                const parsed = JSON.parse(cachedSub);
                if (!parsed.currentPeriodEnd || new Date(parsed.currentPeriodEnd).getTime() > Date.now()) {
                  setSubscription(parsed);
                } else {
                  setSubscription(null);
                }
              } catch {
                setSubscription(null);
              }
            } else {
              setSubscription(null);
            }
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

  const handleSetSubscription = (sub: UserSubscription | null) => {
    setSubscription(sub);
    if (typeof window !== 'undefined' && user?.id) {
      const subStorageKey = `flowtask_subscription_${user.id}`;
      if (sub) {
        localStorage.setItem(subStorageKey, JSON.stringify(sub));
      } else {
        localStorage.removeItem(subStorageKey);
      }
    }
  };

  return (
    <TelegramAuthContext.Provider
      value={{
        user,
        workspaceId,
        setWorkspaceId: handleSetWorkspaceId,
        setMockUser: handleSetMockUser,
        subscription,
        setSubscription: handleSetSubscription,
        isLoading,
        error,
      }}
    >
      {children}
    </TelegramAuthContext.Provider>
  );
}

export const useAuth = () => useContext(TelegramAuthContext);
