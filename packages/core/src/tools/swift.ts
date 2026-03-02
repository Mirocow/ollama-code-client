/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  ToolConfirmationOutcome,
  Kind,
  type ToolInvocation,
  type ToolResult,
  type ToolResultDisplay,
  type ToolCallConfirmationDetails,
} from './tools.js';
import { getErrorMessage } from '../utils/errors.js';
import type { ShellExecutionConfig } from '../services/shellExecutionService.js';
import { ShellExecutionService } from '../services/shellExecutionService.js';
import { createDebugLogger } from '../utils/debugLogger.js';
import type { AnsiOutput } from '../utils/terminalSerializer.js';

import { abortSignalAny } from '../utils/nodePolyfills.js';
const debugLogger = createDebugLogger('SWIFT');

export const DEFAULT_SWIFT_TIMEOUT_MS = 120000;

export type SwiftAction =
  | 'run' // Run with swift run
  | 'build' // Build with swift build
  | 'test' // Run tests with swift test
  | 'package_init' // Initialize package
  | 'package_resolve' // Resolve dependencies
  | 'package_update' // Update dependencies
  | 'package_dump' // Dump package info
  | 'package_desc' // Describe package
  | 'package_clean' // Clean build artifacts
  | 'package_edit' // Put package in editable mode
  | 'package_unedit' // Remove package from editable mode
  | 'package_reset' // Reset complete cache
  | 'custom'; // Custom Swift command

export interface SwiftToolParams {
  action: SwiftAction;
  args?: string[]; // Additional arguments
  directory?: string; // Working directory
  timeout?: number;
  configuration?: 'debug' | 'release'; // Build configuration
  target?: string; // Target to build/run
  product?: string; // Product to build/run
  package_name?: string; // Package name for init
  package_type?: 'library' | 'executable' | 'system-module' | 'manifest'; // Type for init
  enable_test_discovery?: boolean; // Enable test discovery
  skip_update?: boolean; // Skip package update
  command?: string; // Custom command
  description?: string;
}

export class SwiftToolInvocation extends BaseToolInvocation<
  SwiftToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: SwiftToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = [`Swift ${this.params.action}`];

    if (this.params.target) {
      parts.push(`target: ${this.params.target}`);
    }
    if (this.params.product) {
      parts.push(`product: ${this.params.product}`);
    }
    if (this.params.package_name) {
      parts.push(`package: ${this.params.package_name}`);
    }
    if (this.params.configuration) {
      parts.push(`[${this.params.configuration}]`);
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
    // Actions that modify the project need confirmation
    const needsConfirmation = [
      'package_init',
      'package_edit',
      'package_reset',
    ].includes(this.params.action);

    if (!needsConfirmation) {
      return false;
    }

    const command = this.buildCommand();
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'exec',
      title: `Confirm Swift ${this.params.action}`,
      command,
      rootCommand: 'swift',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('swift');
          this.allowlist.add('swiftc');
          this.allowlist.add('spm');
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

      case 'package_init':
        return this.buildPackageInitCommand();

      case 'package_resolve':
        return this.buildPackageResolveCommand();

      case 'package_update':
        return this.buildPackageUpdateCommand();

      case 'package_dump':
        return this.buildPackageDumpCommand();

      case 'package_desc':
        return this.buildPackageDescCommand();

      case 'package_clean':
        return this.buildPackageCleanCommand();

      case 'package_edit':
        return this.buildPackageEditCommand();

      case 'package_unedit':
        return this.buildPackageUneditCommand();

      case 'package_reset':
        return this.buildPackageResetCommand();

      case 'custom':
        return this.params.command || '';

      default:
        return '';
    }
  }

  private addCommonFlags(parts: string[]): void {
    if (this.params.configuration) {
      parts.push('-c', this.params.configuration);
    }
    if (this.params.skip_update) {
      parts.push('--skip-update');
    }
  }

  private buildRunCommand(): string {
    const parts = ['swift', 'run'];

    if (this.params.product) {
      parts.push(this.params.product);
    } else if (this.params.target) {
      parts.push(this.params.target);
    }

    this.addCommonFlags(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildBuildCommand(): string {
    const parts = ['swift', 'build'];

    if (this.params.target) {
      parts.push('--target', this.params.target);
    } else if (this.params.product) {
      parts.push('--product', this.params.product);
    }

    this.addCommonFlags(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildTestCommand(): string {
    const parts = ['swift', 'test'];

    this.addCommonFlags(parts);

    if (this.params.enable_test_discovery) {
      parts.push('--enable-test-discovery');
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    } else {
      parts.push('--parallel');
    }

    return parts.join(' ');
  }

  private buildPackageInitCommand(): string {
    const parts = ['swift', 'package', 'init'];

    if (this.params.package_name) {
      parts.push('--name', this.params.package_name);
    }

    if (this.params.package_type) {
      parts.push('--type', this.params.package_type);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildPackageResolveCommand(): string {
    const parts = ['swift', 'package', 'resolve'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildPackageUpdateCommand(): string {
    const parts = ['swift', 'package', 'update'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildPackageDumpCommand(): string {
    const parts = ['swift', 'package', 'dump-package'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildPackageDescCommand(): string {
    const parts = ['swift', 'package', 'describe'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    } else {
      parts.push('--type', 'json');
    }

    return parts.join(' ');
  }

  private buildPackageCleanCommand(): string {
    const parts = ['swift', 'package', 'clean'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildPackageEditCommand(): string {
    const parts = ['swift', 'package', 'edit'];

    if (this.params.package_name) {
      parts.push(this.params.package_name);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildPackageUneditCommand(): string {
    const parts = ['swift', 'package', 'unedit'];

    if (this.params.package_name) {
      parts.push(this.params.package_name);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildPackageResetCommand(): string {
    const parts = ['swift', 'package', 'reset'];

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
        llmContent:
          'Swift command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const command = this.buildCommand();
    if (!command) {
      return {
        llmContent: 'Invalid Swift action or missing required parameters.',
        returnDisplay: 'Error: Invalid Swift action.',
        error: {
          message: 'Invalid Swift action or missing required parameters.',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    const effectiveTimeout = this.params.timeout ?? DEFAULT_SWIFT_TIMEOUT_MS;
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
          ? `Swift command timed out after ${effectiveTimeout}ms.`
          : 'Swift command was cancelled by user.';
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
      debugLogger.error('Swift tool execution failed:', error);
      return {
        llmContent: `Swift command failed: ${getErrorMessage(error)}`,
        returnDisplay: `Error: ${getErrorMessage(error)}`,
        error: {
          message: getErrorMessage(error),
          type: ToolErrorType.SHELL_EXECUTE_ERROR,
        },
      };
    }
  }
}

function getSwiftToolDescription(): string {
  return `Swift development tool for managing Swift projects with Swift Package Manager (SPM).

**Available Actions:**

1. **run** - Run an executable product or target
   - Optional: \`product\` (product name to run)
   - Optional: \`target\` (target name to run)
   - Optional: \`configuration\` (debug or release)
   - Optional: \`args\` (program arguments)

2. **build** - Build the project
   - Optional: \`target\` (specific target to build)
   - Optional: \`product\` (specific product to build)
   - Optional: \`configuration\` (debug or release)

3. **test** - Run tests
   - Optional: \`configuration\` (debug or release)
   - Optional: \`enable_test_discovery\` (enable test discovery)
   - Optional: \`args\` (additional test arguments)

4. **package_init** - Initialize a new package
   - Optional: \`package_name\` (package name)
   - Optional: \`package_type\` (library, executable, system-module, manifest)

5. **package_resolve** - Resolve package dependencies
   - Optional: \`args\` (additional arguments)

6. **package_update** - Update package dependencies
   - Optional: \`args\` (additional arguments)

7. **package_dump** - Dump package manifest as JSON
   - Optional: \`args\` (additional arguments)

8. **package_desc** - Describe the package structure
   - Optional: \`args\` (--type json for JSON output)

9. **package_clean** - Clean build artifacts
   - Optional: \`args\` (additional arguments)

10. **package_edit** - Put a dependency in editable mode
    - Requires: \`package_name\` (package to edit)

11. **package_unedit** - Remove a dependency from editable mode
    - Requires: \`package_name\` (package name)

12. **package_reset** - Reset the complete package cache

13. **custom** - Run custom Swift command
    - Requires: \`command\` (custom command string)

**Common Parameters:**
- \`directory\`: Working directory (defaults to project root)
- \`timeout\`: Timeout in milliseconds (default: 120000, max: 600000)
- \`skip_update\`: Skip package update during build
- \`description\`: Brief description of the action

**Examples:**

\`\`\`json
// Run the main executable
{
  "action": "run"
}

// Run a specific product in release mode
{
  "action": "run",
  "product": "MyApp",
  "configuration": "release",
  "args": ["--verbose"]
}

// Build in release mode
{
  "action": "build",
  "configuration": "release"
}

// Build a specific target
{
  "action": "build",
  "target": "MyLibrary"
}

// Run tests in parallel
{
  "action": "test"
}

// Initialize a new library package
{
  "action": "package_init",
  "package_name": "MyLibrary",
  "package_type": "library"
}

// Initialize an executable package
{
  "action": "package_init",
  "package_name": "MyApp",
  "package_type": "executable"
}

// Resolve dependencies
{
  "action": "package_resolve"
}

// Update dependencies
{
  "action": "package_update"
}

// Get package info as JSON
{
  "action": "package_desc"
}

// Clean build artifacts
{
  "action": "package_clean"
}
\`\`\`
`;
}

export class SwiftTool extends BaseDeclarativeTool<
  SwiftToolParams,
  ToolResult
> {
  static Name: string = 'swift_dev';
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      SwiftTool.Name,
      'SwiftDev',
      getSwiftToolDescription(),
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
              'package_init',
              'package_resolve',
              'package_update',
              'package_dump',
              'package_desc',
              'package_clean',
              'package_edit',
              'package_unedit',
              'package_reset',
              'custom',
            ],
            description: 'The Swift action to perform',
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
          configuration: {
            type: 'string',
            enum: ['debug', 'release'],
            description: 'Build configuration',
          },
          target: {
            type: 'string',
            description: 'Target to build or run',
          },
          product: {
            type: 'string',
            description: 'Product to build or run',
          },
          package_name: {
            type: 'string',
            description: 'Package name for init/edit operations',
          },
          package_type: {
            type: 'string',
            enum: ['library', 'executable', 'system-module', 'manifest'],
            description: 'Package type for init',
          },
          enable_test_discovery: {
            type: 'boolean',
            description: 'Enable test discovery',
          },
          skip_update: {
            type: 'boolean',
            description: 'Skip package update during build',
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
    params: SwiftToolParams,
  ): string | null {
    if (!params.action) {
      return 'Action is required.';
    }

    if (params.action === 'package_edit' && !params.package_name) {
      return 'Package name is required for package_edit action.';
    }

    if (params.action === 'package_unedit' && !params.package_name) {
      return 'Package name is required for package_unedit action.';
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
    params: SwiftToolParams,
  ): ToolInvocation<SwiftToolParams, ToolResult> {
    return new SwiftToolInvocation(this.config, params, this.allowlist);
  }
}
