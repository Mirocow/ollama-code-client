/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  ReadManyFilesToolParams,
  FileReadInfo} from './read-many-files.js';
import {
  ReadManyFilesTool
} from './read-many-files.js';
import type { Config } from '../config/config.js';
import type { ToolResult } from './tools.js';

// Mock Config
const mockConfig = {
  getTargetDir: () => '/test/project',
  getWorkspaceContext: () => ({
    getDirectories: () => ['/test/project'],
    isPathWithinWorkspace: () => true,
  }),
  getToolRegistry: () => ({
    getTool: () => ({
      build: () => ({
        execute: vi.fn(async () => ({
          llmContent: 'file content here',
          returnDisplay: 'Read 1 file',
        })),
      }),
    }),
  }),
} as unknown as Config;

describe('ReadManyFilesTool', () => {
  let tool: ReadManyFilesTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ReadManyFilesTool(mockConfig as Config);
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(ReadManyFilesTool.Name).toBe('read_many_files');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('ReadManyFiles');
    });

    it('should have description', () => {
      expect(tool.description).toContain('multiple files');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('paths');
    });
  });

  describe('Parameter Validation', () => {
    it('should require paths parameter', () => {
      const params = {} as ReadManyFilesToolParams;
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('paths');
    });

    it('should reject empty paths array', () => {
      const params: ReadManyFilesToolParams = {
        paths: [],
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('paths');
    });

    it('should validate valid params', () => {
      const params: ReadManyFilesToolParams = {
        paths: ['/test/file1.ts', '/test/file2.ts'],
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should reject paths with empty strings', () => {
      const params: ReadManyFilesToolParams = {
        paths: ['/test/file.ts', ''],
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('path');
    });

    it('should reject paths with whitespace-only strings', () => {
      const params: ReadManyFilesToolParams = {
        paths: ['/test/file.ts', '   '],
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('path');
    });
  });

  describe('Path Array Examples', () => {
    it('should accept single file path', () => {
      const params: ReadManyFilesToolParams = {
        paths: ['/test/project/src/main.ts'],
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept multiple file paths', () => {
      const params: ReadManyFilesToolParams = {
        paths: [
          '/test/project/src/main.ts',
          '/test/project/src/utils.ts',
          '/test/project/src/config.ts',
        ],
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept paths with different extensions', () => {
      const params: ReadManyFilesToolParams = {
        paths: [
          '/test/project/src/main.ts',
          '/test/project/README.md',
          '/test/project/package.json',
        ],
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });
});

describe('FileReadInfo Type', () => {
  it('should define FileReadInfo interface correctly', () => {
    const info: FileReadInfo = {
      filePath: '/test/project/src/main.ts',
      content: 'console.log("Hello");',
      isDirectory: false,
    };
    expect(info.filePath).toBe('/test/project/src/main.ts');
    expect(info.isDirectory).toBe(false);
  });

  it('should define FileReadInfo for directory', () => {
    const info: FileReadInfo = {
      filePath: '/test/project/src',
      content: 'file1.ts\nfile2.ts',
      isDirectory: true,
    };
    expect(info.isDirectory).toBe(true);
  });
});

describe('ReadManyFilesToolInvocation', () => {
  let tool: ReadManyFilesTool;

  beforeEach(() => {
    tool = new ReadManyFilesTool(mockConfig as Config);
  });

  it('should create invocation with valid params', () => {
    const params: ReadManyFilesToolParams = {
      paths: ['/test/file.ts'],
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation).toBeDefined();
    expect(invocation.getDescription()).toContain('file.ts');
  });

  it('should create invocation with single path', () => {
    const params: ReadManyFilesToolParams = {
      paths: ['/test/project/src/main.ts'],
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toBe('/test/project/src/main.ts');
  });

  it('should create invocation with multiple paths', () => {
    const params: ReadManyFilesToolParams = {
      paths: ['/file1.ts', '/file2.ts', '/file3.ts', '/file4.ts'],
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('4 files');
  });

  it('should truncate description for many files', () => {
    const params: ReadManyFilesToolParams = {
      paths: ['/file1.ts', '/file2.ts', '/file3.ts', '/file4.ts', '/file5.ts'],
    };
    const invocation = tool['createInvocation'](params);
    // Should show first 3 files with ellipsis
    expect(invocation.getDescription()).toContain('...');
  });
});
