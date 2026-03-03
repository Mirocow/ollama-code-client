/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GitAdvancedToolParams, GitOperation } from './index.js';
import { GitAdvancedTool } from './index.js';
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

// Mock execSync
vi.mock('node:child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes('git stash')) {
      return 'stash@{0}: WIP on main: abc123 Latest commit';
    }
    if (cmd.includes('git branch')) {
      return '* main\n  feature/test';
    }
    if (cmd.includes('git remote')) {
      return 'origin  https://github.com/user/repo.git (fetch)';
    }
    return '';
  }),
}));

describe('GitAdvancedTool', () => {
  let tool: GitAdvancedTool;

  beforeEach(() => {
    tool = new GitAdvancedTool(mockConfig);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(GitAdvancedTool.Name).toBe('git_advanced');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('GitAdvanced');
    });

    it('should have description', () => {
      expect(tool.description).toContain('git operations');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('operation');
    });
  });

  describe('Parameter Validation', () => {
    it('should require operation parameter', () => {
      const params = {} as GitAdvancedToolParams;
      const error = tool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid params', () => {
      const params: GitAdvancedToolParams = {
        operation: 'stash_list',
        args: {},
      };
      const error = tool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Stash Operations', () => {
    const stashOperations: GitOperation[] = [
      'stash_save',
      'stash_pop',
      'stash_apply',
      'stash_list',
      'stash_drop',
      'stash_clear',
    ];

    stashOperations.forEach((operation) => {
      it(`should accept '${operation}' operation`, () => {
        const params: GitAdvancedToolParams = {
          operation,
          args: {},
        };
        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });

    it('should accept message for stash_save', () => {
      const params: GitAdvancedToolParams = {
        operation: 'stash_save',
        args: {
          message: 'Work in progress',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept stash reference for stash_pop', () => {
      const params: GitAdvancedToolParams = {
        operation: 'stash_pop',
        args: {
          stash: 'stash@{1}',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });

  describe('Cherry-Pick Operations', () => {
    const cherryPickOperations: GitOperation[] = [
      'cherry_pick',
      'cherry_pick_continue',
      'cherry_pick_abort',
    ];

    cherryPickOperations.forEach((operation) => {
      it(`should accept '${operation}' operation`, () => {
        const params: GitAdvancedToolParams = {
          operation,
          args: operation === 'cherry_pick' ? { commit: 'abc123' } : {},
        };
        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });

    it('should require commit for cherry_pick', () => {
      const params: GitAdvancedToolParams = {
        operation: 'cherry_pick',
        args: {},
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('commit');
    });

    it('should accept noCommit option for cherry_pick', () => {
      const params: GitAdvancedToolParams = {
        operation: 'cherry_pick',
        args: {
          commit: 'abc123',
          noCommit: true,
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });

  describe('Rebase Operations', () => {
    const rebaseOperations: GitOperation[] = [
      'rebase_start',
      'rebase_continue',
      'rebase_abort',
      'rebase_status',
    ];

    rebaseOperations.forEach((operation) => {
      it(`should accept '${operation}' operation`, () => {
        const params: GitAdvancedToolParams = {
          operation,
          args: operation === 'rebase_start' ? { upstream: 'main' } : {},
        };
        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });

    it('should require upstream for rebase_start', () => {
      const params: GitAdvancedToolParams = {
        operation: 'rebase_start',
        args: {},
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('upstream');
    });

    it('should accept onto option for rebase', () => {
      const params: GitAdvancedToolParams = {
        operation: 'rebase_start',
        args: {
          upstream: 'main',
          onto: 'feature/base',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept interactive option for rebase', () => {
      const params: GitAdvancedToolParams = {
        operation: 'rebase_start',
        args: {
          upstream: 'main',
          interactive: true,
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });

  describe('Bisect Operations', () => {
    const bisectOperations: GitOperation[] = [
      'bisect_start',
      'bisect_good',
      'bisect_bad',
      'bisect_reset',
      'bisect_log',
    ];

    bisectOperations.forEach((operation) => {
      it(`should accept '${operation}' operation`, () => {
        const params: GitAdvancedToolParams = {
          operation,
          args: {},
        };
        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });

    it('should accept good and bad refs for bisect_start', () => {
      const params: GitAdvancedToolParams = {
        operation: 'bisect_start',
        args: {
          bad: 'HEAD',
          good: 'v1.0.0',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });

  describe('Blame Operations', () => {
    it('should accept blame operation', () => {
      const params: GitAdvancedToolParams = {
        operation: 'blame',
        args: {
          file: 'src/main.ts',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should require file for blame', () => {
      const params: GitAdvancedToolParams = {
        operation: 'blame',
        args: {},
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('file');
    });

    it('should accept line range for blame', () => {
      const params: GitAdvancedToolParams = {
        operation: 'blame',
        args: {
          file: 'src/main.ts',
          startLine: 10,
          endLine: 20,
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept showEmail option for blame', () => {
      const params: GitAdvancedToolParams = {
        operation: 'blame',
        args: {
          file: 'src/main.ts',
          showEmail: true,
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });

  describe('Branch Operations', () => {
    const branchOperations: GitOperation[] = [
      'branch_create',
      'branch_delete',
      'branch_rename',
      'branch_list',
    ];

    branchOperations.forEach((operation) => {
      it(`should accept '${operation}' operation`, () => {
        const params: GitAdvancedToolParams = {
          operation,
          args:
            operation === 'branch_create' || operation === 'branch_delete'
              ? { name: 'feature/test' }
              : {},
        };
        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });

    it('should require name for branch_create', () => {
      const params: GitAdvancedToolParams = {
        operation: 'branch_create',
        args: {},
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('name');
    });

    it('should require name for branch_delete', () => {
      const params: GitAdvancedToolParams = {
        operation: 'branch_delete',
        args: {},
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('name');
    });

    it('should require oldName and newName for branch_rename', () => {
      const params: GitAdvancedToolParams = {
        operation: 'branch_rename',
        args: {
          oldName: 'old-branch',
          newName: 'new-branch',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should fail without both names for branch_rename', () => {
      const params: GitAdvancedToolParams = {
        operation: 'branch_rename',
        args: {
          oldName: 'old-branch',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('oldName');
    });

    it('should accept force option for branch_delete', () => {
      const params: GitAdvancedToolParams = {
        operation: 'branch_delete',
        args: {
          name: 'feature/test',
          force: true,
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept checkout option for branch_create', () => {
      const params: GitAdvancedToolParams = {
        operation: 'branch_create',
        args: {
          name: 'feature/new',
          checkout: true,
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });

  describe('Remote Operations', () => {
    const remoteOperations: GitOperation[] = [
      'remote_add',
      'remote_remove',
      'remote_list',
      'remote_set_url',
    ];

    remoteOperations.forEach((operation) => {
      it(`should accept '${operation}' operation`, () => {
        const params: GitAdvancedToolParams = {
          operation,
          args:
            operation === 'remote_add'
              ? { name: 'upstream', url: 'https://github.com/upstream/repo.git' }
              : operation === 'remote_remove'
                ? { name: 'origin' }
                : {},
        };
        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });

    it('should require name and url for remote_add', () => {
      const params: GitAdvancedToolParams = {
        operation: 'remote_add',
        args: {
          name: 'upstream',
          url: 'https://github.com/upstream/repo.git',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should fail without url for remote_add', () => {
      const params: GitAdvancedToolParams = {
        operation: 'remote_add',
        args: {
          name: 'upstream',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('url');
    });

    it('should require name for remote_remove', () => {
      const params: GitAdvancedToolParams = {
        operation: 'remote_remove',
        args: {
          name: 'origin',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should require name and url for remote_set_url', () => {
      const params: GitAdvancedToolParams = {
        operation: 'remote_set_url',
        args: {
          name: 'origin',
          url: 'https://github.com/new/repo.git',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });
});

describe('GitAdvancedToolInvocation', () => {
  let tool: GitAdvancedTool;

  beforeEach(() => {
    tool = new GitAdvancedTool(mockConfig);
  });

  it('should create invocation with valid params', () => {
    const params: GitAdvancedToolParams = {
      operation: 'stash_list',
      args: {},
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation).toBeDefined();
    expect(invocation.getDescription()).toContain('stash');
  });

  it('should create invocation for branch_list', () => {
    const params: GitAdvancedToolParams = {
      operation: 'branch_list',
      args: {},
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('branch');
  });

  it('should create invocation for cherry_pick with commit', () => {
    const params: GitAdvancedToolParams = {
      operation: 'cherry_pick',
      args: {
        commit: 'abc123',
      },
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('abc123');
  });

  it('should create invocation for blame with file', () => {
    const params: GitAdvancedToolParams = {
      operation: 'blame',
      args: {
        file: 'src/main.ts',
      },
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('main.ts');
  });
});
