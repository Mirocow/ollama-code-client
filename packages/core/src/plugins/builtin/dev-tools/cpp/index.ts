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
const debugLogger = createDebugLogger('CPP');

export const DEFAULT_CPP_TIMEOUT_MS = 120000;

export type CppCompiler = 'gcc' | 'g++' | 'clang' | 'clang++';

export type CppAction =
  | 'compile' // Compile C/C++ files
  | 'run' // Compile and run
  | 'build' // Build with make/cmake
  | 'test' // Run tests
  | 'cmake_configure' // Configure with CMake
  | 'cmake_build' // Build with CMake
  | 'cmake_clean' // Clean CMake build
  | 'cmake_test' // Run CTest
  | 'cmake_install' // Install with CMake
  | 'make' // Run make
  | 'make_clean' // Run make clean
  | 'make_install' // Run make install
  | 'custom'; // Custom C/C++ command

export interface CppToolParams {
  action: CppAction;
  compiler?: CppCompiler;
  file?: string; // Source file for compile/run
  args?: string[]; // Additional arguments
  directory?: string; // Working directory
  output?: string; // Output binary name
  build_dir?: string; // CMake build directory
  timeout?: number;
  std?: string; // C/C++ standard (e.g., c++17, c11)
  optimize?: boolean; // Enable optimization
  debug?: boolean; // Include debug symbols
  defines?: string[]; // Preprocessor defines
  include_dirs?: string[]; // Include directories
  libs?: string[]; // Libraries to link
  target?: string; // CMake target
  command?: string; // Custom command
  description?: string;
}

export class CppToolInvocation extends BaseToolInvocation<
  CppToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: CppToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = [`C/C++ ${this.params.action}`];

    if (this.params.compiler) {
      parts.push(`(${this.params.compiler})`);
    }

    if (this.params.file) {
      parts.push(`file: ${this.params.file}`);
    }
    if (this.params.output) {
      parts.push(`output: ${this.params.output}`);
    }
    if (this.params.target) {
      parts.push(`target: ${this.params.target}`);
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
    // Actions that modify the system need confirmation
    const needsConfirmation = ['cmake_install', 'make_install'].includes(
      this.params.action,
    );

    if (!needsConfirmation) {
      return false;
    }

    const command = this.buildCommand();
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'exec',
      title: `Confirm C/C++ ${this.params.action}`,
      command,
      rootCommand: 'cmake',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('gcc');
          this.allowlist.add('g++');
          this.allowlist.add('clang');
          this.allowlist.add('clang++');
          this.allowlist.add('cmake');
          this.allowlist.add('make');
        }
      },
    };

    return confirmationDetails;
  }

  private buildCommand(): string {
    switch (this.params.action) {
      case 'compile':
        return this.buildCompileCommand();

      case 'run':
        return this.buildRunCommand();

      case 'build':
        return this.buildBuildCommand();

      case 'test':
        return this.buildTestCommand();

      case 'cmake_configure':
        return this.buildCMakeConfigureCommand();

      case 'cmake_build':
        return this.buildCMakeBuildCommand();

      case 'cmake_clean':
        return this.buildCMakeCleanCommand();

      case 'cmake_test':
        return this.buildCMakeTestCommand();

      case 'cmake_install':
        return this.buildCMakeInstallCommand();

      case 'make':
        return this.buildMakeCommand();

      case 'make_clean':
        return this.buildMakeCleanCommand();

      case 'make_install':
        return this.buildMakeInstallCommand();

      case 'custom':
        return this.params.command || '';

      default:
        return '';
    }
  }

  private getCompiler(): string {
    if (this.params.compiler) {
      return this.params.compiler;
    }
    // Default to g++ for C++, gcc for C (check file extension)
    if (this.params.file?.endsWith('.c')) {
      return 'gcc';
    }
    return 'g++';
  }

  private buildCompileCommand(): string {
    const parts = [this.getCompiler()];

    // Standard
    if (this.params.std) {
      parts.push(`-std=${this.params.std}`);
    }

    // Optimization
    if (this.params.optimize) {
      parts.push('-O2');
    }

    // Debug symbols
    if (this.params.debug) {
      parts.push('-g');
    }

    // Preprocessor defines
    if (this.params.defines?.length) {
      for (const def of this.params.defines) {
        parts.push(`-D${def}`);
      }
    }

    // Include directories
    if (this.params.include_dirs?.length) {
      for (const inc of this.params.include_dirs) {
        parts.push('-I', inc);
      }
    }

    // Output file
    if (this.params.output) {
      parts.push('-o', this.params.output);
    }

    // Source file
    if (this.params.file) {
      parts.push(this.params.file);
    }

    // Libraries
    if (this.params.libs?.length) {
      for (const lib of this.params.libs) {
        parts.push('-l', lib);
      }
    }

    // Additional arguments
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildRunCommand(): string {
    // Compile and run
    const outputFile = this.params.output || 'a.out';
    const compileCmd = this.buildCompileCommand();
    const runCmd = `./${outputFile}`;

    if (this.params.args?.length) {
      return `${compileCmd} && ${runCmd} ${this.params.args.join(' ')}`;
    }
    return `${compileCmd} && ${runCmd}`;
  }

  private buildBuildCommand(): string {
    const cwd = this.params.directory || this.config.getTargetDir();

    // Check for CMakeLists.txt
    if (fs.existsSync(path.join(cwd, 'CMakeLists.txt'))) {
      return this.buildCMakeBuildCommand();
    }
    // Check for Makefile
    if (
      fs.existsSync(path.join(cwd, 'Makefile')) ||
      fs.existsSync(path.join(cwd, 'makefile'))
    ) {
      return this.buildMakeCommand();
    }
    // Default to compile
    return this.buildCompileCommand();
  }

  private buildTestCommand(): string {
    const buildDir = this.params.build_dir || 'build';
    return `cd ${buildDir} && ctest --output-on-failure`;
  }

  private buildCMakeConfigureCommand(): string {
    const buildDir = this.params.build_dir || 'build';
    const parts = ['cmake', '-B', buildDir];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    parts.push('-S', '.');

    return parts.join(' ');
  }

  private buildCMakeBuildCommand(): string {
    const buildDir = this.params.build_dir || 'build';
    const parts = ['cmake', '--build', buildDir];

    if (this.params.target) {
      parts.push('--target', this.params.target);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCMakeCleanCommand(): string {
    const buildDir = this.params.build_dir || 'build';
    return `cmake --build ${buildDir} --target clean`;
  }

  private buildCMakeTestCommand(): string {
    const buildDir = this.params.build_dir || 'build';
    const parts = ['cd', buildDir, '&&', 'ctest', '--output-on-failure'];

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildCMakeInstallCommand(): string {
    const buildDir = this.params.build_dir || 'build';
    return `cmake --install ${buildDir}`;
  }

  private buildMakeCommand(): string {
    const parts = ['make'];

    if (this.params.target) {
      parts.push(this.params.target);
    }

    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }

    return parts.join(' ');
  }

  private buildMakeCleanCommand(): string {
    return 'make clean';
  }

  private buildMakeInstallCommand(): string {
    return 'make install';
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: ToolResultDisplay) => void,
    shellExecutionConfig?: ShellExecutionConfig,
  ): Promise<ToolResult> {
    if (signal.aborted) {
      return {
        llmContent:
          'C/C++ command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const command = this.buildCommand();
    if (!command) {
      return {
        llmContent: 'Invalid C/C++ action or missing required parameters.',
        returnDisplay: 'Error: Invalid C/C++ action.',
        error: {
          message: 'Invalid C/C++ action or missing required parameters.',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    const effectiveTimeout = this.params.timeout ?? DEFAULT_CPP_TIMEOUT_MS;
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
          ? `C/C++ command timed out after ${effectiveTimeout}ms.`
          : 'C/C++ command was cancelled by user.';
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
      debugLogger.error('C/C++ tool execution failed:', error);
      return {
        llmContent: `C/C++ command failed: ${getErrorMessage(error)}`,
        returnDisplay: `Error: ${getErrorMessage(error)}`,
        error: {
          message: getErrorMessage(error),
          type: ToolErrorType.SHELL_EXECUTE_ERROR,
        },
      };
    }
  }
}

function getCppToolDescription(): string {
  return `C/C++ development tool for compiling, building, and testing C and C++ projects.

**Supported Compilers:**
- gcc (GNU C Compiler)
- g++ (GNU C++ Compiler)
- clang (Clang C Compiler)
- clang++ (Clang C++ Compiler)

**Build Systems:**
- CMake (detected by CMakeLists.txt)
- Make (detected by Makefile)

**Available Actions:**

1. **compile** - Compile C/C++ files
   - Requires: \`file\` (source file)
   - Optional: \`output\` (output binary name)
   - Optional: \`std\` (C/C++ standard, e.g., c++17, c11)
   - Optional: \`optimize\` (enable -O2 optimization)
   - Optional: \`debug\` (include debug symbols)
   - Optional: \`defines\` (preprocessor defines)
   - Optional: \`include_dirs\` (include directories)
   - Optional: \`libs\` (libraries to link)

2. **run** - Compile and run a program
   - Requires: \`file\` (source file)
   - Optional: \`output\` (output binary name)
   - Optional: \`args\` (program arguments)

3. **build** - Build project (auto-detects CMake or Make)
   - Optional: \`build_dir\` (CMake build directory)
   - Optional: \`target\` (build target)

4. **test** - Run tests with CTest
   - Optional: \`build_dir\` (build directory)

5. **cmake_configure** - Configure CMake project
   - Optional: \`build_dir\` (build directory, defaults to 'build')
   - Optional: \`args\` (CMake arguments)

6. **cmake_build** - Build CMake project
   - Optional: \`build_dir\` (build directory)
   - Optional: \`target\` (build target)
   - Optional: \`args\` (build arguments)

7. **cmake_clean** - Clean CMake build
   - Optional: \`build_dir\` (build directory)

8. **cmake_test** - Run CTest
   - Optional: \`build_dir\` (build directory)
   - Optional: \`args\` (ctest arguments)

9. **cmake_install** - Install CMake project
   - Optional: \`build_dir\` (build directory)

10. **make** - Run make
    - Optional: \`target\` (make target)
    - Optional: \`args\` (make arguments)

11. **make_clean** - Run make clean

12. **make_install** - Run make install

13. **custom** - Run custom C/C++ command
    - Requires: \`command\` (custom command string)

**Common Parameters:**
- \`directory\`: Working directory (defaults to project root)
- \`timeout\`: Timeout in milliseconds (default: 120000, max: 600000)
- \`description\`: Brief description of the action

**Examples:**

\`\`\`json
// Compile a C++ file with C++17
{
  "action": "compile",
  "file": "main.cpp",
  "output": "myapp",
  "std": "c++17",
  "optimize": true
}

// Compile with debug symbols
{
  "action": "compile",
  "file": "main.c",
  "compiler": "gcc",
  "debug": true,
  "defines": ["DEBUG", "VERSION='1.0'"]
}

// Compile and run
{
  "action": "run",
  "file": "main.cpp",
  "args": ["--verbose", "input.txt"]
}

// CMake configure
{
  "action": "cmake_configure",
  "build_dir": "build",
  "args": ["-DCMAKE_BUILD_TYPE=Release"]
}

// CMake build
{
  "action": "cmake_build",
  "build_dir": "build",
  "target": "myapp"
}

// Run tests
{
  "action": "cmake_test",
  "build_dir": "build"
}

// Make with target
{
  "action": "make",
  "target": "all",
  "args": ["-j4"]
}

// Compile with libraries
{
  "action": "compile",
  "file": "main.cpp",
  "libs": ["pthread", "ssl"],
  "include_dirs": ["/usr/local/include"]
}
\`\`\`
`;
}

export class CppTool extends BaseDeclarativeTool<CppToolParams, ToolResult> {
  static Name: string = 'cpp_dev';
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      CppTool.Name,
      'CppDev',
      getCppToolDescription(),
      Kind.Execute,
      {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'compile',
              'run',
              'build',
              'test',
              'cmake_configure',
              'cmake_build',
              'cmake_clean',
              'cmake_test',
              'cmake_install',
              'make',
              'make_clean',
              'make_install',
              'custom',
            ],
            description: 'The C/C++ action to perform',
          },
          compiler: {
            type: 'string',
            enum: ['gcc', 'g++', 'clang', 'clang++'],
            description:
              'Compiler to use (auto-detected from file extension if not specified)',
          },
          file: {
            type: 'string',
            description: 'Source file for compile/run actions',
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
          output: {
            type: 'string',
            description: 'Output binary name',
          },
          build_dir: {
            type: 'string',
            description: 'CMake build directory',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (max 600000)',
          },
          std: {
            type: 'string',
            description: 'C/C++ standard (e.g., c++17, c11)',
          },
          optimize: {
            type: 'boolean',
            description: 'Enable optimization (-O2)',
          },
          debug: {
            type: 'boolean',
            description: 'Include debug symbols (-g)',
          },
          defines: {
            type: 'array',
            items: { type: 'string' },
            description: 'Preprocessor defines',
          },
          include_dirs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Include directories',
          },
          libs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Libraries to link',
          },
          target: {
            type: 'string',
            description: 'Build target for CMake/Make',
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
    params: CppToolParams,
  ): string | null {
    if (!params.action) {
      return 'Action is required.';
    }

    if (params.action === 'compile' && !params.file) {
      return 'File is required for compile action.';
    }

    if (params.action === 'run' && !params.file) {
      return 'File is required for run action.';
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
    params: CppToolParams,
  ): ToolInvocation<CppToolParams, ToolResult> {
    return new CppToolInvocation(this.config, params, this.allowlist);
  }
}
