'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useNotifications } from '../providers/notification-provider';
import { useAuth } from '../providers/telegram-provider';

export function useLiveEvents(workspaceId?: string | null) {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { user } = useAuth();

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

              // In-app Notifications
              if (parsed.type === 'TASK_ASSIGNED') {
                const isMe = parsed.data?.assigneeId === user?.id;
                const taskTitle = parsed.data?.taskTitle || parsed.data?.task?.title || 'a task';
                if (isMe) {
                  addNotification({
                    type: 'TASK_ASSIGNED',
                    title: 'Task Assigned To You',
                    message: `You were assigned to "${taskTitle}"`,
                    data: parsed.data,
                  });
                }
              } else if (parsed.type === 'TASK_CREATED') {
                const title = parsed.data?.title;
                if (title) {
                  addNotification({
                    type: 'TASK_CREATED',
                    title: 'New Task Created',
                    message: `"${title}" was added`,
                    data: parsed.data,
                  });
                }
              } else if (parsed.type === 'TASK_COMPLETED') {
                const title = parsed.data?.title;
                if (title) {
                  addNotification({
                    type: 'TASK_COMPLETED',
                    title: 'Task Completed',
                    message: `"${title}" was marked as done!`,
                    data: parsed.data,
                  });
                }
              } else if (parsed.type === 'INVITATION_ACCEPTED') {
                addNotification({
                  type: 'INVITATION_ACCEPTED',
                  title: 'Teammate Joined',
                  message: `${parsed.data?.userName || 'A teammate'} joined the workspace!`,
                  data: parsed.data,
                });
              } else if (parsed.type === 'MEMBER_LEFT') {
                addNotification({
                  type: 'MEMBER_LEFT',
                  title: 'Member Left',
                  message: `${parsed.data?.userName || 'A teammate'} left the workspace.`,
                  data: parsed.data,
                });
              }
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
