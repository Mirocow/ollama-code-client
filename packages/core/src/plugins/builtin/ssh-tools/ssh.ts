/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../../../config/config.js';
import { ToolNames, ToolDisplayNames } from '../../../tools/tool-names.js';
import { ToolErrorType } from '../../../tools/tool-error.js';
import type {
  ToolInvocation,
  ToolResult,
  ToolResultDisplay,
  ToolCallConfirmationDetails,
  ToolExecuteConfirmationDetails,
  ToolConfirmationPayload,
} from '../../../tools/tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  ToolConfirmationOutcome,
  Kind,
} from '../../../tools/tools.js';
import { getErrorMessage } from '../../../utils/errors.js';
import { abortSignalAny } from '../../../utils/nodePolyfills.js';
import { ShellExecutionService } from '../../../services/shellExecutionService.js';
import type { ShellExecutionConfig } from '../../../services/shellExecutionService.js';
import type { AnsiOutput } from '../../../utils/terminalSerializer.js';
import { createDebugLogger } from '../../../utils/debugLogger.js';

const debugLogger = createDebugLogger('SSH');

export interface SSHToolParams {
  host: string;
  user: string;
  command: string;
  port?: number;
  identity_file?: string;
  password?: string;
  timeout?: number;
  description?: string;
}

/**
 * Builds an SSH command string from the parameters.
 */
function buildSSHCommand(params: SSHToolParams): string {
  const parts = ['ssh'];

  // Add port if specified
  if (params.port) {
    parts.push('-p', String(params.port));
  }

  // Add identity file if specified
  if (params.identity_file) {
    parts.push('-i', params.identity_file);
  }

  // Add common SSH options
  parts.push('-o', 'StrictHostKeyChecking=accept-new');
  parts.push('-o', 'ConnectTimeout=30');

  // Add timeout for command execution
  if (params.timeout) {
    parts.push('-o', `ServerAliveInterval=${Math.floor(params.timeout / 1000)}`);
  }

  // Add user@host
  parts.push(`${params.user}@${params.host}`);

  // Add command if specified
  if (params.command) {
    parts.push('--', params.command);
  }

  return parts.join(' ');
}

export class SSHToolInvocation extends BaseToolInvocation<
  SSHToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: SSHToolParams,
    private readonly allowlist: Set<string>,
  ) {
    super(params);
  }

  getDescription(): string {
    const host = `${this.params.user}@${this.params.host}`;
    const port = this.params.port ? `:${this.params.port}` : '';
    let description = `ssh ${host}${port}`;

    if (this.params.command) {
      description += ` "${this.params.command}"`;
    }

    if (this.params.description) {
      description += ` (${this.params.description.replace(/\n/g, ' ')})`;
    }

    return description;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    // Always require confirmation for SSH connections for security
    const confirmationDetails: ToolExecuteConfirmationDetails = {
      type: 'exec',
      title: 'Confirm SSH Connection',
      command: buildSSHCommand(this.params),
      rootCommand: 'ssh',
      onConfirm: async (
        outcome: ToolConfirmationOutcome,
        _payload?: ToolConfirmationPayload,
      ) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.allowlist.add('ssh');
        }
      },
    };
    return confirmationDetails;
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: ToolResultDisplay) => void,
    shellExecutionConfig?: ShellExecutionConfig,
  ): Promise<ToolResult> {
    if (signal.aborted) {
      return {
        llmContent: 'SSH connection was cancelled by user before it could start.',
        returnDisplay: 'Connection cancelled by user.',
      };
    }

    const sshCommand = buildSSHCommand(this.params);
    const effectiveTimeout = this.params.timeout ?? 60000; // Default 1 minute for SSH

    try {
      let cumulativeOutput: string | AnsiOutput = '';
      let lastUpdateTime = Date.now();
      const OUTPUT_UPDATE_INTERVAL_MS = 1000;

      // Create timeout signal
      const timeoutSignal = AbortSignal.timeout(effectiveTimeout);
      const combinedSignal = abortSignalAny([signal, timeoutSignal]);

      const { result: resultPromise } = await ShellExecutionService.execute(
        sshCommand,
        this.config.getTargetDir(),
        (event) => {
          if (event.type === 'data') {
            cumulativeOutput = event.chunk;
            if (updateOutput && Date.now() - lastUpdateTime > OUTPUT_UPDATE_INTERVAL_MS) {
              const outputDisplay = typeof cumulativeOutput === 'string'
                ? cumulativeOutput
                : { ansiOutput: cumulativeOutput };
              updateOutput(outputDisplay);
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
        const wasTimeout = timeoutSignal.aborted && !signal.aborted;
        if (wasTimeout) {
          llmContent = `SSH connection timed out after ${effectiveTimeout}ms.`;
        } else {
          llmContent = 'SSH connection was cancelled by user.';
        }
        if (result.output.trim()) {
          llmContent += `\nOutput before ${wasTimeout ? 'timeout' : 'cancellation'}:\n${result.output}`;
        }
      } else {
        llmContent = [
          `SSH Connection: ${this.params.user}@${this.params.host}${this.params.port ? `:${this.params.port}` : ''}`,
          `Command: ${this.params.command || '(interactive shell)'}`,
          `Output: ${result.output || '(empty)'}`,
          `Exit Code: ${result.exitCode ?? '(none)'}`,
          result.error ? `Error: ${result.error.message}` : '',
        ].filter(Boolean).join('\n');
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
        returnDisplay: result.output || `SSH ${result.aborted ? 'cancelled' : 'completed'}`,
        ...executionError,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLogger.error('SSH execution error:', errorMessage);

      return {
        llmContent: `SSH connection failed: ${errorMessage}`,
        returnDisplay: `Connection failed: ${getErrorMessage(error as Error)}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

function getSSHToolDescription(): string {
  return `Connects to a remote machine via SSH and executes commands.

This tool provides secure SSH connectivity to remote servers for remote command execution, system administration, and file operations.

**Usage notes**:
- The \`host\` and \`user\` parameters are required.
- You can specify an optional \`port\` (defaults to 22).
- Use \`identity_file\` for SSH key authentication (recommended).
- Use \`password\` only when key-based auth is not available (less secure).
- Specify \`command\` to execute a remote command, or leave empty for interactive shell.
- You can specify an optional \`timeout\` in milliseconds (max 600000ms / 10 minutes, default 60000ms).

**Security notes**:
- SSH connections always require user confirmation.
- Password authentication is discouraged; use SSH keys when possible.
- The tool uses \`StrictHostKeyChecking=accept-new\` for host key verification.

**Examples**:
1. Connect and run a command:
   \`{ "host": "192.168.1.100", "user": "admin", "command": "ls -la" }\`

2. Connect with custom port and key:
   \`{ "host": "server.com", "user": "deploy", "port": 2222, "identity_file": "~/.ssh/deploy_key", "command": "docker ps" }\`

3. Interactive shell session:
   \`{ "host": "192.168.1.100", "user": "root" }\`
`;
}

export class SSHTool extends BaseDeclarativeTool<
  SSHToolParams,
  ToolResult
> {
  static Name: string = ToolNames.SSH;
  private allowlist: Set<string> = new Set();

  constructor(private readonly config: Config) {
    super(
      SSHTool.Name,
      ToolDisplayNames.SSH,
      getSSHToolDescription(),
      Kind.Execute,
      {
        type: 'object',
        properties: {
          host: {
            type: 'string',
            description: 'The hostname or IP address of the remote server.',
          },
          user: {
            type: 'string',
            description: 'The username for SSH authentication.',
          },
          command: {
            type: 'string',
            description: 'The command to execute on the remote server. Leave empty for interactive shell.',
          },
          port: {
            type: 'number',
            description: 'SSH port number (default: 22).',
          },
          identity_file: {
            type: 'string',
            description: 'Path to SSH private key file for key-based authentication.',
          },
          password: {
            type: 'string',
            description: 'Password for password authentication (discouraged, use identity_file instead).',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (max 600000, default 60000).',
          },
          description: {
            type: 'string',
            description: 'Brief description of what this SSH connection does.',
          },
        },
        required: ['host', 'user'],
      },
      false, // output is not markdown
      true, // output can be updated
    );
  }

  protected override validateToolParamValues(
    params: SSHToolParams,
  ): string | null {
    if (!params.host?.trim()) {
      return 'Host is required.';
    }
    if (!params.user?.trim()) {
      return 'User is required.';
    }
    if (params.port !== undefined) {
      if (typeof params.port !== 'number' || !Number.isInteger(params.port)) {
        return 'Port must be an integer.';
      }
      if (params.port < 1 || params.port > 65535) {
        return 'Port must be between 1 and 65535.';
      }
    }
    if (params.timeout !== undefined) {
      if (typeof params.timeout !== 'number' || !Number.isInteger(params.timeout)) {
        return 'Timeout must be an integer number of milliseconds.';
      }
      if (params.timeout <= 0) {
        return 'Timeout must be a positive number.';
      }
      if (params.timeout > 600000) {
        return 'Timeout cannot exceed 600000ms (10 minutes).';
      }
    }
    return null;
  }

  protected createInvocation(
    params: SSHToolParams,
  ): ToolInvocation<SSHToolParams, ToolResult> {
    return new SSHToolInvocation(this.config, params, this.allowlist);
  }
}
