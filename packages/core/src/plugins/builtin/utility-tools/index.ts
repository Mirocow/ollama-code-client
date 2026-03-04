/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility Tools Plugin
 * 
 * Built-in plugin providing utility tools for code analysis and diagram generation.
 */

import type { PluginDefinition } from '../../types.js';
import { codeAnalyzerTool } from './code-analyzer/index.js';
import { diagramGeneratorTool } from './diagram-generator/index.js';

/**
 * Utility Tools Plugin Definition
 */
const utilityToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'utility-tools',
    name: 'Utility Tools',
    version: '1.0.0',
    description: 'Utility tools: code analyzer, diagram generator',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'utility', 'analysis'],
    enabledByDefault: true,
  },
  
  toolClasses: [
    codeAnalyzerTool,
    diagramGeneratorTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Utility Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('Utility Tools plugin enabled');
    },
  },
};

export default utilityToolsPlugin;

export { codeAnalyzerTool } from './code-analyzer/index.js';
export { diagramGeneratorTool } from './diagram-generator/index.js';
