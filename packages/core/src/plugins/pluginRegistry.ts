/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 *
 * Plugin Registry - Created with GLM-5 from Z.AI
 */

/**
 * Plugin Registry Integration
 * 
 * Integrates the plugin system with ToolRegistry.
 * Handles loading builtin plugins and registering their tools.
 */

import { pluginManager } from './pluginManager.js';
import { createPluginLoader, registerPluginTools } from './index.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import { createDebugLogger } from '../utils/debugLogger.js';
import type { PluginDefinition } from './types.js';

const debugLogger = createDebugLogger('PLUGIN_REGISTRY');

/**
 * Plugin Registry - Manages plugin integration with ToolRegistry
 */
export class PluginRegistry {
  private initialized = false;
  private toolRegistry: ToolRegistry | null = null;
  private projectRoot: string;
  
  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }
  
  /**
   * Initialize the plugin registry with a tool registry
   */
  async initialize(toolRegistry: ToolRegistry): Promise<void> {
    if (this.initialized) {
      debugLogger.warn('Plugin registry already initialized');
      return;
    }
    
    this.toolRegistry = toolRegistry;
    
    // Load builtin plugins
    await this.loadBuiltinPlugins();
    
    this.initialized = true;
    debugLogger.info('Plugin registry initialized');
  }
  
  /**
   * Load builtin plugins
   */
  private async loadBuiltinPlugins(): Promise<void> {
    try {
      // Import builtin plugins dynamically
      const builtinPlugins = await this.importBuiltinPlugins();
      
      for (const plugin of builtinPlugins) {
        try {
          await pluginManager.registerPlugin(plugin);
          await pluginManager.enablePlugin(plugin.metadata.id);
          
          // Register tool classes with ToolRegistry (for real DeclarativeTool instances)
          if (plugin.toolClasses && this.toolRegistry) {
            for (const toolClass of plugin.toolClasses) {
              if (toolClass && typeof toolClass === 'function') {
                try {
                  this.toolRegistry.registerTool(toolClass as unknown as Parameters<typeof this.toolRegistry.registerTool>[0]);
                } catch (e) {
                  debugLogger.warn(`Failed to register tool class: ${e}`);
                }
              }
            }
          }
          
          // Register plugin tools (for PluginTool interface)
          if (plugin.tools && this.toolRegistry) {
            registerPluginTools(
              plugin.tools,
              plugin.metadata.id,
              (tool) => this.toolRegistry!.registerTool(tool)
            );
          }
          
          debugLogger.info(`Loaded builtin plugin: ${plugin.metadata.name}`);
        } catch (error) {
          debugLogger.error(`Failed to load builtin plugin:`, error);
        }
      }
    } catch (error) {
      debugLogger.error('Failed to load builtin plugins:', error);
    }
  }
  
  /**
   * Import builtin plugins
   */
  private async importBuiltinPlugins(): Promise<PluginDefinition[]> {
    const plugins: PluginDefinition[] = [];
    
    // Core tools - basic utilities
    try {
      const coreTools = await import('./builtin/core-tools/index.js');
      plugins.push(coreTools.default);
    } catch {
      debugLogger.debug('Core tools plugin not available');
    }
    
    // File tools - file system operations
    try {
      const fileTools = await import('./builtin/file-tools/index.js');
      plugins.push(fileTools.default);
    } catch {
      debugLogger.debug('File tools plugin not available');
    }
    
    // Shell tools - command execution
    try {
      const shellTools = await import('./builtin/shell-tools/index.js');
      plugins.push(shellTools.default);
    } catch {
      debugLogger.debug('Shell tools plugin not available');
    }
    
    // Search tools - grep, web search/fetch
    try {
      const searchTools = await import('./builtin/search-tools/index.js');
      plugins.push(searchTools.default);
    } catch {
      debugLogger.debug('Search tools plugin not available');
    }
    
    // Dev tools - language-specific tools
    try {
      const devTools = await import('./builtin/dev-tools/index.js');
      plugins.push(devTools.default);
    } catch {
      debugLogger.debug('Dev tools plugin not available');
    }
    
    // Note: Additional builtin plugins can be added here as they are developed
    // Currently available: core-tools, file-tools, shell-tools, search-tools, dev-tools
    
    debugLogger.info(`Loaded ${plugins.length} builtin plugins`);
    return plugins;
  }
  
  /**
   * Discover and load external plugins
   */
  async discoverExternalPlugins(): Promise<{
    loaded: string[];
    failed: string[];
  }> {
    if (!this.toolRegistry) {
      throw new Error('Plugin registry not initialized');
    }
    
    const loader = createPluginLoader(pluginManager, this.projectRoot);
    const discovered = await loader.discoverPlugins();
    
    // Filter out already loaded builtin plugins
    const externalPlugins = discovered.filter(
      p => p.type !== 'builtin' && p.valid
    );
    
    const result = await loader.loadAllPlugins(externalPlugins);
    
    // Register tools
    for (const pluginId of result.loaded) {
      const plugin = pluginManager.getPlugin(pluginId);
      if (plugin?.definition.tools) {
        registerPluginTools(
          plugin.definition.tools,
          pluginId,
          (tool) => this.toolRegistry!.registerTool(tool)
        );
      }
    }
    
    return result;
  }
  
  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): Array<import('./types.js').PluginInstance> {
    return pluginManager.getAllPlugins();
  }
  
  /**
   * Get enabled plugins
   */
  getEnabledPlugins(): Array<import('./types.js').PluginInstance> {
    return pluginManager.getEnabledPlugins();
  }
  
  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<void> {
    await pluginManager.enablePlugin(pluginId);
    
    // Register tools if tool registry is available
    if (this.toolRegistry) {
      const plugin = pluginManager.getPlugin(pluginId);
      if (plugin?.definition.tools) {
        registerPluginTools(
          plugin.definition.tools,
          pluginId,
          (tool) => this.toolRegistry!.registerTool(tool)
        );
      }
    }
  }
  
  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = pluginManager.getPlugin(pluginId);
    
    // Unregister tools
    if (plugin?.definition.tools && this.toolRegistry) {
      // Note: ToolRegistry doesn't have unregister method
      // Tools remain registered but plugin is disabled
      void plugin.definition.tools; // Acknowledge tools exist
    }
    
    await pluginManager.disablePlugin(pluginId);
  }
  
  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get plugin manager
   */
  getPluginManager(): typeof pluginManager {
    return pluginManager;
  }
  
  /**
   * Get list of available builtin plugin categories
   */
  getBuiltinPluginCategories(): string[] {
    return [
      'core-tools',
      'file-tools',
      'shell-tools',
      'search-tools',
      'dev-tools',
    ];
  }
}

/**
 * Singleton instance
 */
let pluginRegistryInstance: PluginRegistry | null = null;

/**
 * Get or create plugin registry instance
 */
export function getPluginRegistry(projectRoot?: string): PluginRegistry {
  if (!pluginRegistryInstance) {
    pluginRegistryInstance = new PluginRegistry(projectRoot);
  }
  return pluginRegistryInstance;
}

/**
 * Initialize plugin registry with tool registry
 */
export async function initializePluginRegistry(
  toolRegistry: ToolRegistry,
  projectRoot?: string
): Promise<PluginRegistry> {
  const registry = getPluginRegistry(projectRoot);
  await registry.initialize(toolRegistry);
  return registry;
}
