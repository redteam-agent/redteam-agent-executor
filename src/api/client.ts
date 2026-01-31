import type {
  Session,
  AgentRun,
  Document,
  AppDetails,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: { error: { code: string; message: string } }
  ) {
    super(data.error.message);
    this.name = 'ApiError';
  }
}

interface SessionCreate {
  github_org: string;
  github_repo: string;
  gcp_project_id: string;
  gcp_region: string;
  gcp_service_name: string;
}

interface RunCreate {
  app_name: string;
  app_description: string;
  app_url: string;
  additional_context?: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (import.meta.env.DEV) {
      console.log(`[API] ${method} ${path}`);
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: { code: 'UNKNOWN', message: response.statusText } };
      }
      throw new ApiError(response.status, errorData);
    }

    return response.json();
  }

  // Sessions
  async createSession(data: SessionCreate): Promise<Session> {
    return this.request('POST', '/api/v1/sessions', data);
  }

  async getSession(id: string): Promise<Session> {
    return this.request('GET', `/api/v1/sessions/${id}`);
  }

  // Runs
  async startRun(sessionId: string, data: RunCreate): Promise<AgentRun> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/runs`, data);
  }

  async startRunFromAppDetails(sessionId: string, appDetails: AppDetails): Promise<AgentRun> {
    return this.startRun(sessionId, {
      app_name: appDetails.appName,
      app_description: appDetails.appDescription,
      app_url: appDetails.appUrl,
      additional_context: appDetails.additionalContext,
    });
  }

  async getRun(id: string): Promise<AgentRun> {
    return this.request('GET', `/api/v1/runs/${id}`);
  }

  async getRunSteps(id: string): Promise<{ steps: unknown[] }> {
    return this.request('GET', `/api/v1/runs/${id}/steps`);
  }

  async abortRun(id: string): Promise<{ status: string; message: string }> {
    return this.request('POST', `/api/v1/runs/${id}/abort`);
  }

  // Documents
  async uploadDocument(
    sessionId: string,
    file: File,
    type: string
  ): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(
      `${API_URL}/api/v1/sessions/${sessionId}/documents`,
      {
        method: 'POST',
        headers,
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new ApiError(response.status, errorData);
    }

    return response.json();
  }

  async listDocuments(sessionId: string): Promise<{ documents: Document[] }> {
    return this.request('GET', `/api/v1/sessions/${sessionId}/documents`);
  }
}

export const api = new ApiClient();
