/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Custom Next.js Server with WebSocket Support
 *
 * This server extends the default Next.js server to add WebSocket support
 * for terminal emulation and real-time features.
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { createTerminalServer } from './src/server/terminalServer';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  try {
    await app.prepare();

    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    // Create terminal WebSocket server
    const terminalServer = createTerminalServer({
      server,
      path: '/terminal',
      shell: process.env.SHELL || 'bash',
      cwd: process.env.PROJECT_DIR || process.cwd(),
    });

    // Handle server upgrade for WebSocket
    server.on('upgrade', (req, _socket, _head) => {
      const { pathname } = parse(req.url!, true);

      // Terminal WebSocket is handled by TerminalServer
      // This is just for logging
      if (pathname === '/terminal') {
        console.log('[Server] Terminal WebSocket connection upgrade');
      }
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('\n[Server] Shutting down...');

      terminalServer.close();

      server.close(() => {
        console.log('[Server] HTTP server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('[Server] Forced shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Start server
    server.listen(port, hostname, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Ollama Code Web UI                        ║
╠══════════════════════════════════════════════════════════════╣
║  Server:  http://${hostname}:${port}                           ║
║  Terminal: ws://${hostname}:${port}/terminal                   ║
║  Mode:    ${dev ? 'Development' : 'Production'}                                      ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

    // Log terminal server stats periodically in dev mode
    if (dev) {
      setInterval(() => {
        const stats = terminalServer.getStats();
        if (stats.activeSessions > 0) {
          console.log(`[Terminal] Active sessions: ${stats.activeSessions}`);
        }
      }, 60000);
    }
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
