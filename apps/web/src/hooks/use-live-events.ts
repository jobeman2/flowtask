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

  // Retrieve current workspace to know ownerId safely without crashing
  const { data: rawWorkspaces } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: async () => {
      try {
        const res = await apiClient.getWorkspaces();
        return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const workspaces: any[] = Array.isArray(rawWorkspaces)
    ? rawWorkspaces
    : (rawWorkspaces as any)?.data && Array.isArray((rawWorkspaces as any).data)
    ? (rawWorkspaces as any).data
    : [];

  const workspacesRef = useRef<any[]>([]);
  workspacesRef.current = workspaces;

  const currentWs = workspaces.find((w: any) => w && w.id === workspaceId);
  const workspaceOwnerId = currentWs?.ownerId;
  const workspaceOwnerIdRef = useRef(workspaceOwnerId);
  workspaceOwnerIdRef.current = workspaceOwnerId;

  // Helper to fetch latest activities across all user workspaces and sync
  const pollActivity = useCallback(async () => {
    try {
      const activeList = workspacesRef.current.length > 0 ? workspacesRef.current : (workspaceId ? [{ id: workspaceId }] : []);
      const ownerMap = new Map(workspacesRef.current.map((w: any) => [w.id, w.ownerId]));

      // Poll current workspace and all user workspaces
      const targetIds = Array.from(new Set([workspaceId, ...activeList.map((w: any) => w.id)].filter(Boolean)));

      const allLogs: any[] = [];
      await Promise.all(
        targetIds.map(async (wsId) => {
          try {
            const res = await apiClient.getActivity(wsId as string);
            const logs = Array.isArray(res?.data) ? res.data : (res?.data as any)?.data || [];
            allLogs.push(...logs);
          } catch {}
        })
      );

      if (allLogs.length > 0 && typeof syncActivityLogsRef.current === 'function') {
        syncActivityLogsRef.current(allLogs, ownerMap);
      }
    } catch {
      // Non-blocking
    }
  }, [workspaceId]);

  // 1. Initial sync and periodic live background polling (every 4s)
  useEffect(() => {
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
        if (workspaceId) {
          queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
          queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
        }
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

  // 2. Authenticated real-time stream for the active workspace
  useEffect(() => {
    if (typeof window === 'undefined' || !workspaceId || !user) {
      return;
    }

    const sseUrl = apiClient.getLiveStreamUrl(workspaceId);
    let abortController: AbortController | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let retryCount = 0;

    async function connect() {
      if (stopped) return;
      abortController = new AbortController();
      try {
        const response = await fetch(sseUrl, {
          headers: { Authorization: `Bearer ${apiClient.getToken() || ''}` },
          signal: abortController.signal,
        });
        if (!response.ok || !response.body) throw new Error(`SSE request failed: ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split(/\r?\n\r?\n/);
          buffer = messages.pop() || '';
          for (const message of messages) {
            const data = message.split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n');
            if (data) {
              retryCount = 0;
              handleMessage(data);
            }
          }
        }
        if (!stopped) throw new Error('SSE stream ended');
      } catch {
        if (!stopped && retryCount < 3) {
          retryCount++;
          reconnectTimeout = setTimeout(connect, 10000);
        }
      }
    }

    function handleMessage(data: string) {
          try {
            const parsed = JSON.parse(data);
            if (!parsed) return;

            // Heartbeat ping to keep connection alive
            if (parsed.type === 'PING') return;

            // Instantly invalidate queries for the active workspace if matching
            if (!parsed.workspaceId || parsed.workspaceId === workspaceId) {
              if (workspaceId) {
                queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
                queryClient.invalidateQueries({ queryKey: ['task-stats', workspaceId] });
                queryClient.invalidateQueries({ queryKey: ['activity', workspaceId] });
                queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
              }
            }

            // Always refresh workspaces list
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });

            // Optimistically clean deleted tasks from memory
            if (parsed.type === 'TASK_DELETED' && (parsed.data?.taskId || parsed.data?.id)) {
              const delId = parsed.data?.taskId || parsed.data?.id;
              queryClient.setQueriesData({ queryKey: ['tasks'] }, (old: any) => {
                if (!Array.isArray(old)) return old;
                return old.filter((t: any) => t.id !== delId);
              });
            }

            const currentUser = userRef.current;
            const notify = addNotificationRef.current;
            const currentUserId = currentUser?.id;
            const ownerMap = new Map(workspacesRef.current.map((w: any) => [w.id, w.ownerId]));
            const ownerId = parsed.workspaceId ? ownerMap.get(parsed.workspaceId) : workspaceOwnerIdRef.current;

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
                const taskAssignees: string[] = [];
                if (parsed.data?.assigneeId) taskAssignees.push(parsed.data.assigneeId);
                if (Array.isArray(parsed.data?.assigneeIds)) taskAssignees.push(...parsed.data.assigneeIds);
                if (parsed.data?.sourceMessageId?.startsWith('meta:')) {
                  try {
                    const m = JSON.parse(parsed.data.sourceMessageId.replace(/^meta:/, ''));
                    if (Array.isArray(m.assigneeIds)) taskAssignees.push(...m.assigneeIds);
                  } catch {}
                }
                const isAssignedToMe = taskAssignees.includes(currentUserId);
                const isUnassignedTask = taskAssignees.length === 0;
                const isOwner = ownerId && ownerId === currentUserId;

                if (isAssignedToMe && actorId !== currentUserId) {
                  notify({
                    type: 'TASK_CREATED',
                    title: 'New Task Assigned',
                    message: `"${taskTitle}" was created and assigned to you`,
                    data: { ...parsed.data, taskId },
                  });
                } else if (isUnassignedTask && actorId !== currentUserId) {
                  notify({
                    type: 'TASK_CREATED',
                    title: 'New Team Task',
                    message: `"${taskTitle}" was added for the team`,
                    data: { ...parsed.data, taskId },
                  });
                } else if (isOwner && actorId !== currentUserId) {
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
      } catch {
        // Ignore malformed or non-JSON SSE messages.
      }
    }

    connect();

    return () => {
      stopped = true;
      abortController?.abort();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [workspaceId, queryClient, user]);
}
