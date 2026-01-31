import type { Session, SessionCreate, AgentRun, RunCreate } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  data: { error: { code: string; message: string } }

  constructor(
    status: number,
    data: { error: { code: string; message: string } }
  ) {
    super(data.error.message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export interface Document {
  id: string
  session_id: string
  filename: string
  type: string
  size_bytes: number
  uploaded_at: string
}

class ApiClient {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
  }

  clearToken() {
    this.token = null
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    if (import.meta.env.DEV) {
      console.log(`[API] ${method} ${path}`)
    }

    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: { code: 'UNKNOWN', message: response.statusText } }
      }
      throw new ApiError(response.status, errorData)
    }

    return response.json()
  }

  // Sessions
  async createSession(data: SessionCreate): Promise<Session> {
    return this.request('POST', '/api/v1/sessions', data)
  }

  async getSession(id: string): Promise<Session> {
    return this.request('GET', `/api/v1/sessions/${id}`)
  }

  async listSessions(): Promise<Session[]> {
    return this.request('GET', '/api/v1/sessions')
  }

  // Runs
  async startRun(sessionId: string, data: RunCreate): Promise<AgentRun> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/runs`, data)
  }

  async getRun(id: string): Promise<AgentRun> {
    return this.request('GET', `/api/v1/runs/${id}`)
  }

  async abortRun(id: string): Promise<void> {
    return this.request('POST', `/api/v1/runs/${id}/abort`)
  }

  async listRuns(sessionId: string): Promise<AgentRun[]> {
    return this.request('GET', `/api/v1/sessions/${sessionId}/runs`)
  }

  // Documents
  async uploadDocument(
    sessionId: string,
    file: File,
    type: string
  ): Promise<Document> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    if (import.meta.env.DEV) {
      console.log(`[API] POST /api/v1/sessions/${sessionId}/documents (file: ${file.name})`)
    }

    const response = await fetch(
      `${API_URL}/api/v1/sessions/${sessionId}/documents`,
      {
        method: 'POST',
        headers,
        body: formData,
      }
    )

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: { code: 'UNKNOWN', message: response.statusText } }
      }
      throw new ApiError(response.status, errorData)
    }

    return response.json()
  }

  async listDocuments(sessionId: string): Promise<Document[]> {
    return this.request('GET', `/api/v1/sessions/${sessionId}/documents`)
  }

  async deleteDocument(sessionId: string, documentId: string): Promise<void> {
    return this.request('DELETE', `/api/v1/sessions/${sessionId}/documents/${documentId}`)
  }

  // Health
  async health(): Promise<{ status: string; version: string }> {
    return this.request('GET', '/api/v1/health')
  }
}

export const api = new ApiClient()
