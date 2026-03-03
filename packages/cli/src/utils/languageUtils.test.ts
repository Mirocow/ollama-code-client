/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isAutoLanguage,
  normalizeOutputLanguage,
  resolveOutputLanguage,
  initializeLlmOutputLanguage,
  OUTPUT_LANGUAGE_AUTO,
} from './languageUtils.js';

// Mock the Storage module
vi.mock('@ollama-code/ollama-code-core', () => ({
  Storage: {
    getGlobalOllamaDir: () => '/mock/.ollama-code',
  },
}));

// Mock fs module
let mockFiles: Record<string, string> = {};
vi.mock('node:fs', () => ({
  existsSync: (path: string) => path in mockFiles,
  readFileSync: (path: string) => mockFiles[path] ?? '',
  writeFileSync: (path: string, content: string) => {
    mockFiles[path] = content;
  },
  mkdirSync: () => {},
}));

describe('languageUtils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockFiles = {}; // Reset mock file system
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isAutoLanguage', () => {
    it('should return true for undefined', () => {
      expect(isAutoLanguage(undefined)).toBe(true);
    });

    it('should return true for null', () => {
      expect(isAutoLanguage(null)).toBe(true);
    });

    it('should return true for "auto"', () => {
      expect(isAutoLanguage('auto')).toBe(true);
    });

    it('should return true for "AUTO" (case insensitive)', () => {
      expect(isAutoLanguage('AUTO')).toBe(true);
    });

    it('should return false for specific language', () => {
      expect(isAutoLanguage('Russian')).toBe(false);
    });

    it('should return false for locale code', () => {
      expect(isAutoLanguage('ru')).toBe(false);
    });
  });

  describe('normalizeOutputLanguage', () => {
    it('should convert "ru" to "Russian"', () => {
      expect(normalizeOutputLanguage('ru')).toBe('Russian');
    });

    it('should convert "zh" to "Chinese"', () => {
      expect(normalizeOutputLanguage('zh')).toBe('Chinese');
    });

    it('should convert "en" to "English"', () => {
      expect(normalizeOutputLanguage('en')).toBe('English');
    });

    it('should return language name as-is if already full name', () => {
      expect(normalizeOutputLanguage('Russian')).toBe('Russian');
    });

    it('should return unknown input as-is', () => {
      expect(normalizeOutputLanguage('Українська')).toBe('Українська');
    });

    it('should handle case insensitivity', () => {
      expect(normalizeOutputLanguage('RU')).toBe('Russian');
      expect(normalizeOutputLanguage('ZH')).toBe('Chinese');
    });
  });

  describe('resolveOutputLanguage', () => {
    it('should return specific language as-is', () => {
      expect(resolveOutputLanguage('Japanese')).toBe('Japanese');
    });

    it('should normalize locale code', () => {
      expect(resolveOutputLanguage('de')).toBe('German');
    });

    it('should resolve "auto" using system detection', () => {
      // This test depends on system locale, but should return a valid language
      const result = resolveOutputLanguage('auto');
      expect(['English', 'Chinese', 'Russian', 'German', 'Japanese', 'Portuguese']).toContain(result);
    });

    it('should resolve undefined using system detection', () => {
      const result = resolveOutputLanguage(undefined);
      expect(['English', 'Chinese', 'Russian', 'German', 'Japanese', 'Portuguese']).toContain(result);
    });
  });

  describe('UI language fallback', () => {
    it('should use UI language when system is English but UI is Russian', () => {
      // Set LANG to English so system detection returns English
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'en_US.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];
      
      const result = resolveOutputLanguage('auto', 'ru');
      expect(result).toBe('Russian');
    });

    it('should use UI language when system is English but UI is Chinese', () => {
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'en_US.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];
      
      const result = resolveOutputLanguage('auto', 'zh');
      expect(result).toBe('Chinese');
    });

    it('should NOT use UI language fallback when system is non-English', () => {
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'de_DE.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];
      
      const result = resolveOutputLanguage('auto', 'ru');
      expect(result).toBe('German');
    });

    it('should NOT use UI language fallback when UI is English', () => {
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'en_US.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];
      
      const result = resolveOutputLanguage('auto', 'en');
      expect(result).toBe('English');
    });

    it('should resolve "auto" uiLanguage to detected system language', () => {
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'ru_RU.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];
      
      // When uiLanguage is 'auto' and system is Russian, should use Russian
      const result = resolveOutputLanguage('auto', 'auto');
      expect(result).toBe('Russian');
    });

    it('should NOT use UI language fallback when output is explicitly set', () => {
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'en_US.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];
      
      const result = resolveOutputLanguage('Japanese', 'ru');
      expect(result).toBe('Japanese');
    });
  });

  describe('OUTPUT_LANGUAGE_AUTO constant', () => {
    it('should be "auto"', () => {
      expect(OUTPUT_LANGUAGE_AUTO).toBe('auto');
    });
  });

  describe('initializeLlmOutputLanguage', () => {
    const filePath = '/mock/.ollama-code/output-language.md';

    it('should preserve existing file when no setting is provided', () => {
      // Setup: file exists with Russian
      mockFiles[filePath] = `# Output language preference: Russian
<!-- ollama-code:llm-output-language: Russian -->`;

      // Act: call with undefined (no setting in settings.json)
      initializeLlmOutputLanguage(undefined);

      // Assert: file should be unchanged
      expect(mockFiles[filePath]).toContain('Russian');
      expect(mockFiles[filePath]).not.toContain('English');
    });

    it('should create new file when no setting provided and file does not exist', () => {
      // Setup: file doesn't exist
      delete mockFiles[filePath];
      
      // Set system language to English
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'en_US.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];

      // Act
      initializeLlmOutputLanguage(undefined);

      // Assert: file should be created with English
      expect(mockFiles[filePath]).toBeDefined();
      expect(mockFiles[filePath]).toContain('English');
    });

    it('should resolve "auto" and write when file exists with different language', () => {
      // Setup: file exists with English
      mockFiles[filePath] = `# Output language preference: English
<!-- ollama-code:llm-output-language: English -->`;

      // Set system language to Russian
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'ru_RU.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];

      // Act: auto should detect Russian
      initializeLlmOutputLanguage('auto');

      // Assert: file should be updated to Russian
      expect(mockFiles[filePath]).toContain('Russian');
    });

    it('should NOT write when setting matches current file', () => {
      // Setup: file exists with Russian
      const originalContent = `# Output language preference: Russian
<!-- ollama-code:llm-output-language: Russian -->`;
      mockFiles[filePath] = originalContent;

      // Act: explicit setting matches current
      initializeLlmOutputLanguage('Russian');

      // Assert: file should be unchanged
      expect(mockFiles[filePath]).toBe(originalContent);
    });

    it('should write when explicit setting differs from current file', () => {
      // Setup: file exists with Russian
      mockFiles[filePath] = `# Output language preference: Russian
<!-- ollama-code:llm-output-language: Russian -->`;

      // Act: explicit setting is different
      initializeLlmOutputLanguage('Japanese');

      // Assert: file should be updated
      expect(mockFiles[filePath]).toContain('Japanese');
      expect(mockFiles[filePath]).not.toContain('Russian');
    });

    it('should use UI language fallback when system is English but UI is Russian', () => {
      // Setup: file doesn't exist
      delete mockFiles[filePath];
      
      // Set system language to English
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'en_US.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];

      // Act: auto with UI language Russian
      initializeLlmOutputLanguage('auto', 'ru');

      // Assert: file should use Russian (UI fallback)
      expect(mockFiles[filePath]).toContain('Russian');
    });

    it('should NOT preserve file when explicit setting is provided', () => {
      // Setup: file exists with Russian
      mockFiles[filePath] = `# Output language preference: Russian
<!-- ollama-code:llm-output-language: Russian -->`;

      // Act: explicit setting provided (even empty string is explicit)
      initializeLlmOutputLanguage('auto');

      // With auto and English system, should update to English
      // (this tests that explicit 'auto' is treated differently than undefined)
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'en_US.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];

      initializeLlmOutputLanguage('auto');

      expect(mockFiles[filePath]).toContain('English');
    });
  });
});
