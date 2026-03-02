/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shell Tools Plugin
 *
 * Built-in plugin providing shell command execution capabilities.
 */

import type { PluginDefinition, PluginTool } from '../../types.js';

/**
 * Tool: run_shell_command
 * Execute shell commands with safety features
 */
const runShellCommandTool: PluginTool = {
  id: 'run_shell_command',
  name: 'run_shell_command',
  description: `Execute shell commands with safety features and confirmation prompts.

Supports:
- Command execution with timeout
- Background process execution
- Directory specification
- Safety confirmation for destructive commands

Commands that modify the filesystem or system state will require confirmation.`,
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'REQUIRED: The shell command to execute',
      },
      timeout_ms: {
        type: 'number',
        description: 'OPTIONAL: Timeout in milliseconds (default: 120000, max: 600000)',
      },
      description: {
        type: 'string',
        description: 'OPTIONAL: A brief description of what the command does',
      },
      is_background: {
        type: 'boolean',
        description: 'OPTIONAL: Whether to run in background',
      },
      directory: {
        type: 'string',
        description: 'OPTIONAL: Directory to run command in',
      },
    },
    required: ['command'],
  },
  category: 'execute',
  requiresConfirmation: true,
  buildConfirmationMessage: (params) => {
    const command = params['command'] as string;
    return `Execute: \`${command}\``;
  },
  execute: async (params, context) => {
    const command = params['command'] as string;
    
    return {
      success: true,
      data: {
        message: 'Shell command ready for execution',
        command,
      },
      display: {
        summary: `Shell: ${command.substring(0, 100)}`,
      },
    };
  },
  timeout: 600000,
};

/**
 * Shell Tools Plugin Definition
 */
const shellToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'shell-tools',
    name: 'Shell Tools',
    version: '1.0.0',
    description: 'Shell command execution with safety features',
    author: 'Ollama Code Team',
    tags: ['core', 'shell', 'execute', 'terminal'],
    enabledByDefault: true,
  },
  
  tools: [runShellCommandTool],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Shell Tools plugin loaded');
    },
    onEnable: async (context) => {
      context.logger.info('Shell Tools plugin enabled');
    },
  },
  
  defaultConfig: {
    defaultTimeout: 120000,
    maxTimeout: 600000,
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
    allowDangerousCommands: false,
  },
};

export default shellToolsPlugin;
