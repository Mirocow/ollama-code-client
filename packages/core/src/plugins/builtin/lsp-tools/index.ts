/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LSP Tools Plugin
 * 
 * Built-in plugin providing Language Server Protocol integration.
 */

import type { PluginDefinition } from '../../types.js';
import { LspTool } from './lsp/index.js';

/**
 * LSP Tools Plugin Definition
 */
const lspToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'lsp-tools',
    name: 'LSP Tools',
    version: '1.0.0',
    description: 'Language Server Protocol integration for code intelligence',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'lsp', 'language-server'],
    enabledByDefault: true,
  },
  
  toolClasses: [
    LspTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('LSP Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('LSP Tools plugin enabled');
    },
  },
};

export default lspToolsPlugin;

export { LspTool } from './lsp/index.js';
