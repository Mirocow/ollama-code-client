/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dev Tools Plugin
 * 
 * Built-in plugin providing language-specific development tools.
 */

import type { PluginDefinition } from '../../types.js';
import { PythonTool } from './python/index.js';
import { NodeJsTool } from './nodejs/index.js';
import { GolangTool } from './golang/index.js';
import { RustTool } from './rust/index.js';
import { TypeScriptTool } from './typescript/index.js';
import { JavaTool } from './java/index.js';
import { CppTool } from './cpp/index.js';
import { SwiftTool } from './swift/index.js';
import { PHPTool } from './php/index.js';

/**
 * Dev Tools Plugin Definition
 */
const devToolsPlugin: PluginDefinition = {
  metadata: {
    id: 'dev-tools',
    name: 'Development Tools',
    version: '1.0.0',
    description: 'Language-specific development tools: Python, Node.js, Go, Rust, TypeScript, Java, C++, Swift, PHP',
    author: 'Ollama Code Team',
    tags: ['core', 'builtin', 'dev', 'language', 'build'],
    enabledByDefault: true,
  },
  
  // Export tool classes for direct registration with ToolRegistry
  toolClasses: [
    PythonTool,
    NodeJsTool,
    GolangTool,
    RustTool,
    TypeScriptTool,
    JavaTool,
    CppTool,
    SwiftTool,
    PHPTool,
  ],
  
  hooks: {
    onLoad: async (context) => {
      context.logger.info('Dev Tools plugin loaded');
    },
    
    onEnable: async (context) => {
      context.logger.info('Dev Tools plugin enabled');
    },
  },
};

export default devToolsPlugin;

// Also export tool classes for direct imports
export { PythonTool } from './python/index.js';
export { NodeJsTool } from './nodejs/index.js';
export { GolangTool } from './golang/index.js';
export { RustTool } from './rust/index.js';
export { TypeScriptTool } from './typescript/index.js';
export { JavaTool } from './java/index.js';
export { CppTool } from './cpp/index.js';
export { SwiftTool } from './swift/index.js';
export { PHPTool } from './php/index.js';
