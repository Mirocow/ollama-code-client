/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Database Tools Plugin
 * 
 * Built-in plugin providing database and container management tools.
 */

import type { PluginDefinition } from '../../types.js';
import { databaseTool } from './database/index.js';
import { redisTool } from './redis/index.js';
import { dockerTool } from './docker/index.js';

/**
 * Database Tools Plugin Definition
 */
const databaseToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'database-tools',
    name: 'Database Tools',
    version: '1.0.0',
    description: 'Database and container management tools',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'database', 'docker', 'redis'],
    enabledByDefault: true,
  },
  
  toolClasses: [
    databaseTool,
    redisTool,
    dockerTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Database Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('Database Tools plugin enabled');
    },
  },
};

export default databaseToolsPlugin;

export { databaseTool } from './database/index.js';
export { redisTool } from './redis/index.js';
export { dockerTool } from './docker/index.js';
