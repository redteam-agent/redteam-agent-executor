import type { AnyAgentEvent, ConnectionStatus } from '@/types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export interface WebSocketConfig {
  sessionId: string;
  token: string;
  onEvent: (event: AnyAgentEvent) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onError?: (error: Event) => void;
}

export class AgentWebSocket {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.config.onStatusChange('connecting');

    const url = `${WS_URL}/ws/agent/${this.config.sessionId}?token=${encodeURIComponent(this.config.token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.config.onStatusChange('connected');
      this.reconnectAttempts = 0;
      this.startPing();
    };

    this.ws.onclose = () => {
      this.config.onStatusChange('disconnected');
      this.stopPing();
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      this.config.onError?.(error);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle ping/pong
        if (data.type === 'ping') {
          this.ws?.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Handle agent events
        if (data.event_type) {
          this.config.onEvent(data as AnyAgentEvent);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };
  }

  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.config.onStatusChange('disconnected');
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  abort(): void {
    this.send({ type: 'abort' });
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.config.onStatusChange('reconnecting');

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export function createWebSocket(config: WebSocketConfig): AgentWebSocket {
  return new AgentWebSocket(config);
}
