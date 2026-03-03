/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CppToolParams } from './index.js';
import { CppTool, CppToolInvocation, DEFAULT_CPP_TIMEOUT_MS } from './index.js';
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

describe('CppTool', () => {
  let tool: CppTool;

  beforeEach(() => {
    tool = new CppTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(CppTool.Name).toBe('cpp_dev');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('CppDev');
    });

    it('should have description', () => {
      expect(tool.description).toContain('C++ development tool');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('action');
    });

    it('should have default timeout', () => {
      expect(DEFAULT_CPP_TIMEOUT_MS).toBe(120000);
    });
  });

  describe('Parameter Validation', () => {
    it('should require action parameter', () => {
      const params = {} as CppToolParams;
      const error = tool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid action', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should require file for compile action', () => {
      const params: CppToolParams = {
        action: 'compile',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('file');
    });

    it('should require file for run action', () => {
      const params: CppToolParams = {
        action: 'run',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('file');
    });

    it('should require command for custom action', () => {
      const params: CppToolParams = {
        action: 'custom',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('command');
    });

    it('should validate timeout range - too high', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        timeout: 700000,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });

    it('should validate timeout range - negative', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        timeout: -100,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });

    it('should validate directory is within workspace', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        directory: '/outside/workspace',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('workspace');
    });

    it('should validate absolute directory path', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        directory: 'relative/path',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('absolute');
    });

    it('should accept valid timeout', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        timeout: 60000,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });

  describe('Action Types', () => {
    const validActions = [
      'compile',
      'run',
      'build',
      'test',
      'cmake_configure',
      'cmake_build',
      'cmake_clean',
      'cmake_test',
      'cmake_install',
      'make',
      'make_clean',
      'make_install',
      'custom',
    ];

    validActions.forEach((action) => {
      it(`should accept '${action}' action`, () => {
        const params: CppToolParams = { action: action as CppToolParams['action'] };
        // Add required params for specific actions
        if (action === 'compile' || action === 'run') params.file = 'main.cpp';
        if (action === 'custom') params.command = 'echo test';

        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Compiler Types', () => {
    it('should accept gcc compiler', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.c',
        compiler: 'gcc',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept g++ compiler', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        compiler: 'g++',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept clang compiler', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.c',
        compiler: 'clang',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept clang++ compiler', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        compiler: 'clang++',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Compile Options', () => {
    it('should accept std option', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        std: 'c++17',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept optimize option', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        optimize: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept debug option', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        debug: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept defines option', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        defines: ['DEBUG', 'VERSION=1'],
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept include_dirs option', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        include_dirs: ['/usr/local/include'],
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept libs option', () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
        libs: ['pthread', 'ssl'],
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });
});

describe('CppToolInvocation', () => {
  let tool: CppTool;
  let allowlist: Set<string>;

  beforeEach(() => {
    tool = new CppTool(mockConfig);
    allowlist = new Set<string>();
  });

  it('should build correct description for compile action', () => {
    const params: CppToolParams = {
      action: 'compile',
      file: 'main.cpp',
      output: 'app',
    };
    const invocation = new CppToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('compile');
    expect(invocation.getDescription()).toContain('main.cpp');
    expect(invocation.getDescription()).toContain('app');
  });

  it('should build correct description for run action', () => {
    const params: CppToolParams = {
      action: 'run',
      file: 'main.cpp',
      compiler: 'g++',
    };
    const invocation = new CppToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('run');
    expect(invocation.getDescription()).toContain('g++');
  });

  it('should build correct description for cmake_build action', () => {
    const params: CppToolParams = {
      action: 'cmake_build',
      target: 'myapp',
    };
    const invocation = new CppToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('cmake_build');
    expect(invocation.getDescription()).toContain('myapp');
  });

  it('should build correct description with directory', () => {
    const params: CppToolParams = {
      action: 'compile',
      file: 'main.cpp',
      directory: '/test/project',
    };
    const invocation = new CppToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('/test/project');
  });

  it('should build correct description with description param', () => {
    const params: CppToolParams = {
      action: 'compile',
      file: 'main.cpp',
      description: 'Build main application',
    };
    const invocation = new CppToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('Build main application');
  });

  describe('shouldConfirmExecute', () => {
    it('should require confirmation for cmake_install', async () => {
      const params: CppToolParams = {
        action: 'cmake_install',
      };
      const invocation = new CppToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
      expect(confirmation?.title).toContain('cmake_install');
    });

    it('should require confirmation for make_install', async () => {
      const params: CppToolParams = {
        action: 'make_install',
      };
      const invocation = new CppToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
      expect(confirmation?.title).toContain('make_install');
    });

    it('should not require confirmation for compile', async () => {
      const params: CppToolParams = {
        action: 'compile',
        file: 'main.cpp',
      };
      const invocation = new CppToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });

    it('should not require confirmation for build', async () => {
      const params: CppToolParams = {
        action: 'build',
      };
      const invocation = new CppToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });
  });
});
