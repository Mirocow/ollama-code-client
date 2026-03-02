/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { canUseRipgrep } from '@ollama-code/ollama-code-core';

type WarningCheckOptions = {
  workspaceRoot: string;
  useRipgrep: boolean;
  useBuiltinRipgrep: boolean;
};

type WarningCheck = {
  id: string;
  check: (options: WarningCheckOptions) => Promise<string | null>;
};

// Individual warning checks
const homeDirectoryCheck: WarningCheck = {
  id: 'home-directory',
  check: async (options: WarningCheckOptions) => {
    try {
      const [workspaceRealPath, homeRealPath] = await Promise.all([
        fs.realpath(options.workspaceRoot),
        fs.realpath(os.homedir()),
      ]);

      if (workspaceRealPath === homeRealPath) {
        return 'You are running Ollama Code in your home directory. It is recommended to run in a project-specific directory.';
      }
      return null;
    } catch (_err: unknown) {
      return 'Could not verify the current directory due to a file system error.';
    }
  },
};

const rootDirectoryCheck: WarningCheck = {
  id: 'root-directory',
  check: async (options: WarningCheckOptions) => {
    try {
      const workspaceRealPath = await fs.realpath(options.workspaceRoot);
      const errorMessage =
        'Warning: You are running Ollama Code in the root directory. Your entire folder structure will be used for context. It is strongly recommended to run in a project-specific directory.';

      // Check for Unix root directory
      if (path.dirname(workspaceRealPath) === workspaceRealPath) {
        return errorMessage;
      }

      return null;
    } catch (_err: unknown) {
      return 'Could not verify the current directory due to a file system error.';
    }
  },
};

const ripgrepAvailabilityCheck: WarningCheck = {
  id: 'ripgrep-availability',
  check: async (options: WarningCheckOptions) => {
    if (!options.useRipgrep) {
      return null;
    }

    try {
      const isAvailable = await canUseRipgrep(options.useBuiltinRipgrep);
      if (!isAvailable) {
        return 'Ripgrep not available: Please install ripgrep globally to enable faster file content search. Falling back to built-in grep.';
      }
      return null;
    } catch (error) {
      return `Ripgrep not available: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to built-in grep.`;
    }
  },
};

// Check for UTF-8 encoding support
const encodingCheck: WarningCheck = {
  id: 'encoding',
  check: async (_options: WarningCheckOptions) => {
    // Check if LANG or LC_ALL are set to support UTF-8
    const lang = process.env['LANG'] || '';
    const lcAll = process.env['LC_ALL'] || '';
    const lcCtype = process.env['LC_CTYPE'] || '';

    // Check if any of the locale variables contain UTF-8
    const hasUtf8 =
      lang.toLowerCase().includes('utf-8') ||
      lang.toLowerCase().includes('utf8') ||
      lcAll.toLowerCase().includes('utf-8') ||
      lcAll.toLowerCase().includes('utf8') ||
      lcCtype.toLowerCase().includes('utf-8') ||
      lcCtype.toLowerCase().includes('utf8');

    // On Windows, we don't need to check for UTF-8 as it's handled differently
    if (os.platform() === 'win32') {
      return null;
    }

    // If no UTF-8 locale is detected and LANG is not set, warn the user
    if (!hasUtf8 && !lang && !lcAll && !lcCtype) {
      return 'Warning: No UTF-8 locale detected. Cyrillic and other non-ASCII characters may not display correctly. Consider setting LANG=en_US.UTF-8 or LANG=ru_RU.UTF-8 in your shell configuration.';
    }

    // If LANG is set but doesn't contain UTF-8, warn the user
    if (lang && !hasUtf8) {
      return `Warning: Current locale "${lang}" may not support UTF-8. Cyrillic and other non-ASCII characters may not display correctly. Consider setting LANG=en_US.UTF-8 or LANG=ru_RU.UTF-8.`;
    }

    return null;
  },
};

// All warning checks
const WARNING_CHECKS: readonly WarningCheck[] = [
  homeDirectoryCheck,
  rootDirectoryCheck,
  ripgrepAvailabilityCheck,
  encodingCheck,
];

export async function getUserStartupWarnings(
  options: WarningCheckOptions,
): Promise<string[]> {
  const results = await Promise.all(
    WARNING_CHECKS.map((check) => check.check(options)),
  );
  return results.filter((msg): msg is string => msg !== null);
}
