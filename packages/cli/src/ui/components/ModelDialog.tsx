/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  AuthType,
  ModelSlashCommandEvent,
  logModelSlashCommand,
  type AvailableModel as CoreAvailableModel,
  type ContentGeneratorConfig,
  type ContentGeneratorConfigSource,
  type ContentGeneratorConfigSources,
  type OllamaProgressEvent,
  getModelCapabilities,
  tokenLimit,
} from '@ollama-code/ollama-code-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { UIStateContext, type UIState } from '../contexts/UIStateContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { MAINLINE_CODER } from '../models/availableModels.js';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
import { t } from '../../i18n/index.js';

interface ModelDialogProps {
  onClose: () => void;
}

function formatSourceBadge(
  source: ContentGeneratorConfigSource | undefined,
): string | undefined {
  if (!source) return undefined;

  switch (source.kind) {
    case 'cli':
      return source.detail ? `CLI ${source.detail}` : 'CLI';
    case 'env':
      return source.envKey ? `ENV ${source.envKey}` : 'ENV';
    case 'settings':
      return source.settingsPath
        ? `Settings ${source.settingsPath}`
        : 'Settings';
    case 'modelProviders': {
      const suffix =
        source.authType && source.modelId
          ? `${source.authType}:${source.modelId}`
          : source.authType
            ? `${source.authType}`
            : source.modelId
              ? `${source.modelId}`
              : '';
      return suffix ? `ModelProviders ${suffix}` : 'ModelProviders';
    }
    case 'default':
      return source.detail ? `Default ${source.detail}` : 'Default';
    case 'computed':
      return source.detail ? `Computed ${source.detail}` : 'Computed';
    case 'programmatic':
      return source.detail ? `Programmatic ${source.detail}` : 'Programmatic';
    case 'unknown':
    default:
      return undefined;
  }
}

function readSourcesFromConfig(config: unknown): ContentGeneratorConfigSources {
  if (!config) {
    return {};
  }
  const maybe = config as {
    getContentGeneratorConfigSources?: () => ContentGeneratorConfigSources;
  };
  return maybe.getContentGeneratorConfigSources?.() ?? {};
}

function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey) return '(not set)';
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) return '(not set)';
  if (trimmed.length <= 6) return '***';
  const head = trimmed.slice(0, 3);
  const tail = trimmed.slice(-4);
  return `${head}…${tail}`;
}

function persistModelSelection(
  settings: ReturnType<typeof useSettings>,
  modelId: string,
): void {
  const scope = getPersistScopeForModelSelection(settings);
  settings.setValue(scope, 'model.name', modelId);
}

function persistAuthTypeSelection(
  settings: ReturnType<typeof useSettings>,
  authType: AuthType,
): void {
  const scope = getPersistScopeForModelSelection(settings);
  settings.setValue(scope, 'security.auth.selectedType', authType);
}

interface HandleModelSwitchSuccessParams {
  settings: ReturnType<typeof useSettings>;
  uiState: UIState | null;
  after: ContentGeneratorConfig | undefined;
  effectiveAuthType: AuthType | undefined;
  effectiveModelId: string;
  isRuntime: boolean;
}

function handleModelSwitchSuccess({
  settings,
  uiState,
  after,
  effectiveAuthType,
  effectiveModelId,
  isRuntime,
}: HandleModelSwitchSuccessParams): void {
  persistModelSelection(settings, effectiveModelId);
  if (effectiveAuthType) {
    persistAuthTypeSelection(settings, effectiveAuthType);
  }

  const baseUrl = after?.baseUrl ?? t('(default)');
  const maskedKey = maskApiKey(after?.apiKey);
  uiState?.historyManager.addItem(
    {
      type: 'info',
      text:
        `authType: ${effectiveAuthType ?? '(none)'}` +
        `\n` +
        `Using ${isRuntime ? 'runtime ' : ''}model: ${effectiveModelId}` +
        `\n` +
        `Base URL: ${baseUrl}` +
        `\n` +
        `API key: ${maskedKey}`,
    },
    Date.now(),
  );
}

function ConfigRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  badge?: string;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Box>
        <Box minWidth={12} flexShrink={0}>
          <Text color={theme.text.secondary}>{label}:</Text>
        </Box>
        <Box flexGrow={1} flexDirection="row" flexWrap="wrap">
          <Text>{value}</Text>
        </Box>
      </Box>
      {badge ? (
        <Box>
          <Box minWidth={12} flexShrink={0}>
            <Text> </Text>
          </Box>
          <Box flexGrow={1}>
            <Text color={theme.text.secondary}>{badge}</Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

/**
 * Format context window size for display
 */
function formatContextSize(size: number | undefined): string {
  if (!size) return t('Unknown');
  if (size >= 1_000_000) {
    return `${(size / 1_000_000).toFixed(1)}M`;
  }
  if (size >= 1_000) {
    return `${(size / 1_000).toFixed(0)}K`;
  }
  return size.toString();
}

/**
 * Get capabilities badges for a model
 */
function getCapabilityBadges(modelName: string): string {
  const capabilities = getModelCapabilities(modelName);
  const badges: string[] = [];
  if (capabilities.tools) {
    badges.push('🔧');
  }
  if (capabilities.thinking) {
    badges.push('🧠');
  }
  if (capabilities.vision) {
    badges.push('📷');
  }
  if (capabilities.structuredOutput) {
    badges.push('📋');
  }
  return badges.length > 0 ? badges.join(' ') : '';
}

/**
 * Get capabilities description for a model
 */
function getCapabilityDescription(modelName: string): string {
  const capabilities = getModelCapabilities(modelName);
  const parts: string[] = [];
  if (capabilities.tools) parts.push(t('Tools'));
  if (capabilities.thinking) parts.push(t('Thinking'));
  if (capabilities.vision) parts.push(t('Vision'));
  if (capabilities.structuredOutput) parts.push(t('Structured Output'));
  return parts.length > 0 ? parts.join(', ') : t('Basic');
}

/**
 * Format download progress for display
 */
function formatProgress(event: OllamaProgressEvent): string {
  const { status, percentage, completed, total } = event;
  
  if (status === 'success') {
    return t('✓ Model loaded successfully');
  }
  
  if (percentage !== undefined) {
    return `${status}: ${percentage.toFixed(1)}%`;
  }
  
  if (completed !== undefined && total !== undefined && total > 0) {
    const pct = (completed / total) * 100;
    const completedMB = (completed / 1024 / 1024).toFixed(1);
    const totalMB = (total / 1024 / 1024).toFixed(1);
    return `${status}: ${pct.toFixed(1)}% (${completedMB}/${totalMB} MB)`;
  }
  
  return status;
}

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const uiState = useContext(UIStateContext);
  const settings = useSettings();

  // Local error state for displaying errors within the dialog
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // State for model loading progress
  const [isLoading, setIsLoading] = useState(false);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<OllamaProgressEvent | null>(null);

  // State for tracking if local models are being loaded
  const [isLoadingLocalModels, setIsLoadingLocalModels] = useState(false);
  const [localModelsLoaded, setLocalModelsLoaded] = useState(false);

  // Load local models from Ollama API on mount
  useEffect(() => {
    if (!config || localModelsLoaded || isLoadingLocalModels) {
      return;
    }

    const loadLocalModels = async () => {
      // Check if already loaded
      if (config.hasLocalOllamaModelsLoaded()) {
        setLocalModelsLoaded(true);
        return;
      }

      setIsLoadingLocalModels(true);
      try {
        await config.loadLocalOllamaModels();
        setLocalModelsLoaded(true);
      } catch (error) {
        // Silently ignore - local models are optional
        console.debug('Failed to load local models:', error);
      } finally {
        setIsLoadingLocalModels(false);
      }
    };

    loadLocalModels();
  }, [config, localModelsLoaded, isLoadingLocalModels]);

  const authType = config?.getAuthType();
  const effectiveConfig =
    (config?.getContentGeneratorConfig?.() as
      | ContentGeneratorConfig
      | undefined) ?? undefined;
  const sources = readSourcesFromConfig(config);

  // Get settings for auto-pull and auto-unload
  const autoPullOnSwitch = settings.merged.model?.autoPullOnSwitch ?? true;
  const autoUnloadPrevious = settings.merged.model?.autoUnloadPrevious ?? false;

  const availableModelEntries = useMemo(() => {
    const allModels = config ? config.getAllConfiguredModels() : [];

    // Separate runtime models from registry models
    const runtimeModels = allModels.filter((m) => m.isRuntimeModel);
    const registryModels = allModels.filter((m) => !m.isRuntimeModel);

    // Group registry models by authType
    const modelsByAuthTypeMap = new Map<AuthType, CoreAvailableModel[]>();
    for (const model of registryModels) {
      const authType = model.authType;
      if (!modelsByAuthTypeMap.has(authType)) {
        modelsByAuthTypeMap.set(authType, []);
      }
      modelsByAuthTypeMap.get(authType)!.push(model);
    }

    // Fixed order: Ollama only
    const authTypeOrder: AuthType[] = [AuthType.USE_OLLAMA];

    // Filter to only include authTypes that have registry models and maintain order
    const availableAuthTypes = new Set(modelsByAuthTypeMap.keys());
    const orderedAuthTypes = authTypeOrder.filter((t) =>
      availableAuthTypes.has(t),
    );

    // Build ordered list: runtime models first, then registry models grouped by authType
    const result: Array<{
      authType: AuthType;
      model: CoreAvailableModel;
      isRuntime?: boolean;
      snapshotId?: string;
    }> = [];

    // Add all runtime models first
    for (const runtimeModel of runtimeModels) {
      result.push({
        authType: runtimeModel.authType,
        model: runtimeModel,
        isRuntime: true,
        snapshotId: runtimeModel.runtimeSnapshotId,
      });
    }

    // Add registry models grouped by authType
    for (const t of orderedAuthTypes) {
      for (const model of modelsByAuthTypeMap.get(t) ?? []) {
        result.push({ authType: t, model, isRuntime: false });
      }
    }

    return result;
  }, [config, localModelsLoaded]);

  const MODEL_OPTIONS = useMemo(
    () =>
      availableModelEntries.map(
        ({ authType: t2, model, isRuntime, snapshotId }) => {
          // Runtime models use snapshotId directly (format: $runtime|${authType}|${modelId})
          const value =
            isRuntime && snapshotId ? snapshotId : `${t2}::${model.id}`;

          const title = (
            <Text>
              <Text
                bold
                color={isRuntime ? theme.status.warning : theme.text.accent}
              >
                [{t2}]
              </Text>
              <Text>{` ${model.label}`}</Text>
              {isRuntime && (
                <Text color={theme.status.warning}> (Runtime)</Text>
              )}
            </Text>
          );

          // Include runtime indicator in description
          let description = model.description || '';
          if (isRuntime) {
            description = description
              ? `${description} (Runtime)`
              : 'Runtime model';
          }

          return {
            value,
            title,
            description,
            key: value,
          };
        },
      ),
    [availableModelEntries],
  );

  const preferredModelId = config?.getModel() || MAINLINE_CODER;
  // Check if current model is a runtime model
  // Runtime snapshot ID is already in $runtime|${authType}|${modelId} format
  const activeRuntimeSnapshot = config?.getActiveRuntimeModelSnapshot?.();
  const preferredKey = activeRuntimeSnapshot
    ? activeRuntimeSnapshot.id
    : authType
      ? `${authType}::${preferredModelId}`
      : '';

  useKeypress(
    (key) => {
      if (key.name === 'escape' && !isLoading) {
        onClose();
      }
    },
    { isActive: true },
  );

  const initialIndex = useMemo(() => {
    const index = MODEL_OPTIONS.findIndex(
      (option) => option.value === preferredKey,
    );
    return index === -1 ? 0 : index;
  }, [MODEL_OPTIONS, preferredKey]);

  const handleSelect = useCallback(
    async (selected: string) => {
      if (!config) {
        onClose();
        return;
      }

      setErrorMessage(null);
      setIsLoading(false);
      setLoadingProgress(null);

      let after: ContentGeneratorConfig | undefined;
      let effectiveAuthType: AuthType | undefined;
      let effectiveModelId = selected;
      let isRuntime = false;

      try {
        // Determine if this is a runtime model selection
        // Runtime model format: $runtime|${authType}|${modelId}
        isRuntime = selected.startsWith('$runtime|');

        let selectedAuthType: AuthType;
        let modelId: string;

        if (isRuntime) {
          // For runtime models, extract authType from the snapshot ID
          // Format: $runtime|${authType}|${modelId}
          const parts = selected.split('|');
          if (parts.length >= 2 && parts[0] === '$runtime') {
            selectedAuthType = parts[1] as AuthType;
          } else {
            selectedAuthType = authType as AuthType;
          }
          modelId = selected; // Pass the full snapshot ID to switchModel
        } else {
          const sep = '::';
          const idx = selected.indexOf(sep);
          selectedAuthType = (
            idx >= 0 ? selected.slice(0, idx) : authType
          ) as AuthType;
          modelId = idx >= 0 ? selected.slice(idx + sep.length) : selected;
        }

        // Only handle Ollama models for pull/unload operations
        if (selectedAuthType === AuthType.USE_OLLAMA && !isRuntime) {
          const ollamaClient = config.getOllamaNativeClient();
          
          // Check if model is available locally
          const isAvailable = await ollamaClient.isModelAvailable(modelId);
          
          if (!isAvailable && autoPullOnSwitch) {
            // Model not available locally - pull it
            setIsLoading(true);
            setLoadingModelId(modelId);
            
            // Unload previous model if enabled
            if (autoUnloadPrevious && authType === AuthType.USE_OLLAMA) {
              const previousModelId = config.getModel();
              if (previousModelId && previousModelId !== modelId) {
                try {
                  await ollamaClient.unloadModel(previousModelId);
                  uiState?.historyManager.addItem(
                    {
                      type: 'info',
                      text: t('Unloaded previous model: {{model}}', { model: previousModelId }),
                    },
                    Date.now(),
                  );
                } catch (unloadError) {
                  // Log but don't fail - unloading is optional
                  console.warn('Failed to unload previous model:', unloadError);
                }
              }
            }
            
            // Pull the model with progress callback
            await ollamaClient.pullModel(modelId, (progress) => {
              setLoadingProgress(progress);
            });
            
            setIsLoading(false);
            setLoadingModelId(null);
            setLoadingProgress(null);
            
            uiState?.historyManager.addItem(
              {
                type: 'info',
                text: t('Model {{model}} downloaded successfully', { model: modelId }),
              },
              Date.now(),
            );
          } else if (autoUnloadPrevious && authType === AuthType.USE_OLLAMA) {
            // Model is available but we should unload previous if enabled
            const previousModelId = config.getModel();
            if (previousModelId && previousModelId !== modelId) {
              try {
                await ollamaClient.unloadModel(previousModelId);
                uiState?.historyManager.addItem(
                  {
                    type: 'info',
                    text: t('Unloaded previous model: {{model}}', { model: previousModelId }),
                  },
                  Date.now(),
                );
              } catch (unloadError) {
                // Log but don't fail
                console.warn('Failed to unload previous model:', unloadError);
              }
            }
          }
        }

        await config.switchModel(selectedAuthType, modelId);

        if (!isRuntime) {
          const event = new ModelSlashCommandEvent(modelId);
          logModelSlashCommand(config, event);
        }

        after = config.getContentGeneratorConfig?.() as
          | ContentGeneratorConfig
          | undefined;
        effectiveAuthType = after?.authType ?? selectedAuthType ?? authType;
        effectiveModelId = after?.model ?? modelId;
      } catch (e) {
        setIsLoading(false);
        setLoadingModelId(null);
        setLoadingProgress(null);
        const baseErrorMessage = e instanceof Error ? e.message : String(e);
        const errorPrefix = isRuntime
          ? 'Failed to switch to runtime model.'
          : `Failed to switch model to '${effectiveModelId ?? selected}'.`;
        setErrorMessage(`${errorPrefix}\n\n${baseErrorMessage}`);
        return;
      }

      handleModelSwitchSuccess({
        settings,
        uiState,
        after,
        effectiveAuthType,
        effectiveModelId,
        isRuntime,
      });
      onClose();
    },
    [authType, config, onClose, settings, uiState, setErrorMessage, autoPullOnSwitch, autoUnloadPrevious],
  );

  const hasModels = MODEL_OPTIONS.length > 0;

  // Get current model info
  const currentModelId = effectiveConfig?.model ?? config?.getModel?.() ?? '';
  const contextSize = effectiveConfig?.contextWindowSize ?? tokenLimit(currentModelId, 'input');
  const capabilityBadges = getCapabilityBadges(currentModelId);
  const capabilityDesc = getCapabilityDescription(currentModelId);

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{t('Select Model')}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          {t('Current (effective) configuration')}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          <ConfigRow label="AuthType" value={authType} />
          <ConfigRow
            label="Model"
            value={
              <Text>
                <Text>{currentModelId}</Text>
                {capabilityBadges && (
                  <Text color={theme.text.accent}> {capabilityBadges}</Text>
                )}
              </Text>
            }
            badge={formatSourceBadge(sources['model'])}
          />
          <ConfigRow
            label={t('Context')}
            value={
              <Text>
                <Text color={theme.text.accent} bold>
                  {formatContextSize(contextSize)}
                </Text>
                <Text color={theme.text.secondary}> {t('tokens')}</Text>
              </Text>
            }
          />
          <ConfigRow
            label={t('Features')}
            value={
              <Text color={theme.text.secondary}>{capabilityDesc}</Text>
            }
          />

          {authType === AuthType.USE_OLLAMA && (
            <>
              <ConfigRow
                label="Base URL"
                value={
                  effectiveConfig?.baseUrl ??
                  t('(default: http://localhost:11434)')
                }
                badge={formatSourceBadge(sources['baseUrl'])}
              />
              <ConfigRow
                label="API Key"
                value={effectiveConfig?.apiKey ? t('(set)') : t('(optional)')}
                badge={formatSourceBadge(sources['apiKey'])}
              />
            </>
          )}
        </Box>
      </Box>

      {/* Loading progress display */}
      {isLoading && loadingModelId && (
        <Box marginTop={1} flexDirection="column" paddingX={1}>
          <Text color={theme.status.warning} bold>
            {t('Loading model: {{model}}', { model: loadingModelId })}
          </Text>
          {loadingProgress && (
            <Box marginTop={1}>
              <Text color={theme.text.accent}>
                {formatProgress(loadingProgress)}
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('Please wait...')}
            </Text>
          </Box>
        </Box>
      )}

      {/* Local models loading indicator */}
      {isLoadingLocalModels && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            {t('Loading local models from Ollama...')}
          </Text>
        </Box>
      )}

      {!hasModels ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.status.warning}>
            {t(
              'No models available for the current authentication type ({{authType}}).',
              {
                authType: authType ? String(authType) : t('(none)'),
              },
            )}
          </Text>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t(
                'Please configure models in settings.modelProviders or use environment variables.',
              )}
            </Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <DescriptiveRadioButtonSelect
            items={MODEL_OPTIONS}
            onSelect={handleSelect}
            initialIndex={initialIndex}
            showNumbers={true}
            isFocused={!isLoading}
          />
        </Box>
      )}

      {errorMessage && (
        <Box marginTop={1} flexDirection="column" paddingX={1}>
          <Text color={theme.status.error} wrap="wrap">
            ✕ {errorMessage}
          </Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>
          {isLoading ? t('(Loading in progress...)') : t('(Press Esc to close)')}
        </Text>
      </Box>
    </Box>
  );
}
