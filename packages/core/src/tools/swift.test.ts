/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  SwiftToolParams} from './swift.js';
import {
  SwiftTool,
  SwiftToolInvocation,
  DEFAULT_SWIFT_TIMEOUT_MS,
} from './swift.js';
import type { Config } from '../config/config.js';

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

describe('SwiftTool', () => {
  let tool: SwiftTool;

  beforeEach(() => {
    tool = new SwiftTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(SwiftTool.Name).toBe('swift_dev');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('SwiftDev');
    });

    it('should have description', () => {
      expect(tool.description).toContain('Swift development tool');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('action');
    });

    it('should have default timeout', () => {
      expect(DEFAULT_SWIFT_TIMEOUT_MS).toBe(120000);
    });
  });

  describe('Parameter Validation', () => {
    it('should require action parameter', () => {
      const params = {} as SwiftToolParams;
      const error = tool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid action', () => {
      const params: SwiftToolParams = {
        action: 'build',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should require package_name for package_edit action', () => {
      const params: SwiftToolParams = {
        action: 'package_edit',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('package_name');
    });

    it('should require package_name for package_unedit action', () => {
      const params: SwiftToolParams = {
        action: 'package_unedit',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('package_name');
    });

    it('should require command for custom action', () => {
      const params: SwiftToolParams = {
        action: 'custom',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('command');
    });

    it('should validate timeout range', () => {
      const params: SwiftToolParams = {
        action: 'build',
        timeout: 700000,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });

    it('should validate directory is within workspace', () => {
      const params: SwiftToolParams = {
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
      'package_init',
      'package_resolve',
      'package_update',
      'package_dump',
      'package_desc',
      'package_clean',
      'package_edit',
      'package_unedit',
      'package_reset',
      'custom',
    ];

    validActions.forEach((action) => {
      it(`should accept '${action}' action`, () => {
        const params: SwiftToolParams = {
          action: action as SwiftToolParams['action'],
        };
        // Add required params for specific actions
        if (action === 'package_edit' || action === 'package_unedit')
          params.package_name = 'MyPackage';
        if (action === 'custom') params.command = 'echo test';

        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Build Options', () => {
    it('should accept configuration option', () => {
      const params: SwiftToolParams = {
        action: 'build',
        configuration: 'release',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept debug configuration', () => {
      const params: SwiftToolParams = {
        action: 'build',
        configuration: 'debug',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept target option', () => {
      const params: SwiftToolParams = {
        action: 'build',
        target: 'MyLibrary',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept product option', () => {
      const params: SwiftToolParams = {
        action: 'run',
        product: 'MyApp',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept skip_update flag', () => {
      const params: SwiftToolParams = {
        action: 'build',
        skip_update: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Package Options', () => {
    it('should accept package_name for package_init', () => {
      const params: SwiftToolParams = {
        action: 'package_init',
        package_name: 'MyLibrary',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept package_type option', () => {
      const params: SwiftToolParams = {
        action: 'package_init',
        package_name: 'MyLibrary',
        package_type: 'library',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept executable package_type', () => {
      const params: SwiftToolParams = {
        action: 'package_init',
        package_name: 'MyApp',
        package_type: 'executable',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept enable_test_discovery flag', () => {
      const params: SwiftToolParams = {
        action: 'test',
        enable_test_discovery: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });
});

describe('SwiftToolInvocation', () => {
  let tool: SwiftTool;
  let allowlist: Set<string>;

  beforeEach(() => {
    tool = new SwiftTool(mockConfig);
    allowlist = new Set<string>();
  });

  it('should build correct description for run action', () => {
    const params: SwiftToolParams = {
      action: 'run',
      product: 'MyApp',
    };
    const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('run');
    expect(invocation.getDescription()).toContain('MyApp');
  });

  it('should build correct description for build action', () => {
    const params: SwiftToolParams = {
      action: 'build',
      target: 'MyLibrary',
    };
    const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('build');
    expect(invocation.getDescription()).toContain('MyLibrary');
  });

  it('should build correct description for test action', () => {
    const params: SwiftToolParams = {
      action: 'test',
    };
    const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('test');
  });

  it('should build correct description with configuration', () => {
    const params: SwiftToolParams = {
      action: 'build',
      configuration: 'release',
    };
    const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('release');
  });

  it('should build correct description for package_init', () => {
    const params: SwiftToolParams = {
      action: 'package_init',
      package_name: 'MyLibrary',
    };
    const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('package_init');
    expect(invocation.getDescription()).toContain('MyLibrary');
  });

  describe('shouldConfirmExecute', () => {
    it('should require confirmation for package_init', async () => {
      const params: SwiftToolParams = {
        action: 'package_init',
        package_name: 'MyPackage',
      };
      const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for package_edit', async () => {
      const params: SwiftToolParams = {
        action: 'package_edit',
        package_name: 'SomeDependency',
      };
      const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for package_reset', async () => {
      const params: SwiftToolParams = {
        action: 'package_reset',
      };
      const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should not require confirmation for build', async () => {
      const params: SwiftToolParams = {
        action: 'build',
      };
      const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });

    it('should not require confirmation for test', async () => {
      const params: SwiftToolParams = {
        action: 'test',
      };
      const invocation = new SwiftToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });
  });
});
