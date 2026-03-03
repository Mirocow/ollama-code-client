/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PHPToolParams } from './php.js';
import { PHPTool } from './php.js';
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

describe('PHPTool', () => {
  let tool: PHPTool;

  beforeEach(() => {
    tool = new PHPTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(PHPTool.Name).toBe('php_dev');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('PHPDev');
    });

    it('should have description', () => {
      expect(tool.description).toContain('PHP development tool');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('action');
    });
  });

  describe('Parameter Validation', () => {
    it('should require action parameter', () => {
      const params = {} as PHPToolParams;
      const error = tool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid action', () => {
      const params: PHPToolParams = {
        action: 'run',
        script: 'index.php',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should require script for run action', () => {
      const params: PHPToolParams = {
        action: 'run',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('script');
    });

    it('should require packages for composer_require action', () => {
      const params: PHPToolParams = {
        action: 'composer_require',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('packages');
    });

    it('should require command for custom action', () => {
      const params: PHPToolParams = {
        action: 'custom',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('command');
    });

    it('should validate timeout range', () => {
      const params: PHPToolParams = {
        action: 'run',
        script: 'index.php',
        timeout: 700000, // Exceeds max
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });
  });

  describe('Action Types', () => {
    const validActions = [
      'run',
      'test',
      'lint',
      'format',
      'composer_install',
      'composer_update',
      'composer_require',
      'composer_remove',
      'composer_dump_autoload',
      'composer_outdated',
      'phpunit',
      'psalm',
      'phpstan',
      'artisan',
      'custom',
    ];

    validActions.forEach((action) => {
      it(`should accept '${action}' action`, () => {
        const params: PHPToolParams = { action: action as PHPToolParams['action'] };
        // Add required params for specific actions
        if (action === 'run') params.script = 'index.php';
        if (action === 'composer_require') params.packages = ['laravel/framework'];
        if (action === 'custom') params.command = 'echo test';

        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Invocation', () => {
    it('should build correct description for run action', () => {
      const params: PHPToolParams = {
        action: 'run',
        script: 'index.php',
        args: ['--verbose'],
      };

      const invocation = tool['createInvocation'](params);
      expect(invocation.getDescription()).toContain('index.php');
    });

    it('should build correct description for artisan action', () => {
      const params: PHPToolParams = {
        action: 'artisan',
        command: 'migrate',
      };

      const invocation = tool['createInvocation'](params);
      expect(invocation.getDescription()).toContain('artisan');
    });
  });
});
