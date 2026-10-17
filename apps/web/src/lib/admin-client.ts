const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

export interface AdminMetrics {
  users: {
    total: number;
    todaySignups: number;
    weeklySignups: number;
    monthlySignups: number;
  };
  workspaces: {
    total: number;
    connectedTelegramGroups: number;
  };
  tasks: {
    total: number;
    completed: number;
    completionRate: string;
  };
  financials: {
    totalRevenueEtb: number;
    pendingReceiptsCount: number;
    paidSubscribers: number;
    verifiedOrdersCount: number;
    proSubscriptions: number;
    teamSubscriptions: number;
  };
}

export interface PaymentReceiptItem {
  id: string;
  orderCode: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  currentWorkspacePlan: string;
  userId: string;
  userName: string;
  userEmail?: string;
  telegramUsername?: string | null;
  telegramId?: string | null;
  planCode: string;
  amountEtb: number;
  durationDays: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CANCELLED';
  paymentMethod: string;
  telebirrPhone?: string;
  payerName?: string;
  transactionId?: string;
  receiptImageUrl?: string;
  adminNotes?: string | null;
  reviewedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface AdminUserItem {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  telegramId?: string | null;
  telegramUsername?: string | null;
  isSuperAdmin: boolean;
  workspacesCount: number;
  tasksCreatedCount: number;
  createdAt: string;
}

export interface AdminWorkspaceItem {
  id: string;
  name: string;
  slug: string;
  type: string;
  planCode: string;
  ownerName: string;
  ownerTelegram?: string | null;
  membersCount: number;
  tasksCount: number;
  projectsCount: number;
  telegramGroupTitle?: string | null;
  telegramGroupId?: string | null;
  subscriptionStatus: string;
  createdAt: string;
}

export interface AdminAnalytics {
  growthTrend: Array<{ date: string; users: number; revenueEtb: number }>;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  topWorkspaces: Array<{
    id: string;
    name: string;
    slug: string;
    planCode: string;
    membersCount: number;
    tasksCount: number;
    telegramGroup: string | null;
  }>;
  topCreators: Array<{
    id: string;
    name: string;
    email?: string;
    telegram: string | null;
    tasksCount: number;
  }>;
  systemHealth: {
    status: string;
    uptime: string;
    uptimeSeconds: number;
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    botStatus: string;
    botMode: string;
    connectedTelegramGroupsCount: number;
  };
}

export interface PlatformActivityItem {
  id: string;
  type: 'PAYMENT' | 'USER_SIGNUP' | 'TASK_CREATED';
  title: string;
  description: string;
  timestamp: string;
  badge: string;
  badgeColor: string;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class AdminApiClient {
  private token: string | null = null;

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('flowtask_admin_token');
      if (stored) {
        this.token = stored;
        return stored;
      }
    }
    return null;
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('flowtask_admin_token', token);
      } else {
        localStorage.removeItem('flowtask_admin_token');
      }
    }
  }

  logout() {
    this.setToken(null);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: json.message || `Request failed with status ${response.status}`,
        };
      }

      return { data: json.data !== undefined ? json.data : json };
    } catch (err: any) {
      return { error: err.message || 'Network connection failed' };
    }
  }

  async login(username: string, pass: string) {
    const res = await this.request<{ accessToken: string; user: AdminUser }>(
      '/admin/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password: pass }),
      }
    );

    if (res.data?.accessToken) {
      this.setToken(res.data.accessToken);
    }
    return res;
  }

  async getMe() {
    return this.request<AdminUser>('/admin/auth/me');
  }

  async getMetrics() {
    return this.request<AdminMetrics>('/admin/metrics');
  }

  async getReceipts(params: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.search) query.append('search', params.search);

    return this.request<PaginatedResult<PaymentReceiptItem>>(
      `/admin/receipts?${query.toString()}`
    );
  }

  async approveReceipt(orderId: string, notes?: string) {
    return this.request<{ success: boolean; message: string }>(
      `/admin/receipts/${orderId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }
    );
  }

  async rejectReceipt(orderId: string, notes?: string) {
    return this.request<{ success: boolean; message: string }>(
      `/admin/receipts/${orderId}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }
    );
  }

  async getUsers(params: { page?: number; limit?: number; search?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.search) query.append('search', params.search);

    return this.request<PaginatedResult<AdminUserItem>>(
      `/admin/users?${query.toString()}`
    );
  }

  async getWorkspaces(params: { page?: number; limit?: number; search?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.search) query.append('search', params.search);

    return this.request<PaginatedResult<AdminWorkspaceItem>>(
      `/admin/workspaces?${query.toString()}`
    );
  }

  async updateWorkspacePlan(workspaceId: string, planCode: string) {
    return this.request<{ success: boolean; message: string }>(
      `/admin/workspaces/${workspaceId}/plan`,
      {
        method: 'PATCH',
        body: JSON.stringify({ planCode }),
      }
    );
  }

  async getAnalytics() {
    return this.request<AdminAnalytics>('/admin/analytics');
  }

  async getActivity() {
    return this.request<PlatformActivityItem[]>('/admin/activity');
  }

  async toggleUserRole(userId: string, isSuperAdmin: boolean) {
    return this.request<{ success: boolean; message: string }>(
      `/admin/users/${userId}/role`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isSuperAdmin }),
      }
    );
  }

  async broadcastAnnouncement(message: string, target?: string) {
    return this.request<{ success: boolean; message: string; recipientCount?: number }>(
      '/admin/broadcast',
      {
        method: 'POST',
        body: JSON.stringify({ message, target }),
      }
    );
  }
}

export const adminClient = new AdminApiClient();
