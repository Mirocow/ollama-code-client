/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  SdkControlClientTransportOptions,
  SendMcpMessageCallback} from './index.js';
import {
  SdkControlClientTransport
} from './index.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

// Mock debug logger
vi.mock('../utils/debugLogger.js', () => ({
  createDebugLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('SdkControlClientTransport', () => {
  let transport: SdkControlClientTransport;
  let mockSendMcpMessage: SendMcpMessageCallback;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMcpMessage = vi.fn(async () => ({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    }));
    transport = new SdkControlClientTransport({
      serverName: 'test-server',
      sendMcpMessage: mockSendMcpMessage,
    });
  });

  describe('Constructor', () => {
    it('should create transport with server name', () => {
      expect(transport.getServerName()).toBe('test-server');
    });

    it('should not be started by default', () => {
      expect(transport.isStarted()).toBe(false);
    });

    it('should accept debugMode option', () => {
      const transportWithOptions = new SdkControlClientTransport({
        serverName: 'test-server',
        sendMcpMessage: mockSendMcpMessage,
        debugMode: true,
      });
      expect(transportWithOptions).toBeDefined();
    });
  });

  describe('Start', () => {
    it('should mark transport as started', async () => {
      await transport.start();
      expect(transport.isStarted()).toBe(true);
    });

    it('should be idempotent', async () => {
      await transport.start();
      await transport.start(); // Should not throw
      expect(transport.isStarted()).toBe(true);
    });
  });

  describe('Close', () => {
    it('should mark transport as not started', async () => {
      await transport.start();
      await transport.close();
      expect(transport.isStarted()).toBe(false);
    });

    it('should call onclose callback', async () => {
      const onclose = vi.fn();
      transport.onclose = onclose;

      await transport.start();
      await transport.close();

      expect(onclose).toHaveBeenCalled();
    });

    it('should not call onclose if not started', async () => {
      const onclose = vi.fn();
      transport.onclose = onclose;

      await transport.close();

      expect(onclose).not.toHaveBeenCalled();
    });

    it('should be idempotent', async () => {
      await transport.start();
      await transport.close();
      await transport.close(); // Should not throw
      expect(transport.isStarted()).toBe(false);
    });
  });

  describe('Send', () => {
    it('should throw if not started', async () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(transport.send(message)).rejects.toThrow('not started');
    });

    it('should send message and receive response', async () => {
      const response: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      };
      mockSendMcpMessage = vi.fn(async () => response);
      transport = new SdkControlClientTransport({
        serverName: 'test-server',
        sendMcpMessage: mockSendMcpMessage,
      });

      await transport.start();

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      };

      await transport.send(message);

      expect(mockSendMcpMessage).toHaveBeenCalledWith('test-server', message);
    });

    it('should call onmessage callback with response', async () => {
      const response: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        result: { data: 'test' },
      };
      mockSendMcpMessage = vi.fn(async () => response);
      transport = new SdkControlClientTransport({
        serverName: 'test-server',
        sendMcpMessage: mockSendMcpMessage,
      });

      const onmessage = vi.fn();
      transport.onmessage = onmessage;

      await transport.start();

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await transport.send(message);

      expect(onmessage).toHaveBeenCalledWith(response);
    });

    it('should call onerror callback on failure', async () => {
      const error = new Error('Connection failed');
      mockSendMcpMessage = vi.fn(async () => {
        throw error;
      });
      transport = new SdkControlClientTransport({
        serverName: 'test-server',
        sendMcpMessage: mockSendMcpMessage,
      });

      const onerror = vi.fn();
      transport.onerror = onerror;

      await transport.start();

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(transport.send(message)).rejects.toThrow('Connection failed');
      expect(onerror).toHaveBeenCalledWith(error);
    });

    it('should handle non-Error objects in error callback', async () => {
      mockSendMcpMessage = vi.fn(async () => {
        // eslint-disable-next-line no-restricted-syntax -- Testing non-Error throw
        throw 'String error';
      });
      transport = new SdkControlClientTransport({
        serverName: 'test-server',
        sendMcpMessage: mockSendMcpMessage,
      });

      const onerror = vi.fn();
      transport.onerror = onerror;

      await transport.start();

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      await expect(transport.send(message)).rejects.toThrow();
      expect(onerror).toHaveBeenCalled();
      expect(onerror.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('Callbacks', () => {
    it('should allow setting onmessage callback', () => {
      const callback = vi.fn();
      transport.onmessage = callback;
      expect(transport.onmessage).toBe(callback);
    });

    it('should allow setting onerror callback', () => {
      const callback = vi.fn();
      transport.onerror = callback;
      expect(transport.onerror).toBe(callback);
    });

    it('should allow setting onclose callback', () => {
      const callback = vi.fn();
      transport.onclose = callback;
      expect(transport.onclose).toBe(callback);
    });

    it('should handle undefined callbacks', async () => {
      transport.onmessage = undefined;
      transport.onerror = undefined;
      transport.onclose = undefined;

      await transport.start();
      await transport.close();

      // Should not throw
    });
  });

  describe('GetServerName', () => {
    it('should return the server name', () => {
      const transport = new SdkControlClientTransport({
        serverName: 'my-mcp-server',
        sendMcpMessage: mockSendMcpMessage,
      });
      expect(transport.getServerName()).toBe('my-mcp-server');
    });
  });

  describe('IsStarted', () => {
    it('should return false before start', () => {
      expect(transport.isStarted()).toBe(false);
    });

    it('should return true after start', async () => {
      await transport.start();
      expect(transport.isStarted()).toBe(true);
    });

    it('should return false after close', async () => {
      await transport.start();
      await transport.close();
      expect(transport.isStarted()).toBe(false);
    });
  });
});

describe('SdkControlClientTransportOptions', () => {
  it('should have required serverName property', () => {
    const options: SdkControlClientTransportOptions = {
      serverName: 'test-server',
      sendMcpMessage: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
    };
    expect(options.serverName).toBe('test-server');
  });

  it('should have required sendMcpMessage callback', () => {
    const callback: SendMcpMessageCallback = async (name, message) => ({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    });
    const options: SdkControlClientTransportOptions = {
      serverName: 'test-server',
      sendMcpMessage: callback,
    };
    expect(options.sendMcpMessage).toBeDefined();
  });

  it('should have optional debugMode property', () => {
    const options: SdkControlClientTransportOptions = {
      serverName: 'test-server',
      sendMcpMessage: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
      debugMode: true,
    };
    expect(options.debugMode).toBe(true);
  });
});
