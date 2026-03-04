/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Tools Plugin
 * 
 * Built-in plugin providing agent-related tools.
 */

import type { PluginDefinition } from '../../types.js';
import { SkillTool } from './skill/index.js';
import { TaskTool } from './task/index.js';

/**
 * Agent Tools Plugin Definition
 */
const agentToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'agent-tools',
    name: 'Agent Tools',
    version: '1.0.0',
    description: 'Agent-related tools: skill, task',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'agent'],
    enabledByDefault: true,
  },
  
  toolClasses: [
    SkillTool,
    TaskTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Agent Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('Agent Tools plugin enabled');
    },
  },
};

export default agentToolsPlugin;

// Also export tool classes for direct imports
export { SkillTool } from './skill/index.js';
export { TaskTool } from './task/index.js';
