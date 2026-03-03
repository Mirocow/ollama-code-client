/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GolangToolParams } from './golang.js';
import { GolangTool } from './golang.js';
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

describe('GolangTool', () => {
  let tool: GolangTool;

  beforeEach(() => {
    tool = new GolangTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(GolangTool.Name).toBe('golang_dev');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('GolangDev');
    });

    it('should have description', () => {
      expect(tool.description).toContain('Golang development tool');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('action');
    });
  });

  describe('Parameter Validation', () => {
    it('should require action parameter', () => {
      const params = {} as GolangToolParams;
      const error = tool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid action', () => {
      const params: GolangToolParams = {
        action: 'run',
        file: 'main.go',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should require packages for get action', () => {
      const params: GolangToolParams = {
        action: 'get',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('packages');
    });

    it('should require packages for install action', () => {
      const params: GolangToolParams = {
        action: 'install',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('packages');
    });

    it('should require command for custom action', () => {
      const params: GolangToolParams = {
        action: 'custom',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('command');
    });

    it('should validate timeout range', () => {
      const params: GolangToolParams = {
        action: 'run',
        file: 'main.go',
        timeout: 700000, // Exceeds max
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });

    it('should validate directory is within workspace', () => {
      const params: GolangToolParams = {
        action: 'run',
        file: 'main.go',
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
      'test_cover',
      'test_bench',
      'fmt',
      'vet',
      'lint',
      'mod_init',
      'mod_tidy',
      'mod_download',
      'mod_verify',
      'mod_graph',
      'get',
      'install',
      'list',
      'doc',
      'env',
      'version',
      'clean',
      'generate',
      'custom',
    ];

    validActions.forEach((action) => {
      it(`should accept '${action}' action`, () => {
        const params: GolangToolParams = { action: action as GolangToolParams['action'] };
        // Add required params for specific actions
        if (action === 'run') params.file = 'main.go';
        if (action === 'build') params.output = 'app';
        if (action === 'get' || action === 'install') params.packages = ['github.com/gin-gonic/gin'];
        if (action === 'custom') params.command = 'echo test';

        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Test Options', () => {
    it('should accept race detector option', () => {
      const params: GolangToolParams = {
        action: 'test',
        race: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept verbose option', () => {
      const params: GolangToolParams = {
        action: 'test',
        verbose: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept test_pattern option', () => {
      const params: GolangToolParams = {
        action: 'test',
        test_pattern: 'TestUser',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept cover_profile option', () => {
      const params: GolangToolParams = {
        action: 'test_cover',
        cover_profile: 'coverage.out',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept bench_pattern option', () => {
      const params: GolangToolParams = {
        action: 'test_bench',
        bench_pattern: 'Benchmark',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Module Options', () => {
    it('should accept module_name for mod_init', () => {
      const params: GolangToolParams = {
        action: 'mod_init',
        module_name: 'github.com/user/project',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Invocation', () => {
    it('should build correct description for run action', () => {
      const params: GolangToolParams = {
        action: 'run',
        file: 'main.go',
        args: ['--config', 'config.yaml'],
      };

      const invocation = tool['createInvocation'](params);
      expect(invocation.getDescription()).toContain('main.go');
    });

    it('should build correct description for test action', () => {
      const params: GolangToolParams = {
        action: 'test',
        test_pattern: 'TestUser',
        race: true,
      };

      const invocation = tool['createInvocation'](params);
      expect(invocation.getDescription()).toContain('test');
    });

    it('should build correct description for build action', () => {
      const params: GolangToolParams = {
        action: 'build',
        output: 'myapp',
      };

      const invocation = tool['createInvocation'](params);
      expect(invocation.getDescription()).toContain('build');
    });
  });
});
