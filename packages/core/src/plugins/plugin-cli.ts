#!/usr/bin/env node
/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Development CLI
 * 
 * Commands:
 * - create <name>     Create a new plugin from template
 * - validate <path>   Validate a plugin manifest
 * - list              List all loaded plugins
 * - info <id>         Show plugin information
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const PLUGINS_DIR = path.join(os.homedir(), '.ollama-code', 'plugins');

/**
 * Create a new plugin from template
 */
async function createPlugin(name: string): Promise<void> {
  const pluginDir = path.join(PLUGINS_DIR, name);
  
  // Check if plugin already exists
  try {
    await fs.access(pluginDir);
    console.error(`❌ Plugin '${name}' already exists at ${pluginDir}`);
    process.exit(1);
  } catch {
    // Directory doesn't exist, proceed
  }
  
  // Create plugin directory
  await fs.mkdir(pluginDir, { recursive: true });
  
  // Create plugin.json
  const manifest = {
    entry: 'index.js',
    metadata: {
      id: name,
      name: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      version: '1.0.0',
      description: 'A custom plugin for Ollama Code',
      author: 'Your Name',
      tags: ['custom'],
      enabledByDefault: true,
    },
  };
  
  await fs.writeFile(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  // Create index.ts template
  const indexTemplate = `/**
 * ${manifest.metadata.name}
 * 
 * ${manifest.metadata.description}
 */

import type { PluginDefinition, PluginTool } from 'ollama-code';

/**
 * Example Tool
 */
const exampleTool: PluginTool = {
  id: 'example',
  name: '${name}_example',
  description: 'An example tool from ${name} plugin',
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter',
      },
    },
    required: ['input'],
  },
  category: 'other',
  execute: async (params, context) => {
    const input = params.input as string;
    
    context.logger.info('Example tool executed');
    
    return {
      success: true,
      data: \`Processed: \${input}\`,
      display: {
        summary: \`Result: \${input}\`,
      },
    };
  },
};

/**
 * Plugin Definition
 */
const plugin: PluginDefinition = {
  metadata: {
    id: '${name}',
    name: '${manifest.metadata.name}',
    version: '1.0.0',
    description: '${manifest.metadata.description}',
    author: 'Your Name',
  },
  tools: [exampleTool],
  hooks: {
    onLoad: async (context) => {
      context.logger.info('${name} plugin loaded');
    },
  },
};

export default plugin;
`;
  
  await fs.writeFile(path.join(pluginDir, 'index.ts'), indexTemplate);
  
  // Create README.md
  const readme = `# ${manifest.metadata.name}

${manifest.metadata.description}

## Installation

Place this plugin in \`~/.ollama-code/plugins/${name}/\`

## Tools

### ${name}_example

An example tool that processes input.

**Parameters:**
- \`input\` (string, required): Input parameter to process

## Development

1. Edit \`index.ts\` to add your tools
2. Compile TypeScript: \`tsc index.ts --outDir .\`
3. Test by restarting Ollama Code

## License

MIT
`;
  
  await fs.writeFile(path.join(pluginDir, 'README.md'), readme);
  
  console.log(`✅ Created plugin '${name}' at ${pluginDir}`);
  console.log('');
  console.log('Files created:');
  console.log('  - plugin.json  (manifest)');
  console.log('  - index.ts     (plugin code)');
  console.log('  - README.md    (documentation)');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit index.ts to add your tools');
  console.log('  2. Compile: tsc index.ts --esModuleInterop --moduleResolution node --outDir .');
  console.log('  3. Restart Ollama Code to load the plugin');
}

/**
 * Validate a plugin manifest
 */
async function validatePlugin(pluginPath: string): Promise<void> {
  const manifestPath = path.join(pluginPath, 'plugin.json');
  
  try {
    const content = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(content);
    
    const errors: string[] = [];
    
    // Validate required fields
    if (!manifest.entry) errors.push('Missing "entry" field');
    if (!manifest.metadata?.id) errors.push('Missing "metadata.id" field');
    if (!manifest.metadata?.name) errors.push('Missing "metadata.name" field');
    if (!manifest.metadata?.version) errors.push('Missing "metadata.version" field');
    
    // Validate entry file exists
    const entryPath = path.join(pluginPath, manifest.entry || 'index.js');
    try {
      await fs.access(entryPath);
    } catch {
      errors.push(`Entry file "${manifest.entry}" not found`);
    }
    
    if (errors.length > 0) {
      console.log('❌ Validation failed:\n');
      errors.forEach(e => console.log(`  - ${e}`));
      process.exit(1);
    }
    
    console.log('✅ Plugin manifest is valid');
    console.log('');
    console.log('Plugin info:');
    console.log(`  ID:          ${manifest.metadata.id}`);
    console.log(`  Name:        ${manifest.metadata.name}`);
    console.log(`  Version:     ${manifest.metadata.version}`);
    console.log(`  Description: ${manifest.metadata.description || '(none)'}`);
    console.log(`  Author:      ${manifest.metadata.author || '(unknown)'}`);
    
    if (manifest.metadata.tools) {
      console.log(`  Tools:       ${manifest.metadata.tools.join(', ')}`);
    }
  } catch (error) {
    console.error(`❌ Failed to read plugin manifest: ${error}`);
    process.exit(1);
  }
}

/**
 * List all loaded plugins
 */
async function listPlugins(): Promise<void> {
  console.log('Installed plugins:\n');
  
  // List user plugins
  try {
    const userPlugins = await fs.readdir(PLUGINS_DIR);
    for (const plugin of userPlugins) {
      const manifestPath = path.join(PLUGINS_DIR, plugin, 'plugin.json');
      try {
        const content = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(content);
        console.log(`  📦 ${manifest.metadata.name} (${manifest.metadata.id})`);
        console.log(`     Version: ${manifest.metadata.version}`);
        console.log(`     Path: ${path.join(PLUGINS_DIR, plugin)}`);
        console.log('');
      } catch {
        console.log(`  ⚠️  ${plugin} (invalid manifest)`);
      }
    }
  } catch {
    console.log('  No user plugins installed');
    console.log(`  Plugin directory: ${PLUGINS_DIR}`);
  }
}

/**
 * Show plugin information
 */
async function showPluginInfo(pluginId: string): Promise<void> {
  // Search in user plugins
  const userPluginPath = path.join(PLUGINS_DIR, pluginId);
  
  try {
    const manifestPath = path.join(userPluginPath, 'plugin.json');
    const content = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(content);
    
    console.log(`\n📦 ${manifest.metadata.name}`);
    console.log('━'.repeat(40));
    console.log(`ID:          ${manifest.metadata.id}`);
    console.log(`Version:     ${manifest.metadata.version}`);
    console.log(`Description: ${manifest.metadata.description || '(none)'}`);
    console.log(`Author:      ${manifest.metadata.author || '(unknown)'}`);
    console.log(`Path:        ${userPluginPath}`);
    console.log(`Entry:       ${manifest.entry}`);
    
    if (manifest.metadata.tags) {
      console.log(`Tags:        ${manifest.metadata.tags.join(', ')}`);
    }
    
    if (manifest.metadata.dependencies) {
      console.log('\nDependencies:');
      manifest.metadata.dependencies.forEach((dep: {pluginId: string; optional?: boolean}) => {
        console.log(`  - ${dep.pluginId}${dep.optional ? ' (optional)' : ''}`);
      });
    }
    
    // Check if entry file exists
    const entryPath = path.join(userPluginPath, manifest.entry);
    try {
      const stats = await fs.stat(entryPath);
      console.log(`\nEntry file:  ✅ (${stats.size} bytes)`);
    } catch {
      console.log(`\nEntry file:  ❌ Not found`);
    }
  } catch (_error) {
    console.error(`❌ Plugin '${pluginId}' not found`);
    process.exit(1);
  }
}

/**
 * Main CLI
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'create':
      if (!args[1]) {
        console.error('Usage: plugin-cli create <name>');
        process.exit(1);
      }
      await createPlugin(args[1]);
      break;
      
    case 'validate':
      if (!args[1]) {
        console.error('Usage: plugin-cli validate <path>');
        process.exit(1);
      }
      await validatePlugin(args[1]);
      break;
      
    case 'list':
    case 'ls':
      await listPlugins();
      break;
      
    case 'info':
      if (!args[1]) {
        console.error('Usage: plugin-cli info <id>');
        process.exit(1);
      }
      await showPluginInfo(args[1]);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      console.log(`
Plugin Development CLI

Usage: plugin-cli <command> [options]

Commands:
  create <name>     Create a new plugin from template
  validate <path>   Validate a plugin manifest
  list              List all installed plugins
  info <id>         Show plugin information
  help              Show this help message

Examples:
  plugin-cli create my-plugin
  plugin-cli validate ./my-plugin
  plugin-cli list
  plugin-cli info my-plugin
`);
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "plugin-cli help" for usage');
      process.exit(1);
  }
}

main().catch(console.error);
