/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * API Tools Plugin
 * 
 * Built-in plugin providing API testing tools.
 */

import type { PluginDefinition } from '../../types.js';
import { ApiTesterTool } from './api-tester/index.js';

/**
 * API Tools Plugin Definition
 */
const apiToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'api-tools',
    name: 'API Tools',
    version: '1.0.0',
    description: 'API testing and debugging tools',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'api', 'testing'],
    enabledByDefault: true,
  },
  
  toolClasses: [
    ApiTesterTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('API Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('API Tools plugin enabled');
    },
  },
};

export default apiToolsPlugin;

export { ApiTesterTool } from './api-tester/index.js';
