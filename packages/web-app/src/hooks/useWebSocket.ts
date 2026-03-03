/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * WebSocket hook for real-time streaming from Ollama.
 *
 * @module hooks/useWebSocket
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * WebSocket message types
 */
export type WSMessageType =
  | 'chat'
  | 'generate'
  | 'embed'
  | 'pull'
  | 'push'
  | 'create'
  | 'delete';

/**
 * WebSocket request
 */
export interface WSRequest {
  type: WSMessageType;
  id: string;
  payload: Record<string, unknown>;
}

/**
 * WebSocket response chunk
 */
export interface WSResponseChunk {
  id: string;
  type: 'start' | 'chunk' | 'done' | 'error';
  content?: string;
  thinking?: string;
  done?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * WebSocket hook options
 */
export interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  onMessage?: (chunk: WSResponseChunk) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * WebSocket hook return type
 */
export interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  send: (request: WSRequest) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * WebSocket hook for real-time streaming.
 *
 * @param options - WebSocket configuration options
 * @returns WebSocket state and control functions
 *
 * @example
 * ```tsx
 * import { useWebSocket } from '@/hooks/useWebSocket';
 *
 * function ChatComponent() {
 *   const { isConnected, send, error } = useWebSocket({
 *     url: 'ws://localhost:11434/api/ws',
 *     onMessage: (chunk) => {
 *       if (chunk.type === 'chunk') {
 *         setContent(prev => prev + chunk.content);
 *       }
 *     }
 *   });
 *
 *   const handleSend = () => {
 *     send({
 *       type: 'chat',
 *       id: 'msg-1',
 *       payload: { model: 'llama3.2', messages: [...] }
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       {error && <span>Error: {error.message}</span>}
 *       <button onClick={handleSend} disabled={!isConnected}>Send</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    onMessage,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMessagesRef = useRef<WSRequest[]>([]);

  /**
   * Clear reconnect timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectCountRef.current = 0;

        // Send pending messages
        while (pendingMessagesRef.current.length > 0) {
          const msg = pendingMessagesRef.current.shift();
          if (msg) {
            ws.send(JSON.stringify(msg));
          }
        }

        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const chunk: WSResponseChunk = JSON.parse(event.data);
          onMessage?.(chunk);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = (_event) => {
        const err = new Error('WebSocket error');
        setError(err);
        onError?.(err);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        onDisconnect?.();

        // Auto reconnect
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          clearReconnectTimeout();
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * Math.pow(2, reconnectCountRef.current - 1));
        }
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to connect');
      setError(err);
      setIsConnecting(false);
      onError?.(err);
    }
  }, [
    url,
    isConnecting,
    reconnectAttempts,
    reconnectDelay,
    onMessage,
    onError,
    onConnect,
    onDisconnect,
    clearReconnectTimeout,
  ]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectCountRef.current = reconnectAttempts; // Prevent auto reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
  }, [clearReconnectTimeout, reconnectAttempts]);

  /**
   * Send a request through WebSocket
   */
  const send = useCallback(
    (request: WSRequest) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(request));
      } else {
        // Queue message for when connected
        pendingMessagesRef.current.push(request);
        if (!isConnecting) {
          connect();
        }
      }
    },
    [isConnecting, connect]
  );

  // Auto connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    send,
    connect,
    disconnect,
  };
}

export default useWebSocket;
