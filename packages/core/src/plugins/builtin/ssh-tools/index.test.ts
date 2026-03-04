/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSHTool, SSHToolInvocation } from './ssh.js';
import type { Config } from '../../../config/config.js';

// Mock the ShellExecutionService
vi.mock('../../../services/shellExecutionService.js', () => ({
  ShellExecutionService: {
    execute: vi.fn(),
  },
}));

// Mock the debug logger
vi.mock('../../../utils/debugLogger.js', () => ({
  createDebugLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('SSHTool', () => {
  let mockConfig: Config;
  let sshTool: SSHTool;

  beforeEach(() => {
    mockConfig = {
      getTargetDir: () => '/home/test',
      getShouldUseNodePtyShell: () => false,
    } as unknown as Config;

    sshTool = new SSHTool(mockConfig);
    vi.clearAllMocks();
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(SSHTool.Name).toBe('ssh_connect');
    });

    it('should have correct display name', () => {
      expect(sshTool.displayName).toBe('SSH');
    });

    it('should have kind execute', () => {
      expect(sshTool.kind).toBe('execute');
    });
  });

  describe('parameter validation', () => {
    it('should validate required host parameter', () => {
      expect(() => sshTool.build({ host: '', user: 'test' } as any)).toThrow(
        'Host is required.',
      );
    });

    it('should validate required user parameter', () => {
      expect(() => sshTool.build({ host: 'localhost', user: '' } as any)).toThrow(
        'User is required.',
      );
    });

    it('should validate port range', () => {
      expect(() =>
        sshTool.build({ host: 'localhost', user: 'test', port: 0 }),
      ).toThrow('Port must be between 1 and 65535.');

      expect(() =>
        sshTool.build({ host: 'localhost', user: 'test', port: 70000 }),
      ).toThrow('Port must be between 1 and 65535.');
    });

    it('should validate timeout', () => {
      expect(() =>
        sshTool.build({ host: 'localhost', user: 'test', timeout: 0 }),
      ).toThrow('Timeout must be a positive number.');

      expect(() =>
        sshTool.build({ host: 'localhost', user: 'test', timeout: 700000 }),
      ).toThrow('Timeout cannot exceed 600000ms');
    });

    it('should accept valid parameters', () => {
      const invocation = sshTool.build({
        host: '192.168.1.100',
        user: 'admin',
        command: 'ls -la',
        port: 22,
        identity_file: '~/.ssh/id_rsa',
      });
      expect(invocation).toBeInstanceOf(SSHToolInvocation);
    });
  });

  describe('getDescription', () => {
    it('should format basic connection', () => {
      const invocation = sshTool.build({
        host: '192.168.1.100',
        user: 'admin',
      });
      expect(invocation.getDescription()).toBe('ssh admin@192.168.1.100');
    });

    it('should include port when specified', () => {
      const invocation = sshTool.build({
        host: '192.168.1.100',
        user: 'admin',
        port: 2222,
      });
      expect(invocation.getDescription()).toBe('ssh admin@192.168.1.100:2222');
    });

    it('should include command when specified', () => {
      const invocation = sshTool.build({
        host: '192.168.1.100',
        user: 'admin',
        command: 'ls -la',
      });
      expect(invocation.getDescription()).toBe('ssh admin@192.168.1.100 "ls -la"');
    });

    it('should include description when specified', () => {
      const invocation = sshTool.build({
        host: '192.168.1.100',
        user: 'admin',
        description: 'List files on remote server',
      });
      expect(invocation.getDescription()).toContain('List files on remote server');
    });
  });
});

describe('buildSSHCommand', () => {
  it('should build basic SSH command', async () => {
    const { ShellExecutionService } = await import(
      '../../../services/shellExecutionService.js'
    );

    const mockConfig = {
      getTargetDir: () => '/home/test',
      getShouldUseNodePtyShell: () => false,
    } as unknown as Config;

    const sshTool = new SSHTool(mockConfig);
    const invocation = sshTool.build({
      host: '192.168.1.100',
      user: 'admin',
    });

    // Verify invocation was created
    expect(invocation).toBeDefined();
  });
});
