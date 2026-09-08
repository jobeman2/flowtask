'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useNotifications } from '../providers/notification-provider';
import { useAuth } from '../providers/telegram-provider';

export function useLiveEvents(workspaceId?: string | null) {
  const queryClient = useQueryClient();
  const { addNotification, syncActivityLogs } = useNotifications();
  const { user } = useAuth();

  const userRef = useRef(user);
  userRef.current = user;

  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;

  const syncActivityLogsRef = useRef(syncActivityLogs);
  syncActivityLogsRef.current = syncActivityLogs;

  // Retrieve current workspace to know ownerId
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      const res = await apiClient.getWorkspaces();
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const currentWs = workspaces.find((w: any) => w.id === workspaceId);
  const workspaceOwnerId = currentWs?.ownerId;
  const workspaceOwnerIdRef = useRef(workspaceOwnerId);
  workspaceOwnerIdRef.current = workspaceOwnerId;

  // Helper to fetch latest activities and sync
  const pollActivity = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await apiClient.getActivity(workspaceId, 30);
      const logs = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
      if (logs.length > 0) {
        syncActivityLogsRef.current(logs, workspaceOwnerIdRef.current);
      }
    } catch {
      // Non-blocking
    }
  }, [workspaceId]);

  // 1. Initial sync and periodic live background polling (every 4s)
  useEffect(() => {
    if (!workspaceId) return;

    pollActivity();

    // Live background polling interval ensures continuous updates even if Webview suspends SSE
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        pollActivity();
      }
    }, 4000);

    // Refresh immediately when app/tab regains focus or visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pollActivity();
        queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
        queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [workspaceId, pollActivity, queryClient]);

  // 2. Real-time EventSource listener
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
            if (!parsed) return;

            // Heartbeat ping to keep connection alive
            if (parsed.type === 'PING') return;

            if (!parsed.workspaceId || parsed.workspaceId === workspaceId) {
              // Instantly invalidate queries so the UI updates live in real-time
              queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
              queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
              queryClient.invalidateQueries({ queryKey: ['activity', workspaceId] });
              queryClient.invalidateQueries({ queryKey: ['workspaces'] });
              queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });

              const currentUser = userRef.current;
              const notify = addNotificationRef.current;
              const currentUserId = currentUser?.id;
              const ownerId = workspaceOwnerIdRef.current;

              if (!currentUserId) return;

              // Never notify the actor for their own action
              const actorId = parsed.data?.actorId || parsed.data?.completedById || parsed.data?.creatorId;
              if (actorId === currentUserId && parsed.type !== 'TASK_ASSIGNED') return;

              const taskTitle = parsed.data?.taskTitle || parsed.data?.title || parsed.data?.task?.title || 'a task';
              const taskId = parsed.data?.taskId || parsed.data?.id || parsed.data?.task?.id;

              // Strictly personalized notification dispatch
              if (parsed.type === 'TASK_ASSIGNED') {
                const isAssignedToMe =
                  parsed.data?.assigneeId === currentUserId ||
                  (Array.isArray(parsed.data?.assigneeIds) && parsed.data.assigneeIds.includes(currentUserId));

                if (isAssignedToMe && actorId !== currentUserId) {
                  notify({
                    type: 'TASK_ASSIGNED',
                    title: 'Task Assigned To You',
                    message: `You were assigned to "${taskTitle}" by ${parsed.data?.assignerName || 'a teammate'}`,
                    data: { ...parsed.data, taskId },
                  });
                }
              } else if (parsed.type === 'TASK_CREATED') {
                const isAssignedToMe =
                  parsed.data?.assigneeId === currentUserId ||
                  (Array.isArray(parsed.data?.assigneeIds) && parsed.data.assigneeIds.includes(currentUserId));
                const isOwner = ownerId && ownerId === currentUserId;

                if (isAssignedToMe) {
                  notify({
                    type: 'TASK_CREATED',
                    title: 'New Task Assigned',
                    message: `"${taskTitle}" was created and assigned to you`,
                    data: { ...parsed.data, taskId },
                  });
                } else if (isOwner) {
                  notify({
                    type: 'TASK_CREATED',
                    title: 'New Task Created',
                    message: `"${taskTitle}" was added to your workspace`,
                    data: { ...parsed.data, taskId },
                  });
                }
              } else if (parsed.type === 'TASK_COMPLETED') {
                const isCreator = parsed.data?.creatorId === currentUserId;
                const isOwner = ownerId && ownerId === currentUserId;

                if ((isCreator || isOwner) && actorId !== currentUserId) {
                  const completer = parsed.data?.completedByName || 'A teammate';
                  notify({
                    type: 'TASK_COMPLETED',
                    title: 'Task Completed',
                    message: `"${taskTitle}" was marked as done by ${completer}!`,
                    data: { ...parsed.data, taskId },
                  });
                }
              } else if (parsed.type === 'INVITATION_ACCEPTED') {
                const isInviter = parsed.data?.inviterId === currentUserId;
                const isOwner = ownerId && ownerId === currentUserId;

                if ((isInviter || isOwner) && parsed.data?.userId !== currentUserId) {
                  notify({
                    type: 'INVITATION_ACCEPTED',
                    title: 'Teammate Joined',
                    message: `${parsed.data?.userName || 'A teammate'} joined the workspace!`,
                    data: parsed.data,
                  });
                }
              } else if (parsed.type === 'MEMBER_LEFT') {
                const isOwner = ownerId && ownerId === currentUserId;

                if (isOwner && parsed.data?.userId !== currentUserId) {
                  notify({
                    type: 'MEMBER_LEFT',
                    title: 'Member Left',
                    message: `${parsed.data?.userName || 'A teammate'} left the workspace.`,
                    data: parsed.data,
                  });
                }
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
