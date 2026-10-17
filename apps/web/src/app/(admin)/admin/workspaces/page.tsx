'use client';

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Search,
  Users,
  CheckSquare,
  FolderKanban,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Check,
} from 'lucide-react';
import { adminClient, AdminWorkspaceItem } from '../../../../lib/admin-client';

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

  const fetchWorkspaces = async () => {
    setIsLoading(true);
    try {
      const res = await adminClient.getWorkspaces({
        page,
        limit: 20,
        search: search.trim() || undefined,
      });

      if (res.data) {
        setWorkspaces(res.data.items);
        setTotal(res.data.meta.total);
        setTotalPages(res.data.meta.totalPages || 1);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchWorkspaces();
  };

  const handlePlanChange = async (workspaceId: string, newPlan: string) => {
    setUpdatingId(workspaceId);
    setUpdateFeedback(null);

    try {
      const res = await adminClient.updateWorkspacePlan(workspaceId, newPlan);
      if (res.data?.success || !res.error) {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === workspaceId ? { ...w, planCode: newPlan } : w))
        );
        setUpdateFeedback(`Workspace plan updated to ${newPlan}`);
        setTimeout(() => setUpdateFeedback(null), 3000);
      } else {
        alert(res.error || 'Failed to update plan');
      }
    } catch (err: any) {
      alert(err.message || 'Plan update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Workspaces & Telegram Groups
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor client workspaces, Telegram chat links, and override subscription tiers directly.
          </p>
        </div>

        <button
          onClick={fetchWorkspaces}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Notification */}
      {updateFeedback && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 text-blue-600" />
          <span>{updateFeedback}</span>
        </div>
      )}

      {/* 2. Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workspace title or slug..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        <div className="text-xs font-semibold text-slate-500">
          Showing {workspaces.length} of {total} workspaces
        </div>
      </div>

      {/* 3. Workspaces Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-xs font-semibold">Loading workspaces...</span>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-20 text-slate-400 space-y-2">
            <Briefcase className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              No workspaces found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">Workspace / Owner</th>
                  <th className="py-3.5 px-4">Telegram Group</th>
                  <th className="py-3.5 px-4">Members</th>
                  <th className="py-3.5 px-4">Tasks</th>
                  <th className="py-3.5 px-4">Projects</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4 text-right">Plan Tier & Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {workspaces.map((w) => {
                  const isUpdating = updatingId === w.id;

                  return (
                    <tr
                      key={w.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Workspace & Owner */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {w.name}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span>Owner: {w.ownerName}</span>
                          {w.ownerTelegram && (
                            <span className="text-blue-600 dark:text-blue-400 font-mono">
                              ({w.ownerTelegram})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Connected Telegram Group */}
                      <td className="py-3.5 px-4">
                        {w.telegramGroupTitle ? (
                          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
                            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[150px]">{w.telegramGroupTitle}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No group linked</span>
                        )}
                      </td>

                      {/* Members */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{w.membersCount}</span>
                        </div>
                      </td>

                      {/* Tasks */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                          <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                          <span>{w.tasksCount}</span>
                        </div>
                      </td>

                      {/* Projects */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                          <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
                          <span>{w.projectsCount}</span>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {w.type}
                        </span>
                      </td>

                      {/* Plan Tier Override Dropdown */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {isUpdating && <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />}
                          <select
                            disabled={isUpdating}
                            value={w.planCode}
                            onChange={(e) => handlePlanChange(w.id, e.target.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              w.planCode === 'TEAM'
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                : w.planCode === 'PRO'
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : w.planCode === 'ENTERPRISE'
                                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <option value="FREE">FREE</option>
                            <option value="PRO">PRO (199 ETB)</option>
                            <option value="TEAM">TEAM (999 ETB)</option>
                            <option value="BUSINESS">BUSINESS</option>
                            <option value="ENTERPRISE">ENTERPRISE</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
