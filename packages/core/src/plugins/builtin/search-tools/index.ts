/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Search Tools Plugin
 * 
 * Built-in plugin providing search operations.
 */

import type { PluginDefinition } from '../../types.js';
import { GrepTool } from './grep/index.js';
import { RipGrepTool } from './ripGrep/index.js';
import { WebFetchTool } from './web-fetch/index.js';
import * as webSearch from './web-search/index.js';

/**
 * Search Tools Plugin Definition
 */
const searchToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'search-tools',
    name: 'Search Tools',
    version: '1.0.0',
    description: 'Search operations: grep, ripgrep, web fetch, web search',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'search', 'grep', 'web'],
    enabledByDefault: true,
  },
  
  // Export tool classes for direct registration with ToolRegistry
  toolClasses: [
    GrepTool,
    RipGrepTool,
    WebFetchTool,
    webSearch.WebSearchTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Search Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('Search Tools plugin enabled');
    },
  },
};

export default searchToolsPlugin;

// Also export tool classes for direct imports
export { GrepTool } from './grep/index.js';
export { RipGrepTool } from './ripGrep/index.js';
export { WebFetchTool } from './web-fetch/index.js';
export * from './web-search/index.js';
