/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '../core/contentGenerator.js';
import {
  DEFAULT_OLLAMA_NATIVE_URL,
  OllamaNativeClient,
} from '../core/ollamaNativeClient.js';
import {
  type ModelConfig,
  type ModelProvidersConfig,
  type ResolvedModelConfig,
  type AvailableModel,
} from './types.js';
import { DEFAULT_OLLAMA_MODEL, OLLAMA_MODELS } from './constants.js';
import { createDebugLogger } from '../utils/debugLogger.js';
import {
  getModelCapabilities,
  supportsVision,
} from '../model-definitions/index.js';

const debugLogger = createDebugLogger('MODEL_REGISTRY');

export { OLLAMA_MODELS } from './constants.js';

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Validates if a string key is a valid AuthType enum value.
 * @param key - The key to validate
 * @returns The validated AuthType or undefined if invalid
 */
function validateAuthTypeKey(key: string): AuthType | undefined {
  // Check if the key is a valid AuthType enum value
  if (Object.values(AuthType).includes(key as AuthType)) {
    return key as AuthType;
  }

  // Invalid key
  return undefined;
}

/**
 * Central registry for managing model configurations.
 * Models are organized by authType.
 */
export class ModelRegistry {
  private modelsByAuthType: Map<AuthType, Map<string, ResolvedModelConfig>>;
  private ollamaClient: OllamaNativeClient;
  private localModelsLoaded: boolean = false;

  private getDefaultBaseUrl(_authType: AuthType): string {
    return DEFAULT_OLLAMA_NATIVE_URL;
  }

  constructor(modelProvidersConfig?: ModelProvidersConfig) {
    this.modelsByAuthType = new Map();
    this.ollamaClient = new OllamaNativeClient({
      baseUrl: DEFAULT_OLLAMA_NATIVE_URL,
    });

    // Register user-configured models first (they take precedence)
    if (modelProvidersConfig) {
      for (const [rawKey, models] of Object.entries(modelProvidersConfig)) {
        const authType = validateAuthTypeKey(rawKey);

        if (!authType) {
          debugLogger.warn(
            `Invalid authType key "${rawKey}" in modelProviders config. Expected: ollama. Skipping.`,
          );
          continue;
        }

        this.registerAuthTypeModels(authType, models);
      }
    }

    // Then register default Ollama models (only if not already registered by user)
    this.registerDefaultOllamaModels();
  }

  /**
   * Register default Ollama models (only if not already configured by user)
   */
  private registerDefaultOllamaModels(): void {
    const existingModels = this.modelsByAuthType.get(AuthType.USE_OLLAMA);
    const modelMap = existingModels || new Map<string, ResolvedModelConfig>();

    for (const config of OLLAMA_MODELS) {
      // Only add if not already registered by user
      if (!modelMap.has(config.id)) {
        const resolved = this.resolveModelConfig(config, AuthType.USE_OLLAMA);
        modelMap.set(config.id, resolved);
      }
    }

    this.modelsByAuthType.set(AuthType.USE_OLLAMA, modelMap);
  }

  /**
   * Set Ollama base URL for API calls.
   * Should be called when baseUrl changes in config.
   */
  setOllamaBaseUrl(baseUrl: string): void {
    this.ollamaClient = new OllamaNativeClient({ baseUrl });
    // Reset flag to allow reloading models with new URL
    this.localModelsLoaded = false;
  }

  /**
   * Load local models from Ollama API /api/tags.
   * Models are added to the registry only if not already present.
   * This allows the UI to show models that are pulled locally in Ollama.
   *
   * @param baseUrl - Optional base URL override for Ollama API
   * @returns Promise<boolean> - true if models were loaded successfully
   */
  async loadLocalOllamaModels(baseUrl?: string): Promise<boolean> {
    try {
      // Use provided baseUrl or existing client
      const client = baseUrl
        ? new OllamaNativeClient({ baseUrl })
        : this.ollamaClient;

      debugLogger.info('Loading local models from Ollama API...');
      const response = await client.listModels();

      if (!response.models || response.models.length === 0) {
        debugLogger.info('No local models found in Ollama');
        this.localModelsLoaded = true;
        return true;
      }

      // Get or create model map for Ollama
      const existingModels =
        this.modelsByAuthType.get(AuthType.USE_OLLAMA) ||
        new Map<string, ResolvedModelConfig>();

      // Add local models that aren't already registered
      let addedCount = 0;
      for (const model of response.models) {
        // Use model.name as ID (Ollama returns names like "llama3.2:latest")
        // Strip the :latest tag for cleaner display, but keep full name as ID
        const modelId = model.name;
        const displayName = model.name.split(':')[0]; // Remove tag for display

        if (!existingModels.has(modelId)) {
          const config: ModelConfig = {
            id: modelId,
            name: displayName,
            description: `Local Ollama model (${formatBytes(model.size)})`,
          };
          const resolved = this.resolveModelConfig(
            config,
            AuthType.USE_OLLAMA,
          );
          existingModels.set(modelId, resolved);
          addedCount++;
        }
      }

      this.modelsByAuthType.set(AuthType.USE_OLLAMA, existingModels);
      this.localModelsLoaded = true;

      debugLogger.info(
        `Loaded ${response.models.length} local models, added ${addedCount} new ones`,
      );
      return true;
    } catch (error) {
      debugLogger.warn(
        'Failed to load local models from Ollama:',
        error instanceof Error ? error.message : String(error),
      );
      // Don't throw - local models are optional, fallback to defaults
      return false;
    }
  }

  /**
   * Check if local models have been loaded from Ollama API.
   */
  hasLocalModelsLoaded(): boolean {
    return this.localModelsLoaded;
  }

  /**
   * Register models for an authType.
   * If multiple models have the same id, the first one takes precedence.
   */
  private registerAuthTypeModels(
    authType: AuthType,
    models: ModelConfig[],
  ): void {
    const modelMap = new Map<string, ResolvedModelConfig>();

    for (const config of models) {
      // Skip if a model with the same id is already registered (first one wins)
      if (modelMap.has(config.id)) {
        debugLogger.warn(
          `Duplicate model id "${config.id}" for authType "${authType}". Using the first registered config.`,
        );
        continue;
      }
      const resolved = this.resolveModelConfig(config, authType);
      modelMap.set(config.id, resolved);
    }

    this.modelsByAuthType.set(authType, modelMap);
  }

  /**
   * Get all models for a specific authType.
   */
  getModelsForAuthType(authType: AuthType): AvailableModel[] {
    const models = this.modelsByAuthType.get(authType);
    if (!models) return [];

    return Array.from(models.values()).map((model) => {
      // Use dynamic capabilities detection from model-definitions
      const dynamicCapabilities = getModelCapabilities(model.id);
      return {
        id: model.id,
        label: model.name,
        description: model.description,
        capabilities: dynamicCapabilities,
        authType: model.authType,
        isVision: supportsVision(model.id),
        contextWindowSize: model.generationConfig.contextWindowSize,
      };
    });
  }

  /**
   * Get model configuration by authType and modelId
   */
  getModel(
    authType: AuthType,
    modelId: string,
  ): ResolvedModelConfig | undefined {
    const models = this.modelsByAuthType.get(authType);
    return models?.get(modelId);
  }

  /**
   * Check if model exists for given authType
   */
  hasModel(authType: AuthType, modelId: string): boolean {
    const models = this.modelsByAuthType.get(authType);
    return models?.has(modelId) ?? false;
  }

  /**
   * Get default model for an authType.
   */
  getDefaultModelForAuthType(
    authType: AuthType,
  ): ResolvedModelConfig | undefined {
    if (authType === AuthType.USE_OLLAMA) {
      return this.getModel(authType, DEFAULT_OLLAMA_MODEL);
    }
    const models = this.modelsByAuthType.get(authType);
    if (!models || models.size === 0) return undefined;
    return Array.from(models.values())[0];
  }

  /**
   * Resolve model config by applying defaults
   */
  private resolveModelConfig(
    config: ModelConfig,
    authType: AuthType,
  ): ResolvedModelConfig {
    this.validateModelConfig(config, authType);

    return {
      ...config,
      authType,
      name: config.name || config.id,
      baseUrl: config.baseUrl || this.getDefaultBaseUrl(authType),
      generationConfig: config.generationConfig ?? {},
      capabilities: config.capabilities || {},
    };
  }

  /**
   * Validate model configuration
   */
  private validateModelConfig(config: ModelConfig, authType: AuthType): void {
    if (!config.id) {
      throw new Error(
        `Model config in authType '${authType}' missing required field: id`,
      );
    }
  }

  /**
   * Reload models from updated configuration.
   */
  reloadModels(modelProvidersConfig?: ModelProvidersConfig): void {
    // Clear all existing models
    this.modelsByAuthType.clear();
    // Reset local models flag - will need to reload from Ollama
    this.localModelsLoaded = false;

    // Register user-configured models first (they take precedence)
    if (modelProvidersConfig) {
      for (const [rawKey, models] of Object.entries(modelProvidersConfig)) {
        const authType = validateAuthTypeKey(rawKey);

        if (!authType) {
          debugLogger.warn(
            `Invalid authType key "${rawKey}" in modelProviders config. Expected: ollama. Skipping.`,
          );
          continue;
        }

        this.registerAuthTypeModels(authType, models);
      }
    }

    // Then register default Ollama models (only if not already configured by user)
    this.registerDefaultOllamaModels();
  }
}
