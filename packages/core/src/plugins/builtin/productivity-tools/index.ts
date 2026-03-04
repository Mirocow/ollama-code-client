/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Productivity Tools Plugin
 * 
 * Built-in plugin providing productivity enhancement tools.
 */

import type { PluginDefinition } from '../../types.js';
import { TodoWriteTool } from './todo-write/index.js';
import { ExitPlanModeTool } from './exit-plan-mode/index.js';

/**
 * Productivity Tools Plugin Definition
 */
const productivityToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'productivity-tools',
    name: 'Productivity Tools',
    version: '1.0.0',
    description: 'Productivity enhancement tools: todo_write, exit_plan_mode',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'productivity'],
    enabledByDefault: true,
  },
  
  toolClasses: [
    TodoWriteTool,
    ExitPlanModeTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Productivity Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('Productivity Tools plugin enabled');
    },
  },
};

export default productivityToolsPlugin;

// Also export tool classes for direct imports
export { TodoWriteTool } from './todo-write/index.js';
export { ExitPlanModeTool } from './exit-plan-mode/index.js';
