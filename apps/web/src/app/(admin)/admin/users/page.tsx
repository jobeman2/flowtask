'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  CheckCircle,
  Briefcase,
  CheckSquare,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { adminClient, AdminUserItem } from '../../../../lib/admin-client';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await adminClient.getUsers({
        page,
        limit: 20,
        search: search.trim() || undefined,
      });

      if (res.data) {
        setUsers(res.data.items);
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
    fetchUsers();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleToggleRole = async (user: AdminUserItem) => {
    const newStatus = !user.isSuperAdmin;
    const confirmMsg = newStatus
      ? `Promote ${user.name} to Super Admin? They will have full access to this platform management console.`
      : `Demote ${user.name}? They will lose Super Admin platform privileges.`;
    if (!confirm(confirmMsg)) return;

    setUpdatingUserId(user.id);
    try {
      const res = await adminClient.toggleUserRole(user.id, newStatus);
      if (res.data?.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isSuperAdmin: newStatus } : u))
        );
      }
    } catch {
      // Ignore
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Registered Users Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Total of {total.toLocaleString()} users onboarded across Telegram Mini App and desktop.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh List</span>
        </button>
      </div>

      {/* 2. Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, @handle, or Telegram ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        <div className="text-xs font-semibold text-slate-500">
          Showing {users.length} of {total} users
        </div>
      </div>

      {/* 3. Users Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-xs font-semibold">Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              No users found matching query
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Telegram Account</th>
                  <th className="py-3.5 px-4">Workspaces</th>
                  <th className="py-3.5 px-4">Tasks Created</th>
                  <th className="py-3.5 px-4">Joined Date</th>
                  <th className="py-3.5 px-4 text-right">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* User */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{u.name?.[0]?.toUpperCase() || 'U'}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {u.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {u.email || 'No email attached'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Telegram */}
                    <td className="py-3.5 px-4">
                      {u.telegramUsername ? (
                        <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {u.telegramUsername}
                        </div>
                      ) : (
                        <div className="text-slate-400 italic">No @handle</div>
                      )}
                      {u.telegramId && (
                        <div className="text-[10px] font-mono text-slate-400">
                          ID: {u.telegramId}
                        </div>
                      )}
                    </td>

                    {/* Workspaces Count */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.workspacesCount}</span>
                      </div>
                    </td>

                    {/* Tasks Created */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                        <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.tasksCreatedCount}</span>
                      </div>
                    </td>

                    {/* Joined Date */}
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Role & Toggle */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {u.isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Super Admin</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">
                            Member
                          </span>
                        )}

                        <button
                          type="button"
                          disabled={updatingUserId === u.id}
                          onClick={() => handleToggleRole(u)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                            u.isSuperAdmin
                              ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900'
                              : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900'
                          }`}
                        >
                          {updatingUserId === u.id
                            ? '...'
                            : u.isSuperAdmin
                            ? 'Demote'
                            : 'Promote'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
