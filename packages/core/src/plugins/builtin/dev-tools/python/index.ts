/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import os from 'node:os';
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
const debugLogger = createDebugLogger('PYTHON');

export const DEFAULT_PYTHON_TIMEOUT_MS = 120000;

export type PythonAction =
  | 'run' // Run a Python script
  | 'r' // Alias for run
  | 'test' // Run pytest
  | 't' // Alias for test
  | 'lint' // Run pylint/flake8
  | 'l' // Alias for lint
  | 'format' // Run black/autopep8
  | 'f' // Alias for format
  | 'init' // Alias for venv_create - Create virtual environment
  | 'venv_create' // Create virtual environment
  | 'venv_activate' // Get activation command for venv
  | 'install' // Alias for pip_install
  | 'pip_install' // Install packages
  | 'pip_list' // List installed packages
  | 'pip_freeze' // Freeze requirements
  | 'mypy' // Run mypy type checker
  | 'custom'; // Custom Python command

// Action aliases mapping
const ACTION_ALIASES: Record<string, PythonAction> = {
  init: 'venv_create',
  r: 'run',
  t: 'test',
  l: 'lint',
  f: 'format',
  install: 'pip_install',
};

export interface PythonToolParams {
  action: PythonAction;
  script?: string; // Python script path for run action
  args?: string[]; // Script arguments
  packages?: string[]; // Packages for pip install
  directory?: string; // Working directory
  venv?: string; // Virtual environment path
  python_path?: string; // Custom Python interpreter path
  timeout?: number;
  test_pattern?: string; // Test pattern for pytest
  lint_config?: string; // Lint config file
  requirements_file?: string; // Requirements file path
  command?: string; // Custom command for custom action
  description?: string;
}

export class PythonToolInvocation extends BaseToolInvocation<
  PythonToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: PythonToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const parts: string[] = [`Python ${this.params.action}`];

    if (this.params.script) {
      parts.push(`script: ${this.params.script}`);
    }
    if (this.params.packages?.length) {
      parts.push(`packages: ${this.params.packages.join(', ')}`);
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
    // Check if action needs confirmation
    const needsConfirmation = ['pip_install', 'venv_create'].includes(
      this.params.action,
    );

    if (!needsConfirmation) {
      return false;
    }

    const command = this.buildCommand();
    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'exec',
      title: `Confirm Python ${this.params.action}`,
      command,
      rootCommand: 'python',
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('python');
          this.allowlist.add('pip');
        }
      },
    };

    return confirmationDetails;
  }

  private buildCommand(): string {
    const pythonCmd = this.params.python_path || this.detectPython();
    const venvPath = this.params.venv;
    const venvPython = venvPath
      ? path.join(
          venvPath,
          os.platform() === 'win32' ? 'Scripts' : 'bin',
          'python',
        )
      : null;
    const effectivePython = venvPython || pythonCmd;

    // Resolve action alias
    const action = ACTION_ALIASES[this.params.action] || this.params.action;

    switch (action) {
      case 'run':
        return this.buildRunCommand(effectivePython);

      case 'test':
        return this.buildTestCommand(effectivePython);

      case 'lint':
        return this.buildLintCommand(effectivePython);

      case 'format':
        return this.buildFormatCommand(effectivePython);

      case 'venv_create':
        return this.buildVenvCreateCommand(pythonCmd);

      case 'venv_activate':
        return this.buildVenvActivateCommand();

      case 'pip_install':
        return this.buildPipInstallCommand(effectivePython);

      case 'pip_list':
        return this.buildPipListCommand(effectivePython);

      case 'pip_freeze':
        return this.buildPipFreezeCommand(effectivePython);

      case 'mypy':
        return this.buildMypyCommand(effectivePython);

      case 'custom':
        return this.params.command || '';

      default:
        return '';
    }
  }

  private detectPython(): string {
    // Prefer python3 on Unix, python on Windows
    return os.platform() === 'win32' ? 'python' : 'python3';
  }

  private buildRunCommand(python: string): string {
    const parts = [python];
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildTestCommand(python: string): string {
    const parts = [python, '-m', 'pytest'];
    if (this.params.test_pattern) {
      parts.push(this.params.test_pattern);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    // Add common useful flags
    parts.push('-v');
    return parts.join(' ');
  }

  private buildLintCommand(python: string): string {
    const parts = [python, '-m', 'pylint'];
    if (this.params.lint_config) {
      parts.push(`--rcfile=${this.params.lint_config}`);
    }
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildFormatCommand(python: string): string {
    const parts = [python, '-m', 'black'];
    if (this.params.script) {
      parts.push(this.params.script);
    }
    if (this.params.args?.length) {
      parts.push(...this.params.args);
    }
    return parts.join(' ');
  }

  private buildVenvCreateCommand(python: string): string {
    const parts = [python, '-m', 'venv'];
    if (this.params.venv) {
      parts.push(this.params.venv);
    } else {
      parts.push('.venv');
    }
    return parts.join(' ');
  }

  private buildVenvActivateCommand(): string {
    const venvPath = this.params.venv || '.venv';
    if (os.platform() === 'win32') {
      return `${venvPath}\\Scripts\\activate`;
    }
    return `source ${venvPath}/bin/activate`;
  }

  private buildPipInstallCommand(python: string): string {
    const parts = [python, '-m', 'pip', 'install'];
    if (this.params.requirements_file) {
      parts.push('-r', this.params.requirements_file);
    } else if (this.params.packages?.length) {
      parts.push(...this.params.packages);
    }
    return parts.join(' ');
  }

  private buildPipListCommand(python: string): string {
    return `${python} -m pip list`;
  }

  private buildPipFreezeCommand(python: string): string {
    const parts = [python, '-m', 'pip', 'freeze'];
    if (this.params.requirements_file) {
      parts.push('>', this.params.requirements_file);
    }
    return parts.join(' ');
  }

  private buildMypyCommand(python: string): string {
    const parts = [python, '-m', 'mypy'];
    if (this.params.script) {
      parts.push(this.params.script);
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
          'Python command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    const command = this.buildCommand();
    if (!command) {
      return {
        llmContent: 'Invalid Python action or missing required parameters.',
        returnDisplay: 'Error: Invalid Python action.',
        error: {
          message: 'Invalid Python action or missing required parameters.',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    const effectiveTimeout = this.params.timeout ?? DEFAULT_PYTHON_TIMEOUT_MS;
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
          ? `Python command timed out after ${effectiveTimeout}ms.`
          : 'Python command was cancelled by user.';
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
      debugLogger.error('Python tool execution failed:', error);
      return {
        llmContent: `Python command failed: ${getErrorMessage(error)}`,
        returnDisplay: `Error: ${getErrorMessage(error)}`,
        error: {
          message: getErrorMessage(error),
          type: ToolErrorType.SHELL_EXECUTE_ERROR,
        },
      };
    }
  }
}

function getPythonToolDescription(): string {
  return `Python development tool for managing Python projects, virtual environments, and running Python-related commands.

**Available Actions:**

1. **run** - Execute a Python script
   - Requires: \`script\` (path to .py file)
   - Optional: \`args\` (script arguments)

2. **test** - Run pytest tests
   - Optional: \`test_pattern\` (test file/pattern)
   - Optional: \`args\` (additional pytest arguments)

3. **lint** - Run pylint code analysis
   - Optional: \`script\` (file/directory to lint)
   - Optional: \`lint_config\` (pylint config file)

4. **format** - Run black code formatter
   - Optional: \`script\` (file/directory to format)

5. **venv_create** - Create a virtual environment
   - Optional: \`venv\` (venv path, defaults to .venv)

6. **venv_activate** - Get activation command for virtual environment
   - Optional: \`venv\` (venv path)

7. **pip_install** - Install packages with pip
   - Optional: \`packages\` (list of packages)
   - Optional: \`requirements_file\` (requirements.txt path)

8. **pip_list** - List installed packages

9. **pip_freeze** - Generate requirements.txt
   - Optional: \`requirements_file\` (output file path)

10. **mypy** - Run mypy type checker
    - Optional: \`script\` (file/directory to check)

11. **custom** - Run custom Python command
    - Requires: \`command\` (custom command string)

**Common Parameters:**
- \`directory\`: Working directory (defaults to project root)
- \`venv\`: Virtual environment path
- \`python_path\`: Custom Python interpreter path
- \`timeout\`: Timeout in milliseconds (default: 120000, max: 600000)
- \`description\`: Brief description of the action

**Examples:**

\`\`\`json
// Run a Python script
{
  "action": "run",
  "script": "main.py",
  "args": ["--verbose", "input.txt"]
}

// Run pytest with pattern
{
  "action": "test",
  "test_pattern": "tests/unit/",
  "args": ["-k", "test_auth"]
}

// Create virtual environment
{
  "action": "venv_create",
  "venv": ".venv"
}

// Install packages
{
  "action": "pip_install",
  "packages": ["requests", "numpy"],
  "venv": ".venv"
}
\`\`\`
`;
}

export class PythonTool extends BaseDeclarativeTool<
  PythonToolParams,
  ToolResult
> {
  static Name: string = 'python_dev';
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      PythonTool.Name,
      'PythonDev',
      getPythonToolDescription(),
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
              'init',
              'venv_create',
              'venv_activate',
              'install',
              'pip_install',
              'pip_list',
              'pip_freeze',
              'mypy',
              'custom',
            ],
            description: 'The Python action to perform',
          },
          script: {
            type: 'string',
            description: 'Python script path or file to process',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional arguments for the action',
          },
          packages: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of packages to install (for pip_install)',
          },
          directory: {
            type: 'string',
            description: 'Working directory for the command',
          },
          venv: {
            type: 'string',
            description: 'Virtual environment path',
          },
          python_path: {
            type: 'string',
            description: 'Custom Python interpreter path',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (max 600000)',
          },
          test_pattern: {
            type: 'string',
            description: 'Test file pattern for pytest',
          },
          lint_config: {
            type: 'string',
            description: 'Lint configuration file path',
          },
          requirements_file: {
            type: 'string',
            description: 'Requirements file path',
          },
          command: {
            type: 'string',
            description: 'Custom Python command (for custom action)',
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
    params: PythonToolParams,
  ): string | null {
    if (!params.action) {
      return 'Action is required.';
    }

    if (params.action === 'run' && !params.script && !params.command) {
      return 'Script path is required for run action.';
    }

    if (params.action === 'custom' && !params.command) {
      return 'Command is required for custom action.';
    }

    if (
      params.action === 'pip_install' &&
      !params.packages?.length &&
      !params.requirements_file
    ) {
      return 'Packages or requirements_file is required for pip_install action.';
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
    params: PythonToolParams,
  ): ToolInvocation<PythonToolParams, ToolResult> {
    return new PythonToolInvocation(this.config, params, this.allowlist);
  }
}
