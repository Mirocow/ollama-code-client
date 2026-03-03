/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * File Tools Plugin
 * 
 * Built-in plugin providing file system operations.
 */

import type { PluginDefinition } from '../../types.js';
import { ReadFileTool } from './read-file/index.js';
import { WriteFileTool } from './write-file/index.js';
import { EditTool } from './edit/index.js';
import { LSTool } from './ls/index.js';
import { GlobTool } from './glob/index.js';
import { ReadManyFilesTool } from './read-many-files/index.js';

/**
 * File Tools Plugin Definition
 */
const fileToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'file-tools',
    name: 'File Tools',
    version: '1.0.0',
    description: 'File system operations: read, write, edit, list, glob',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'file', 'filesystem'],
    enabledByDefault: true,
  },
  
  // Export tool classes for direct registration with ToolRegistry
  toolClasses: [
    ReadFileTool,
    WriteFileTool,
    EditTool,
    LSTool,
    GlobTool,
    ReadManyFilesTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('File Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('File Tools plugin enabled');
    },
  },
};

export default fileToolsPlugin;

// Also export tool classes for direct imports
export { ReadFileTool } from './read-file/index.js';
export { WriteFileTool } from './write-file/index.js';
export { EditTool } from './edit/index.js';
export { LSTool } from './ls/index.js';
export { GlobTool } from './glob/index.js';
export { ReadManyFilesTool } from './read-many-files/index.js';
