/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SSH Tools Plugin
 *
 * Built-in plugin providing SSH connectivity for remote server management.
 */

import type { PluginDefinition } from '../../types.js';
import { SSHTool } from './ssh.js';

/**
 * SSH Tools Plugin Definition
 */
const sshToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'ssh-tools',
    name: 'SSH Tools',
    version: '1.0.0',
    description: 'SSH connectivity for remote server command execution',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'ssh', 'remote', 'network'],
    enabledByDefault: true,
  },

  // Export tool classes for direct registration with ToolRegistry
  toolClasses: [SSHTool],

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
