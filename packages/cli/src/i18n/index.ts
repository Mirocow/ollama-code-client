/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { writeStderrLine } from '../utils/stdioHelpers.js';
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
  getLanguageNameFromLocale,
} from './languages.js';

export type { SupportedLanguage };
export { getLanguageNameFromLocale };

// State
let currentLanguage: SupportedLanguage = 'en';
let translations: Record<string, string | string[]> = {};

// Cache
type TranslationValue = string | string[];
type TranslationDict = Record<string, TranslationValue>;
const translationCache: Record<string, TranslationDict> = {};
const loadingPromises: Record<string, Promise<TranslationDict>> = {};
// Path helpers
const getBuiltinLocalesDir = (): string => {
  const __filename = fileURLToPath(import.meta.url);
  return path.join(path.dirname(__filename), 'locales');
};

const getUserLocalesDir = (): string =>
  path.join(homedir(), '.ollama-code', 'locales');

/**
 * Get the path to the user's custom locales directory.
 * Users can place custom language packs (e.g., es.js, fr.js) in this directory.
 * @returns The path to ~/.ollama-code/locales
 */
export function getUserLocalesDirectory(): string {
  return getUserLocalesDir();
}

const getLocalePath = (
  lang: SupportedLanguage,
  useUserDir: boolean = false,
): string => {
  const baseDir = useUserDir ? getUserLocalesDir() : getBuiltinLocalesDir();
  return path.join(baseDir, `${lang}.js`);
};

// Language detection
export function detectSystemLanguage(): SupportedLanguage {
  // Priority 1: Explicit OLLAMA_CODE_LANG environment variable
  const explicitLang = process.env['OLLAMA_CODE_LANG'];
  if (explicitLang) {
    for (const lang of SUPPORTED_LANGUAGES) {
      if (explicitLang.toLowerCase().startsWith(lang.code)) return lang.code;
    }
  }

  // Priority 2: Check multiple locale environment variables
  const localeEnvVars = [
    process.env['LANG'],
    process.env['LANGUAGE'],
    process.env['LC_ALL'],
    process.env['LC_MESSAGES'],
    process.env['LC_CTYPE'],
  ].filter((v): v is string => !!v);

  for (const envLang of localeEnvVars) {
    // Extract language code from locale like "ru_RU.UTF-8" or "ru_RU" or "ru"
    const match = envLang.match(/^([a-z]{2})[_-]?/i);
    if (match) {
      const code = match[1].toLowerCase();
      for (const lang of SUPPORTED_LANGUAGES) {
        if (code === lang.code) return lang.code;
      }
    }
    // Also check if the whole string starts with a language code
    for (const lang of SUPPORTED_LANGUAGES) {
      if (envLang.toLowerCase().startsWith(lang.code)) return lang.code;
    }
  }

  // Priority 3: Try Intl API
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    // Extract language code from locale like "ru-RU" or "ru"
    const match = locale.match(/^([a-z]{2})[_-]?/i);
    if (match) {
      const code = match[1].toLowerCase();
      for (const lang of SUPPORTED_LANGUAGES) {
        if (code === lang.code) return lang.code;
      }
    }
  } catch {
    // Fallback to default
  }

  // Priority 4: Try to detect from system locale command (Unix-like systems)
  try {
    // On Linux, try reading /etc/locale.conf
    if (fs.existsSync('/etc/locale.conf')) {
      const content = fs.readFileSync('/etc/locale.conf', 'utf-8');
      const langMatch = content.match(/^(?:LANG|LC_ALL)\s*=\s*([a-z]{2})/im);
      if (langMatch) {
        const code = langMatch[1].toLowerCase();
        for (const lang of SUPPORTED_LANGUAGES) {
          if (code === lang.code) return lang.code;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  // Priority 5: macOS - try to detect from defaults command
  if (process.platform === 'darwin') {
    try {
      // Try AppleLanguages first - this gives the actual UI language preference
      let result = execSync('defaults read -g AppleLanguages 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      if (result) {
        // Parse array like: ( "ru-RU", "en-US", ... ) or ( ru, en, ... )
        const match = result.match(/\(\s*"([a-z]{2})/i);
        if (match) {
          const code = match[1].toLowerCase();
          for (const lang of SUPPORTED_LANGUAGES) {
            if (code === lang.code) return lang.code;
          }
        }
      }
      
      // Try AppleLocale - format like "ru_RU" or "en_RU"
      result = execSync('defaults read -g AppleLocale 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      if (result) {
        // Extract language code
        let match = result.match(/^([a-z]{2})[_-]?/i);
        if (match) {
          const code = match[1].toLowerCase();
          for (const lang of SUPPORTED_LANGUAGES) {
            if (code === lang.code) return lang.code;
          }
        }
        
        // If language is "en" but region is non-English (e.g., "en_RU"),
        // use the region as a hint for the user's preferred language
        match = result.match(/^en_([A-Z]{2})$/i);
        if (match) {
          const regionToLang: Record<string, string> = {
            'RU': 'ru', 'CN': 'zh', 'TW': 'zh', 'HK': 'zh',
            'DE': 'de', 'AT': 'de', 'CH': 'de',
            'JP': 'ja', 'BR': 'pt', 'PT': 'pt',
            'FR': 'fr', 'ES': 'es', 'IT': 'it',
            'KR': 'ko', 'UA': 'uk', 'CZ': 'cs',
            'PL': 'pl', 'TR': 'tr', 'VN': 'vi',
            'TH': 'th', 'ID': 'id', 'MY': 'ms',
          };
          const regionCode = match[1].toUpperCase();
          const langCode = regionToLang[regionCode];
          if (langCode) {
            for (const lang of SUPPORTED_LANGUAGES) {
              if (langCode === lang.code) return lang.code;
            }
          }
        }
      }
    } catch {
      // Ignore errors - defaults command may not be available
    }
  }

  return 'en';
}

// Translation loading
async function loadTranslationsAsync(
  lang: SupportedLanguage,
): Promise<TranslationDict> {
  if (translationCache[lang]) {
    return translationCache[lang];
  }

  const existingPromise = loadingPromises[lang];
  if (existingPromise) {
    return existingPromise;
  }

  const loadPromise = (async () => {
    // Try user directory first (for custom language packs), then builtin directory
    const searchDirs = [
      { dir: getUserLocalesDir(), isUser: true },
      { dir: getBuiltinLocalesDir(), isUser: false },
    ];

    for (const { dir, isUser } of searchDirs) {
      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        continue;
      }

      const jsPath = getLocalePath(lang, isUser);
      if (!fs.existsSync(jsPath)) {
        continue;
      }

      try {
        // Convert file path to file:// URL for cross-platform compatibility
        const fileUrl = pathToFileURL(jsPath).href;
        try {
          const module = await import(fileUrl);
          const result = module.default || module;
          if (
            result &&
            typeof result === 'object' &&
            Object.keys(result).length > 0
          ) {
            translationCache[lang] = result;
            return result;
          } else {
            throw new Error('Module loaded but result is empty or invalid');
          }
        } catch {
          // If import failed, continue to next directory
          continue;
        }
      } catch (error) {
        // Log warning but continue to next directory
        if (isUser) {
          writeStderrLine(
            `Failed to load translations from user directory for ${lang}: ${error instanceof Error ? error.message : String(error)}`,
          );
        } else {
          writeStderrLine(
            `Failed to load JS translations for ${lang}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        // Continue to next directory
        continue;
      }
    }

    // Return empty object if both directories fail
    // Cache it to avoid repeated failed attempts
    translationCache[lang] = {};
    return {};
  })();

  loadingPromises[lang] = loadPromise;

  // Clean up promise after completion to allow retry on next call if needed
  loadPromise.finally(() => {
    delete loadingPromises[lang];
  });

  return loadPromise;
}

function loadTranslations(lang: SupportedLanguage): TranslationDict {
  // Only return from cache (JS files require async loading)
  return translationCache[lang] || {};
}

// String interpolation
function interpolate(
  template: string,
  params?: Record<string, string>,
): string {
  if (!params) return template;
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (match, key) => params[key] ?? match,
  );
}

// Language setting helpers
function resolveLanguage(lang: SupportedLanguage | 'auto'): SupportedLanguage {
  return lang === 'auto' ? detectSystemLanguage() : lang;
}

// Public API
export function setLanguage(lang: SupportedLanguage | 'auto'): void {
  const resolvedLang = resolveLanguage(lang);
  currentLanguage = resolvedLang;

  // Try to load translations synchronously (from cache only)
  const loaded = loadTranslations(resolvedLang);
  translations = loaded;

  // Warn if translations are empty and JS file exists (requires async loading)
  if (Object.keys(loaded).length === 0) {
    const userJsPath = getLocalePath(resolvedLang, true);
    const builtinJsPath = getLocalePath(resolvedLang, false);
    if (fs.existsSync(userJsPath) || fs.existsSync(builtinJsPath)) {
      writeStderrLine(
        `Language file for ${resolvedLang} requires async loading. ` +
          `Use setLanguageAsync() instead, or call initializeI18n() first.`,
      );
    }
  }
}

export async function setLanguageAsync(
  lang: SupportedLanguage | 'auto',
): Promise<void> {
  currentLanguage = resolveLanguage(lang);
  translations = await loadTranslationsAsync(currentLanguage);
}

export function getCurrentLanguage(): SupportedLanguage {
  return currentLanguage;
}

export function t(key: string, params?: Record<string, string>): string {
  const translation = translations[key] ?? key;
  if (Array.isArray(translation)) {
    return key;
  }
  return interpolate(translation, params);
}

/**
 * Get a translation that is an array of strings.
 * @param key The translation key
 * @returns The array of strings, or an empty array if not found or not an array
 */
export function ta(key: string): string[] {
  const translation = translations[key];
  if (Array.isArray(translation)) {
    return translation;
  }
  return [];
}

export async function initializeI18n(
  lang?: SupportedLanguage | 'auto',
): Promise<void> {
  await setLanguageAsync(lang ?? 'auto');
}
