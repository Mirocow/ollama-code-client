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
const debugLogger = createDebugLogger('TYPESCRIPT');

export const DEFAULT_TYPESCRIPT_TIMEOUT_MS = 120000;

export type TypeScriptAction =
  | 'compile' // Compile with tsc
  | 'watch' // Watch mode with tsc --watch
  | 'build' // Build (tsc --build)
  | 'check' // Type check without emit (tsc --noEmit)
  | 'clean' // Clean build (tsc --build --clean)
  | 'init' // Initialize tsconfig.json
  | 'show_config' // Show resolved config
  | 'version' // Show TypeScript version
  | 'run' // Run with ts-node
  | 'run_esm' // Run ESM with ts-node-esm
  | 'transpile' // Transpile only (no type check)
  | 'custom'; // Custom TypeScript command

export interface TypeScriptToolParams {
  action: TypeScriptAction;
  file?: string; // File to compile/run
  args?: string[]; // Additional arguments
  directory?: string; // Working directory
  timeout?: number;
  project?: string; // tsconfig.json path
  out_dir?: string; // Output directory
  out_file?: string; // Output file
  root_dir?: string; // Root directory
  declaration?: boolean; // Generate .d.ts files
  source_map?: boolean; // Generate source maps
  strict?: boolean; // Strict mode
  es_module?: boolean; // ES modules
  module?: string; // Module system (commonjs, esnext, etc.)
  target?: string; // Target (es5, es2015, es2020, etc.)
  jsx?: string; // JSX mode (react, react-native, preserve)
  module_resolution?: string; // Module resolution (node, classic, bundler)
  command?: string; // Custom command
  description?: string;
}

export class TypeScriptToolInvocation extends BaseToolInvocation<
  TypeScriptToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: TypeScriptToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = [`TypeScript ${this.params.action}`];

    if (this.params.file) {
      parts.push(`file: ${this.params.file}`);
    }
    if (this.params.project) {
      parts.push(`project: ${this.params.project}`);
    }
    if (this.params.out_dir) {
      parts.push(`out: ${this.params.out_dir}`);
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
    const needsConfirmation = ['init', 'clean'].includes(this.params.action);

    if (!needsConfirmation) {
      return false;
    }

    const command = this.buildCommand();
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'exec',
      title: `Confirm TypeScript ${this.params.action}`,
      command,
      rootCommand: 'tsc',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('tsc');
          this.allowlist.add('ts-node');
        }
      },
    };

    return confirmationDetails;
  }

  private buildCommand(): string {
    switch (this.params.action) {
      case 'compile':
        return this.buildCompileCommand();

      case 'watch':
        return this.buildWatchCommand();

      case 'build':
        return this.buildBuildCommand();

      case 'check':
        return this.buildCheckCommand();

      case 'clean':
        return this.buildCleanCommand();

      case 'init':
        return this.buildInitCommand();

      case 'show_config':
        return this.buildShowConfigCommand();

      case 'version':
        return this.buildVersionCommand();

      case 'run':
        return this.buildRunCommand();

      case 'run_esm':
        return this.buildRunEsmCommand();

      case 'transpile':
        return this.buildTranspileCommand();

      case 'custom':
        return this.params.command || '';

      default:
        return '';
    }
  }

  private addProjectFlag(parts: string[]): void {
    if (this.params.project) {
      parts.push('-p', this.params.project);
    }
  }

  private addCompileOptions(parts: string[]): void {
    if (this.params.out_dir) {
      parts.push('--outDir', this.params.out_dir);
    }
    if (this.params.out_file) {
      parts.push('--outFile', this.params.out_file);
    }
    if (this.params.root_dir) {
      parts.push('--rootDir', this.params.root_dir);
    }
    if (this.params.declaration !== undefined) {
      if (this.params.declaration) {
        parts.push('--declaration');
      } else {
        parts.push('--declaration', 'false');
      }
    }
    if (this.params.source_map !== undefined) {
      if (this.params.source_map) {
        parts.push('--sourceMap');
      } else {
        parts.push('--sourceMap', 'false');
      }
    }
    if (this.params.strict) {
      parts.push('--strict');
    }
    if (this.params.module) {
      parts.push('--module', this.params.module);
    }
    if (this.params.target) {
      parts.push('--target', this.params.target);
    }
    if (this.params.jsx) {
      parts.push('--jsx', this.params.jsx);
    }
    if (this.params.module_resolution) {
      parts.push('--moduleResolution', this.params.module_resolution);
    }
    if (this.params.es_module) {
      parts.push('--esModuleInterop');
    }
  }

  private buildCompileCommand(): string {
    const parts = ['tsc'];

    this.addProjectFlag(parts);
    this.addCompileOptions(parts);

    if (this.params.file) {
      parts.push(this.params.file);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildWatchCommand(): string {
    const parts = ['tsc', '--watch'];

    this.addProjectFlag(parts);
    this.addCompileOptions(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildBuildCommand(): string {
    const parts = ['tsc', '--build'];

    if (this.params.project) {
      parts.push(this.params.project);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCheckCommand(): string {
    const parts = ['tsc', '--noEmit'];

    this.addProjectFlag(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCleanCommand(): string {
    const parts = ['tsc', '--build', '--clean'];

    if (this.params.project) {
      parts.push(this.params.project);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildInitCommand(): string {
    const parts = ['tsc', '--init'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildShowConfigCommand(): string {
    const parts = ['tsc', '--showConfig'];

    this.addProjectFlag(parts);

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildVersionCommand(): string {
    return 'tsc --version';
  }

  private buildRunCommand(): string {
    const parts = ['ts-node'];

    if (this.params.project) {
      parts.push('-P', this.params.project);
    }

    if (this.params.file) {
      parts.push(this.params.file);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildRunEsmCommand(): string {
    const parts = ['ts-node-esm'];

    if (this.params.project) {
      parts.push('-P', this.params.project);
    }

    if (this.params.file) {
      parts.push(this.params.file);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildTranspileCommand(): string {
    const parts = ['ts-node', '--transpile-only'];

    if (this.params.project) {
      parts.push('-P', this.params.project);
    }

    if (this.params.file) {
      parts.push(this.params.file);
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
        llmContent:
          'TypeScript command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const command = this.buildCommand();
    if (!command) {
      return {
        llmContent: 'Invalid TypeScript action or missing required parameters.',
        returnDisplay: 'Error: Invalid TypeScript action.',
        error: {
          message: 'Invalid TypeScript action or missing required parameters.',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    const effectiveTimeout =
      this.params.timeout ?? DEFAULT_TYPESCRIPT_TIMEOUT_MS;
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
          ? `TypeScript command timed out after ${effectiveTimeout}ms.`
          : 'TypeScript command was cancelled by user.';
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
      debugLogger.error('TypeScript tool execution failed:', error);
      return {
        llmContent: `TypeScript command failed: ${getErrorMessage(error)}`,
        returnDisplay: `Error: ${getErrorMessage(error)}`,
        error: {
          message: getErrorMessage(error),
          type: ToolErrorType.SHELL_EXECUTE_ERROR,
        },
      };
    }
  }
}

function getTypeScriptToolDescription(): string {
  return `TypeScript development tool for compiling, type-checking, and running TypeScript code.

**Available Actions:**

1. **compile** - Compile TypeScript with tsc
   - Optional: \`file\` (specific file to compile)
   - Optional: \`project\` (tsconfig.json path)
   - Optional: \`out_dir\` (output directory)
   - Optional: \`declaration\` (generate .d.ts files)
   - Optional: \`source_map\` (generate source maps)

2. **watch** - Watch mode compilation
   - Optional: \`project\` (tsconfig.json path)
   - Same options as compile

3. **build** - Build project (tsc --build, supports project references)
   - Optional: \`project\` (tsconfig.json path or directory)

4. **check** - Type check without emitting files
   - Optional: \`project\` (tsconfig.json path)

5. **clean** - Clean build output
   - Optional: \`project\` (tsconfig.json path)

6. **init** - Create tsconfig.json
   - Optional: \`args\` (additional init arguments)

7. **show_config** - Show resolved TypeScript config
   - Optional: \`project\` (tsconfig.json path)

8. **version** - Show TypeScript version

9. **run** - Run TypeScript with ts-node
   - Requires: \`file\` (TypeScript file to run)
   - Optional: \`project\` (tsconfig.json path)
   - Optional: \`args\` (program arguments)

10. **run_esm** - Run ESM TypeScript with ts-node-esm
    - Requires: \`file\` (TypeScript file to run)
    - Optional: \`args\` (program arguments)

11. **transpile** - Transpile only (faster, no type check)
    - Requires: \`file\` (TypeScript file to run)
    - Optional: \`args\` (program arguments)

12. **custom** - Run custom TypeScript command
    - Requires: \`command\` (custom command string)

**Common Parameters:**
- \`directory\`: Working directory (defaults to project root)
- \`timeout\`: Timeout in milliseconds (default: 120000, max: 600000)
- \`module\`: Module system (commonjs, amd, es2015, es2020, esnext, etc.)
- \`target\`: JavaScript target (es3, es5, es2015, es2020, esnext, etc.)
- \`jsx\`: JSX mode (react, react-jsx, react-jsxdev, preserve)
- \`module_resolution\`: Module resolution (node, classic, bundler)
- \`strict\`: Enable strict type checking
- \`description\`: Brief description of the action

**Examples:**

\`\`\`json
// Compile TypeScript
{
  "action": "compile"
}

// Compile with specific tsconfig
{
  "action": "compile",
  "project": "tsconfig.build.json"
}

// Compile single file with output
{
  "action": "compile",
  "file": "src/index.ts",
  "out_dir": "dist",
  "declaration": true,
  "source_map": true
}

// Type check without emitting
{
  "action": "check"
}

// Build with project references
{
  "action": "build"
}

// Watch mode
{
  "action": "watch"
}

// Run TypeScript file
{
  "action": "run",
  "file": "src/main.ts",
  "args": ["--config", "config.json"]
}

// Run ESM TypeScript
{
  "action": "run_esm",
  "file": "src/main.ts"
}

// Transpile only (fast)
{
  "action": "transpile",
  "file": "src/script.ts"
}

// Initialize tsconfig.json
{
  "action": "init"
}

// Show resolved config
{
  "action": "show_config"
}

// Clean build output
{
  "action": "clean"
}

// Compile with custom options
{
  "action": "compile",
  "target": "es2020",
  "module": "esnext",
  "module_resolution": "bundler",
  "jsx": "react-jsx",
  "strict": true
}
\`\`\`
`;
}

export class TypeScriptTool extends BaseDeclarativeTool<
  TypeScriptToolParams,
  ToolResult
> {
  static Name: string = 'typescript_dev';
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      TypeScriptTool.Name,
      'TypeScriptDev',
      getTypeScriptToolDescription(),
      Kind.Execute,
      {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'compile',
              'watch',
              'build',
              'check',
              'clean',
              'init',
              'show_config',
              'version',
              'run',
              'run_esm',
              'transpile',
              'custom',
            ],
            description: 'The TypeScript action to perform',
          },
          file: {
            type: 'string',
            description: 'TypeScript file to compile or run',
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
          project: {
            type: 'string',
            description: 'Path to tsconfig.json',
          },
          out_dir: {
            type: 'string',
            description: 'Output directory for compiled files',
          },
          out_file: {
            type: 'string',
            description: 'Output file for bundled output',
          },
          root_dir: {
            type: 'string',
            description: 'Root directory of source files',
          },
          declaration: {
            type: 'boolean',
            description: 'Generate .d.ts declaration files',
          },
          source_map: {
            type: 'boolean',
            description: 'Generate source map files',
          },
          strict: {
            type: 'boolean',
            description: 'Enable strict type checking',
          },
          es_module: {
            type: 'boolean',
            description: 'Enable ES module interop',
          },
          module: {
            type: 'string',
            description: 'Module system (commonjs, esnext, etc.)',
          },
          target: {
            type: 'string',
            description: 'JavaScript target (es5, es2020, etc.)',
          },
          jsx: {
            type: 'string',
            description: 'JSX mode (react, preserve, etc.)',
          },
          module_resolution: {
            type: 'string',
            description: 'Module resolution strategy',
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
    params: TypeScriptToolParams,
  ): string | null {
    if (!params.action) {
      return 'Action is required.';
    }

    if (params.action === 'run' && !params.file) {
      return 'File is required for run action.';
    }

    if (params.action === 'run_esm' && !params.file) {
      return 'File is required for run_esm action.';
    }

    if (params.action === 'transpile' && !params.file) {
      return 'File is required for transpile action.';
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
    params: TypeScriptToolParams,
  ): ToolInvocation<TypeScriptToolParams, ToolResult> {
    return new TypeScriptToolInvocation(this.config, params, this.allowlist);
  }
}
