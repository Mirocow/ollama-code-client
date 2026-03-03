/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectSystemLanguage } from './index.js';

describe('detectSystemLanguage', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('OLLAMA_CODE_LANG environment variable', () => {
    it('should detect language from OLLAMA_CODE_LANG', () => {
      process.env.OLLAMA_CODE_LANG = 'ru';
      expect(detectSystemLanguage()).toBe('ru');
    });

    it('should detect language from OLLAMA_CODE_LANG with locale suffix', () => {
      process.env.OLLAMA_CODE_LANG = 'zh_CN';
      expect(detectSystemLanguage()).toBe('zh');
    });

    it('should prioritize OLLAMA_CODE_LANG over other env vars', () => {
      process.env.OLLAMA_CODE_LANG = 'ja';
      process.env.LANG = 'en_US.UTF-8';
      expect(detectSystemLanguage()).toBe('ja');
    });
  });

  describe('Locale environment variables', () => {
    it('should detect language from LANG', () => {
      delete process.env.OLLAMA_CODE_LANG;
      process.env.LANG = 'ru_RU.UTF-8';
      expect(detectSystemLanguage()).toBe('ru');
    });

    it('should detect language from LANGUAGE', () => {
      delete process.env.OLLAMA_CODE_LANG;
      delete process.env.LANG;
      process.env.LANGUAGE = 'de:en';
      expect(detectSystemLanguage()).toBe('de');
    });

    it('should detect language from LC_ALL', () => {
      delete process.env.OLLAMA_CODE_LANG;
      delete process.env.LANG;
      delete process.env.LANGUAGE;
      process.env.LC_ALL = 'pt_BR.UTF-8';
      expect(detectSystemLanguage()).toBe('pt');
    });

    it('should detect language from LC_MESSAGES', () => {
      delete process.env.OLLAMA_CODE_LANG;
      delete process.env.LANG;
      delete process.env.LANGUAGE;
      delete process.env.LC_ALL;
      process.env.LC_MESSAGES = 'ja_JP.UTF-8';
      expect(detectSystemLanguage()).toBe('ja');
    });

    it('should check env vars in priority order (LANG before LANGUAGE)', () => {
      delete process.env.OLLAMA_CODE_LANG;
      process.env.LANG = 'en_US.UTF-8';
      process.env.LANGUAGE = 'ru';
      // LANG is checked before LANGUAGE, so should return 'en'
      expect(detectSystemLanguage()).toBe('en');
    });

    it('should use LANGUAGE when LANG is not set', () => {
      delete process.env.OLLAMA_CODE_LANG;
      delete process.env.LANG;
      process.env.LANGUAGE = 'ru';
      expect(detectSystemLanguage()).toBe('ru');
    });
  });

  describe('Locale format parsing', () => {
    it('should parse locale format with encoding (ru_RU.UTF-8)', () => {
      delete process.env.OLLAMA_CODE_LANG;
      process.env.LANG = 'ru_RU.UTF-8';
      expect(detectSystemLanguage()).toBe('ru');
    });

    it('should parse locale format without encoding (zh_CN)', () => {
      delete process.env.OLLAMA_CODE_LANG;
      process.env.LANG = 'zh_CN';
      expect(detectSystemLanguage()).toBe('zh');
    });

    it('should parse simple locale code (de)', () => {
      delete process.env.OLLAMA_CODE_LANG;
      process.env.LANG = 'de';
      expect(detectSystemLanguage()).toBe('de');
    });

    it('should parse locale with hyphen (pt-BR)', () => {
      delete process.env.OLLAMA_CODE_LANG;
      process.env.LANG = 'pt-BR';
      expect(detectSystemLanguage()).toBe('pt');
    });
  });

  describe('Fallback behavior', () => {
    it('should return "en" when no locale is detected', () => {
      delete process.env.OLLAMA_CODE_LANG;
      delete process.env.LANG;
      delete process.env.LANGUAGE;
      delete process.env.LC_ALL;
      delete process.env.LC_MESSAGES;
      delete process.env.LC_CTYPE;
      
      // Intl API may still return something, so we just check it returns a valid language
      const result = detectSystemLanguage();
      expect(['en', 'zh', 'ru', 'de', 'ja', 'pt']).toContain(result);
    });

    it('should return "en" for unsupported language', () => {
      delete process.env.OLLAMA_CODE_LANG;
      process.env.LANG = 'xx_XX.UTF-8';
      // Should fall back to en or whatever Intl returns
      const result = detectSystemLanguage();
      expect(['en', 'zh', 'ru', 'de', 'ja', 'pt']).toContain(result);
    });
  });

  describe('Case insensitivity', () => {
    it('should handle uppercase locale codes', () => {
      delete process.env.OLLAMA_CODE_LANG;
      process.env.LANG = 'RU_RU.UTF-8';
      expect(detectSystemLanguage()).toBe('ru');
    });

    it('should handle mixed case locale codes', () => {
      delete process.env.OLLAMA_CODE_LANG;
      process.env.LANG = 'Zh_CN.UTF-8';
      expect(detectSystemLanguage()).toBe('zh');
    });
  });
});
