/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin System Types
 * 
 * This module defines the interfaces for the plugin system,
 * allowing dynamic loading and management of tools and extensions.
 */

import type { FunctionDeclaration } from '../types/content.js';

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Plugin homepage URL */
  homepage?: string;
  /** Plugin repository URL */
  repository?: string;
  /** Plugin license */
  license?: string;
  /** Minimum Ollama Code version required */
  minVersion?: string;
  /** Maximum Ollama Code version supported */
  maxVersion?: string;
  /** Plugin dependencies */
  dependencies?: PluginDependency[];
  /** Plugin configuration schema */
  configSchema?: PluginConfigSchema;
  /** Plugin tags for categorization */
  tags?: string[];
  /** Whether the plugin is enabled by default */
  enabledByDefault?: boolean;
}

/**
 * Plugin dependency
 */
export interface PluginDependency {
  /** Dependency plugin ID */
  pluginId: string;
  /** Minimum version required */
  minVersion?: string;
  /** Maximum version supported */
  maxVersion?: string;
  /** Whether the dependency is optional */
  optional?: boolean;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfigSchema {
  /** JSON Schema for configuration */
  type: 'object';
  properties: Record<string, PluginConfigProperty>;
  required?: string[];
}

/**
 * Plugin configuration property
 */
export interface PluginConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: PluginConfigProperty;
  properties?: Record<string, PluginConfigProperty>;
}

/**
 * Plugin context provided to plugin hooks
 */
export interface PluginContext {
  /** Plugin configuration */
  config: Record<string, unknown>;
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Logger instance */
  logger: PluginLogger;
  /** Event emitter for plugin events */
  events: PluginEventEmitter;
  /** Access to Ollama Code services */
  services: PluginServices;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Plugin event emitter
 */
export interface PluginEventEmitter {
  emit: (event: string, data: unknown) => void;
  on: (event: string, callback: (data: unknown) => void) => () => void;
  once: (event: string, callback: (data: unknown) => void) => void;
}

/**
 * Plugin services - access to Ollama Code internals
 */
export interface PluginServices {
  /** Register a tool */
  registerTool: (tool: PluginTool) => void;
  /** Unregister a tool */
  unregisterTool: (toolId: string) => void;
  /** Get registered tools */
  getTools: () => PluginTool[];
  /** Show a notification to the user */
  showNotification: (notification: PluginNotification) => void;
  /** Execute a command */
  executeCommand: (commandId: string, ...args: unknown[]) => Promise<unknown>;
  /** Get configuration */
  getConfig: () => Record<string, unknown>;
  /** Set configuration */
  setConfig: (config: Record<string, unknown>) => void;
}

/**
 * Plugin tool definition
 */
export interface PluginTool {
  /** Unique tool identifier */
  id: string;
  /** Tool name (used in function calls) */
  name: string;
  /** Tool description */
  description: string;
  /** Tool parameters schema */
  parameters: FunctionDeclaration['parameters'];
  /** Tool execution handler */
  execute: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
  /** Whether the tool requires confirmation */
  requiresConfirmation?: boolean;
  /** Confirmation message builder */
  buildConfirmationMessage?: (params: Record<string, unknown>) => string;
  /** Tool timeout in milliseconds */
  timeout?: number;
  /** Whether the tool is destructive */
  isDestructive?: boolean;
  /** Tool category */
  category?: string;
  /** Tool tags */
  tags?: string[];
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Working directory */
  workingDirectory?: string;
  /** User preferences */
  preferences?: Record<string, unknown>;
  /** Plugin context */
  plugin: PluginContext;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Whether the execution was successful */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Display information */
  display?: {
    title?: string;
    summary?: string;
    details?: string;
    file?: string;
    line?: number;
  };
}

/**
 * Plugin notification
 */
export interface PluginNotification {
  /** Notification type */
  type: 'info' | 'warning' | 'error' | 'success';
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Notification duration in milliseconds (0 for persistent) */
  duration?: number;
  /** Actions available for the user */
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  /** Called when the plugin is loaded */
  onLoad?: (context: PluginContext) => Promise<void>;
  /** Called when the plugin is enabled */
  onEnable?: (context: PluginContext) => Promise<void>;
  /** Called when the plugin is disabled */
  onDisable?: (context: PluginContext) => Promise<void>;
  /** Called when the plugin is unloaded */
  onUnload?: (context: PluginContext) => Promise<void>;
  /** Called when configuration changes */
  onConfigChange?: (config: Record<string, unknown>, context: PluginContext) => Promise<void>;
  /** Called before a tool is executed */
  onBeforeToolExecute?: (toolId: string, params: Record<string, unknown>, context: PluginContext) => Promise<boolean>;
  /** Called after a tool is executed */
  onAfterToolExecute?: (toolId: string, params: Record<string, unknown>, result: ToolExecutionResult, context: PluginContext) => Promise<void>;
}

/**
 * Plugin definition
 */
export interface PluginDefinition {
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Plugin hooks */
  hooks?: PluginHooks;
  /** Tools provided by this plugin (declarative) */
  tools?: PluginTool[];
  /** Real tool classes (BaseDeclarativeTool instances) 
   * These are used when full tool implementation is needed
   * Created with GLM-5 from Z.AI
   */
  toolClasses?: unknown[];
  /** Tool factories - functions that create tool instances with Config 
   * Use this when tools require Config parameter in constructor
   */
  toolFactories?: Array<(config: unknown) => unknown>;
  /** Commands provided by this plugin */
  commands?: PluginCommand[];
  /** Default configuration */
  defaultConfig?: Record<string, unknown>;
}

/**
 * Plugin command definition
 */
export interface PluginCommand {
  /** Unique command identifier */
  id: string;
  /** Command name (e.g., '/mycommand') */
  name: string;
  /** Command description */
  description: string;
  /** Command handler */
  execute: (args: string[], context: PluginContext) => Promise<unknown>;
  /** Command aliases */
  aliases?: string[];
  /** Whether the command is available in shell mode */
  shellMode?: boolean;
}

/**
 * Plugin status
 */
export type PluginStatus = 
  | 'unloaded'   // Plugin is not loaded
  | 'loaded'     // Plugin is loaded but not enabled
  | 'enabled'    // Plugin is enabled and running
  | 'error'      // Plugin has an error
  | 'disabled';  // Plugin is explicitly disabled

/**
 * Plugin instance (runtime state)
 */
export interface PluginInstance {
  /** Plugin definition */
  definition: PluginDefinition;
  /** Plugin context */
  context: PluginContext;
  /** Plugin status */
  status: PluginStatus;
  /** Plugin error if any */
  error?: Error;
  /** Plugin configuration */
  config: Record<string, unknown>;
  /** Load timestamp */
  loadedAt?: Date;
  /** Enable timestamp */
  enabledAt?: Date;
}

/**
 * Plugin manifest (for discovery)
 */
export interface PluginManifest {
  /** Entry point file */
  entry: string;
  /** Plugin metadata */
  metadata: PluginMetadata;
  /** Whether the plugin is built-in */
  builtin?: boolean;
}
