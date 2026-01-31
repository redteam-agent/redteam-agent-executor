import { useCallback, useRef, useEffect } from 'react'
import { useAgentStore } from '@/stores/agentStore'
import type { AnyAgentEvent, ConnectionStatus } from '@/types'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

interface UseWebSocketOptions {
  sessionId: string
  token: string
  onConnect?: () => void
  onDisconnect?: () => void
}

interface UseWebSocketReturn {
  status: ConnectionStatus
  connect: () => void
  disconnect: () => void
  send: (data: unknown) => void
  abort: () => void
}

// Exponential backoff constants
const INITIAL_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 30000
const BACKOFF_MULTIPLIER = 2

export function useWebSocket({
  sessionId,
  token,
  onConnect,
  onDisconnect,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isIntentionalClose = useRef(false)
  const connectRef = useRef<() => void>(() => {})

  const status = useAgentStore((s) => s.connectionStatus)
  const setConnectionStatus = useAgentStore((s) => s.setConnectionStatus)
  const handleEvent = useAgentStore((s) => s.handleEvent)

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    retryTimeoutRef.current = setTimeout(() => {
      connectRef.current()
      // Increase delay for next retry
      retryDelayRef.current = Math.min(
        retryDelayRef.current * BACKOFF_MULTIPLIER,
        MAX_RETRY_DELAY
      )
    }, retryDelayRef.current)
  }, [])

  const connect = useCallback(() => {
    // Cleanup any existing connection
    cleanup()
    isIntentionalClose.current = false

    setConnectionStatus('connecting')

    const url = `${WS_URL}/ws/agent/${sessionId}?token=${token}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
      retryDelayRef.current = INITIAL_RETRY_DELAY
      onConnect?.()
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
      onDisconnect?.()

      // Auto-reconnect with exponential backoff if not intentional close
      if (!isIntentionalClose.current) {
        setConnectionStatus('reconnecting')
        scheduleReconnect()
      }
    }

    ws.onerror = () => {
      // Error handling is done in onclose
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AnyAgentEvent

        // Handle ping/pong
        if (data.event_type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
        }

        handleEvent(data)
      } catch {
        console.error('Failed to parse WebSocket message:', event.data)
      }
    }
  }, [sessionId, token, setConnectionStatus, handleEvent, onConnect, onDisconnect, cleanup, scheduleReconnect])

  // Keep connectRef up to date
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const disconnect = useCallback(() => {
    isIntentionalClose.current = true
    cleanup()
    setConnectionStatus('disconnected')
  }, [cleanup, setConnectionStatus])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  const abort = useCallback(() => {
    send({ type: 'abort' })
  }, [send])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isIntentionalClose.current = true
      cleanup()
    }
  }, [cleanup])

  return {
    status,
    connect,
    disconnect,
    send,
    abort,
  }
}
