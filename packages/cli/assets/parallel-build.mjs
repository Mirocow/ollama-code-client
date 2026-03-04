import { access, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const assetsDir = dirname(fileURLToPath(import.meta.url));

// Detect available package manager (prefer pnpm for monorepo support)
const getPackageManager = () => {
  const checkCommand = (cmd) => {
    try {
      const result = spawnSync(cmd, ['--version'], {
        shell: process.platform === 'win32',
        stdio: 'pipe',
      });
      return result.status === 0;
    } catch {
      return false;
    }
  };

  // Prefer pnpm for workspace/monorepo projects
  if (checkCommand('pnpm')) {
    return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  }
  // Fallback to npm (always available with Node.js)
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
};

const packageManager = getPackageManager();

const entries = await readdir(assetsDir, { withFileTypes: true });
const assetBuilds = [];

for (const entry of entries) {
  if (!entry.isDirectory()) {
    continue;
  }

  const assetPath = join(assetsDir, entry.name);
  const buildPath = join(assetPath, 'build.mjs');
  const packageJsonPath = join(assetPath, 'package.json');
  let hasBuild = false;
  let hasPackageJson = false;

  try {
    await access(buildPath);
    hasBuild = true;
  } catch {
    // ignore missing build.mjs
  }

  try {
    await access(packageJsonPath);
    hasPackageJson = true;
  } catch {
    // ignore missing package.json
  }

  if (hasBuild || hasPackageJson) {
    assetBuilds.push({
      name: entry.name,
      assetPath,
      buildPath,
      useNpm: hasPackageJson,
    });
  }
}

if (assetBuilds.length === 0) {
  process.exit(0);
}

const runCommand = ({ command, args, cwd, label }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      // CI=true disables progress animations to prevent terminal flickering
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192', CI: 'true', TERM: 'dumb' },
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed for ${cwd}.`));
      }
    });
  });

const runBuild = async (asset) => {
  if (asset.useNpm) {
    // Skip install - dependencies are installed at workspace root
    // Just run build using detected package manager (pnpm preferred for workspace protocol)
    await runCommand({
      command: packageManager,
      args: ['run', 'build'],
      cwd: asset.assetPath,
      label: `${packageManager} run build`,
    });
    return;
  }

  await runCommand({
    command: process.execPath,
    args: [asset.buildPath],
    cwd: asset.assetPath,
    label: `Node build`,
  });
};

await Promise.all(assetBuilds.map((asset) => runBuild(asset)));
