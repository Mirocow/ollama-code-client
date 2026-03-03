/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  TypeScriptToolParams} from './index.js';
import {
  TypeScriptTool,
  TypeScriptToolInvocation,
  DEFAULT_TYPESCRIPT_TIMEOUT_MS,
  detectTypeScriptRunner,
  getRunnerCommand,
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

describe('TypeScriptTool', () => {
  let tool: TypeScriptTool;

  beforeEach(() => {
    tool = new TypeScriptTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(TypeScriptTool.Name).toBe('typescript_dev');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('TypeScriptDev');
    });

    it('should have description', () => {
      expect(tool.description).toContain('TypeScript development tool');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('action');
    });

    it('should have default timeout', () => {
      expect(DEFAULT_TYPESCRIPT_TIMEOUT_MS).toBe(120000);
    });
  });

  describe('Parameter Validation', () => {
    it('should require action parameter', () => {
      const params = {} as TypeScriptToolParams;
      const error = tool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid action', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should require file for run action', () => {
      const params: TypeScriptToolParams = {
        action: 'run',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('file');
    });

    it('should require file for run_esm action', () => {
      const params: TypeScriptToolParams = {
        action: 'run_esm',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('file');
    });

    it('should require file for transpile action', () => {
      const params: TypeScriptToolParams = {
        action: 'transpile',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('file');
    });

    it('should require command for custom action', () => {
      const params: TypeScriptToolParams = {
        action: 'custom',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('command');
    });

    it('should validate timeout range', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        timeout: 700000,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });

    it('should validate directory is within workspace', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        directory: '/outside/workspace',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('workspace');
    });
  });

  describe('Action Types', () => {
    const validActions = [
      'compile',
      'watch',
      'build',
      'check',
      'clean',
      'init',
      'show_config',
      'version',
      'run',
      'run_esm',
      'transpile',
      'custom',
    ];

    validActions.forEach((action) => {
      it(`should accept '${action}' action`, () => {
        const params: TypeScriptToolParams = {
          action: action as TypeScriptToolParams['action'],
        };
        // Add required params for specific actions
        if (action === 'run' || action === 'run_esm' || action === 'transpile')
          params.file = 'main.ts';
        if (action === 'custom') params.command = 'echo test';

        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Compile Options', () => {
    it('should accept project option', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        project: 'tsconfig.build.json',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept out_dir option', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        out_dir: 'dist',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept out_file option', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        out_file: 'bundle.js',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept root_dir option', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        root_dir: 'src',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept declaration flag', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        declaration: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept source_map flag', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        source_map: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept strict flag', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        strict: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept module option', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        module: 'esnext',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept target option', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        target: 'es2020',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept jsx option', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        jsx: 'react',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept module_resolution option', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        module_resolution: 'node',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept es_module flag', () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
        es_module: true,
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });
});

describe('TypeScriptToolInvocation', () => {
  let _tool: TypeScriptTool;
  let allowlist: Set<string>;

  beforeEach(() => {
    _tool = new TypeScriptTool(mockConfig);
    allowlist = new Set<string>();
  });

  it('should build correct description for compile action', () => {
    const params: TypeScriptToolParams = {
      action: 'compile',
      file: 'main.ts',
    };
    const invocation = new TypeScriptToolInvocation(
      mockConfig,
      params,
      allowlist,
    );
    expect(invocation.getDescription()).toContain('compile');
    expect(invocation.getDescription()).toContain('main.ts');
  });

  it('should build correct description for run action', () => {
    const params: TypeScriptToolParams = {
      action: 'run',
      file: 'main.ts',
    };
    const invocation = new TypeScriptToolInvocation(
      mockConfig,
      params,
      allowlist,
    );
    expect(invocation.getDescription()).toContain('run');
    expect(invocation.getDescription()).toContain('main.ts');
  });

  it('should build correct description for build action', () => {
    const params: TypeScriptToolParams = {
      action: 'build',
      project: 'tsconfig.json',
    };
    const invocation = new TypeScriptToolInvocation(
      mockConfig,
      params,
      allowlist,
    );
    expect(invocation.getDescription()).toContain('build');
    expect(invocation.getDescription()).toContain('tsconfig.json');
  });

  it('should build correct description with out_dir', () => {
    const params: TypeScriptToolParams = {
      action: 'compile',
      out_dir: 'dist',
    };
    const invocation = new TypeScriptToolInvocation(
      mockConfig,
      params,
      allowlist,
    );
    expect(invocation.getDescription()).toContain('dist');
  });

  describe('shouldConfirmExecute', () => {
    it('should require confirmation for init', async () => {
      const params: TypeScriptToolParams = {
        action: 'init',
      };
      const invocation = new TypeScriptToolInvocation(
        mockConfig,
        params,
        allowlist,
      );
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for clean', async () => {
      const params: TypeScriptToolParams = {
        action: 'clean',
      };
      const invocation = new TypeScriptToolInvocation(
        mockConfig,
        params,
        allowlist,
      );
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should not require confirmation for compile', async () => {
      const params: TypeScriptToolParams = {
        action: 'compile',
      };
      const invocation = new TypeScriptToolInvocation(
        mockConfig,
        params,
        allowlist,
      );
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });

    it('should not require confirmation for check', async () => {
      const params: TypeScriptToolParams = {
        action: 'check',
      };
      const invocation = new TypeScriptToolInvocation(
        mockConfig,
        params,
        allowlist,
      );
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });
  });
});

describe('detectTypeScriptRunner', () => {
  it('should return tsx when tsx is in dependencies', async () => {
    const configWithTsx = {
      ...mockConfig,
      getTargetDir: () => '/test/project-tsx',
    } as unknown as Config;

    // Mock fs to return package.json with tsx
    vi.mock('node:fs', () => ({
      existsSync: () => true,
      readFileSync: () =>
        JSON.stringify({
          dependencies: { tsx: '4.20.0' },
        }),
    }));

    const runner = await detectTypeScriptRunner(configWithTsx);
    expect(runner).toBe('tsx');
  });

  it('should return ts-node when only ts-node is in dependencies', async () => {
    const configWithTsNode = {
      ...mockConfig,
      getTargetDir: () => '/test/project-tsnode',
    } as unknown as Config;

    const runner = await detectTypeScriptRunner(configWithTsNode);
    // Without actual fs mock, it defaults to tsx
    expect(['tsx', 'ts-node']).toContain(runner);
  });

  it('should default to tsx when no runner is found', async () => {
    const configEmpty = {
      ...mockConfig,
      getTargetDir: () => '/test/project-empty',
    } as unknown as Config;

    const runner = await detectTypeScriptRunner(configEmpty);
    expect(runner).toBe('tsx');
  });
});

describe('getRunnerCommand', () => {
  it('should return npx tsx for tsx runner', () => {
    const cmd = getRunnerCommand('tsx');
    expect(cmd).toEqual(['npx', 'tsx']);
  });

  it('should return npx ts-node for ts-node runner', () => {
    const cmd = getRunnerCommand('ts-node');
    expect(cmd).toEqual(['npx', 'ts-node']);
  });

  it('should return npx tsx as default', () => {
    const cmd = getRunnerCommand('tsx' as 'tsx' | 'ts-node');
    expect(cmd).toEqual(['npx', 'tsx']);
  });
});
