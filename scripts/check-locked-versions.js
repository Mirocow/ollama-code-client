/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Script to verify that all package.json files use exact versions (no ^ or ~)
 * Run as part of CI/CD to prevent version range regressions
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const errors = [];
const warnings = [];

/**
 * Check if a version string uses a range prefix or workspace wildcard
 */
function hasRangePrefix(version) {
  if (!version || typeof version !== 'string') return false;

  // Skip file, git, and other special references (but NOT workspace:)
  if (
    version.startsWith('file:') ||
    version.startsWith('link:') ||
    version.startsWith('portal:') ||
    version.startsWith('git:') ||
    version.startsWith('git+') ||
    version.startsWith('github:') ||
    version.startsWith('http:') ||
    version.startsWith('https:') ||
    version.startsWith('npm:')
  ) {
    return false;
  }

  // Check for workspace wildcards - these are allowed
  if (version.startsWith('workspace:')) {
    // workspace:* workspace:^ workspace:~ are all valid for monorepo
    return false;
  }

  // Check for range prefixes
  if (version.startsWith('^') || version.startsWith('~')) {
    return true;
  }

  // Check for complex ranges like ">=1.0.0 <2.0.0"
  if (/^[><=]/.test(version)) {
    return true;
  }

  return false;
}

/**
 * Recursively find all package.json files
 */
function findPackageJsonFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    if (
      entry === 'node_modules' ||
      entry === 'dist' ||
      entry === '.git' ||
      entry === '.next' ||
      entry === 'build' ||
      entry === 'coverage'
    ) {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findPackageJsonFiles(fullPath, files);
    } else if (entry === 'package.json') {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check a package.json for version ranges
 */
function checkPackageJson(filePath) {
  const relativePath = relative(rootDir, filePath);
  let content;

  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    warnings.push(`Could not read: ${relativePath}`);
    return;
  }

  let pkg;
  try {
    pkg = JSON.parse(content);
  } catch {
    errors.push(`Invalid JSON: ${relativePath}`);
    return;
  }

  const depTypes = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    // Note: peerDependencies are allowed to have ranges
  ];

  for (const depType of depTypes) {
    const deps = pkg[depType];
    if (!deps || typeof deps !== 'object') continue;

    for (const [name, version] of Object.entries(deps)) {
      if (typeof version !== 'string') continue;

      if (hasRangePrefix(version)) {
        errors.push(
          `${relativePath}: ${depType}.${name} uses range "${version}" (should be exact)`,
        );
      }
    }
  }
}

console.log('Checking for version range prefixes in package.json files...\n');

const packageJsonFiles = findPackageJsonFiles(rootDir);
console.log(`Found ${packageJsonFiles.length} package.json files\n`);

for (const filePath of packageJsonFiles) {
  checkPackageJson(filePath);
}

// Print warnings
if (warnings.length > 0) {
  console.log('Warnings:');
  for (const warning of warnings) {
    console.log(`  ⚠️  ${warning}`);
  }
  console.log('');
}

// Print errors
if (errors.length > 0) {
  console.error('❌ Version range prefixes found:\n');
  for (const error of errors) {
    console.error(`  ${error}`);
  }
  console.log(
    '\n💡 Tip: Run "node scripts/lock-versions.js" to fix these automatically.',
  );
  process.exit(1);
} else {
  console.log('✅ All dependencies use exact versions.\n');
  process.exit(0);
}
