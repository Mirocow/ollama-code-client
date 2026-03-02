/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import lintStaged from 'lint-staged';

try {
  // Get repository root
  const root = execSync('git rev-parse --show-toplevel').toString().trim();

  // Check for version range prefixes in package.json files
  console.log('Checking for exact versions in package.json files...');
  try {
    execSync('node scripts/check-locked-versions.js', {
      cwd: root,
      stdio: 'inherit',
    });
  } catch {
    console.error(
      '\n❌ Pre-commit check failed: Some dependencies use version ranges (^ or ~).',
    );
    console.error(
      '   Run "node scripts/lock-versions.js" to fix this automatically.\n',
    );
    process.exit(1);
  }

  // Run lint-staged with API directly
  const passed = await lintStaged({ cwd: root });

  // Exit with appropriate code
  process.exit(passed ? 0 : 1);
} catch {
  // Exit with error code
  process.exit(1);
}
