'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export function useLiveEvents(workspaceId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId || typeof window === 'undefined' || !window.EventSource) {
      return;
    }

    const sseUrl = apiClient.getLiveStreamUrl(workspaceId);
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      try {
        eventSource = new EventSource(sseUrl);

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && (!parsed.workspaceId || parsed.workspaceId === workspaceId)) {
              // Instantly invalidate queries so the UI updates live in real-time
              queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
              queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
              queryClient.invalidateQueries({ queryKey: ['activity', workspaceId] });
              queryClient.invalidateQueries({ queryKey: ['workspaces'] });
              queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
            }
          } catch {
            // Non-blocking
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Retry connection after 5 seconds
          reconnectTimeout = setTimeout(connect, 5000);
        };
      } catch {
        // Non-blocking fallback to regular React Query polling
      }
    }

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [workspaceId, queryClient]);
}
