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
import type { Config } from '../config/config.js';

const debugLogger = createDebugLogger('PLUGIN_REGISTRY');

/**
 * Plugin Registry - Manages plugin integration with ToolRegistry
 */
export class PluginRegistry {
  private initialized = false;
  private toolRegistry: ToolRegistry | null = null;
  private config: Config | null = null;
  private projectRoot: string;
  
  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }
  
  /**
   * Initialize the plugin registry with a tool registry and config
   */
  async initialize(toolRegistry: ToolRegistry, config?: Config): Promise<void> {
    if (this.initialized) {
      debugLogger.warn('Plugin registry already initialized');
      return;
    }
    
    this.toolRegistry = toolRegistry;
    this.config = config || null;
    
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
          
          // Register tool classes with ToolRegistry (for DeclarativeTool instances without config)
          if (plugin.toolClasses && this.toolRegistry) {
            for (const toolClass of plugin.toolClasses) {
              if (toolClass && typeof toolClass === 'function') {
                try {
                  // Try to instantiate without config (for tools that don't need it)
                  const toolInstance = new (toolClass as new () => unknown)();
                  this.toolRegistry.registerTool(toolInstance as Parameters<typeof this.toolRegistry.registerTool>[0]);
                } catch (e) {
                  debugLogger.warn(`Failed to register tool class without config: ${e}`);
                }
              }
            }
          }
          
          // Register tools from factories (for tools that need config)
          if (plugin.toolFactories && this.toolRegistry && this.config) {
            for (const factory of plugin.toolFactories) {
              if (factory && typeof factory === 'function') {
                try {
                  const toolInstance = factory(this.config);
                  this.toolRegistry.registerTool(toolInstance as Parameters<typeof this.toolRegistry.registerTool>[0]);
                } catch (e) {
                  debugLogger.warn(`Failed to register tool from factory: ${e}`);
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
    
    // List of builtin plugins to load
    const pluginModules = [
      './builtin/core-tools/index.js',
      './builtin/file-tools/index.js',
      './builtin/shell-tools/index.js',
      './builtin/search-tools/index.js',
      './builtin/dev-tools/index.js',
      './builtin/agent-tools/index.js',
      './builtin/memory-tools/index.js',
      './builtin/productivity-tools/index.js',
      './builtin/api-tools/index.js',
      './builtin/database-tools/index.js',
      './builtin/git-tools/index.js',
      './builtin/lsp-tools/index.js',
      './builtin/mcp-tools/index.js',
      './builtin/utility-tools/index.js',
    ];
    
    for (const modulePath of pluginModules) {
      try {
        const module = await import(modulePath);
        if (module.default) {
          plugins.push(module.default);
        }
      } catch (error) {
        debugLogger.debug(`Plugin not available: ${modulePath}`);
      }
    }
    
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
      'agent-tools',
      'memory-tools',
      'productivity-tools',
      'api-tools',
      'database-tools',
      'git-tools',
      'lsp-tools',
      'mcp-tools',
      'utility-tools',
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
  projectRoot?: string,
  config?: Config
): Promise<PluginRegistry> {
  const registry = getPluginRegistry(projectRoot);
  await registry.initialize(toolRegistry, config);
  return registry;
}
