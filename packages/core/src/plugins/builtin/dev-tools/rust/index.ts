/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
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
const debugLogger = createDebugLogger('RUST');

export const DEFAULT_RUST_TIMEOUT_MS = 120000;

export type RustAction =
  | 'run' // Run with cargo run
  | 'build' // Build with cargo build
  | 'test' // Run tests with cargo test
  | 'doc' // Generate documentation
  | 'check' // Check code without building
  | 'clippy' // Run Clippy linter
  | 'fmt' // Format code with rustfmt
  | 'clean' // Clean build artifacts
  | 'cargo_new' // Create new project
  | 'cargo_init' // Initialize project in current directory
  | 'init' // Alias for cargo_init
  | 'new' // Alias for cargo_new
  | 'cargo_add' // Add dependency
  | 'cargo_remove' // Remove dependency
  | 'cargo_update' // Update dependencies
  | 'cargo_tree' // Show dependency tree
  | 'cargo_publish' // Publish to crates.io
  | 'cargo_install' // Install binary
  | 'cargo_search' // Search crates
  | 'cargo_info' // Show crate info
  | 'cargo_lock' // Generate/update Cargo.lock
  | 'custom'; // Custom Cargo command

export interface RustToolParams {
  action: RustAction;
  package?: string; // Package name for workspace
  args?: string[]; // Additional arguments
  directory?: string; // Working directory
  timeout?: number;
  release?: boolean; // Build in release mode
  target?: string; // Target binary/example
  example?: string; // Example to run
  bin?: string; // Binary to run
  test_pattern?: string; // Test pattern for cargo test
  features?: string[]; // Features to enable
  all_features?: boolean; // Enable all features
  no_default_features?: boolean; // Disable default features
  crate_name?: string; // Crate name for cargo add/remove
  crate_version?: string; // Crate version
  command?: string; // Custom command
  description?: string;
}

export class RustToolInvocation extends BaseToolInvocation<
  RustToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: RustToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = [`Rust ${this.params.action}`];

    if (this.params.package) {
      parts.push(`package: ${this.params.package}`);
    }
    if (this.params.bin) {
      parts.push(`bin: ${this.params.bin}`);
    }
    if (this.params.example) {
      parts.push(`example: ${this.params.example}`);
    }
    if (this.params.test_pattern) {
      parts.push(`test: ${this.params.test_pattern}`);
    }
    if (this.params.crate_name) {
      parts.push(`crate: ${this.params.crate_name}`);
    }
    if (this.params.release) {
      parts.push('[release]');
    }
    if (this.params.directory) {
      parts.push(`[in ${this.params.directory}]`);
    }
    if (this.params.description) {
      parts.push(`(${this.params.description})`);
    }

    return parts.join(' ');
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    // Actions that modify the project/system need confirmation
    const needsConfirmation = [
      'cargo_new',
      'new',
      'cargo_init',
      'init',
      'cargo_add',
      'cargo_remove',
      'cargo_publish',
      'cargo_install',
    ].includes(this.params.action);

    if (!needsConfirmation) {
      return false;
    }

    const command = this.buildCommand();
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'exec',
      title: `Confirm Rust ${this.params.action}`,
      command,
      rootCommand: 'cargo',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('cargo');
          this.allowlist.add('rustc');
          this.allowlist.add('rustup');
        }
      },
    };

    return confirmationDetails;
  }

  private buildCommand(): string {
    switch (this.params.action) {
      case 'run':
        return this.buildRunCommand();

      case 'build':
        return this.buildBuildCommand();

      case 'test':
        return this.buildTestCommand();

      case 'doc':
        return this.buildDocCommand();

      case 'check':
        return this.buildCheckCommand();

      case 'clippy':
        return this.buildClippyCommand();

      case 'fmt':
        return this.buildFmtCommand();

      case 'clean':
        return this.buildCleanCommand();

      case 'cargo_new':
      case 'new': // Alias for cargo_new
        return this.buildCargoNewCommand();

      case 'cargo_init':
      case 'init': // Alias for cargo_init
        return this.buildCargoInitCommand();

      case 'cargo_add':
        return this.buildCargoAddCommand();

      case 'cargo_remove':
        return this.buildCargoRemoveCommand();

      case 'cargo_update':
        return this.buildCargoUpdateCommand();

      case 'cargo_tree':
        return this.buildCargoTreeCommand();

      case 'cargo_publish':
        return this.buildCargoPublishCommand();

      case 'cargo_install':
        return this.buildCargoInstallCommand();

      case 'cargo_search':
        return this.buildCargoSearchCommand();

      case 'cargo_info':
        return this.buildCargoInfoCommand();

      case 'cargo_lock':
        return this.buildCargoLockCommand();

      case 'custom':
        return this.params.command || '';

      default:
        return '';
    }
  }

  private addCommonFlags(parts: string[]): void {
    if (this.params.package) {
      parts.push('-p', this.params.package);
    }
    if (this.params.release) {
      parts.push('--release');
    }
    if (this.params.features?.length) {
      parts.push('--features', this.params.features.join(','));
    }
    if (this.params.all_features) {
      parts.push('--all-features');
    }
    if (this.params.no_default_features) {
      parts.push('--no-default-features');
    }
  }

  private buildRunCommand(): string {
    const parts = ['cargo', 'run'];

    if (this.params.bin) {
      parts.push('--bin', this.params.bin);
    } else if (this.params.example) {
      parts.push('--example', this.params.example);
    }

    this.addCommonFlags(parts);

    if (this.params.args?.length) {
      parts.push('--', ...this.params.args);
    }

    return parts.join(' ');
  }

  private buildBuildCommand(): string {
    const parts = ['cargo', 'build'];
    this.addCommonFlags(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildTestCommand(): string {
    const parts = ['cargo', 'test'];

    if (this.params.test_pattern) {
      parts.push(this.params.test_pattern);
    }

    this.addCommonFlags(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildDocCommand(): string {
    const parts = ['cargo', 'doc'];
    this.addCommonFlags(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    } else {
      parts.push('--open');
    }

    return parts.join(' ');
  }

  private buildCheckCommand(): string {
    const parts = ['cargo', 'check'];
    this.addCommonFlags(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildClippyCommand(): string {
    const parts = ['cargo', 'clippy'];
    this.addCommonFlags(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    } else {
      parts.push('--', '-D', 'warnings');
    }

    return parts.join(' ');
  }

  private buildFmtCommand(): string {
    const parts = ['cargo', 'fmt'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCleanCommand(): string {
    const parts = ['cargo', 'clean'];

    if (this.params.package) {
      parts.push('-p', this.params.package);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoNewCommand(): string {
    const parts = ['cargo', 'new'];

    if (this.params.crate_name) {
      parts.push(this.params.crate_name);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoInitCommand(): string {
    const parts = ['cargo', 'init'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoAddCommand(): string {
    const parts = ['cargo', 'add'];

    if (this.params.crate_name) {
      let crateSpec = this.params.crate_name;
      if (this.params.crate_version) {
        crateSpec += `@${this.params.crate_version}`;
      }
      parts.push(crateSpec);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoRemoveCommand(): string {
    const parts = ['cargo', 'remove'];

    if (this.params.crate_name) {
      parts.push(this.params.crate_name);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoUpdateCommand(): string {
    const parts = ['cargo', 'update'];

    if (this.params.crate_name) {
      parts.push('-p', this.params.crate_name);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoTreeCommand(): string {
    const parts = ['cargo', 'tree'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoPublishCommand(): string {
    const parts = ['cargo', 'publish'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoInstallCommand(): string {
    const parts = ['cargo', 'install'];

    if (this.params.crate_name) {
      parts.push(this.params.crate_name);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoSearchCommand(): string {
    const parts = ['cargo', 'search'];

    if (this.params.crate_name) {
      parts.push(this.params.crate_name);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoInfoCommand(): string {
    const parts = ['cargo', 'info'];

    if (this.params.crate_name) {
      parts.push(this.params.crate_name);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCargoLockCommand(): string {
    const parts = ['cargo', 'generate-lockfile'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: ToolResultDisplay) => void,
    shellExecutionConfig?: ShellExecutionConfig,
  ): Promise<ToolResult> {
    if (signal.aborted) {
      return {
        llmContent: 'Rust command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const command = this.buildCommand();
    if (!command) {
      return {
        llmContent: 'Invalid Rust action or missing required parameters.',
        returnDisplay: 'Error: Invalid Rust action.',
        error: {
          message: 'Invalid Rust action or missing required parameters.',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    const effectiveTimeout = this.params.timeout ?? DEFAULT_RUST_TIMEOUT_MS;
    let combinedSignal = signal;
    if (effectiveTimeout) {
      const timeoutSignal = AbortSignal.timeout(effectiveTimeout);
      combinedSignal = abortSignalAny([signal, timeoutSignal]);
    }

    const cwd = this.params.directory || this.config.getTargetDir();
    let cumulativeOutput: string | AnsiOutput = '';
    let lastUpdateTime = Date.now();

    try {
      const { result: resultPromise } = await ShellExecutionService.execute(
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

      const result = await resultPromise;

      let llmContent = '';
      if (result.aborted) {
        const wasTimeout =
          effectiveTimeout && combinedSignal.aborted && !signal.aborted;
        llmContent = wasTimeout
          ? `Rust command timed out after ${effectiveTimeout}ms.`
          : 'Rust command was cancelled by user.';
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
      debugLogger.error('Rust tool execution failed:', error);
      return {
        llmContent: `Rust command failed: ${getErrorMessage(error)}`,
        returnDisplay: `Error: ${getErrorMessage(error)}`,
        error: {
          message: getErrorMessage(error),
          type: ToolErrorType.SHELL_EXECUTE_ERROR,
        },
      };
    }
  }
}

function getRustToolDescription(): string {
  return `Rust development tool for managing Rust projects with Cargo.

**Available Actions:**

1. **run** - Run the main binary or a specific binary/example
   - Optional: \`bin\` (binary name)
   - Optional: \`example\` (example name)
   - Optional: \`release\` (run in release mode)
   - Optional: \`args\` (program arguments after --)

2. **build** - Build the project
   - Optional: \`release\` (build in release mode)
   - Optional: \`package\` (specific package in workspace)

3. **test** - Run tests
   - Optional: \`test_pattern\` (test name pattern)
   - Optional: \`package\` (specific package)

4. **doc** - Generate and open documentation
   - Optional: \`package\` (specific package)

5. **check** - Check code without building (faster than build)
   - Optional: \`package\` (specific package)

6. **clippy** - Run Clippy linter
   - Optional: \`args\` (clippy arguments)

7. **fmt** - Format code with rustfmt

8. **clean** - Remove build artifacts
   - Optional: \`package\` (specific package)

9. **cargo_new** - Create a new project
   - Requires: \`crate_name\` (project name)
   - Optional: \`args\` (--lib for library)

10. **cargo_init** - Initialize project in current directory
    - Optional: \`args\` (--lib for library)

11. **cargo_add** - Add a dependency
    - Requires: \`crate_name\` (crate name)
    - Optional: \`crate_version\` (version)
    - Optional: \`args\` (--dev for dev dependency)

12. **cargo_remove** - Remove a dependency
    - Requires: \`crate_name\` (crate name)

13. **cargo_update** - Update dependencies
    - Optional: \`crate_name\` (specific crate)

14. **cargo_tree** - Show dependency tree
    - Optional: \`args\` (tree arguments)

15. **cargo_publish** - Publish to crates.io
    - Optional: \`args\` (publish arguments)

16. **cargo_install** - Install a binary crate
    - Requires: \`crate_name\` (crate name)

17. **cargo_search** - Search for crates
    - Optional: \`crate_name\` (search term)

18. **cargo_info** - Show crate information
    - Requires: \`crate_name\` (crate name)

19. **cargo_lock** - Generate or update Cargo.lock

20. **custom** - Run custom Cargo command
    - Requires: \`command\` (custom command string)

**Common Parameters:**
- \`directory\`: Working directory (defaults to project root)
- \`timeout\`: Timeout in milliseconds (default: 120000, max: 600000)
- \`features\`: Features to enable
- \`all_features\`: Enable all features
- \`no_default_features\`: Disable default features
- \`description\`: Brief description of the action

**Examples:**

\`\`\`json
// Run the project
{
  "action": "run",
  "args": ["--config", "config.toml"]
}

// Run a specific binary in release mode
{
  "action": "run",
  "bin": "my-server",
  "release": true
}

// Build in release mode
{
  "action": "build",
  "release": true
}

// Run specific test
{
  "action": "test",
  "test_pattern": "test_user_auth",
  "package": "my-lib"
}

// Run Clippy with warnings as errors
{
  "action": "clippy"
}

// Add a dependency
{
  "action": "cargo_add",
  "crate_name": "serde",
  "args": ["--features", "derive"]
}

// Add dev dependency
{
  "action": "cargo_add",
  "crate_name": "tokio-test",
  "args": ["--dev"]
}

// Create a new project
{
  "action": "cargo_new",
  "crate_name": "my-project"
}

// Check without building
{
  "action": "check",
  "all_features": true
}

// Generate documentation
{
  "action": "doc"
}
\`\`\`
`;
}

export class RustTool extends BaseDeclarativeTool<RustToolParams, ToolResult> {
  static Name: string = 'rust_dev';
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      RustTool.Name,
      'RustDev',
      getRustToolDescription(),
      Kind.Execute,
      {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'run',
              'build',
              'test',
              'doc',
              'check',
              'clippy',
              'fmt',
              'clean',
              'cargo_new',
              'cargo_init',
              'init', // Alias for cargo_init
              'new', // Alias for cargo_new
              'cargo_add',
              'cargo_remove',
              'cargo_update',
              'cargo_tree',
              'cargo_publish',
              'cargo_install',
              'cargo_search',
              'cargo_info',
              'cargo_lock',
              'custom',
            ],
            description: 'The Rust action to perform',
          },
          package: {
            type: 'string',
            description: 'Package name for workspace operations',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional arguments for the action',
          },
          directory: {
            type: 'string',
            description: 'Working directory for the command',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (max 600000)',
          },
          release: {
            type: 'boolean',
            description: 'Build in release mode',
          },
          target: {
            type: 'string',
            description: 'Target binary or example',
          },
          example: {
            type: 'string',
            description: 'Example to run',
          },
          bin: {
            type: 'string',
            description: 'Binary to run',
          },
          test_pattern: {
            type: 'string',
            description: 'Test pattern for cargo test',
          },
          features: {
            type: 'array',
            items: { type: 'string' },
            description: 'Features to enable',
          },
          all_features: {
            type: 'boolean',
            description: 'Enable all features',
          },
          no_default_features: {
            type: 'boolean',
            description: 'Disable default features',
          },
          crate_name: {
            type: 'string',
            description: 'Crate name for add/remove/search operations',
          },
          crate_version: {
            type: 'string',
            description: 'Crate version for add operation',
          },
          command: {
            type: 'string',
            description: 'Custom command for custom action',
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
    params: RustToolParams,
  ): string | null {
    if (!params.action) {
      return 'Action is required.';
    }

    if ((params.action === 'cargo_new' || params.action === 'new') && !params.crate_name) {
      return 'Crate name is required for cargo_new action.';
    }

    if (params.action === 'cargo_add' && !params.crate_name) {
      return 'Crate name is required for cargo_add action.';
    }

    if (params.action === 'cargo_remove' && !params.crate_name) {
      return 'Crate name is required for cargo_remove action.';
    }

    if (params.action === 'cargo_install' && !params.crate_name) {
      return 'Crate name is required for cargo_install action.';
    }

    if (params.action === 'cargo_info' && !params.crate_name) {
      return 'Crate name is required for cargo_info action.';
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
    params: RustToolParams,
  ): ToolInvocation<RustToolParams, ToolResult> {
    return new RustToolInvocation(this.config, params, this.allowlist);
  }
}
