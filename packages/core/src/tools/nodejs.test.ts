/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NodeJsToolParams } from './nodejs.js';
import { NodeJsTool } from './nodejs.js';
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

describe('NodeJsTool', () => {
  let tool: NodeJsTool;

  beforeEach(() => {
    tool = new NodeJsTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(NodeJsTool.Name).toBe('nodejs_dev');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('NodeJsDev');
    });

    it('should have description', () => {
      expect(tool.description).toContain('Node.js/JavaScript development tool');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('action');
      expect(tool.parameterSchema.properties).toHaveProperty('package_manager');
    });
  });

  describe('Parameter Validation', () => {
    it('should require action parameter', () => {
      const params = {} as NodeJsToolParams;
      const error = tool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid action', () => {
      const params: NodeJsToolParams = {
        action: 'install',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should require script for run action', () => {
      const params: NodeJsToolParams = {
        action: 'run',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('script');
    });

    it('should require packages for add action', () => {
      const params: NodeJsToolParams = {
        action: 'add',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('packages');
    });

    it('should require packages for remove action', () => {
      const params: NodeJsToolParams = {
        action: 'remove',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('packages');
    });

    it('should require script_name for run_script action', () => {
      const params: NodeJsToolParams = {
        action: 'run_script',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('script_name');
    });

    it('should require command for exec action', () => {
      const params: NodeJsToolParams = {
        action: 'exec',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('command');
    });

    it('should require command for custom action', () => {
      const params: NodeJsToolParams = {
        action: 'custom',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('command');
    });

    it('should validate timeout range', () => {
      const params: NodeJsToolParams = {
        action: 'install',
        timeout: 700000, // Exceeds max
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });

    it('should validate directory is within workspace', () => {
      const params: NodeJsToolParams = {
        action: 'install',
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
      'install',
      'add',
      'remove',
      'update',
      'run_script',
      'test',
      'build',
      'dev',
      'lint',
      'exec',
      'info',
      'list',
      'outdated',
      'audit',
      'clean',
      'init',
      'custom',
    ];

    validActions.forEach((action) => {
      it(`should accept '${action}' action`, () => {
        const params: NodeJsToolParams = { action: action as NodeJsToolParams['action'] };
        // Add required params for specific actions
        if (action === 'run') params.script = 'server.js';
        if (action === 'add' || action === 'remove') params.packages = ['express'];
        if (action === 'run_script') params.script_name = 'build';
        if (action === 'exec' || action === 'custom') params.command = 'echo test';

        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Package Manager', () => {
    it('should accept valid package managers', () => {
      const packageManagers = ['npm', 'yarn', 'pnpm', 'bun'];

      packageManagers.forEach((pm) => {
        const params: NodeJsToolParams = {
          action: 'install',
          package_manager: pm as NodeJsToolParams['package_manager'],
        };
        const error = tool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Invocation', () => {
    it('should build correct description for install action', () => {
      const params: NodeJsToolParams = {
        action: 'install',
      };

      const invocation = tool['createInvocation'](params);
      expect(invocation.getDescription()).toContain('install');
    });

    it('should build correct description for dev action with background', () => {
      const params: NodeJsToolParams = {
        action: 'dev',
        background: true,
      };

      const invocation = tool['createInvocation'](params);
      expect(invocation.getDescription()).toContain('dev');
      expect(invocation.getDescription()).toContain('background');
    });
  });
});
