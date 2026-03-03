/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Loader
 * 
 * Handles discovery and dynamic loading of plugins from:
 * - Built-in plugins (bundled with Ollama Code)
 * - User plugins (~/.ollama-code/plugins/)
 * - Project plugins (.ollama-code/plugins/)
 * - npm packages (ollama-code-plugin-*)
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { createDebugLogger } from '../utils/debugLogger.js';
import type { PluginDefinition, PluginManifest } from './types.js';
import type { PluginManager } from './pluginManager.js';

const debugLogger = createDebugLogger('PLUGIN_LOADER');

/**
 * Plugin discovery result
 */
export interface DiscoveredPlugin {
  /** Path to plugin directory */
  path: string;
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Plugin type */
  type: 'builtin' | 'user' | 'project' | 'npm';
  /** Whether the plugin is valid */
  valid: boolean;
  /** Validation error if invalid */
  error?: string;
}

/**
 * Plugin Loader - Discovers and loads plugins from various sources
 */
export class PluginLoader {
  private pluginManager: PluginManager;
  private loadedPlugins: Map<string, DiscoveredPlugin> = new Map();
  
  // Standard plugin directories
  private readonly userPluginsDir: string;
  private readonly projectPluginsDir: string;
  
  constructor(pluginManager: PluginManager, projectRoot?: string) {
    this.pluginManager = pluginManager;
    this.userPluginsDir = path.join(os.homedir(), '.ollama-code', 'plugins');
    this.projectPluginsDir = projectRoot 
      ? path.join(projectRoot, '.ollama-code', 'plugins')
      : '';
  }
  
  /**
   * Discover all available plugins
   */
  async discoverPlugins(): Promise<DiscoveredPlugin[]> {
    const discovered: DiscoveredPlugin[] = [];
    
    // Discover built-in plugins
    discovered.push(...await this.discoverBuiltinPlugins());
    
    // Discover user plugins
    discovered.push(...await this.discoverUserPlugins());
    
    // Discover project plugins
    if (this.projectPluginsDir) {
      discovered.push(...await this.discoverProjectPlugins());
    }
    
    // Discover npm plugins
    discovered.push(...await this.discoverNpmPlugins());
    
    debugLogger.info(`Discovered ${discovered.length} plugins`);
    return discovered;
  }
  
  /**
   * Discover built-in plugins
   */
  private async discoverBuiltinPlugins(): Promise<DiscoveredPlugin[]> {
    const discovered: DiscoveredPlugin[] = [];
    const builtinDir = path.join(__dirname, 'builtin');
    
    if (!fs.existsSync(builtinDir)) {
      debugLogger.debug('No built-in plugins directory found');
      return discovered;
    }
    
    const entries = fs.readdirSync(builtinDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const pluginPath = path.join(builtinDir, entry.name);
      const manifest = await this.loadManifest(pluginPath);
      
      if (manifest) {
        discovered.push({
          path: pluginPath,
          manifest,
          type: 'builtin',
          valid: true,
        });
      }
    }
    
    return discovered;
  }
  
  /**
   * Discover user-level plugins
   */
  private async discoverUserPlugins(): Promise<DiscoveredPlugin[]> {
    return this.discoverPluginsFromDirectory(this.userPluginsDir, 'user');
  }
  
  /**
   * Discover project-level plugins
   */
  private async discoverProjectPlugins(): Promise<DiscoveredPlugin[]> {
    return this.discoverPluginsFromDirectory(this.projectPluginsDir, 'project');
  }
  
  /**
   * Discover plugins from a specific directory
   */
  private async discoverPluginsFromDirectory(
    dir: string, 
    type: 'user' | 'project'
  ): Promise<DiscoveredPlugin[]> {
    const discovered: DiscoveredPlugin[] = [];
    
    if (!fs.existsSync(dir)) {
      debugLogger.debug(`Plugin directory not found: ${dir}`);
      return discovered;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const pluginPath = path.join(dir, entry.name);
      const manifest = await this.loadManifest(pluginPath);
      
      if (manifest) {
        discovered.push({
          path: pluginPath,
          manifest,
          type,
          valid: true,
        });
      } else {
        discovered.push({
          path: pluginPath,
          manifest: { entry: '', metadata: { id: entry.name, name: entry.name, version: '0.0.0' } },
          type,
          valid: false,
          error: 'Invalid or missing manifest',
        });
      }
    }
    
    return discovered;
  }
  
  /**
   * Discover npm packages that are Ollama Code plugins
   */
  private async discoverNpmPlugins(): Promise<DiscoveredPlugin[]> {
    const discovered: DiscoveredPlugin[] = [];
    
    // Look for ollama-code-plugin-* packages in node_modules
    const nodeModulesDir = path.join(process.cwd(), 'node_modules');
    
    if (!fs.existsSync(nodeModulesDir)) {
      return discovered;
    }
    
    const entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      // Check for scoped packages (@scope/ollama-code-plugin-*)
      if (entry.name.startsWith('@')) {
        const scopedDir = path.join(nodeModulesDir, entry.name);
        const scopedEntries = fs.readdirSync(scopedDir, { withFileTypes: true });
        
        for (const scopedEntry of scopedEntries) {
          if (scopedEntry.name.startsWith('ollama-code-plugin-')) {
            const pluginPath = path.join(scopedDir, scopedEntry.name);
            const manifest = await this.loadManifest(pluginPath);
            
            if (manifest) {
              discovered.push({
                path: pluginPath,
                manifest,
                type: 'npm',
                valid: true,
              });
            }
          }
        }
      }
      // Check for unscoped packages (ollama-code-plugin-*)
      else if (entry.name.startsWith('ollama-code-plugin-')) {
        const pluginPath = path.join(nodeModulesDir, entry.name);
        const manifest = await this.loadManifest(pluginPath);
        
        if (manifest) {
          discovered.push({
            path: pluginPath,
            manifest,
            type: 'npm',
            valid: true,
          });
        }
      }
    }
    
    return discovered;
  }
  
  /**
   * Load plugin manifest from directory
   */
  private async loadManifest(pluginPath: string): Promise<PluginManifest | null> {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    
    if (!fs.existsSync(manifestPath)) {
      debugLogger.debug(`No plugin.json found in ${pluginPath}`);
      return null;
    }
    
    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(content) as PluginManifest;
      
      // Validate manifest
      if (!manifest.metadata?.id || !manifest.metadata?.name || !manifest.entry) {
        debugLogger.warn(`Invalid manifest in ${pluginPath}: missing required fields`);
        return null;
      }
      
      return manifest;
    } catch (error) {
      debugLogger.error(`Error loading manifest from ${pluginPath}:`, error);
      return null;
    }
  }
  
  /**
   * Load a plugin from discovered plugin info
   */
  async loadPlugin(discovered: DiscoveredPlugin): Promise<boolean> {
    if (!discovered.valid) {
      debugLogger.warn(`Cannot load invalid plugin: ${discovered.path}`);
      return false;
    }
    
    const { manifest, path: pluginPath } = discovered;
    const pluginId = manifest.metadata.id;
    
    // Check if already loaded
    if (this.loadedPlugins.has(pluginId)) {
      debugLogger.debug(`Plugin ${pluginId} already loaded`);
      return true;
    }
    
    try {
      // Load the plugin module
      const entryPath = path.join(pluginPath, manifest.entry);
      
      // Dynamic import
      const pluginModule = await import(entryPath);
      const definition: PluginDefinition = pluginModule.default || pluginModule;
      
      // Register with plugin manager
      await this.pluginManager.registerPlugin(definition);
      this.loadedPlugins.set(pluginId, discovered);
      
      debugLogger.info(`Loaded plugin: ${definition.metadata.name} (${pluginId})`);
      return true;
    } catch (error) {
      debugLogger.error(`Failed to load plugin ${pluginId}:`, error);
      return false;
    }
  }
  
  /**
   * Load all valid discovered plugins
   */
  async loadAllPlugins(discovered: DiscoveredPlugin[]): Promise<{
    loaded: string[];
    failed: string[];
  }> {
    const loaded: string[] = [];
    const failed: string[] = [];
    
    // Sort by dependencies (simple topological sort)
    const sorted = this.sortByDependencies(discovered.filter(d => d.valid));
    
    for (const plugin of sorted) {
      const success = await this.loadPlugin(plugin);
      if (success) {
        loaded.push(plugin.manifest.metadata.id);
      } else {
        failed.push(plugin.manifest.metadata.id);
      }
    }
    
    return { loaded, failed };
  }
  
  /**
   * Sort plugins by dependencies (topological sort)
   */
  private sortByDependencies(plugins: DiscoveredPlugin[]): DiscoveredPlugin[] {
    const sorted: DiscoveredPlugin[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (plugin: DiscoveredPlugin) => {
      const id = plugin.manifest.metadata.id;
      
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        debugLogger.warn(`Circular dependency detected for plugin ${id}`);
        return;
      }
      
      visiting.add(id);
      
      // Visit dependencies first
      const deps = plugin.manifest.metadata.dependencies || [];
      for (const dep of deps) {
        const depPlugin = plugins.find(p => p.manifest.metadata.id === dep.pluginId);
        if (depPlugin && !dep.optional) {
          visit(depPlugin);
        }
      }
      
      visiting.delete(id);
      visited.add(id);
      sorted.push(plugin);
    };
    
    for (const plugin of plugins) {
      visit(plugin);
    }
    
    return sorted;
  }
  
  /**
   * Enable all loaded plugins
   */
  async enableAllPlugins(): Promise<void> {
    for (const [pluginId] of this.loadedPlugins) {
      try {
        await this.pluginManager.enablePlugin(pluginId);
      } catch (error) {
        debugLogger.error(`Failed to enable plugin ${pluginId}:`, error);
      }
    }
  }
  
  /**
   * Get loaded plugin info
   */
  getLoadedPlugin(pluginId: string): DiscoveredPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }
  
  /**
   * Get all loaded plugins
   */
  getAllLoadedPlugins(): DiscoveredPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }
  
  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    await this.pluginManager.unregisterPlugin(pluginId);
    this.loadedPlugins.delete(pluginId);
  }
  
  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginId: string): Promise<boolean> {
    const discovered = this.loadedPlugins.get(pluginId);
    if (!discovered) {
      debugLogger.warn(`Cannot reload plugin ${pluginId}: not found`);
      return false;
    }
    
    await this.unloadPlugin(pluginId);
    return this.loadPlugin(discovered);
  }
}

/**
 * Create a plugin loader instance
 */
export function createPluginLoader(
  pluginManager: PluginManager, 
  projectRoot?: string
): PluginLoader {
  return new PluginLoader(pluginManager, projectRoot);
}
