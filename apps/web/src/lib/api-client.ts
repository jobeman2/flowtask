const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';


class ApiClient {
  private token: string | null = null;
  private currentWorkspaceId: string | null = null;

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('flowtask_auth_token');
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
      if (token) localStorage.setItem('flowtask_auth_token', token);
      else localStorage.removeItem('flowtask_auth_token');
    }
  }

  getWorkspaceId(): string | null {
    if (this.currentWorkspaceId) return this.currentWorkspaceId;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('flowtask_active_ws');
      if (stored) {
        this.currentWorkspaceId = stored;
        return stored;
      }
    }
    return null;
  }

  setWorkspaceId(id: string | null) {
    this.currentWorkspaceId = id;
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('flowtask_active_ws', id);
      else localStorage.removeItem('flowtask_active_ws');
    }
  }

  getLiveStreamUrl(workspaceId?: string): string {
    const base = API_URL;
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return `${base}/tasks/live-stream${query}`;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; error?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const activeToken = this.getToken();
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const activeWsId = this.getWorkspaceId();
    if (activeWsId) {
      headers['x-workspace-id'] = activeWsId;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const json = await response.json();

      if (!response.ok) {
        return { data: null as any, error: json.message || 'Request failed' };
      }

      return { data: json.data !== undefined ? json.data : json };
    } catch (error: any) {
      return { data: null as any, error: error.message || 'Network error' };
    }
  }

  async authWithTelegram(initData: string) {
    return this.request<{ accessToken: string; user: any; defaultWorkspaceId?: string; subscription?: any }>(
      '/auth/telegram',
      {
        method: 'POST',
        body: JSON.stringify({ initData }),
      }
    );
  }

  async getWorkspaces() {
    return this.request<any[]>('/workspaces');
  }

  async createWorkspace(name: string, type: string = 'TEAM') {
    return this.request<any>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    });
  }

  async getWorkspaceMembers(workspaceId: string) {
    return this.request<any[]>(`/workspaces/${workspaceId}/members`);
  }

  async inviteWorkspaceMember(
    workspaceId: string,
    data: { username?: string; email?: string; name?: string; role?: string }
  ) {
    return this.request<any>(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeWorkspaceMember(workspaceId: string, memberId: string) {
    return this.request<any>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async syncTelegramGroup(workspaceId: string) {
    return this.request<{
      success: boolean;
      message: string;
      groupTitle: string;
      memberCount: number;
      imported: any[];
    }>(`/workspaces/${workspaceId}/sync-telegram-group`, {
      method: 'POST',
    });
  }

  async connectTelegramGroup(chatIdOrUsername: string) {
    return this.request<{
      workspaceId: string;
      telegramChat: any;
      syncResult: any;
    }>('/workspaces/connect-telegram-group', {
      method: 'POST',
      body: JSON.stringify({ chatIdOrUsername }),
    });
  }

  async getTaskStats(workspaceId: string) {
    return this.request<{
      totalActive: number;
      completed: number;
      overdue: number;
      dueToday: number;
      upcoming: number;
      totalTasks: number;
      byPriority: Record<string, number>;
      byStatus: Record<string, number>;
      projectsCount: number;
      projectsSummary: Array<{ id: string; name: string; color: string; taskCount: number }>;
    }>(`/tasks/stats/summary?workspaceId=${workspaceId}`);
  }

  async getTasks(workspaceId: string, params: Record<string, any> = {}) {
    const query = new URLSearchParams({ workspaceId });
    if (params.status) query.append('status', params.status);
    if (params.projectId) query.append('projectId', params.projectId);
    if (params.assigneeId) query.append('assigneeId', params.assigneeId);
    if (params.search) query.append('search', params.search);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);
    return this.request<any[]>(`/tasks?${query.toString()}`);
  }

  async getTaskById(taskId: string, workspaceId: string) {
    return this.request<any>(`/tasks/${taskId}?workspaceId=${workspaceId}`);
  }

  async createTask(data: any) {
    return this.request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(taskId: string, workspaceId: string, data: any) {
    return this.request<any>(`/tasks/${taskId}?workspaceId=${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async completeTask(taskId: string, workspaceId: string) {
    return this.request<any>(`/tasks/${taskId}/complete?workspaceId=${workspaceId}`, {
      method: 'POST',
    });
  }

  async deleteTask(taskId: string, workspaceId: string) {
    return this.request<any>(`/tasks/${taskId}?workspaceId=${workspaceId}`, {
      method: 'DELETE',
    });
  }

  async getProjects(workspaceId: string) {
    return this.request<any[]>(`/projects?workspaceId=${workspaceId}`);
  }

  async createProject(workspaceId: string, data: { name: string; description?: string; color?: string }) {
    return this.request<any>('/projects', {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId }),
    });
  }

  async getLabels(workspaceId: string) {
    return this.request<any[]>(`/labels?workspaceId=${workspaceId}`);
  }

  async createLabel(workspaceId: string, data: { name: string; color?: string }) {
    return this.request<any>('/labels', {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId }),
    });
  }

  async getComments(taskId: string, workspaceId: string) {
    return this.request<any[]>(`/tasks/${taskId}/comments?workspaceId=${workspaceId}`);
  }

  async addComment(taskId: string, workspaceId: string, content: string) {
    return this.request<any>(`/tasks/${taskId}/comments?workspaceId=${workspaceId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async getActivity(workspaceId: string) {
    return this.request<any[]>(`/activity?workspaceId=${workspaceId}`);
  }

  // Billing & Telebirr endpoints
  async getPlans() {
    return this.request<any[]>('/billing/plans');
  }

  async getWorkspaceSubscription(workspaceId: string) {
    return this.request<any>(`/billing/workspace/${workspaceId}`);
  }

  async createPaymentOrder(data: { workspaceId: string; planCode: string; durationDays?: number }) {
    return this.request<any>('/billing/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyPaymentOrder(data: { orderId: string; transactionId: string; receiptImageUrl?: string }) {
    return this.request<any>('/billing/verify-order', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();
