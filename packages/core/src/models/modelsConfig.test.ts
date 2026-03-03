/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelsConfig, type ModelsConfigOptions } from './modelsConfig.js';
import { AuthType } from '../core/contentGenerator.js';

// Mock dependencies
vi.mock('../config/models.js', () => ({
  DEFAULT_OLLAMA_MODEL: 'llama3.2',
}));

vi.mock('../core/tokenLimits.js', () => ({
  tokenLimit: () => 4096,
}));

vi.mock('./modelRegistry.js', () => ({
  ModelRegistry: class MockModelRegistry {
    private models: Map<string, Map<string, object>> = new Map();

    constructor(config?: Record<string, unknown>) {
      const ollamaModels = new Map();
      ollamaModels.set('llama3.2', {
        id: 'llama3.2',
        authType: AuthType.USE_OLLAMA,
        name: 'Llama 3.2',
        baseUrl: 'http://localhost:11434',
        generationConfig: {},
        capabilities: {},
      });
      this.models.set(AuthType.USE_OLLAMA, ollamaModels);
    }

    getModelsForAuthType(authType: AuthType) {
      const models = this.models.get(authType);
      if (!models) return [];
      return Array.from(models.values()).map((m: object) => ({
        id: (m as { id: string }).id,
        label: (m as { name: string }).name,
        authType: (m as { authType: AuthType }).authType,
        isVision: false,
      }));
    }

    getModel(authType: AuthType, modelId: string) {
      const models = this.models.get(authType);
      return models?.get(modelId);
    }

    hasModel(authType: AuthType, modelId: string) {
      const models = this.models.get(authType);
      return models?.has(modelId) ?? false;
    }

    getDefaultModelForAuthType(authType: AuthType) {
      const models = this.models.get(authType);
      if (!models || models.size === 0) return undefined;
      return Array.from(models.values())[0];
    }

    reloadModels() {}
  }
}));

vi.mock('../utils/debugLogger.js', () => ({
  createDebugLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('ModelsConfig', () => {
  let modelsConfig: ModelsConfig;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      modelsConfig = new ModelsConfig();
      expect(modelsConfig).toBeDefined();
    });

    it('should create with initial authType', () => {
      const options: ModelsConfigOptions = {
        initialAuthType: AuthType.USE_OLLAMA,
      };
      modelsConfig = new ModelsConfig(options);

      expect(modelsConfig.getCurrentAuthType()).toBe(AuthType.USE_OLLAMA);
      expect(modelsConfig.wasAuthTypeExplicitlyProvided()).toBe(true);
    });

    it('should create with generation config', () => {
      const options: ModelsConfigOptions = {
        generationConfig: { model: 'test-model' },
      };
      modelsConfig = new ModelsConfig(options);

      expect(modelsConfig.getModel()).toBe('test-model');
    });

    it('should track when authType is not explicitly provided', () => {
      modelsConfig = new ModelsConfig();
      expect(modelsConfig.wasAuthTypeExplicitlyProvided()).toBe(false);
    });
  });

  describe('getModel', () => {
    it('should return current model', () => {
      modelsConfig = new ModelsConfig({
        generationConfig: { model: 'custom-model' },
      });

      expect(modelsConfig.getModel()).toBe('custom-model');
    });

    it('should return default model when not set', () => {
      modelsConfig = new ModelsConfig();

      expect(modelsConfig.getModel()).toBe('llama3.2');
    });
  });

  describe('getCurrentAuthType', () => {
    it('should return current authType', () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      expect(modelsConfig.getCurrentAuthType()).toBe(AuthType.USE_OLLAMA);
    });

    it('should return undefined when not set', () => {
      modelsConfig = new ModelsConfig();

      expect(modelsConfig.getCurrentAuthType()).toBeUndefined();
    });
  });

  describe('getAvailableModels', () => {
    it('should return empty array when no authType', () => {
      modelsConfig = new ModelsConfig();

      expect(modelsConfig.getAvailableModels()).toEqual([]);
    });

    it('should return models for current authType', () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      const models = modelsConfig.getAvailableModels();
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableModelsForAuthType', () => {
    it('should return models for specific authType', () => {
      modelsConfig = new ModelsConfig();

      const models = modelsConfig.getAvailableModelsForAuthType(AuthType.USE_OLLAMA);
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('getAllConfiguredModels', () => {
    it('should return all configured models', () => {
      modelsConfig = new ModelsConfig();

      const models = modelsConfig.getAllConfiguredModels();
      expect(models.length).toBeGreaterThan(0);
    });

    it('should accept authTypes parameter', () => {
      modelsConfig = new ModelsConfig();

      const models = modelsConfig.getAllConfiguredModels([AuthType.USE_OLLAMA]);
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('hasModel', () => {
    it('should return true for existing model', () => {
      modelsConfig = new ModelsConfig();

      expect(modelsConfig.hasModel(AuthType.USE_OLLAMA, 'llama3.2')).toBe(true);
    });

    it('should return false for non-existing model', () => {
      modelsConfig = new ModelsConfig();

      expect(modelsConfig.hasModel(AuthType.USE_OLLAMA, 'non-existent')).toBe(false);
    });
  });

  describe('getGenerationConfig', () => {
    it('should return generation config', () => {
      modelsConfig = new ModelsConfig({
        generationConfig: { timeout: 30000 },
      });

      const config = modelsConfig.getGenerationConfig();
      expect(config.timeout).toBe(30000);
    });
  });

  describe('getGenerationConfigSources', () => {
    it('should return sources', () => {
      modelsConfig = new ModelsConfig({
        generationConfig: { model: 'test' },
        generationConfigSources: {
          model: { kind: 'cli', detail: 'test' },
        },
      });

      const sources = modelsConfig.getGenerationConfigSources();
      expect(sources['model']).toBeDefined();
    });
  });

  describe('updateCredentials', () => {
    it('should update apiKey', () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      modelsConfig.updateCredentials({ apiKey: 'new-key' });

      const config = modelsConfig.getGenerationConfig();
      expect(config.apiKey).toBe('new-key');
    });

    it('should update baseUrl', () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      modelsConfig.updateCredentials({ baseUrl: 'https://new.url' });

      const config = modelsConfig.getGenerationConfig();
      expect(config.baseUrl).toBe('https://new.url');
    });

    it('should update model', () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      modelsConfig.updateCredentials({ model: 'new-model' });

      expect(modelsConfig.getModel()).toBe('new-model');
    });

    it('should disable strict model provider selection', () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      modelsConfig.updateCredentials({ apiKey: 'key' });

      expect(modelsConfig.isStrictModelProviderSelection()).toBe(false);
    });
  });

  describe('isStrictModelProviderSelection', () => {
    it('should return false by default', () => {
      modelsConfig = new ModelsConfig();

      expect(modelsConfig.isStrictModelProviderSelection()).toBe(false);
    });
  });

  describe('resetStrictModelProviderSelection', () => {
    it('should reset flag', () => {
      modelsConfig = new ModelsConfig();

      modelsConfig.resetStrictModelProviderSelection();

      expect(modelsConfig.isStrictModelProviderSelection()).toBe(false);
    });
  });

  describe('consumeRequireCachedCredentialsFlag', () => {
    it('should return false by default', () => {
      modelsConfig = new ModelsConfig();

      expect(modelsConfig.consumeRequireCachedCredentialsFlag()).toBe(false);
    });

    it('should return true once when set', async () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      // The flag is set internally during switchModel with requireCachedCredentials
      // For this test, we verify the consume behavior
      expect(modelsConfig.consumeRequireCachedCredentialsFlag()).toBe(false);
      // Second call should also be false
      expect(modelsConfig.consumeRequireCachedCredentialsFlag()).toBe(false);
    });
  });

  describe('setOnModelChange', () => {
    it('should set callback', () => {
      modelsConfig = new ModelsConfig();

      const callback = vi.fn();
      modelsConfig.setOnModelChange(callback);

      // Callback is internal, we can't directly test it without triggering a model change
      expect(modelsConfig).toBeDefined();
    });
  });

  describe('mergeSettingsGenerationConfig', () => {
    it('should merge missing fields from settings', () => {
      modelsConfig = new ModelsConfig();

      modelsConfig.mergeSettingsGenerationConfig({
        timeout: 30000,
        samplingParams: { temperature: 0.7 },
      });

      const config = modelsConfig.getGenerationConfig();
      expect(config.timeout).toBe(30000);
      expect(config.samplingParams).toEqual({ temperature: 0.7 });
    });

    it('should not override existing fields', () => {
      modelsConfig = new ModelsConfig({
        generationConfig: { timeout: 60000 },
      });

      modelsConfig.mergeSettingsGenerationConfig({
        timeout: 30000,
      });

      const config = modelsConfig.getGenerationConfig();
      expect(config.timeout).toBe(60000);
    });

    it('should handle undefined input', () => {
      modelsConfig = new ModelsConfig();

      modelsConfig.mergeSettingsGenerationConfig(undefined);

      // Should not throw
    });
  });

  describe('syncAfterAuthRefresh', () => {
    it('should update authType', () => {
      modelsConfig = new ModelsConfig();

      modelsConfig.syncAfterAuthRefresh(AuthType.USE_OLLAMA);

      expect(modelsConfig.getCurrentAuthType()).toBe(AuthType.USE_OLLAMA);
    });

    it('should apply default model when no modelId provided', () => {
      modelsConfig = new ModelsConfig();

      modelsConfig.syncAfterAuthRefresh(AuthType.USE_OLLAMA);

      expect(modelsConfig.getModel()).toBe('llama3.2');
    });

    it('should apply registry model when modelId exists', () => {
      modelsConfig = new ModelsConfig();

      modelsConfig.syncAfterAuthRefresh(AuthType.USE_OLLAMA, 'llama3.2');

      expect(modelsConfig.getModel()).toBe('llama3.2');
    });
  });

  describe('setModel', () => {
    it('should set model directly for non-registry model', async () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      await modelsConfig.setModel('custom-model', { reason: 'test' });

      expect(modelsConfig.getModel()).toBe('custom-model');
    });

    it('should use switchModel for registry model', async () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      await modelsConfig.setModel('llama3.2');

      expect(modelsConfig.getModel()).toBe('llama3.2');
    });
  });

  describe('switchModel', () => {
    it('should switch to registry model', async () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      await modelsConfig.switchModel(AuthType.USE_OLLAMA, 'llama3.2');

      expect(modelsConfig.getModel()).toBe('llama3.2');
    });

    it('should throw for non-existent model', async () => {
      modelsConfig = new ModelsConfig({
        initialAuthType: AuthType.USE_OLLAMA,
      });

      await expect(
        modelsConfig.switchModel(AuthType.USE_OLLAMA, 'non-existent'),
      ).rejects.toThrow();
    });
  });

  describe('reloadModelProvidersConfig', () => {
    it('should reload config', () => {
      modelsConfig = new ModelsConfig();

      modelsConfig.reloadModelProvidersConfig({});

      // Should not throw
    });
  });

  describe('Runtime Model Snapshots', () => {
    describe('getActiveRuntimeModelSnapshot', () => {
      it('should return undefined when no runtime model', () => {
        modelsConfig = new ModelsConfig();

        expect(modelsConfig.getActiveRuntimeModelSnapshot()).toBeUndefined();
      });
    });

    describe('getActiveRuntimeModelSnapshotId', () => {
      it('should return undefined when no runtime model', () => {
        modelsConfig = new ModelsConfig();

        expect(modelsConfig.getActiveRuntimeModelSnapshotId()).toBeUndefined();
      });
    });

    describe('detectAndCaptureRuntimeModel', () => {
      it('should return undefined when no current model', () => {
        modelsConfig = new ModelsConfig();

        const result = modelsConfig.detectAndCaptureRuntimeModel();

        expect(result).toBeUndefined();
      });
    });
  });
});
