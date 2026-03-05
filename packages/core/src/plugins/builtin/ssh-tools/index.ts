/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SSH Tools Plugin
 *
 * Built-in plugin providing SSH connectivity for remote server management.
 * Includes tools for SSH connections and SSH host profile management.
 */

import type { PluginDefinition } from '../../types.js';
import { SSHTool } from './ssh.js';
import { SSHAddHostTool, SSHListHostsTool, SSHRemoveHostTool } from './ssh-hosts.js';

/**
 * SSH Tools Plugin Definition
 */
const sshToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'ssh-tools',
    name: 'SSH Tools',
    version: '1.1.0',
    description: 'SSH connectivity for remote server command execution with profile management',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'ssh', 'remote', 'network'],
    enabledByDefault: true,
  },

  // Export tool classes for direct registration with ToolRegistry
  toolClasses: [SSHTool, SSHAddHostTool, SSHListHostsTool, SSHRemoveHostTool],

  hooks: {
    onLoad: async (context) => {
      context.logger.info('SSH Tools plugin loaded');
    },

    onEnable: async (context) => {
      context.logger.info('SSH Tools plugin enabled');
    },
  },
};

export default sshToolsPlugin;

// Also export tool classes for direct imports
export { SSHTool, SSHToolInvocation } from './ssh.js';
export { 
  SSHAddHostTool, 
  SSHAddHostInvocation,
  SSHListHostsTool, 
  SSHListHostsInvocation,
  SSHRemoveHostTool, 
  SSHRemoveHostInvocation,
  type SSHAddHostParams,
  type SSHListHostsParams,
  type SSHRemoveHostParams,
} from './ssh-hosts.js';
