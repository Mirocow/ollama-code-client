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
const debugLogger = createDebugLogger('GOLANG');

export const DEFAULT_GOLANG_TIMEOUT_MS = 120000;

export type GolangAction =
  | 'run' // Run a Go file
  | 'build' // Build a Go program
  | 'test' // Run tests
  | 'test_cover' // Run tests with coverage
  | 'test_bench' // Run benchmarks
  | 'fmt' // Format code
  | 'vet' // Run go vet
  | 'lint' // Run golangci-lint
  | 'mod_init' // Initialize go.mod
  | 'mod_tidy' // Tidy dependencies
  | 'mod_download' // Download dependencies
  | 'mod_verify' // Verify dependencies
  | 'mod_graph' // Show dependency graph
  | 'get' // Get/add a package
  | 'install' // Install a package
  | 'list' // List packages
  | 'doc' // Show documentation
  | 'env' // Show Go environment
  | 'version' // Show Go version
  | 'clean' // Clean build cache
  | 'generate' // Run go generate
  | 'custom'; // Custom command

export interface GolangToolParams {
  action: GolangAction;
  file?: string; // Go file path for run/build
  args?: string[]; // Additional arguments
  package?: string; // Package name/path
  packages?: string[]; // Packages for get/install
  directory?: string; // Working directory
  output?: string; // Output file for build
  timeout?: number;
  test_pattern?: string; // Test pattern for go test
  bench_pattern?: string; // Benchmark pattern
  cover_profile?: string; // Coverage profile output file
  race?: boolean; // Enable race detector
  verbose?: boolean; // Verbose output
  background?: boolean; // Run in background
  module_name?: string; // Module name for go mod init
  command?: string; // Custom command for custom action
  description?: string;
}

export class GolangToolInvocation extends BaseToolInvocation<
  GolangToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: GolangToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = [`Go ${this.params.action}`];

    if (this.params.file) {
      parts.push(`file: ${this.params.file}`);
    }
    if (this.params.package) {
      parts.push(`package: ${this.params.package}`);
    }
    if (this.params.packages?.length) {
      parts.push(`packages: ${this.params.packages.join(', ')}`);
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
    const needsConfirmation = ['mod_init', 'get', 'install', 'clean'].includes(
      this.params.action,
    );

    if (!needsConfirmation) {
      return false;
    }

    const command = this.buildCommand();
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'exec',
      title: `Confirm Go ${this.params.action}`,
      command,
      rootCommand: 'go',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('go');
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

      case 'test_cover':
        return this.buildTestCoverCommand();

      case 'test_bench':
        return this.buildBenchCommand();

      case 'fmt':
        return this.buildFmtCommand();

      case 'vet':
        return this.buildVetCommand();

      case 'lint':
        return this.buildLintCommand();

      case 'mod_init':
        return this.buildModInitCommand();

      case 'mod_tidy':
        return this.buildModTidyCommand();

      case 'mod_download':
        return this.buildModDownloadCommand();

      case 'mod_verify':
        return this.buildModVerifyCommand();

      case 'mod_graph':
        return this.buildModGraphCommand();

      case 'get':
        return this.buildGetCommand();

      case 'install':
        return this.buildInstallCommand();

      case 'list':
        return this.buildListCommand();

      case 'doc':
        return this.buildDocCommand();

      case 'env':
        return this.buildEnvCommand();

      case 'version':
        return this.buildVersionCommand();

      case 'clean':
        return this.buildCleanCommand();

      case 'generate':
        return this.buildGenerateCommand();

      case 'custom':
        return this.params.command || '';

      default:
        return '';
    }
  }

  private buildRunCommand(): string {
    const parts = ['go', 'run'];
    if (this.params.file) {
      parts.push(this.params.file);
    } else {
      parts.push('.');
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildBuildCommand(): string {
    const parts = ['go', 'build'];
    if (this.params.output) {
      parts.push('-o', this.params.output);
    }
    if (this.params.verbose) {
      parts.push('-v');
    }
    if (this.params.file) {
      parts.push(this.params.file);
    } else if (this.params.package) {
      parts.push(this.params.package);
    } else {
      parts.push('.');
    }
    return parts.join(' ');
  }

  private buildTestCommand(): string {
    const parts = ['go', 'test'];
    if (this.params.verbose) {
      parts.push('-v');
    }
    if (this.params.race) {
      parts.push('-race');
    }
    if (this.params.test_pattern) {
      parts.push('-run', this.params.test_pattern);
    }
    if (this.params.package) {
      parts.push(this.params.package);
    } else {
      parts.push('./...');
    }
    return parts.join(' ');
  }

  private buildTestCoverCommand(): string {
    const parts = ['go', 'test', '-cover'];
    if (this.params.cover_profile) {
      parts.push('-coverprofile', this.params.cover_profile);
    }
    if (this.params.verbose) {
      parts.push('-v');
    }
    if (this.params.race) {
      parts.push('-race');
    }
    if (this.params.test_pattern) {
      parts.push('-run', this.params.test_pattern);
    }
    if (this.params.package) {
      parts.push(this.params.package);
    } else {
      parts.push('./...');
    }
    return parts.join(' ');
  }

  private buildBenchCommand(): string {
    const parts = ['go', 'test', '-bench'];
    parts.push(this.params.bench_pattern || '.');
    if (this.params.verbose) {
      parts.push('-v');
    }
    if (this.params.package) {
      parts.push(this.params.package);
    } else {
      parts.push('./...');
    }
    return parts.join(' ');
  }

  private buildFmtCommand(): string {
    const parts = ['go', 'fmt'];
    if (this.params.file) {
      parts.push(this.params.file);
    } else if (this.params.package) {
      parts.push(this.params.package);
    } else {
      parts.push('./...');
    }
    return parts.join(' ');
  }

  private buildVetCommand(): string {
    const parts = ['go', 'vet'];
    if (this.params.file) {
      parts.push(this.params.file);
    } else if (this.params.package) {
      parts.push(this.params.package);
    } else {
      parts.push('./...');
    }
    return parts.join(' ');
  }

  private buildLintCommand(): string {
    const parts = ['golangci-lint', 'run'];
    if (this.params.file) {
      parts.push(this.params.file);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildModInitCommand(): string {
    const parts = ['go', 'mod', 'init'];
    if (this.params.module_name) {
      parts.push(this.params.module_name);
    }
    return parts.join(' ');
  }

  private buildModTidyCommand(): string {
    const parts = ['go', 'mod', 'tidy'];
    if (this.params.verbose) {
      parts.push('-v');
    }
    return parts.join(' ');
  }

  private buildModDownloadCommand(): string {
    const parts = ['go', 'mod', 'download'];
    if (this.params.packages?.length) {
      parts.push(...this.params.packages);
    }
    return parts.join(' ');
  }

  private buildModVerifyCommand(): string {
    return 'go mod verify';
  }

  private buildModGraphCommand(): string {
    return 'go mod graph';
  }

  private buildGetCommand(): string {
    const parts = ['go', 'get'];
    if (this.params.packages?.length) {
      parts.push(...this.params.packages);
    }
    return parts.join(' ');
  }

  private buildInstallCommand(): string {
    const parts = ['go', 'install'];
    if (this.params.packages?.length) {
      parts.push(...this.params.packages);
    }
    return parts.join(' ');
  }

  private buildListCommand(): string {
    const parts = ['go', 'list'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    if (this.params.package) {
      parts.push(this.params.package);
    } else {
      parts.push('./...');
    }
    return parts.join(' ');
  }

  private buildDocCommand(): string {
    const parts = ['go', 'doc'];
    if (this.params.package) {
      parts.push(this.params.package);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildEnvCommand(): string {
    const parts = ['go', 'env'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildVersionCommand(): string {
    return 'go version';
  }

  private buildCleanCommand(): string {
    const parts = ['go', 'clean'];
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    } else {
      // Default clean options
      parts.push('-cache', '-testcache', '-modcache');
    }
    return parts.join(' ');
  }

  private buildGenerateCommand(): string {
    const parts = ['go', 'generate'];
    if (this.params.verbose) {
      parts.push('-v');
    }
    if (this.params.file) {
      parts.push(this.params.file);
    } else {
      parts.push('./...');
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
        llmContent: 'Go command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const command = this.buildCommand();
    if (!command) {
      return {
        llmContent: 'Invalid Go action or missing required parameters.',
        returnDisplay: 'Error: Invalid Go action.',
        error: {
          message: 'Invalid Go action or missing required parameters.',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    const effectiveTimeout = this.params.timeout ?? DEFAULT_GOLANG_TIMEOUT_MS;
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

      // For background tasks, return immediately
      if (this.params.background) {
        const pidMsg = pid ? ` PID: ${pid}` : '';
        return {
          llmContent: `Background Go process started.${pidMsg} (Use kill ${pid} to stop)`,
          returnDisplay: `Background process started.${pidMsg}`,
        };
      }

      const result = await resultPromise;

      let llmContent = '';
      if (result.aborted) {
        const wasTimeout =
          effectiveTimeout && combinedSignal.aborted && !signal.aborted;
        llmContent = wasTimeout
          ? `Go command timed out after ${effectiveTimeout}ms.`
          : 'Go command was cancelled by user.';
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
      debugLogger.error('Go tool execution failed:', error);
      return {
        llmContent: `Go command failed: ${getErrorMessage(error)}`,
        returnDisplay: `Error: ${getErrorMessage(error)}`,
        error: {
          message: getErrorMessage(error),
          type: ToolErrorType.SHELL_EXECUTE_ERROR,
        },
      };
    }
  }
}

function getGolangToolDescription(): string {
  return `Golang development tool for managing Go projects, modules, and running Go-related commands.

**Available Actions:**

1. **run** - Run a Go file or package
   - Optional: \`file\` (Go file to run, defaults to current directory)
   - Optional: \`args\` (program arguments)

2. **build** - Build a Go program
   - Optional: \`file\` or \`package\` (what to build)
   - Optional: \`output\` (output binary name)
   - Optional: \`verbose\` (show package names)

3. **test** - Run tests
   - Optional: \`test_pattern\` (test name pattern)
   - Optional: \`package\` (package to test, defaults to ./...)
   - Optional: \`race\` (enable race detector)
   - Optional: \`verbose\` (show test details)

4. **test_cover** - Run tests with coverage
   - Optional: \`cover_profile\` (coverage output file)
   - Same options as test

5. **test_bench** - Run benchmarks
   - Optional: \`bench_pattern\` (benchmark pattern, defaults to all)
   - Optional: \`package\` (package to benchmark)

6. **fmt** - Format Go code
   - Optional: \`file\` or \`package\` (defaults to ./...)

7. **vet** - Run go vet static analysis
   - Optional: \`file\` or \`package\` (defaults to ./...)

8. **lint** - Run golangci-lint
   - Requires golangci-lint installed
   - Optional: \`file\` (file to lint)
   - Optional: \`args\` (additional lint arguments)

9. **mod_init** - Initialize go.mod
   - Optional: \`module_name\` (module path)

10. **mod_tidy** - Tidy dependencies in go.mod

11. **mod_download** - Download dependencies
    - Optional: \`packages\` (specific packages)

12. **mod_verify** - Verify dependencies

13. **mod_graph** - Show dependency graph

14. **get** - Add a dependency
    - Requires: \`packages\` (package paths)

15. **install** - Install a Go tool
    - Requires: \`packages\` (package paths)

16. **list** - List packages
    - Optional: \`package\` (defaults to ./...)
    - Optional: \`args\` (list flags like -m, -json)

17. **doc** - Show documentation
    - Optional: \`package\` (package to document)
    - Optional: \`args\` (additional doc arguments)

18. **env** - Show Go environment
    - Optional: \`args\` (specific env vars)

19. **version** - Show Go version

20. **clean** - Clean build cache
    - Optional: \`args\` (clean flags)

21. **generate** - Run go generate
    - Optional: \`file\` (file with generate directives)
    - Optional: \`verbose\` (show details)

22. **custom** - Run custom Go command
    - Requires: \`command\` (custom command string)

**Common Parameters:**
- \`directory\`: Working directory (defaults to project root)
- \`timeout\`: Timeout in milliseconds (default: 120000, max: 600000)
- \`background\`: Run in background
- \`verbose\`: Enable verbose output
- \`description\`: Brief description of the action

**Examples:**

\`\`\`json
// Run a Go file
{
  "action": "run",
  "file": "main.go",
  "args": ["--config", "config.yaml"]
}

// Run tests with race detector
{
  "action": "test",
  "race": true,
  "verbose": true,
  "test_pattern": "TestUser"
}

// Build with output name
{
  "action": "build",
  "output": "myapp",
  "package": "./cmd/server"
}

// Initialize module
{
  "action": "mod_init",
  "module_name": "github.com/user/myproject"
}

// Add dependency
{
  "action": "get",
  "packages": ["github.com/gin-gonic/gin@latest"]
}

// Run golangci-lint
{
  "action": "lint",
  "args": ["--config", ".golangci.yml"]
}
\`\`\`
`;
}

export class GolangTool extends BaseDeclarativeTool<
  GolangToolParams,
  ToolResult
> {
  static Name: string = 'golang_dev';
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      GolangTool.Name,
      'GolangDev',
      getGolangToolDescription(),
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
              'test_cover',
              'test_bench',
              'fmt',
              'vet',
              'lint',
              'mod_init',
              'mod_tidy',
              'mod_download',
              'mod_verify',
              'mod_graph',
              'get',
              'install',
              'list',
              'doc',
              'env',
              'version',
              'clean',
              'generate',
              'custom',
            ],
            description: 'The Go action to perform',
          },
          file: {
            type: 'string',
            description: 'Go file path for run/build actions',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional arguments for the action',
          },
          package: {
            type: 'string',
            description: 'Package path',
          },
          packages: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of packages for get/install actions',
          },
          directory: {
            type: 'string',
            description: 'Working directory for the command',
          },
          output: {
            type: 'string',
            description: 'Output binary name for build action',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (max 600000)',
          },
          test_pattern: {
            type: 'string',
            description: 'Test name pattern for go test',
          },
          bench_pattern: {
            type: 'string',
            description: 'Benchmark pattern for go test -bench',
          },
          cover_profile: {
            type: 'string',
            description: 'Coverage profile output file',
          },
          race: {
            type: 'boolean',
            description: 'Enable race detector for tests',
          },
          verbose: {
            type: 'boolean',
            description: 'Enable verbose output',
          },
          background: {
            type: 'boolean',
            description: 'Run in background',
          },
          module_name: {
            type: 'string',
            description: 'Module name for go mod init',
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
    params: GolangToolParams,
  ): string | null {
    if (!params.action) {
      return 'Action is required.';
    }

    if (params.action === 'get' && !params.packages?.length) {
      return 'Packages are required for get action.';
    }

    if (params.action === 'install' && !params.packages?.length) {
      return 'Packages are required for install action.';
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
    params: GolangToolParams,
  ): ToolInvocation<GolangToolParams, ToolResult> {
    return new GolangToolInvocation(this.config, params, this.allowlist);
  }
}
