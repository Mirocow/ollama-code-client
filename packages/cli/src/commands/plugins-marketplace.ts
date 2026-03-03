/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Marketplace CLI Commands
 *
 * Provides CLI interface for searching, installing, and managing plugins
 */

import type { CommandContext } from '../ui/commands/types.js';
import {
  createPluginMarketplace,
  type MarketplacePlugin,
  type MarketplaceSearchOptions,
} from '@ollama-code/ollama-code-core';

/**
 * Format plugin for display
 */
function formatPlugin(
  plugin: MarketplacePlugin,
  verbose: boolean = false,
): string {
  const lines: string[] = [];

  const statusBadge = plugin.installed
    ? plugin.updateAvailable
      ? '📦⬆️' // Installed, update available
      : '📦✓' // Installed, up to date
    : '📦'; // Not installed

  const trustBadge = plugin.verified
    ? '✓'
    : plugin.trustLevel === 'community'
      ? '○'
      : '?';

  lines.push(
    `${statusBadge} ${plugin.name} (${plugin.id}) v${plugin.version} [${trustBadge}]`,
  );

  if (verbose) {
    lines.push(`   ${plugin.description}`);

    if (plugin.author) {
      lines.push(
        `   Author: ${plugin.author.name}${plugin.author.email ? ` <${plugin.author.email}>` : ''}`,
      );
    }

    if (plugin.keywords.length > 0) {
      lines.push(`   Keywords: ${plugin.keywords.slice(0, 5).join(', ')}`);
    }

    if (plugin.downloads !== undefined) {
      lines.push(`   Downloads: ${plugin.downloads.toLocaleString()}`);
    }

    if (plugin.installed) {
      lines.push(`   Installed: ${plugin.installedVersion}`);
      if (plugin.updateAvailable) {
        lines.push(`   ⬆️ Update available!`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Plugin marketplace commands
 */
export const pluginMarketplaceCommands = {
  /**
   * Search for plugins
   */
  async search(
    context: CommandContext,
    query: string,
    options: Partial<MarketplaceSearchOptions> = {},
  ): Promise<void> {
    const marketplace = createPluginMarketplace(process.cwd());

    console.log(`Searching for plugins: "${query}"...\n`);

    try {
      const plugins = await marketplace.search({
        query,
        limit: options.limit || 20,
        sortBy: options.sortBy || 'downloads',
        sortOrder: options.sortOrder || 'desc',
        ...options,
      });

      if (plugins.length === 0) {
        console.log('No plugins found.');
        return;
      }

      console.log(`Found ${plugins.length} plugins:\n`);

      for (const plugin of plugins) {
        console.log(formatPlugin(plugin, false));
      }

      console.log('\nLegend:');
      console.log('  📦 = Available  📦✓ = Installed  📦⬆️ = Update available');
      console.log('  ✓ = Verified  ○ = Community  ? = Unverified');
      console.log('\nUse "plugin info <id>" for more details.');
    } catch (error) {
      console.error('Search failed:', error);
    }
  },

  /**
   * Get plugin info
   */
  async info(context: CommandContext, pluginId: string): Promise<void> {
    const marketplace = createPluginMarketplace(process.cwd());

    try {
      const plugin = await marketplace.getPlugin(pluginId);

      if (!plugin) {
        console.error(`Plugin "${pluginId}" not found.`);
        return;
      }

      console.log(formatPlugin(plugin, true));

      if (plugin.repository) {
        console.log(`\n   Repository: ${plugin.repository}`);
      }

      if (plugin.homepage) {
        console.log(`   Homepage: ${plugin.homepage}`);
      }

      console.log('\nCommands:');
      console.log(`  plugin install ${plugin.id}    # Install the plugin`);
      console.log(`  plugin update ${plugin.id}     # Update the plugin`);

      if (plugin.installed) {
        console.log(`  plugin uninstall ${plugin.id}  # Uninstall the plugin`);
      }
    } catch (error) {
      console.error('Failed to get plugin info:', error);
    }
  },

  /**
   * Install a plugin
   */
  async install(
    context: CommandContext,
    pluginId: string,
    options: {
      version?: string;
      global?: boolean;
      force?: boolean;
      skipVerification?: boolean;
    } = {},
  ): Promise<void> {
    const marketplace = createPluginMarketplace(process.cwd());

    console.log(`Installing plugin: ${pluginId}...\n`);

    try {
      const result = await marketplace.install(pluginId, {
        version: options.version,
        global: options.global !== false,
        force: options.force,
        skipVerification: options.skipVerification,
      });

      if (result.success) {
        console.log(result.message);

        if (result.plugin) {
          console.log(`\nPlugin installed to: ${result.plugin.installedPath}`);
          console.log('\nTo use the plugin, restart Ollama Code or run:');
          console.log(`  /plugins enable ${result.plugin.id}`);
        }
      } else {
        console.error(result.message);
      }
    } catch (error) {
      console.error('Installation failed:', error);
    }
  },

  /**
   * Uninstall a plugin
   */
  async uninstall(
    context: CommandContext,
    pluginId: string,
    options: { global?: boolean } = {},
  ): Promise<void> {
    const marketplace = createPluginMarketplace(process.cwd());

    console.log(`Uninstalling plugin: ${pluginId}...\n`);

    try {
      const result = await marketplace.uninstall(pluginId, {
        global: options.global !== false,
      });

      if (result.success) {
        console.log(result.message);
      } else {
        console.error(result.message);
      }
    } catch (error) {
      console.error('Uninstallation failed:', error);
    }
  },

  /**
   * Update a plugin
   */
  async update(
    context: CommandContext,
    pluginId: string | undefined,
    options: {
      version?: string;
      all?: boolean;
      checkOnly?: boolean;
    } = {},
  ): Promise<void> {
    const marketplace = createPluginMarketplace(process.cwd());

    try {
      if (options.all || !pluginId) {
        console.log('Checking for plugin updates...\n');

        const results = await marketplace.updateAll({
          checkOnly: options.checkOnly,
        });

        if (results.length === 0) {
          console.log('No plugins installed.');
          return;
        }

        for (const result of results) {
          if (result.success && 'updated' in result && result.updated) {
            console.log(`${result.pluginId}: ${result.message}`);
          } else if (result.success) {
            console.log(`${result.pluginId}: ${result.message}`);
          } else {
            console.error(`${result.pluginId}: ${result.message}`);
          }
        }
      } else {
        console.log(`Updating plugin: ${pluginId}...\n`);

        const result = await marketplace.update(pluginId, {
          version: options.version,
          checkOnly: options.checkOnly,
        });

        if (result.success) {
          console.log(result.message);
        } else {
          console.error(result.message);
        }
      }
    } catch (error) {
      console.error('Update failed:', error);
    }
  },

  /**
   * List installed plugins
   */
  async list(_context: CommandContext): Promise<void> {
    const marketplace = createPluginMarketplace(process.cwd());

    try {
      const plugins = await marketplace.getInstalledPlugins();

      if (plugins.length === 0) {
        console.log('No plugins installed.');
        console.log(
          '\nUse "plugin search <query>" to find plugins to install.',
        );
        return;
      }

      console.log(`Installed plugins (${plugins.length}):\n`);

      for (const plugin of plugins) {
        console.log(formatPlugin(plugin, true));
        console.log('');
      }
    } catch (error) {
      console.error('Failed to list plugins:', error);
    }
  },
};

/**
 * Register plugin marketplace commands
 */
export function registerPluginMarketplaceCommands(
  registerCommand: (
    name: string,
    handler: (ctx: CommandContext, ...args: unknown[]) => Promise<void>,
  ) => void,
): void {
  // plugin search <query>
  registerCommand('plugin:search', async (ctx, ...args) => {
    const query = args[0] as string;
    const options = args[1] as Partial<MarketplaceSearchOptions> | undefined;
    return pluginMarketplaceCommands.search(ctx, query, options);
  });

  // plugin info <id>
  registerCommand('plugin:info', async (ctx, ...args) => {
    const pluginId = args[0] as string;
    return pluginMarketplaceCommands.info(ctx, pluginId);
  });

  // plugin install <id> [--version] [--global] [--force]
  registerCommand('plugin:install', async (ctx, ...args) => {
    const pluginId = args[0] as string;
    const options = args[1] as
      | {
          version?: string;
          global?: boolean;
          force?: boolean;
          skipVerification?: boolean;
        }
      | undefined;
    return pluginMarketplaceCommands.install(ctx, pluginId, options);
  });

  // plugin uninstall <id>
  registerCommand('plugin:uninstall', async (ctx, ...args) => {
    const pluginId = args[0] as string;
    const options = args[1] as { global?: boolean } | undefined;
    return pluginMarketplaceCommands.uninstall(ctx, pluginId, options);
  });

  // plugin update [id] [--all] [--check]
  registerCommand('plugin:update', async (ctx, ...args) => {
    const pluginId = args[0] as string | undefined;
    const options = args[1] as
      | { version?: string; all?: boolean; checkOnly?: boolean }
      | undefined;
    return pluginMarketplaceCommands.update(ctx, pluginId, options);
  });

  // plugin list
  registerCommand('plugin:list', pluginMarketplaceCommands.list);
}
