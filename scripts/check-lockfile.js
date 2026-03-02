/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

console.log('Checking lockfile integrity...');

// Check for pnpm-lock.yaml
const pnpmLockPath = join(root, 'pnpm-lock.yaml');
const npmLockPath = join(root, 'package-lock.json');

if (fs.existsSync(pnpmLockPath)) {
  console.log('Found pnpm-lock.yaml');

  // Verify it's not empty
  const stats = fs.statSync(pnpmLockPath);
  if (stats.size < 1000) {
    console.error('❌ pnpm-lock.yaml seems too small, may be corrupted');
    process.exit(1);
  }

  // Check that lockfile version is present
  const content = fs.readFileSync(pnpmLockPath, 'utf-8');
  if (!content.includes('lockfileVersion:')) {
    console.error('❌ pnpm-lock.yaml is missing lockfileVersion');
    process.exit(1);
  }

  // Check for importers section (workspace indicator)
  if (!content.includes('importers:')) {
    console.error('❌ pnpm-lock.yaml is missing importers section');
    process.exit(1);
  }

  console.log('✅ pnpm-lock.yaml is valid');
  process.exit(0);
} else if (fs.existsSync(npmLockPath)) {
  console.log('Found package-lock.json (npm)');

  const lockfile = JSON.parse(fs.readFileSync(npmLockPath, 'utf-8'));
  const packages = lockfile.packages || {};
  const invalidPackages = [];

  for (const [location, details] of Object.entries(packages)) {
    // Skip the root package itself
    if (location === '') {
      continue;
    }

    // Skip local workspace packages
    if (details.link === true || !location.includes('node_modules')) {
      continue;
    }

    // Registry package should have both "resolved" and "integrity"
    if (details.resolved && details.integrity) {
      continue;
    }

    // Git and file dependencies only need a "resolved" field
    const isGitOrFileDep =
      details.resolved?.startsWith('git') ||
      details.resolved?.startsWith('file:');
    if (isGitOrFileDep) {
      continue;
    }

    invalidPackages.push(location);
  }

  if (invalidPackages.length > 0) {
    console.error(
      '\n❌ The following dependencies are missing "resolved" or "integrity":',
    );
    invalidPackages.forEach((pkg) => console.error(`  - ${pkg}`));
    process.exit(1);
  }

  console.log('✅ package-lock.json is valid');
  process.exit(0);
} else {
  console.error('❌ No lockfile found (pnpm-lock.yaml or package-lock.json)');
  process.exit(1);
}
