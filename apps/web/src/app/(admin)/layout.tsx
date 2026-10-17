'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Users,
  Briefcase,
  ShieldCheck,
  LogOut,
  Bell,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { adminClient, AdminUser } from '../../lib/admin-client';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [pendingReceipts, setPendingReceipts] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const isLoginPage = pathname === '/admin/login';

  const checkAuth = async () => {
    const token = adminClient.getToken();
    if (!token) {
      if (!isLoginPage) {
        router.push('/admin/login');
      }
      setIsLoading(false);
      return;
    }

    try {
      const res = await adminClient.getMe();
      if (res.data) {
        setAdminUser(res.data);
        // Also fetch pending receipts count for badge
        const metricsRes = await adminClient.getMetrics();
        if (metricsRes.data?.financials?.pendingReceiptsCount !== undefined) {
          setPendingReceipts(metricsRes.data.financials.pendingReceiptsCount);
        }
      } else {
        adminClient.logout();
        if (!isLoginPage) router.push('/admin/login');
      }
    } catch {
      adminClient.logout();
      if (!isLoginPage) router.push('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoginPage) {
      checkAuth();
    } else {
      setIsLoading(false);
    }
  }, [pathname, isLoginPage]);

  const handleLogout = () => {
    adminClient.logout();
    router.push('/admin/login');
  };

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950">{children}</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Loading Super Admin Portal...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      label: 'Overview',
      href: '/admin',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: 'Receipt Review',
      href: '/admin/receipts',
      icon: Receipt,
      badge: pendingReceipts > 0 ? pendingReceipts : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      label: 'Users Directory',
      href: '/admin/users',
      icon: Users,
      badge: null,
    },
    {
      label: 'Workspaces & Groups',
      href: '/admin/workspaces',
      icon: Briefcase,
      badge: null,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row text-slate-800 dark:text-slate-100 font-sans">
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-black text-lg">
              F
            </div>
            <div>
              <div className="font-bold text-base tracking-tight flex items-center gap-1.5">
                FlowTask
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Super Platform Control</p>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Platform Management
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span
                    className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white text-blue-700' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Admin User info & logout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">
                  {adminUser?.name || 'Super Admin'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {adminUser?.email || 'admin@flowtask.app'}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <Link
            href="/"
            target="_blank"
            className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900 transition-colors"
          >
            <span>Open Mobile App View</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </aside>

      {/* 2. Main Desktop Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Admin</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-semibold text-slate-800 dark:text-slate-100 capitalize">
              {pathname === '/admin' ? 'Dashboard Overview' : pathname.replace('/admin/', '').replace('-', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {pendingReceipts > 0 && (
              <Link
                href="/admin/receipts"
                className="flex items-center gap-1.5 text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{pendingReceipts} Pending Bank Receipts</span>
              </Link>
            )}

            <button
              onClick={() => checkAuth()}
              title="Refresh Data"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Children */}
        <main className="p-6 md:p-8 flex-1">{children}</main>
      </div>
    </div>
  );
}
