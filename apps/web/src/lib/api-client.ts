const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

class ApiClient {
  private token: string | null = null;
  private currentWorkspaceId: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  setWorkspaceId(id: string | null) {
    this.currentWorkspaceId = id;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; error?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.currentWorkspaceId) {
      headers['x-workspace-id'] = this.currentWorkspaceId;
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
    return this.request<{ accessToken: string; user: any; defaultWorkspaceId?: string }>(
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

  async getTasks(workspaceId: string) {
    return this.request<any[]>(`/tasks?workspaceId=${workspaceId}`);
  }

  async createTask(data: any) {
    return this.request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async completeTask(taskId: string, workspaceId: string) {
    return this.request<any>(`/tasks/${taskId}/complete?workspaceId=${workspaceId}`, {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient();
