/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Terminal WebSocket Server
 *
 * Provides a WebSocket server for terminal emulation with PTY support.
 * This module creates a WebSocket server that spawns PTY processes
 * and forwards I/O between the terminal client and the process.
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as pty from '@lydell/node-pty';
import type { Server as HttpServer } from 'http';

type IPty = pty.IPty;

/**
 * Terminal session information
 */
interface TerminalSession {
  pty: IPty;
  socket: WebSocket;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Terminal server configuration
 */
export interface TerminalServerConfig {
  /** HTTP server to attach WebSocket server to */
  server: HttpServer;
  /** WebSocket path (default: '/terminal') */
  path?: string;
  /** Shell to use (default: process.env.SHELL or 'bash') */
  shell?: string;
  /** Initial terminal columns (default: 80) */
  cols?: number;
  /** Initial terminal rows (default: 24) */
  rows?: number;
  /** Environment variables to pass to shell */
  env?: Record<string, string>;
  /** Working directory for shell (default: process.cwd()) */
  cwd?: string;
  /** Maximum sessions per IP (default: 5) */
  maxSessionsPerIp?: number;
  /** Session timeout in ms (default: 30 minutes) */
  sessionTimeout?: number;
}

/**
 * Terminal message types
 */
interface TerminalMessage {
  type: 'input' | 'resize' | 'ping';
  data?: string;
  cols?: number;
  rows?: number;
}

/**
 * Terminal output message
 */
interface TerminalOutput {
  type: 'output' | 'exit' | 'error';
  data?: string;
  code?: number;
}

/**
 * Terminal WebSocket Server
 */
export class TerminalServer {
  private wss: WebSocketServer;
  private sessions: Map<string, TerminalSession> = new Map();
  private ipSessions: Map<string, number> = new Map();
  private config: Required<Omit<TerminalServerConfig, 'server'>> & { server: HttpServer };
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: TerminalServerConfig) {
    this.config = {
      server: config.server,
      path: config.path || '/terminal',
      shell: config.shell || process.env.SHELL || 'bash',
      cols: config.cols || 80,
      rows: config.rows || 24,
      env: config.env || {},
      cwd: config.cwd || process.cwd(),
      maxSessionsPerIp: config.maxSessionsPerIp || 5,
      sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30 minutes
    };

    this.wss = new WebSocketServer({ server: this.config.server, path: this.config.path });
    this.setupHandlers();
    this.startCleanup();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupHandlers(): void {
    this.wss.on('connection', (socket, request) => {
      const clientIp = this.getClientIp(request);

      // Check session limit per IP
      const currentSessions = this.ipSessions.get(clientIp) || 0;
      if (currentSessions >= this.config.maxSessionsPerIp) {
        this.sendError(socket, 'Maximum sessions reached for this IP');
        socket.close();
        return;
      }

      // Create session
      const sessionId = this.createSession(socket);
      this.ipSessions.set(clientIp, currentSessions + 1);

      console.log(`[Terminal] New session ${sessionId} from ${clientIp}`);

      // Handle messages
      socket.on('message', (data: Buffer) => {
        this.handleMessage(sessionId, data);
      });

      // Handle close
      socket.on('close', () => {
        this.closeSession(sessionId);
        const sessions = this.ipSessions.get(clientIp) || 1;
        this.ipSessions.set(clientIp, sessions - 1);
        console.log(`[Terminal] Session ${sessionId} closed`);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`[Terminal] Session ${sessionId} error:`, error.message);
        this.closeSession(sessionId);
      });
    });

    this.wss.on('error', (error) => {
      console.error('[Terminal] Server error:', error.message);
    });
  }

  /**
   * Create a new terminal session
   */
  private createSession(socket: WebSocket): string {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Spawn PTY process
    const ptyProcess = pty.spawn(this.config.shell, [], {
      name: 'xterm-256color',
      cols: this.config.cols,
      rows: this.config.rows,
      cwd: this.config.cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        ...this.config.env,
      } as Record<string, string>,
    });

    // Store session
    const session: TerminalSession = {
      pty: ptyProcess,
      socket,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    this.sessions.set(sessionId, session);

    // Handle PTY output
    ptyProcess.onData((data: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        const output: TerminalOutput = { type: 'output', data };
        socket.send(JSON.stringify(output));
        session.lastActivity = new Date();
      }
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      if (socket.readyState === WebSocket.OPEN) {
        const output: TerminalOutput = { type: 'exit', code: exitCode };
        socket.send(JSON.stringify(output));
        socket.close();
      }
      this.sessions.delete(sessionId);
    });

    return sessionId;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(sessionId: string, data: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message: TerminalMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'input':
          if (message.data) {
            session.pty.write(message.data);
            session.lastActivity = new Date();
          }
          break;

        case 'resize':
          if (message.cols && message.rows) {
            session.pty.resize(message.cols, message.rows);
          }
          break;

        case 'ping':
          // Respond with pong to keep connection alive
          if (session.socket.readyState === WebSocket.OPEN) {
            session.socket.send(JSON.stringify({ type: 'pong' }));
          }
          break;
      }
    } catch (error) {
      console.error(`[Terminal] Failed to parse message:`, error);
    }
  }

  /**
   * Close a terminal session
   */
  private closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.pty.kill();
      } catch {
        // PTY might already be dead
      }
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Send error message to client
   */
  private sendError(socket: WebSocket, message: string): void {
    if (socket.readyState === WebSocket.OPEN) {
      const output: TerminalOutput = { type: 'error', data: message };
      socket.send(JSON.stringify(output));
    }
  }

  /**
   * Get client IP from request
   */
  private getClientIp(request: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }
    return request.socket.remoteAddress || 'unknown';
  }

  /**
   * Start cleanup interval for inactive sessions
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions) {
        const inactiveTime = now - session.lastActivity.getTime();
        if (inactiveTime > this.config.sessionTimeout) {
          console.log(`[Terminal] Closing inactive session ${sessionId}`);
          this.closeSession(sessionId);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Get server statistics
   */
  getStats(): { activeSessions: number; sessions: Array<{ id: string; createdAt: Date; lastActivity: Date }> } {
    return {
      activeSessions: this.sessions.size,
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
      })),
    };
  }

  /**
   * Close all sessions and stop server
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }

    this.wss.close();
  }
}

/**
 * Create terminal server instance
 */
export function createTerminalServer(config: TerminalServerConfig): TerminalServer {
  return new TerminalServer(config);
}
