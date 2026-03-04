/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Memory Tools Plugin
 * 
 * Built-in plugin providing memory/context management tools.
 */

import type { PluginDefinition } from '../../types.js';
import { MemoryTool } from './save-memory/index.js';

/**
 * Memory Tools Plugin Definition
 */
const memoryToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'memory-tools',
    name: 'Memory Tools',
    version: '1.0.0',
    description: 'Memory and context management tools: save_memory',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'memory', 'context'],
    enabledByDefault: true,
  },
  
  toolClasses: [
    MemoryTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Memory Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('Memory Tools plugin enabled');
    },
  },
};

export default memoryToolsPlugin;

// Also export tool classes and utilities for direct imports
export { 
  MemoryTool, 
  setOllamaMdFilename, 
  getCurrentOllamaMdFilename, 
  getAllOllamaMdFilenames, 
  OLLAMA_CONFIG_DIR, 
  OLLAMA_CODE_CONFIG_DIR, 
  DEFAULT_CONTEXT_FILENAME 
} from './save-memory/index.js';
