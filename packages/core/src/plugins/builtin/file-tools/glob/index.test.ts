/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GlobToolParams, GlobPath } from './index.js';
import { GlobTool, sortFileEntries } from './index.js';
import type { Config } from '../config/config.js';

// Mock Config
const mockConfig = {
  getTargetDir: () => '/test/project',
  getWorkspaceContext: () => ({
    getDirectories: () => ['/test/project'],
    isPathWithinWorkspace: () => true,
  }),
  getFileService: () => ({
    filterFilesWithReport: (paths: string[]) => ({ filteredPaths: paths }),
  }),
  getTruncateToolOutputLines: () => 100,
} as unknown as Config;

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn(async () => []),
  escape: vi.fn((s: string) => s),
}));

describe('GlobTool', () => {
  let tool: GlobTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new GlobTool(mockConfig as Config);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(GlobTool.Name).toBe('glob');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('Glob');
    });

    it('should have description', () => {
      expect(tool.description).toContain('file pattern matching');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('pattern');
    });
  });

  describe('Parameter Validation', () => {
    it('should require pattern parameter', () => {
      const params = {} as GlobToolParams;
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('pattern');
    });

    it('should reject empty pattern', () => {
      const params: GlobToolParams = {
        pattern: '',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('pattern');
    });

    it('should reject whitespace-only pattern', () => {
      const params: GlobToolParams = {
        pattern: '   ',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('pattern');
    });

    it('should validate valid params', () => {
      const params: GlobToolParams = {
        pattern: '**/*.ts',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept pattern with path', () => {
      const params: GlobToolParams = {
        pattern: '**/*.ts',
        path: '/test/project/src',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });

  describe('Pattern Examples', () => {
    it('should accept TypeScript file pattern', () => {
      const params: GlobToolParams = {
        pattern: '**/*.ts',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept JavaScript file pattern', () => {
      const params: GlobToolParams = {
        pattern: 'src/**/*.js',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept JSON file pattern', () => {
      const params: GlobToolParams = {
        pattern: '*.json',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept complex pattern', () => {
      const params: GlobToolParams = {
        pattern: 'src/**/*.{ts,tsx,js,jsx}',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept single asterisk pattern', () => {
      const params: GlobToolParams = {
        pattern: '*',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept double asterisk pattern', () => {
      const params: GlobToolParams = {
        pattern: '**',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });
});

describe('sortFileEntries', () => {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  it('should sort recent files first (newest to oldest)', () => {
    const entries: GlobPath[] = [
      { fullpath: () => '/old.txt', mtimeMs: now - oneDayMs * 2 },
      { fullpath: () => '/new.txt', mtimeMs: now - 1000 },
      { fullpath: () => '/mid.txt', mtimeMs: now - oneDayMs / 2 },
    ];

    const sorted = sortFileEntries(entries, now, oneDayMs);

    expect(sorted[0].fullpath()).toBe('/new.txt');
    expect(sorted[1].fullpath()).toBe('/mid.txt');
    expect(sorted[2].fullpath()).toBe('/old.txt');
  });

  it('should sort older files alphabetically', () => {
    const entries: GlobPath[] = [
      { fullpath: () => '/zebra.txt', mtimeMs: now - oneDayMs * 5 },
      { fullpath: () => '/alpha.txt', mtimeMs: now - oneDayMs * 3 },
      { fullpath: () => '/beta.txt', mtimeMs: now - oneDayMs * 4 },
    ];

    const sorted = sortFileEntries(entries, now, oneDayMs);

    // All are older than one day, so sort alphabetically
    expect(sorted[0].fullpath()).toBe('/alpha.txt');
    expect(sorted[1].fullpath()).toBe('/beta.txt');
    expect(sorted[2].fullpath()).toBe('/zebra.txt');
  });

  it('should prioritize recent files over old files', () => {
    const entries: GlobPath[] = [
      { fullpath: () => '/aaa_old.txt', mtimeMs: now - oneDayMs * 5 },
      { fullpath: () => '/zzz_new.txt', mtimeMs: now - 1000 },
    ];

    const sorted = sortFileEntries(entries, now, oneDayMs);

    // Recent file first, even though 'z' comes after 'a'
    expect(sorted[0].fullpath()).toBe('/zzz_new.txt');
    expect(sorted[1].fullpath()).toBe('/aaa_old.txt');
  });

  it('should handle entries without mtimeMs', () => {
    const entries: GlobPath[] = [
      { fullpath: () => '/no_mtime.txt' },
      { fullpath: () => '/with_mtime.txt', mtimeMs: now - 1000 },
    ];

    const sorted = sortFileEntries(entries, now, oneDayMs);

    // Entry with mtime should come first (recent)
    expect(sorted[0].fullpath()).toBe('/with_mtime.txt');
    expect(sorted[1].fullpath()).toBe('/no_mtime.txt');
  });

  it('should handle empty array', () => {
    const entries: GlobPath[] = [];
    const sorted = sortFileEntries(entries, now, oneDayMs);
    expect(sorted).toHaveLength(0);
  });

  it('should handle single entry', () => {
    const entries: GlobPath[] = [
      { fullpath: () => '/single.txt', mtimeMs: now - 5000 },
    ];
    const sorted = sortFileEntries(entries, now, oneDayMs);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].fullpath()).toBe('/single.txt');
  });

  it('should handle entries at boundary of recency threshold', () => {
    const entries: GlobPath[] = [
      { fullpath: () => '/just_old.txt', mtimeMs: now - oneDayMs - 1 },
      { fullpath: () => '/just_new.txt', mtimeMs: now - oneDayMs + 1 },
    ];

    const sorted = sortFileEntries(entries, now, oneDayMs);

    // just_new should be first (recent)
    expect(sorted[0].fullpath()).toBe('/just_new.txt');
    expect(sorted[1].fullpath()).toBe('/just_old.txt');
  });
});

describe('GlobToolInvocation', () => {
  let tool: GlobTool;

  beforeEach(() => {
    tool = new GlobTool(mockConfig as Config);
  });

  it('should create invocation with valid params', () => {
    const params: GlobToolParams = {
      pattern: '**/*.ts',
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation).toBeDefined();
    expect(invocation.getDescription()).toContain('**/*.ts');
  });

  it('should create invocation with path', () => {
    const params: GlobToolParams = {
      pattern: '*.json',
      path: '/test/project/config',
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('*.json');
    expect(invocation.getDescription()).toContain('/test/project/config');
  });
});
