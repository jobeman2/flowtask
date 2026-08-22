'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../providers/telegram-provider';
import { Layers } from 'lucide-react';

export function WorkspaceSwitcher() {
  const { workspaceId, setWorkspaceId } = useAuth();

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiClient.getWorkspaces();
      return res.data || [];
    },
  });

  return (
    <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg">
      <Layers className="w-4 h-4 text-blue-500" />
      <select
        value={workspaceId || ''}
        onChange={(e) => setWorkspaceId(e.target.value)}
        className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
      >
        {workspaces.map((ws: any) => (
          <option key={ws.id} value={ws.id} className="bg-white dark:bg-slate-900">
            {ws.name} ({ws.role})
          </option>
        ))}
      </select>
    </div>
  );
}
