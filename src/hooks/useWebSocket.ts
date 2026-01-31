/**
 * WebSocket hook for real-time agent event streaming.
 *
 * Manages connection to the API WebSocket endpoint and dispatches
 * events to the agent store.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgentStore } from '../stores/agentStore';
import type { AnyAgentEvent, ConnectionStatus } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

interface UseWebSocketOptions {
  sessionId: string;
  token: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { sessionId, token, onConnect, onDisconnect, onError } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const { setConnectionStatus, handleEvent } = useAgentStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('connecting');
    setConnectionStatus('connecting');

    const url = `${WS_URL}/ws/agent/${sessionId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus('connected');
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
      onConnect?.();
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setConnectionStatus('disconnected');
      onDisconnect?.();

      // Attempt reconnection with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current += 1;

      setStatus('reconnecting');
      setConnectionStatus('reconnecting');

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      onError?.(error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AnyAgentEvent | { type: string };

        // Handle ping/pong
        if ('type' in data && data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Handle agent events
        if ('event_type' in data) {
          handleEvent(data as AnyAgentEvent);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    wsRef.current = ws;
  }, [sessionId, token, onConnect, onDisconnect, onError, setConnectionStatus, handleEvent]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('disconnected');
    setConnectionStatus('disconnected');
  }, [setConnectionStatus]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const abort = useCallback(() => {
    send({ type: 'abort' });
  }, [send]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    connect,
    disconnect,
    send,
    abort,
    isConnected: status === 'connected',
  };
}
