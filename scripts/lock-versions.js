#!/usr/bin/env node

/**
 * Script to lock all dependency versions in package.json files
 * - Removes ^ and ~ prefixes from all dependency versions
 * - Converts workspace:* to exact version numbers
 *
 * Usage: node scripts/lock-versions.js [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const isDryRun = process.argv.includes('--dry-run');

/**
 * Collect all workspace package versions
 * Returns a map of package name -> version
 */
function collectWorkspaceVersions() {
  const versions = new Map();
  const packageJsonFiles = findPackageJsonFiles(rootDir);

  for (const filePath of packageJsonFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const pkg = JSON.parse(content);

      if (pkg.name && pkg.version) {
        versions.set(pkg.name, pkg.version);
      }
    } catch {
      // Ignore errors
    }
  }

  return versions;
}

/**
 * Remove version range prefixes and convert workspace references to exact versions
 */
function lockVersion(version, _workspaceVersions) {
  if (!version || typeof version !== 'string') {
    return version;
  }

  // Handle workspace references - convert to exact version
  if (version.startsWith('workspace:')) {
    const spec = version.replace('workspace:', '');

    // workspace:* -> use version from workspace package
    if (spec === '*' || spec === '^' || spec === '~') {
      // This will be handled separately with package name context
      return version; // Return as-is, will be processed in processPackage
    }

    // workspace:^1.0.0 -> workspace:1.0.0
    // workspace:1.0.0 -> workspace:1.0.0 (keep as-is)
    const versionOnly = spec.replace(/^[\^~]/, '');
    if (/^\d/.test(versionOnly)) {
      // Already has a valid version, keep workspace: prefix
      return `workspace:${versionOnly}`;
    }

    return version;
  }

  // Skip file references, git URLs, etc.
  if (
    version.startsWith('file:') ||
    version.startsWith('link:') ||
    version.startsWith('portal:') ||
    version.startsWith('git:') ||
    version.startsWith('git+') ||
    version.startsWith('github:') ||
    version.startsWith('http:') ||
    version.startsWith('https:')
  ) {
    return version;
  }

  // Handle complex ranges like ">=1.0.0 <2.0.0" or "^1.0.0 || ^2.0.0"
  const parts = version.split(/\s*\|\|\s*|\s+/);
  let cleanVersion = parts[0];

  // Remove all range prefixes
  cleanVersion = cleanVersion.replace(/^[\^~>=<]+/, '');

  // If we have something like "1.0.0 <2.0.0", take just the version
  cleanVersion = cleanVersion.split(/\s*[<>=]/)[0];

  // Validate it looks like a version
  if (/^\d/.test(cleanVersion)) {
    return cleanVersion;
  }

  return version;
}

/**
 * Process a package.json object and lock all dependency versions
 */
function processPackage(pkg, workspaceVersions) {
  const changed = [];

  const depTypes = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    // Note: peerDependencies are intentionally NOT included here
    // because they typically need to support version ranges
  ];

  for (const depType of depTypes) {
    const deps = pkg[depType];
    if (!deps || typeof deps !== 'object') continue;

    for (const [name, version] of Object.entries(deps)) {
      if (typeof version !== 'string') continue;

      // Handle workspace references
      if (version.startsWith('workspace:')) {
        const spec = version.replace('workspace:', '');

        // workspace:* -> exact version with workspace: prefix
        if (spec === '*' || spec === '^' || spec === '~') {
          const exactVersion = workspaceVersions.get(name);
          if (exactVersion) {
            const newVersion = `workspace:${exactVersion}`;
            deps[name] = newVersion;
            changed.push({
              type: depType,
              name,
              from: version,
              to: newVersion,
            });
            continue;
          }
        }
      }

      // If this is a workspace package, use workspace:VERSION
      if (workspaceVersions.has(name) && !version.startsWith('workspace:')) {
        const wsVersion = workspaceVersions.get(name);
        const newVersion = `workspace:${wsVersion}`;
        deps[name] = newVersion;
        changed.push({
          type: depType,
          name,
          from: version,
          to: newVersion,
        });
        continue;
      }

      const lockedVersion = lockVersion(version, workspaceVersions);
      if (lockedVersion !== version) {
        deps[name] = lockedVersion;
        changed.push({
          type: depType,
          name,
          from: version,
          to: lockedVersion,
        });
      }
    }
  }

  // Process overrides/resolutions
  const overrideTypes = ['overrides', 'resolutions', 'pnpm.overrides'];
  for (const overrideType of overrideTypes) {
    const overrides = overrideType
      .split('.')
      .reduce((obj, key) => obj?.[key], pkg);
    if (!overrides || typeof overrides !== 'object') continue;

    const targetObj = overrideType.split('.').reduce((obj, key, idx, arr) => {
      if (idx === arr.length - 1) return obj;
      return obj[key];
    }, pkg);

    const key = overrideType.split('.').pop();

    for (const [name, version] of Object.entries(overrides)) {
      if (typeof version !== 'string') continue;

      // Handle workspace references in overrides
      if (version.startsWith('workspace:')) {
        const spec = version.replace('workspace:', '');
        if (spec === '*' || spec === '^' || spec === '~') {
          const exactVersion = workspaceVersions.get(name);
          if (exactVersion) {
            targetObj[key][name] = `workspace:${exactVersion}`;
            changed.push({
              type: overrideType,
              name,
              from: version,
              to: `workspace:${exactVersion}`,
            });
            continue;
          }
        }
      }

      const lockedVersion = lockVersion(version, workspaceVersions);
      if (lockedVersion !== version) {
        targetObj[key][name] = lockedVersion;
        changed.push({
          type: overrideType,
          name,
          from: version,
          to: lockedVersion,
        });
      }
    }
  }

  return changed;
}

/**
 * Recursively find all package.json files
 */
function findPackageJsonFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    // Skip node_modules, dist, .git, etc.
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
 * Main function
 */
function main() {
  console.log('Locking all dependency versions...');
  console.log(
    `Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'APPLYING CHANGES'}`,
  );
  console.log('');

  // First, collect all workspace package versions
  const workspaceVersions = collectWorkspaceVersions();
  console.log(`Found ${workspaceVersions.size} workspace packages:`);
  for (const [name, version] of workspaceVersions) {
    console.log(`  ${name}@${version}`);
  }
  console.log('');

  const packageJsonFiles = findPackageJsonFiles(rootDir);
  let totalChanges = 0;

  for (const filePath of packageJsonFiles) {
    const relativePath = filePath.replace(rootDir + '/', '');

    try {
      const content = readFileSync(filePath, 'utf-8');
      const pkg = JSON.parse(content);

      // Skip if no dependencies at all
      if (
        !pkg.dependencies &&
        !pkg.devDependencies &&
        !pkg.optionalDependencies &&
        !pkg.peerDependencies &&
        !pkg.overrides &&
        !pkg.resolutions
      ) {
        continue;
      }

      const changes = processPackage(pkg, workspaceVersions);

      if (changes.length > 0) {
        console.log(`\n${relativePath}:`);
        for (const change of changes) {
          console.log(
            `  ${change.type}/${change.name}: ${change.from} -> ${change.to}`,
          );
        }

        if (!isDryRun) {
          writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
        }

        totalChanges += changes.length;
      }
    } catch (error) {
      console.error(`Error processing ${relativePath}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Total changes: ${totalChanges}`);
  if (isDryRun) {
    console.log('Run without --dry-run to apply these changes.');
  } else {
    console.log('Changes applied. Run "pnpm install" to update lockfile.');
  }
}

main();
