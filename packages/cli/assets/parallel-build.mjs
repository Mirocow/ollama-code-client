import { access, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const assetsDir = dirname(fileURLToPath(import.meta.url));

// Use pnpm for workspace protocol support
const getPnpmCommand = () => {
  if (process.platform === 'win32') return 'pnpm.cmd';
  return 'pnpm';
};

const pnpmCommand = getPnpmCommand();

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
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
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
    await runCommand({
      command: pnpmCommand,
      args: ['install', '--prefer-offline'],
      cwd: asset.assetPath,
      label: `pnpm install`,
    });

    await runCommand({
      command: pnpmCommand,
      args: ['run', 'build'],
      cwd: asset.assetPath,
      label: `pnpm run build`,
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
