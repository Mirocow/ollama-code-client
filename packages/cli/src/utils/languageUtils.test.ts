/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isAutoLanguage,
  normalizeOutputLanguage,
  resolveOutputLanguage,
  OUTPUT_LANGUAGE_AUTO,
} from './languageUtils.js';

describe('languageUtils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
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

    it('should NOT use UI language fallback when UI is "auto"', () => {
      delete process.env['OLLAMA_CODE_LANG'];
      process.env['LANG'] = 'en_US.UTF-8';
      delete process.env['LANGUAGE'];
      delete process.env['LC_ALL'];
      delete process.env['LC_MESSAGES'];
      delete process.env['LC_CTYPE'];
      
      const result = resolveOutputLanguage('auto', 'auto');
      expect(result).toBe('English');
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
});
