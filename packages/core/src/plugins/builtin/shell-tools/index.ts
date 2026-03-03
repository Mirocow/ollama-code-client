/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shell Tools Plugin
 * 
 * Built-in plugin providing shell command execution.
 */

import type { PluginDefinition } from '../../types.js';
import { ShellTool } from './shell.js';

/**
 * Shell Tools Plugin Definition
 */
const shellToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'shell-tools',
    name: 'Shell Tools',
    version: '1.0.0',
    description: 'Shell command execution with timeout and background support',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'shell', 'execute'],
    enabledByDefault: true,
  },
  
  // Export tool classes for direct registration with ToolRegistry
  toolClasses: [ShellTool],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Shell Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('Shell Tools plugin enabled');
    },
  },
};

export default shellToolsPlugin;

// Also export tool classes for direct imports
export { ShellTool, ShellToolInvocation } from './shell.js';
