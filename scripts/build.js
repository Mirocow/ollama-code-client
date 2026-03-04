/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// npm install if node_modules was removed (e.g. via npm run clean or scripts/clean.js)
if (!existsSync(join(root, 'node_modules'))) {
  execSync('npm install', {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
  });
}

// build all workspaces/packages in dependency order
// CI=true disables progress animations to prevent terminal flickering
execSync('npm run generate', {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192', CI: 'true', TERM: 'dumb' },
});

// Build in dependency order:
// 1. test-utils (no internal dependencies)
// 2. core (foundation package)
// 3. cli (depends on core, test-utils)
// 4. webui (shared UI components)
// 5. sdk (no internal dependencies)
const buildOrder = [
  'packages/test-utils',
  'packages/core',
  'packages/cli',
  'packages/webui',
  'packages/sdk-typescript',
];

for (const workspace of buildOrder) {
  execSync(`npm run build --workspace=${workspace}`, {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192', CI: 'true', TERM: 'dumb' },
  });
}

// also build container image if sandboxing is enabled
// skip (-s) npm install + build since we did that above
try {
  execSync('node scripts/sandbox_command.js -q', {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, CI: 'true', TERM: 'dumb' },
  });
  if (
    process.env.BUILD_SANDBOX === '1' ||
    process.env.BUILD_SANDBOX === 'true'
  ) {
    execSync('node scripts/build_sandbox.js -s', {
      stdio: 'inherit',
      cwd: root,
    });
  }
} catch {
  // ignore
}
