/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Git Tools Plugin
 * 
 * Built-in plugin providing advanced Git operations.
 */

import type { PluginDefinition } from '../../types.js';
import { GitAdvancedTool } from './git-advanced/index.js';

/**
 * Git Tools Plugin Definition
 */
const gitToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'git-tools',
    name: 'Git Tools',
    version: '1.0.0',
    description: 'Advanced Git operations and version control tools',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'git', 'version-control'],
    enabledByDefault: true,
  },
  
  toolClasses: [
    GitAdvancedTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Git Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('Git Tools plugin enabled');
    },
  },
};

export default gitToolsPlugin;

export { GitAdvancedTool } from './git-advanced/index.js';
