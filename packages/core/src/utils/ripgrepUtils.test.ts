/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { getBuiltinRipgrep, requiresPcre2 } from './ripgrepUtils.js';
import path from 'node:path';

describe('ripgrepUtils', () => {
  describe('requiresPcre2', () => {
    describe('positive look-ahead', () => {
      it('should detect positive look-ahead pattern', () => {
        expect(requiresPcre2('(?=.*\\bword\\b)')).toBe(true);
      });

      it('should detect positive look-ahead in complex pattern', () => {
        expect(requiresPcre2('(?=.*\\bfactory\\b)(?=.*\\bmodel\\b)')).toBe(true);
      });

      it('should detect positive look-ahead with content', () => {
        expect(requiresPcre2('foo(?=bar)')).toBe(true);
      });
    });

    describe('negative look-ahead', () => {
      it('should detect negative look-ahead pattern', () => {
        expect(requiresPcre2('(?!.*warning)')).toBe(true);
      });

      it('should detect negative look-ahead in error pattern', () => {
        expect(requiresPcre2('error(?!.*warning)')).toBe(true);
      });
    });

    describe('positive look-behind', () => {
      it('should detect positive look-behind pattern', () => {
        expect(requiresPcre2('(?<=static )import')).toBe(true);
      });

      it('should detect positive look-behind with word boundary', () => {
        expect(requiresPcre2('(?<=\\bclass\\s)\\w+')).toBe(true);
      });
    });

    describe('negative look-behind', () => {
      it('should detect negative look-behind pattern', () => {
        expect(requiresPcre2('(?<!\\$)foo')).toBe(true);
      });

      it('should detect negative look-behind in complex pattern', () => {
        expect(requiresPcre2('(?<!@)import(?!"")')).toBe(true);
      });
    });

    describe('patterns not requiring PCRE2', () => {
      it('should return false for simple patterns', () => {
        expect(requiresPcre2('simple')).toBe(false);
      });

      it('should return false for basic regex', () => {
        expect(requiresPcre2('function\\s+\\w+')).toBe(false);
      });

      it('should return false for character classes', () => {
        expect(requiresPcre2('[a-zA-Z]+')).toBe(false);
      });

      it('should return false for quantifiers', () => {
        expect(requiresPcre2('a*b+c?')).toBe(false);
      });

      it('should return false for groups', () => {
        expect(requiresPcre2('(foo|bar)')).toBe(false);
      });

      it('should return false for anchors', () => {
        expect(requiresPcre2('^start|end$')).toBe(false);
      });

      it('should return false for escaped characters', () => {
        expect(requiresPcre2('\\bword\\b')).toBe(false);
      });

      it('should return false for empty pattern', () => {
        expect(requiresPcre2('')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should detect multiple look-around patterns', () => {
        expect(requiresPcre2('(?<=foo)(?=bar)')).toBe(true);
      });

      it('should handle nested parentheses', () => {
        expect(requiresPcre2('(?=(foo|bar))')).toBe(true);
      });

      it('should not match look-alike patterns', () => {
        // These look similar but are not look-around
        expect(requiresPcre2('(=literal)')).toBe(false);
        expect(requiresPcre2('(?!literal)')).toBe(true); // This IS negative look-ahead
      });
    });
  });

  describe('getBuiltinRipgrep', () => {
    it('should return path with .exe extension on Windows', () => {
      const originalPlatform = process.platform;
      const originalArch = process.arch;

      // Mock Windows x64
      Object.defineProperty(process, 'platform', { value: 'win32' });
      Object.defineProperty(process, 'arch', { value: 'x64' });

      const rgPath = getBuiltinRipgrep();

      expect(rgPath).toContain('x64-win32');
      expect(rgPath).toContain('rg.exe');
      expect(rgPath).toContain(path.join('vendor', 'ripgrep'));

      // Restore original values
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('should return path without .exe extension on macOS', () => {
      const originalPlatform = process.platform;
      const originalArch = process.arch;

      // Mock macOS arm64
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      Object.defineProperty(process, 'arch', { value: 'arm64' });

      const rgPath = getBuiltinRipgrep();

      expect(rgPath).toContain('arm64-darwin');
      expect(rgPath).toContain('rg');
      expect(rgPath).not.toContain('.exe');
      expect(rgPath).toContain(path.join('vendor', 'ripgrep'));

      // Restore original values
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('should return path without .exe extension on Linux', () => {
      const originalPlatform = process.platform;
      const originalArch = process.arch;

      // Mock Linux x64
      Object.defineProperty(process, 'platform', { value: 'linux' });
      Object.defineProperty(process, 'arch', { value: 'x64' });

      const rgPath = getBuiltinRipgrep();

      expect(rgPath).toContain('x64-linux');
      expect(rgPath).toContain('rg');
      expect(rgPath).not.toContain('.exe');
      expect(rgPath).toContain(path.join('vendor', 'ripgrep'));

      // Restore original values
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('should return null for unsupported platform', () => {
      const originalPlatform = process.platform;
      const originalArch = process.arch;

      // Mock unsupported platform
      Object.defineProperty(process, 'platform', { value: 'freebsd' });
      Object.defineProperty(process, 'arch', { value: 'x64' });

      expect(getBuiltinRipgrep()).toBeNull();

      // Restore original values
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('should return null for unsupported architecture', () => {
      const originalPlatform = process.platform;
      const originalArch = process.arch;

      // Mock unsupported architecture
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      Object.defineProperty(process, 'arch', { value: 'ia32' });

      expect(getBuiltinRipgrep()).toBeNull();

      // Restore original values
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('should handle all supported platform/arch combinations', () => {
      const originalPlatform = process.platform;
      const originalArch = process.arch;

      const combinations: Array<{
        platform: string;
        arch: string;
      }> = [
        { platform: 'darwin', arch: 'x64' },
        { platform: 'darwin', arch: 'arm64' },
        { platform: 'linux', arch: 'x64' },
        { platform: 'linux', arch: 'arm64' },
        { platform: 'win32', arch: 'x64' },
      ];

      combinations.forEach(({ platform, arch }) => {
        Object.defineProperty(process, 'platform', { value: platform });
        Object.defineProperty(process, 'arch', { value: arch });

        const rgPath = getBuiltinRipgrep();
        const binaryName = platform === 'win32' ? 'rg.exe' : 'rg';
        const expectedPathSegment = path.join(
          `${arch}-${platform}`,
          binaryName,
        );
        expect(rgPath).toContain(expectedPathSegment);
      });

      // Restore original values
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'arch', { value: originalArch });
    });
  });
});
