/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import fs from 'node:fs';
import type { Config } from '../../../../config/config.js';
import { ToolErrorType } from '../../../../tools/tool-error.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  ToolConfirmationOutcome,
  Kind,
  type ToolInvocation,
  type ToolResult,
  type ToolResultDisplay,
  type ToolCallConfirmationDetails,
} from '../../../../tools/tools.js';
import { getErrorMessage } from '../../../../utils/errors.js';
import type { ShellExecutionConfig } from '../../../../services/shellExecutionService.js';
import { ShellExecutionService } from '../../../../services/shellExecutionService.js';
import { createDebugLogger } from '../../../../utils/debugLogger.js';
import type { AnsiOutput } from '../../../../utils/terminalSerializer.js';

import { abortSignalAny } from '../../../../utils/nodePolyfills.js';
const debugLogger = createDebugLogger('NODEJS');

export const DEFAULT_NODEJS_TIMEOUT_MS = 120000;

export type NodePackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export type NodeJsAction =
  | 'run' // Run a Node.js script
  | 'install' // Install dependencies
  | 'add' // Add a package
  | 'remove' // Remove a package
  | 'update' // Update packages
  | 'run_script' // Run package.json script
  | 'test' // Run tests
  | 'build' // Run build
  | 'dev' // Run dev server
  | 'lint' // Run linter
  | 'exec' // Run npx/yarn dlx command
  | 'info' // Show package info
  | 'list' // List installed packages
  | 'outdated' // Check outdated packages
  | 'audit' // Security audit
  | 'clean' // Clean node_modules and lock file
  | 'init' // Initialize new project
  | 'custom'; // Custom command

export interface NodeJsToolParams {
  action: NodeJsAction;
  package_manager?: NodePackageManager;
  script?: string; // Script path for run action
  args?: string[]; // Additional arguments
  packages?: string[]; // Packages for add/remove
  directory?: string; // Working directory
  dev?: boolean; // Add as dev dependency
  global?: boolean; // Global installation
  timeout?: number;
  script_name?: string; // Package.json script name for run_script
  command?: string; // Custom command for exec/custom
  background?: boolean; // Run in background (for dev servers)
  description?: string;
}

export class NodeJsToolInvocation extends BaseToolInvocation<
  NodeJsToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: NodeJsToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = [`Node.js ${this.params.action}`];
    const pm = this.params.package_manager || this.detectPackageManager();

    parts.push(`(${pm})`);

    if (this.params.script) {
      parts.push(`script: ${this.params.script}`);
    }
    if (this.params.packages?.length) {
      parts.push(`packages: ${this.params.packages.join(', ')}`);
    }
    if (this.params.script_name) {
      parts.push(`script: ${this.params.script_name}`);
    }
    if (this.params.directory) {
      parts.push(`[in ${this.params.directory}]`);
    }
    if (this.params.background) {
      parts.push('[background]');
    }
    if (this.params.description) {
      parts.push(`(${this.params.description})`);
    }

    return parts.join(' ');
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    // Actions that modify the project need confirmation
    const needsConfirmation = [
      'install',
      'add',
      'remove',
      'update',
      'clean',
      'init',
    ].includes(this.params.action);

    if (!needsConfirmation) {
      return false;
    }

    const command = this.buildCommand();
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'exec',
      title: `Confirm Node.js ${this.params.action}`,
      command,
      rootCommand: this.params.package_manager || 'npm',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('npm');
          this.allowlist.add('yarn');
          this.allowlist.add('pnpm');
          this.allowlist.add('bun');
          this.allowlist.add('node');
        }
      },
    };

    return confirmationDetails;
  }

  private detectPackageManager(): NodePackageManager {
    const cwd = this.params.directory || this.config.getTargetDir();

    // Check for lock files
    if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
      return 'yarn';
    }
    if (fs.existsSync(path.join(cwd, 'bun.lock'))) {
      return 'bun';
    }
    if (fs.existsSync(path.join(cwd, 'bun.lockb'))) {
      return 'bun';
    }

    // Default to npm
    return 'npm';
  }

  private buildCommand(): string {
    const pm = this.params.package_manager || this.detectPackageManager();

    switch (this.params.action) {
      case 'run':
        return this.buildRunCommand();

      case 'install':
        return this.buildInstallCommand(pm);

      case 'add':
        return this.buildAddCommand(pm);

      case 'remove':
        return this.buildRemoveCommand(pm);

      case 'update':
        return this.buildUpdateCommand(pm);

      case 'run_script':
        return this.buildRunScriptCommand(pm);

      case 'test':
        return this.buildTestCommand(pm);

      case 'build':
        return this.buildBuildCommand(pm);

      case 'dev':
        return this.buildDevCommand(pm);

      case 'lint':
        return this.buildLintCommand(pm);

      case 'exec':
        return this.buildExecCommand(pm);

      case 'info':
        return this.buildInfoCommand(pm);

      case 'list':
        return this.buildListCommand(pm);

      case 'outdated':
        return this.buildOutdatedCommand(pm);

      case 'audit':
        return this.buildAuditCommand(pm);

      case 'clean':
        return this.buildCleanCommand();

      case 'init':
        return this.buildInitCommand(pm);

      case 'custom':
        return this.params.command || '';

      default:
        return '';
    }
  }

  private buildRunCommand(): string {
    const parts = ['node'];
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildInstallCommand(pm: NodePackageManager): string {
    switch (pm) {
      case 'yarn':
        return 'yarn install';
      case 'pnpm':
        return 'pnpm install';
      case 'bun':
        return 'bun install';
      default:
        return 'npm install';
    }
  }

  private buildAddCommand(pm: NodePackageManager): string {
    const packages = this.params.packages || [];
    const devFlag = this.params.dev ? (pm === 'npm' ? ' -D' : ' -D') : '';
    const globalFlag = this.params.global ? ' -g' : '';

    switch (pm) {
      case 'yarn':
        if (this.params.global) {
          return `yarn global add ${packages.join(' ')}`;
        }
        return `yarn add ${packages.join(' ')}${devFlag}`;
      case 'pnpm':
        return `pnpm add ${packages.join(' ')}${devFlag}${globalFlag}`;
      case 'bun':
        return `bun add ${packages.join(' ')}${devFlag}${globalFlag}`;
      default:
        return `npm install ${packages.join(' ')}${devFlag}${globalFlag}`;
    }
  }

  private buildRemoveCommand(pm: NodePackageManager): string {
    const packages = this.params.packages || [];
    const globalFlag = this.params.global ? ' -g' : '';

    switch (pm) {
      case 'yarn':
        if (this.params.global) {
          return `yarn global remove ${packages.join(' ')}`;
        }
        return `yarn remove ${packages.join(' ')}`;
      case 'pnpm':
        return `pnpm remove ${packages.join(' ')}${globalFlag}`;
      case 'bun':
        return `bun remove ${packages.join(' ')}${globalFlag}`;
      default:
        return `npm uninstall ${packages.join(' ')}${globalFlag}`;
    }
  }

  private buildUpdateCommand(pm: NodePackageManager): string {
    const packages = this.params.packages || [];

    switch (pm) {
      case 'yarn':
        return packages.length
          ? `yarn upgrade ${packages.join(' ')}`
          : 'yarn upgrade';
      case 'pnpm':
        return packages.length
          ? `pnpm update ${packages.join(' ')}`
          : 'pnpm update';
      case 'bun':
        return packages.length
          ? `bun update ${packages.join(' ')}`
          : 'bun update';
      default:
        return packages.length
          ? `npm update ${packages.join(' ')}`
          : 'npm update';
    }
  }

  private buildRunScriptCommand(pm: NodePackageManager): string {
    const scriptName = this.params.script_name || '';
    const args = this.params.args || [];

    switch (pm) {
      case 'yarn':
        return `yarn ${scriptName} ${args.join(' ')}`.trim();
      case 'pnpm':
        return `pnpm ${scriptName} ${args.join(' ')}`.trim();
      case 'bun':
        return `bun run ${scriptName} ${args.join(' ')}`.trim();
      default:
        return `npm run ${scriptName} ${args.join(' ')}`.trim();
    }
  }

  private buildTestCommand(pm: NodePackageManager): string {
    const args = this.params.args || [];

    switch (pm) {
      case 'yarn':
        return `yarn test ${args.join(' ')}`.trim();
      case 'pnpm':
        return `pnpm test ${args.join(' ')}`.trim();
      case 'bun':
        return `bun test ${args.join(' ')}`.trim();
      default:
        return `npm test ${args.join(' ')}`.trim();
    }
  }

  private buildBuildCommand(pm: NodePackageManager): string {
    const args = this.params.args || [];

    switch (pm) {
      case 'yarn':
        return `yarn build ${args.join(' ')}`.trim();
      case 'pnpm':
        return `pnpm build ${args.join(' ')}`.trim();
      case 'bun':
        return `bun run build ${args.join(' ')}`.trim();
      default:
        return `npm run build ${args.join(' ')}`.trim();
    }
  }

  private buildDevCommand(pm: NodePackageManager): string {
    const args = this.params.args || [];

    switch (pm) {
      case 'yarn':
        return `yarn dev ${args.join(' ')}`.trim();
      case 'pnpm':
        return `pnpm dev ${args.join(' ')}`.trim();
      case 'bun':
        return `bun dev ${args.join(' ')}`.trim();
      default:
        return `npm run dev ${args.join(' ')}`.trim();
    }
  }

  private buildLintCommand(pm: NodePackageManager): string {
    const args = this.params.args || [];

    switch (pm) {
      case 'yarn':
        return `yarn lint ${args.join(' ')}`.trim();
      case 'pnpm':
        return `pnpm lint ${args.join(' ')}`.trim();
      case 'bun':
        return `bun run lint ${args.join(' ')}`.trim();
      default:
        return `npm run lint ${args.join(' ')}`.trim();
    }
  }

  private buildExecCommand(pm: NodePackageManager): string {
    const command = this.params.command || '';
    const args = this.params.args || [];

    switch (pm) {
      case 'yarn':
        return `yarn dlx ${command} ${args.join(' ')}`.trim();
      case 'pnpm':
        return `pnpm dlx ${command} ${args.join(' ')}`.trim();
      case 'bun':
        return `bunx ${command} ${args.join(' ')}`.trim();
      default:
        return `npx ${command} ${args.join(' ')}`.trim();
    }
  }

  private buildInfoCommand(pm: NodePackageManager): string {
    const packages = this.params.packages || [];

    switch (pm) {
      case 'yarn':
        return `yarn info ${packages.join(' ')}`;
      case 'pnpm':
        return `pnpm info ${packages.join(' ')}`;
      case 'bun':
        return `bun pm ls`;
      default:
        return `npm info ${packages.join(' ')}`;
    }
  }

  private buildListCommand(pm: NodePackageManager): string {
    switch (pm) {
      case 'yarn':
        return 'yarn list --depth=0';
      case 'pnpm':
        return 'pnpm list';
      case 'bun':
        return 'bun pm ls';
      default:
        return 'npm list --depth=0';
    }
  }

  private buildOutdatedCommand(pm: NodePackageManager): string {
    switch (pm) {
      case 'yarn':
        return 'yarn outdated';
      case 'pnpm':
        return 'pnpm outdated';
      case 'bun':
        return 'bun outdated';
      default:
        return 'npm outdated';
    }
  }

  private buildAuditCommand(pm: NodePackageManager): string {
    switch (pm) {
      case 'yarn':
        return 'yarn audit';
      case 'pnpm':
        return 'pnpm audit';
      case 'bun':
        return 'bun audit';
      default:
        return 'npm audit';
    }
  }

  private buildCleanCommand(): string {
    // Works cross-platform
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      return 'if exist node_modules rmdir /s /q node_modules && if exist package-lock.json del package-lock.json && if exist yarn.lock del yarn.lock && if exist pnpm-lock.yaml del pnpm-lock.yaml';
    }
    return 'rm -rf node_modules package-lock.json yarn.lock pnpm-lock.yaml bun.lock bun.lockb';
  }

  private buildInitCommand(pm: NodePackageManager): string {
    const args = this.params.args || [];

    switch (pm) {
      case 'yarn':
        return `yarn init ${args.join(' ')}`.trim();
      case 'pnpm':
        return `pnpm init ${args.join(' ')}`.trim();
      case 'bun':
        return `bun init ${args.join(' ')}`.trim();
      default:
        return `npm init ${args.join(' ')}`.trim();
    }
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: ToolResultDisplay) => void,
    shellExecutionConfig?: ShellExecutionConfig,
  ): Promise<ToolResult> {
    if (signal.aborted) {
      return {
        llmContent:
          'Node.js command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const command = this.buildCommand();
    if (!command) {
      return {
        llmContent: 'Invalid Node.js action or missing required parameters.',
        returnDisplay: 'Error: Invalid Node.js action.',
        error: {
          message: 'Invalid Node.js action or missing required parameters.',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    const effectiveTimeout = this.params.timeout ?? DEFAULT_NODEJS_TIMEOUT_MS;
    let combinedSignal = signal;
    if (effectiveTimeout && !this.params.background) {
      const timeoutSignal = AbortSignal.timeout(effectiveTimeout);
      combinedSignal = abortSignalAny([signal, timeoutSignal]);
    }

    const cwd = this.params.directory || this.config.getTargetDir();
    let cumulativeOutput: string | AnsiOutput = '';
    let lastUpdateTime = Date.now();

    try {
      const { result: resultPromise, pid } =
        await ShellExecutionService.execute(
          command,
          cwd,
          (event) => {
            if (event.type === 'data') {
              cumulativeOutput = event.chunk;
              if (updateOutput && Date.now() - lastUpdateTime > 1000) {
                updateOutput(
                  typeof cumulativeOutput === 'string'
                    ? cumulativeOutput
                    : { ansiOutput: cumulativeOutput },
                );
                lastUpdateTime = Date.now();
              }
            }
          },
          combinedSignal,
          this.config.getShouldUseNodePtyShell(),
          shellExecutionConfig ?? {},
        );

      // For background tasks (like dev servers), return immediately
      if (this.params.background) {
        const pidMsg = pid ? ` PID: ${pid}` : '';
        return {
          llmContent: `Background Node.js process started.${pidMsg} (Use kill ${pid} to stop)`,
          returnDisplay: `Background process started.${pidMsg}`,
        };
      }

      const result = await resultPromise;

      let llmContent = '';
      if (result.aborted) {
        const wasTimeout =
          effectiveTimeout && combinedSignal.aborted && !signal.aborted;
        llmContent = wasTimeout
          ? `Node.js command timed out after ${effectiveTimeout}ms.`
          : 'Node.js command was cancelled by user.';
        if (result.output.trim()) {
          llmContent += `\nOutput before ${wasTimeout ? 'timeout' : 'cancellation'}:\n${result.output}`;
        }
      } else {
        llmContent = [
          `Action: ${this.params.action}`,
          `Command: ${command}`,
          `Directory: ${cwd}`,
          `Output: ${result.output || '(empty)'}`,
          `Exit Code: ${result.exitCode ?? '(none)'}`,
        ].join('\n');
      }

      const executionError = result.error
        ? {
            error: {
              message: result.error.message,
              type: ToolErrorType.SHELL_EXECUTE_ERROR,
            },
          }
        : {};

      return {
        llmContent,
        returnDisplay: result.output || llmContent,
        ...executionError,
      };
    } catch (error) {
      debugLogger.error('Node.js tool execution failed:', error);
      return {
        llmContent: `Node.js command failed: ${getErrorMessage(error)}`,
        returnDisplay: `Error: ${getErrorMessage(error)}`,
        error: {
          message: getErrorMessage(error),
          type: ToolErrorType.SHELL_EXECUTE_ERROR,
        },
      };
    }
  }
}

function getNodeJsToolDescription(): string {
  return `Node.js/JavaScript development tool for managing Node.js projects, packages, and running JavaScript-related commands.

**Supported Package Managers:**
- npm (default)
- yarn
- pnpm
- bun

The tool auto-detects the package manager based on lock files (yarn.lock, pnpm-lock.yaml, bun.lock/bun.lockb).

**Available Actions:**

1. **run** - Execute a Node.js script
   - Requires: \`script\` (path to .js/.mjs/.ts file)
   - Optional: \`args\` (script arguments)

2. **install** - Install dependencies from package.json
   - Uses detected or specified package manager

3. **add** - Add packages to the project
   - Requires: \`packages\` (list of package names)
   - Optional: \`dev\` (add as dev dependency)
   - Optional: \`global\` (install globally)

4. **remove** - Remove packages from the project
   - Requires: \`packages\` (list of package names)
   - Optional: \`global\` (remove global package)

5. **update** - Update packages
   - Optional: \`packages\` (specific packages to update)

6. **run_script** - Run a script from package.json
   - Requires: \`script_name\` (name of the script)
   - Optional: \`args\` (additional arguments)

7. **test** - Run tests (npm test / yarn test)
   - Optional: \`args\` (additional test arguments)

8. **build** - Run build script
   - Optional: \`args\` (additional build arguments)

9. **dev** - Run development server (background mode recommended)
   - Optional: \`background\` (set true for dev servers)
   - Optional: \`args\` (additional dev arguments)

10. **lint** - Run linter
    - Optional: \`args\` (additional lint arguments)

11. **exec** - Run npx/yarn dlx/pnpm dlx/bunx command
    - Requires: \`command\` (command to execute)
    - Optional: \`args\` (command arguments)

12. **info** - Show package information
    - Optional: \`packages\` (packages to get info for)

13. **list** - List installed packages

14. **outdated** - Check for outdated packages

15. **audit** - Run security audit

16. **clean** - Remove node_modules and lock files

17. **init** - Initialize new project
    - Optional: \`args\` (init arguments like -y)

18. **custom** - Run custom command
    - Requires: \`command\` (custom command string)

**Common Parameters:**
- \`package_manager\`: Override auto-detected package manager
- \`directory\`: Working directory (defaults to project root)
- \`timeout\`: Timeout in milliseconds (default: 120000, max: 600000)
- \`background\`: Run in background (for dev servers)
- \`description\`: Brief description of the action

**Examples:**

\`\`\`json
// Install dependencies
{
  "action": "install"
}

// Add packages
{
  "action": "add",
  "packages": ["express", "lodash"],
  "dev": false
}

// Run dev server in background
{
  "action": "dev",
  "background": true,
  "package_manager": "bun"
}

// Run custom npx command
{
  "action": "exec",
  "command": "create-next-app",
  "args": ["my-app", "--typescript"]
}
\`\`\`
`;
}

export class NodeJsTool extends BaseDeclarativeTool<
  NodeJsToolParams,
  ToolResult
> {
  static Name: string = 'nodejs_dev';
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      NodeJsTool.Name,
      'NodeJsDev',
      getNodeJsToolDescription(),
      Kind.Execute,
      {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'run',
              'install',
              'add',
              'remove',
              'update',
              'run_script',
              'test',
              'build',
              'dev',
              'lint',
              'exec',
              'info',
              'list',
              'outdated',
              'audit',
              'clean',
              'init',
              'custom',
            ],
            description: 'The Node.js action to perform',
          },
          package_manager: {
            type: 'string',
            enum: ['npm', 'yarn', 'pnpm', 'bun'],
            description:
              'Package manager to use (auto-detected if not specified)',
          },
          script: {
            type: 'string',
            description: 'JavaScript/TypeScript script path to run',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional arguments for the action',
          },
          packages: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of packages for add/remove actions',
          },
          directory: {
            type: 'string',
            description: 'Working directory for the command',
          },
          dev: {
            type: 'boolean',
            description: 'Add as dev dependency',
          },
          global: {
            type: 'boolean',
            description: 'Install/remove globally',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (max 600000)',
          },
          script_name: {
            type: 'string',
            description: 'Package.json script name to run',
          },
          command: {
            type: 'string',
            description: 'Custom command for exec/custom action',
          },
          background: {
            type: 'boolean',
            description: 'Run in background (for dev servers)',
          },
          description: {
            type: 'string',
            description: 'Brief description of the action',
          },
        },
        required: ['action'],
      },
      false,
      true,
    );
  }

  protected override validateToolParamValues(
    params: NodeJsToolParams,
  ): string | null {
    if (!params.action) {
      return 'Action is required.';
    }

    if (params.action === 'run' && !params.script) {
      return 'Script path is required for run action.';
    }

    if (params.action === 'add' && !params.packages?.length) {
      return 'Packages are required for add action.';
    }

    if (params.action === 'remove' && !params.packages?.length) {
      return 'Packages are required for remove action.';
    }

    if (params.action === 'run_script' && !params.script_name) {
      return 'Script name is required for run_script action.';
    }

    if (params.action === 'exec' && !params.command) {
      return 'Command is required for exec action.';
    }

    if (params.action === 'custom' && !params.command) {
      return 'Command is required for custom action.';
    }

    if (params.timeout !== undefined) {
      if (params.timeout <= 0 || params.timeout > 600000) {
        return 'Timeout must be between 1 and 600000ms.';
      }
    }

    if (params.directory) {
      if (!path.isAbsolute(params.directory)) {
        return 'Directory must be an absolute path.';
      }
      const workspaceDirs = this.config.getWorkspaceContext().getDirectories();
      const isWithinWorkspace = workspaceDirs.some((wsDir) =>
        params.directory!.startsWith(wsDir),
      );
      if (!isWithinWorkspace) {
        return `Directory '${params.directory}' is not within the workspace.`;
      }
    }

    return null;
  }

  protected createInvocation(
    params: NodeJsToolParams,
  ): ToolInvocation<NodeJsToolParams, ToolResult> {
    return new NodeJsToolInvocation(this.config, params, this.allowlist);
  }
}
