/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  JavaToolParams} from './java.js';
import {
  JavaTool,
  JavaToolInvocation,
  DEFAULT_JAVA_TIMEOUT_MS,
} from './java.js';
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

describe('JavaTool', () => {
  let tool: JavaTool;

  beforeEach(() => {
    tool = new JavaTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(JavaTool.Name).toBe('java_dev');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('JavaDev');
    });

    it('should have description', () => {
      expect(tool.description).toContain('Java development tool');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('action');
    });

    it('should have default timeout', () => {
      expect(DEFAULT_JAVA_TIMEOUT_MS).toBe(120000);
    });
  });

  describe('Parameter Validation', () => {
    it('should require action parameter', () => {
      const params = {} as JavaToolParams;
      const error = tool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid action', () => {
      const params: JavaToolParams = {
        action: 'run',
        class: 'com.example.Main',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should require class for run action', () => {
      const params: JavaToolParams = {
        action: 'run',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('class');
    });

    it('should require goal for maven_exec action', () => {
      const params: JavaToolParams = {
        action: 'maven_exec',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('goal');
    });

    it('should require goal for gradle_exec action', () => {
      const params: JavaToolParams = {
        action: 'gradle_exec',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('goal');
    });

    it('should require command for custom action', () => {
      const params: JavaToolParams = {
        action: 'custom',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('command');
    });

    it('should validate timeout range', () => {
      const params: JavaToolParams = {
        action: 'run',
        class: 'com.example.Main',
        timeout: 700000,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });

    it('should validate directory is within workspace', () => {
      const params: JavaToolParams = {
        action: 'run',
        class: 'com.example.Main',
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
      'compile',
      'test',
      'build',
      'clean',
      'maven_compile',
      'maven_test',
      'maven_package',
      'maven_install',
      'maven_clean',
      'maven_dependency_tree',
      'maven_exec',
      'gradle_build',
      'gradle_test',
      'gradle_clean',
      'gradle_run',
      'gradle_tasks',
      'gradle_dependency_tree',
      'gradle_exec',
      'jar',
      'custom',
    ];

    validActions.forEach((action) => {
      it(`should accept '${action}' action`, () => {
        const params: JavaToolParams = {
          action: action as JavaToolParams['action'],
        };
        // Add required params for specific actions
        if (action === 'run') params.class = 'com.example.Main';
        if (action === 'maven_exec' || action === 'gradle_exec')
          params.goal = 'clean';
        if (action === 'custom') params.command = 'echo test';

        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Build Tool Options', () => {
    it('should accept maven build tool', () => {
      const params: JavaToolParams = {
        action: 'build',
        build_tool: 'maven',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept gradle build tool', () => {
      const params: JavaToolParams = {
        action: 'build',
        build_tool: 'gradle',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Java Options', () => {
    it('should accept classpath option', () => {
      const params: JavaToolParams = {
        action: 'run',
        class: 'com.example.Main',
        classpath: 'target/classes:lib/*',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept profile option for maven', () => {
      const params: JavaToolParams = {
        action: 'maven_compile',
        profile: 'production',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept main_class for jar', () => {
      const params: JavaToolParams = {
        action: 'jar',
        output: 'app.jar',
        main_class: 'com.example.Main',
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });
});

describe('JavaToolInvocation', () => {
  let tool: JavaTool;
  let allowlist: Set<string>;

  beforeEach(() => {
    tool = new JavaTool(mockConfig);
    allowlist = new Set<string>();
  });

  it('should build correct description for run action', () => {
    const params: JavaToolParams = {
      action: 'run',
      class: 'com.example.Main',
    };
    const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('run');
    expect(invocation.getDescription()).toContain('com.example.Main');
  });

  it('should build correct description for maven action', () => {
    const params: JavaToolParams = {
      action: 'maven_compile',
      build_tool: 'maven',
    };
    const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('maven');
  });

  it('should build correct description for gradle action', () => {
    const params: JavaToolParams = {
      action: 'gradle_build',
      build_tool: 'gradle',
    };
    const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('gradle');
  });

  it('should build correct description with goal', () => {
    const params: JavaToolParams = {
      action: 'maven_exec',
      goal: 'clean install',
    };
    const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
    expect(invocation.getDescription()).toContain('clean install');
  });

  describe('shouldConfirmExecute', () => {
    it('should require confirmation for maven_install', async () => {
      const params: JavaToolParams = {
        action: 'maven_install',
      };
      const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for clean', async () => {
      const params: JavaToolParams = {
        action: 'clean',
      };
      const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for maven_clean', async () => {
      const params: JavaToolParams = {
        action: 'maven_clean',
      };
      const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should require confirmation for gradle_clean', async () => {
      const params: JavaToolParams = {
        action: 'gradle_clean',
      };
      const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
    });

    it('should not require confirmation for build', async () => {
      const params: JavaToolParams = {
        action: 'build',
      };
      const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });

    it('should not require confirmation for test', async () => {
      const params: JavaToolParams = {
        action: 'test',
      };
      const invocation = new JavaToolInvocation(mockConfig, params, allowlist);
      const confirmation = await invocation.shouldConfirmExecute(
        new AbortController().signal,
      );
      expect(confirmation).toBe(false);
    });
  });
});
