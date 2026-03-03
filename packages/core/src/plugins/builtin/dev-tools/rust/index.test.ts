/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  RustToolParams} from './index.js';
import {
  RustTool,
  RustToolInvocation,
  DEFAULT_RUST_TIMEOUT_MS,
} from './index.js';
import type { Config } from '../../../../config/config.js';

// Mock Config
const mockConfig = {
  getTargetDir: () => '/test/project',
  getWorkspaceContext: () => ({
    getDirectories: () => ['/test/project'],
    isPathWithinWorkspace: () => true,
  }),
  getFileSystemService: () => ({
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
  }),
  getShouldUseNodePtyShell: () => false,
  getDebugMode: () => false,
  getSessionId: () => 'test-session',
} as unknown as Config;

describe('RustTool', () => {
  let tool: RustTool;

  beforeEach(() => {
    tool = new RustTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(RustTool.Name).toBe('rust_dev');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('RustDev');
    });

    it('should have description', () => {
      expect(tool.description).toContain('Rust development tool');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('action');
    });

    it('should have default timeout', () => {
      expect(DEFAULT_RUST_TIMEOUT_MS).toBe(120000);
    });
  });

  describe('Parameter Validation', () => {
    it('should require action parameter', () => {
      const params = {} as RustToolParams;
      const error = tool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid action', () => {
      const params: RustToolParams = {
        action: 'build',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should require crate_name for cargo_new action', () => {
      const params: RustToolParams = {
        action: 'cargo_new',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('crate_name');
    });

    it('should require crate_name for cargo_add action', () => {
      const params: RustToolParams = {
        action: 'cargo_add',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('crate_name');
    });

    it('should require crate_name for cargo_remove action', () => {
      const params: RustToolParams = {
        action: 'cargo_remove',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('crate_name');
    });

    it('should require crate_name for cargo_install action', () => {
      const params: RustToolParams = {
        action: 'cargo_install',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('crate_name');
    });

    it('should require crate_name for cargo_info action', () => {
      const params: RustToolParams = {
        action: 'cargo_info',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('crate_name');
    });

    it('should require command for custom action', () => {
      const params: RustToolParams = {
        action: 'custom',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('command');
    });

    it('should validate timeout range', () => {
      const params: RustToolParams = {
        action: 'build',
        timeout: 700000,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });

    it('should validate directory is within workspace', () => {
      const params: RustToolParams = {
        action: 'build',
        directory: '/outside/workspace',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('workspace');
    });
  });

  describe('Action Types', () => {
    const validActions = [
      'run',
      'build',
      'test',
      'doc',
      'check',
      'clippy',
      'fmt',
      'clean',
      'cargo_new',
      'cargo_init',
      'cargo_add',
      'cargo_remove',
      'cargo_update',
      'cargo_tree',
      'cargo_publish',
      'cargo_install',
      'cargo_search',
      'cargo_info',
      'cargo_lock',
      'custom',
    ];

    validActions.forEach((action) => {
      it(`should accept '${action}' action`, () => {
        const params: RustToolParams = {
          action: action as RustToolParams['action'],
        };
        // Add required params for specific actions
        if (action === 'cargo_new' || action === 'cargo_install')
          params.crate_name = 'my-crate';
        if (action === 'cargo_add' || action === 'cargo_remove')
          params.crate_name = 'serde';
        if (action === 'cargo_info') params.crate_name = 'tokio';
        if (action === 'custom') params.command = 'echo test';

        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Build Options', () => {
    it('should accept release flag', () => {
      const params: RustToolParams = {
        action: 'build',
        release: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept package option', () => {
      const params: RustToolParams = {
        action: 'build',
        package: 'my-lib',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept bin option', () => {
      const params: RustToolParams = {
        action: 'run',
        bin: 'my-bin',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept example option', () => {
      const params: RustToolParams = {
        action: 'run',
        example: 'my-example',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept test_pattern option', () => {
      const params: RustToolParams = {
        action: 'test',
        test_pattern: 'test_user',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept features option', () => {
      const params: RustToolParams = {
        action: 'build',
        features: ['serde', 'tokio'],
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept all_features flag', () => {
      const params: RustToolParams = {
        action: 'build',
        all_features: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept no_default_features flag', () => {
      const params: RustToolParams = {
        action: 'build',
        no_default_features: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Crate Options', () => {
    it('should accept crate_version for cargo_add', () => {
      const params: RustToolParams = {
        action: 'cargo_add',
        crate_name: 'serde',
        crate_version: '1.0',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });
});

describe('RustToolInvocation', () => {
  let tool: RustTool;
  let allowlist: Set<string>;

  beforeEach(() => {
    tool = new RustTool(mockConfig);
    allowlist = new Set<string>();
  });

  it('should build correct description for run action', () => {
    const params: RustToolParams = {
      action: 'run',
      bin: 'my-app',
    };
    const invocation = new RustToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('run');
    expect(invocation.getDescription()).toContain('my-app');
  });

  it('should build correct description for build action with release', () => {
    const params: RustToolParams = {
      action: 'build',
      release: true,
    };
    const invocation = new RustToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('build');
    expect(invocation.getDescription()).toContain('release');
  });

  it('should build correct description for test action', () => {
    const params: RustToolParams = {
      action: 'test',
      test_pattern: 'test_user_auth',
    };
    const invocation = new RustToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('test');
    expect(invocation.getDescription()).toContain('test_user_auth');
  });

  it('should build correct description for cargo_add action', () => {
    const params: RustToolParams = {
      action: 'cargo_add',
      crate_name: 'serde',
    };
    const invocation = new RustToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('cargo_add');
    expect(invocation.getDescription()).toContain('serde');
  });

  describe('shouldConfirmExecute', () => {
    it('should require confirmation for cargo_new', async () => {
      const params: RustToolParams = {
        action: 'cargo_new',
        crate_name: 'my-project',
      };
      const invocation = new RustToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for cargo_init', async () => {
      const params: RustToolParams = {
        action: 'cargo_init',
      };
      const invocation = new RustToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for cargo_add', async () => {
      const params: RustToolParams = {
        action: 'cargo_add',
        crate_name: 'serde',
      };
      const invocation = new RustToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for cargo_remove', async () => {
      const params: RustToolParams = {
        action: 'cargo_remove',
        crate_name: 'serde',
      };
      const invocation = new RustToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for cargo_publish', async () => {
      const params: RustToolParams = {
        action: 'cargo_publish',
      };
      const invocation = new RustToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for cargo_install', async () => {
      const params: RustToolParams = {
        action: 'cargo_install',
        crate_name: 'ripgrep',
      };
      const invocation = new RustToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should not require confirmation for build', async () => {
      const params: RustToolParams = {
        action: 'build',
      };
      const invocation = new RustToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });

    it('should not require confirmation for test', async () => {
      const params: RustToolParams = {
        action: 'test',
      };
      const invocation = new RustToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });
  });
});
