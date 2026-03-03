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
const debugLogger = createDebugLogger('PHP');

export const DEFAULT_PHP_TIMEOUT_MS = 120000;

export type PHPAction =
  | 'run' // Run PHP script
  | 'r' // Alias for run
  | 'test' // Run PHPUnit tests
  | 't' // Alias for test
  | 'lint' // Run PHP_CodeSniffer (phpcs)
  | 'l' // Alias for lint
  | 'format' // Run PHP-CS-Fixer
  | 'f' // Alias for format
  | 'install' // Alias for composer_install
  | 'composer_install' // Run composer install
  | 'ci' // Alias for composer_install
  | 'composer_update' // Run composer update
  | 'cu' // Alias for composer_update
  | 'composer_require' // Add package
  | 'cr' // Alias for composer_require
  | 'composer_remove' // Remove package
  | 'crm' // Alias for composer_remove
  | 'composer_dump_autoload' // Regenerate autoload
  | 'cda' // Alias for composer_dump_autoload
  | 'composer_outdated' // Check outdated packages
  | 'co' // Alias for composer_outdated
  | 'phpunit' // Run PHPUnit directly
  | 'pu' // Alias for phpunit
  | 'psalm' // Run Psalm static analysis
  | 'ps' // Alias for psalm
  | 'phpstan' // Run PHPStan analysis
  | 'stan' // Alias for phpstan
  | 'artisan' // Run Laravel Artisan commands
  | 'art' // Alias for artisan
  | 'custom'; // Custom PHP command

// Action aliases mapping
const ACTION_ALIASES: Record<string, PHPAction> = {
  r: 'run',
  t: 'test',
  l: 'lint',
  f: 'format',
  install: 'composer_install',
  ci: 'composer_install',
  cu: 'composer_update',
  cr: 'composer_require',
  crm: 'composer_remove',
  cda: 'composer_dump_autoload',
  co: 'composer_outdated',
  pu: 'phpunit',
  ps: 'psalm',
  stan: 'phpstan',
  art: 'artisan',
};

export interface PHPToolParams {
  action: PHPAction;
  script?: string; // PHP file path for run action
  args?: string[]; // Additional arguments
  packages?: string[]; // Packages for composer require/remove
  directory?: string; // Working directory
  timeout?: number;
  test_pattern?: string; // Test filter pattern
  command?: string; // Custom command for custom action
  description?: string;
}

export class PHPToolInvocation extends BaseToolInvocation<
  PHPToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: PHPToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = [`PHP ${this.params.action}`];

    if (this.params.script) {
      parts.push(`script: ${this.params.script}`);
    }
    if (this.params.packages?.length) {
      parts.push(`packages: ${this.params.packages.join(', ')}`);
    }
    if (this.params.command) {
      parts.push(`command: ${this.params.command}`);
    }
    if (this.params.test_pattern) {
      parts.push(`filter: ${this.params.test_pattern}`);
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
      'composer_install',
      'composer_update',
      'composer_require',
      'composer_remove',
      'format',
    ].includes(this.params.action);

    if (!needsConfirmation) {
      return false;
    }

    const command = this.buildCommand();
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'exec',
      title: `Confirm PHP ${this.params.action}`,
      command,
      rootCommand: 'php',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('php');
          this.allowlist.add('composer');
        }
      },
    };

    return confirmationDetails;
  }

  private buildCommand(): string {
    // Resolve action alias
    const action = ACTION_ALIASES[this.params.action] || this.params.action;

    switch (action) {
      case 'run':
        return this.buildRunCommand();

      case 'test':
        return this.buildTestCommand();

      case 'lint':
        return this.buildLintCommand();

      case 'format':
        return this.buildFormatCommand();

      case 'composer_install':
        return this.buildComposerInstallCommand();

      case 'composer_update':
        return this.buildComposerUpdateCommand();

      case 'composer_require':
        return this.buildComposerRequireCommand();

      case 'composer_remove':
        return this.buildComposerRemoveCommand();

      case 'composer_dump_autoload':
        return this.buildComposerDumpAutoloadCommand();

      case 'composer_outdated':
        return this.buildComposerOutdatedCommand();

      case 'phpunit':
        return this.buildPHPUnitCommand();

      case 'psalm':
        return this.buildPsalmCommand();

      case 'phpstan':
        return this.buildPHPStanCommand();

      case 'artisan':
        return this.buildArtisanCommand();

      case 'custom':
        return this.params.command || '';

      default:
        return '';
    }
  }

  private buildRunCommand(): string {
    const parts = ['php'];
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildTestCommand(): string {
    const parts = ['vendor/bin/phpunit'];
    if (this.params.test_pattern) {
      parts.push('--filter', this.params.test_pattern);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildLintCommand(): string {
    const parts = ['vendor/bin/phpcs'];
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildFormatCommand(): string {
    const parts = ['vendor/bin/php-cs-fixer', 'fix'];
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildComposerInstallCommand(): string {
    const parts = ['composer', 'install'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildComposerUpdateCommand(): string {
    const parts = ['composer', 'update'];
    if (this.params.packages?.length) {
      parts.push(...this.params.packages);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildComposerRequireCommand(): string {
    const parts = ['composer', 'require'];
    if (this.params.packages?.length) {
      parts.push(...this.params.packages);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildComposerRemoveCommand(): string {
    const parts = ['composer', 'remove'];
    if (this.params.packages?.length) {
      parts.push(...this.params.packages);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildComposerDumpAutoloadCommand(): string {
    const parts = ['composer', 'dump-autoload'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildComposerOutdatedCommand(): string {
    const parts = ['composer', 'outdated'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildPHPUnitCommand(): string {
    const parts = ['phpunit'];
    if (this.params.test_pattern) {
      parts.push('--filter', this.params.test_pattern);
    }
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildPsalmCommand(): string {
    const parts = ['vendor/bin/psalm'];
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildPHPStanCommand(): string {
    const parts = ['vendor/bin/phpstan', 'analyse'];
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildArtisanCommand(): string {
    const parts = ['php', 'artisan'];
    if (this.params.command) {
      parts.push(this.params.command);
    }
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
        llmContent: 'PHP command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const command = this.buildCommand();
    if (!command) {
      return {
        llmContent: 'Invalid PHP action or missing required parameters.',
        returnDisplay: 'Error: Invalid PHP action.',
        error: {
          message: 'Invalid PHP action or missing required parameters.',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    const effectiveTimeout = this.params.timeout ?? DEFAULT_PHP_TIMEOUT_MS;
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
          ? `PHP command timed out after ${effectiveTimeout}ms.`
          : 'PHP command was cancelled by user.';
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
      debugLogger.error('PHP tool execution failed:', error);
      return {
        llmContent: `PHP command failed: ${getErrorMessage(error)}`,
        returnDisplay: `Error: ${getErrorMessage(error)}`,
        error: {
          message: getErrorMessage(error),
          type: ToolErrorType.SHELL_EXECUTE_ERROR,
        },
      };
    }
  }
}

function getPHPToolDescription(): string {
  return `PHP development tool for managing PHP projects, Composer packages, and running PHP-related commands.

**Available Actions:**

1. **run** - Execute a PHP script
   - Requires: \`script\` (path to .php file)
   - Optional: \`args\` (script arguments)

2. **test** - Run PHPUnit tests
   - Optional: \`test_pattern\` (test filter pattern)
   - Optional: \`args\` (additional PHPUnit arguments)

3. **lint** - Run PHP_CodeSniffer (phpcs)
   - Optional: \`script\` (file/directory to lint)
   - Optional: \`args\` (additional phpcs arguments)

4. **format** - Run PHP-CS-Fixer
   - Optional: \`script\` (file/directory to format)
   - Optional: \`args\` (additional fixer arguments)

5. **composer_install** - Install dependencies
   - Optional: \`args\` (additional composer arguments)

6. **composer_update** - Update dependencies
   - Optional: \`packages\` (specific packages to update)
   - Optional: \`args\` (additional composer arguments)

7. **composer_require** - Add packages to project
   - Requires: \`packages\` (list of packages)
   - Optional: \`args\` (additional composer arguments)

8. **composer_remove** - Remove packages from project
   - Requires: \`packages\` (list of packages)
   - Optional: \`args\` (additional composer arguments)

9. **composer_dump_autoload** - Regenerate autoload files
   - Optional: \`args\` (additional composer arguments)

10. **composer_outdated** - Check for outdated packages
    - Optional: \`args\` (additional composer arguments)

11. **phpunit** - Run PHPUnit directly (global installation)
    - Optional: \`test_pattern\` (test filter pattern)
    - Optional: \`script\` (test file/directory)
    - Optional: \`args\` (additional phpunit arguments)

12. **psalm** - Run Psalm static analysis
    - Optional: \`script\` (file/directory to analyze)
    - Optional: \`args\` (additional psalm arguments)

13. **phpstan** - Run PHPStan analysis
    - Optional: \`script\` (file/directory to analyze)
    - Optional: \`args\` (additional phpstan arguments)

14. **artisan** - Run Laravel Artisan commands
    - Requires: \`command\` (artisan command name)
    - Optional: \`args\` (command arguments)

15. **custom** - Run custom PHP command
    - Requires: \`command\` (custom command string)

**Common Parameters:**
- \`directory\`: Working directory (defaults to project root)
- \`timeout\`: Timeout in milliseconds (default: 120000, max: 600000)
- \`description\`: Brief description of the action

**Examples:**

\`\`\`json
// Run a PHP script
{
  "action": "run",
  "script": "index.php",
  "args": ["--verbose"]
}

// Run PHPUnit tests with filter
{
  "action": "test",
  "test_pattern": "testUserAuthentication",
  "args": ["--testdox"]
}

// Install composer dependencies
{
  "action": "composer_install"
}

// Add a package
{
  "action": "composer_require",
  "packages": ["laravel/framework", "guzzlehttp/guzzle"]
}

// Run Laravel artisan command
{
  "action": "artisan",
  "command": "migrate",
  "args": ["--force"]
}

// Run PHPStan analysis
{
  "action": "phpstan",
  "script": "src/",
  "args": ["--level=8"]
}

// Run Psalm
{
  "action": "psalm",
  "args": ["--show-info=true"]
}

// Check outdated packages
{
  "action": "composer_outdated",
  "args": ["--direct"]
}
\`\`\`
`;
}

export class PHPTool extends BaseDeclarativeTool<PHPToolParams, ToolResult> {
  static Name: string = 'php_dev';
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      PHPTool.Name,
      'PHPDev',
      getPHPToolDescription(),
      Kind.Execute,
      {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'run',
              'r',
              'test',
              't',
              'lint',
              'l',
              'format',
              'f',
              'install',
              'composer_install',
              'ci',
              'composer_update',
              'cu',
              'composer_require',
              'cr',
              'composer_remove',
              'crm',
              'composer_dump_autoload',
              'cda',
              'composer_outdated',
              'co',
              'phpunit',
              'pu',
              'psalm',
              'ps',
              'phpstan',
              'stan',
              'artisan',
              'art',
              'custom',
            ],
            description: 'The PHP action to perform',
          },
          script: {
            type: 'string',
            description: 'PHP script path or file to process',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional arguments for the action',
          },
          packages: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of packages for composer require/remove',
          },
          directory: {
            type: 'string',
            description: 'Working directory for the command',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (max 600000)',
          },
          test_pattern: {
            type: 'string',
            description: 'Test filter pattern for PHPUnit',
          },
          command: {
            type: 'string',
            description: 'Custom command or artisan command name',
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
    params: PHPToolParams,
  ): string | null {
    if (!params.action) {
      return 'Action is required.';
    }

    if (params.action === 'run' && !params.script && !params.command) {
      return 'Script path is required for run action.';
    }

    if (params.action === 'composer_require' && !params.packages?.length) {
      return 'Packages are required for composer_require action.';
    }

    if (params.action === 'composer_remove' && !params.packages?.length) {
      return 'Packages are required for composer_remove action.';
    }

    if (params.action === 'artisan' && !params.command) {
      return 'Command is required for artisan action.';
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
    params: PHPToolParams,
  ): ToolInvocation<PHPToolParams, ToolResult> {
    return new PHPToolInvocation(this.config, params, this.allowlist);
  }
}
