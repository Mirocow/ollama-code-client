/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type {
  Config,
  EditorType,
  OllamaClient,
  ServerOllamaChatCompressedEvent,
  ServerOllamaContentEvent as ContentEvent,
  ServerOllamaFinishedEvent,
  ServerOllamaStreamEvent as GeminiEvent,
  ThoughtSummary,
  ToolCallRequestInfo,
  OllamaErrorEventValue,
  Part,
  PartListUnion,
} from '@ollama-code/ollama-code-core';
import {
  FinishReason,
  OllamaEventType as ServerOllamaEventType,
  createDebugLogger,
  getErrorMessage,
  isNodeError,
  MessageSenderType,
  GitService,
  UnauthorizedError,
  ApprovalMode,
  parseAndFormatApiError,
  promptIdContext,
  ToolConfirmationOutcome,
  uiTelemetryService,
  TextTokenizer,
  partToString,
} from '@ollama-code/ollama-code-core';
import type {
  HistoryItem,
  HistoryItemWithoutId,
  HistoryItemToolGroup,
  SlashCommandProcessorResult,
} from '../types.js';
import { StreamingState, MessageType, ToolCallStatus } from '../types.js';
import { isAtCommand, isSlashCommand } from '../utils/commandUtils.js';
import { useShellCommandProcessor } from './shellCommandProcessor.js';
import { useVisionAutoSwitch } from './useVisionAutoSwitch.js';
import { handleAtCommand } from './atCommandProcessor.js';
import { findLastSafeSplitPoint } from '../utils/markdownUtilities.js';
import { useStateAndRef } from './useStateAndRef.js';
import type { UseHistoryManagerReturn } from './useHistoryManager.js';
import { useLogger } from './useLogger.js';
import {
  useReactToolScheduler,
  mapToDisplay as mapTrackedToolCallsToDisplay,
  type TrackedToolCall,
  type TrackedCompletedToolCall,
  type TrackedCancelledToolCall,
  type TrackedWaitingToolCall,
} from './useReactToolScheduler.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { useSessionStats } from '../contexts/SessionContext.js';
import type { LoadedSettings } from '../../config/settings.js';
import { t } from '../../i18n/index.js';

const debugLogger = createDebugLogger('OLLAMA_STREAM');

// Throttle interval for UI updates during streaming (ms)
// This helps reduce terminal flickering when scrolling during streaming
const STREAM_UPDATE_THROTTLE_MS = 50;

enum StreamProcessingStatus {
  Completed,
  UserCancelled,
  Error,
}

const EDIT_TOOL_NAMES = new Set(['replace', 'write_file']);

function showCitations(settings: LoadedSettings): boolean {
  const enabled = settings?.merged?.ui?.showCitations;
  if (enabled !== undefined) {
    return enabled;
  }
  return true;
}

/**
 * Manages the Gemini stream, including user input, command processing,
 * API interaction, and tool call lifecycle.
 */
export const useOllamaStream = (
  ollamaClient: OllamaClient,
  history: HistoryItem[],
  addItem: UseHistoryManagerReturn['addItem'],
  config: Config,
  settings: LoadedSettings,
  onDebugMessage: (message: string) => void,
  handleSlashCommand: (
    cmd: PartListUnion,
  ) => Promise<SlashCommandProcessorResult | false>,
  shellModeActive: boolean,
  getPreferredEditor: () => EditorType | undefined,
  onAuthError: (error: string) => void,
  performMemoryRefresh: () => Promise<void>,
  modelSwitchedFromQuotaError: boolean,
  setModelSwitchedFromQuotaError: React.Dispatch<React.SetStateAction<boolean>>,
  onEditorClose: () => void,
  onCancelSubmit: () => void,
  visionModelPreviewEnabled: boolean,
  setShellInputFocused: (value: boolean) => void,
  terminalWidth: number,
  terminalHeight: number,
  onVisionSwitchRequired?: (query: PartListUnion) => Promise<{
    modelOverride?: string;
    persistSessionModel?: string;
    showGuidance?: boolean;
  }>,
) => {
  const [initError, setInitError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnCancelledRef = useRef(false);
  const isSubmittingQueryRef = useRef(false);
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const [thought, setThought] = useState<ThoughtSummary | null>(null);
  const [pendingHistoryItem, pendingHistoryItemRef, setPendingHistoryItem] =
    useStateAndRef<HistoryItemWithoutId | null>(null);
  // Throttle tracking for pending history updates
  const lastPendingUpdateRef = useRef<number>(0);
  const pendingTextBufferRef = useRef<string>('');
  const pendingUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingRetryErrorItem, setPendingRetryErrorItem] =
    useState<HistoryItemWithoutId | null>(null);
  const [
    pendingRetryCountdownItem,
    pendingRetryCountdownItemRef,
    setPendingRetryCountdownItem,
  ] = useStateAndRef<HistoryItemWithoutId | null>(null);
  const retryCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const processedMemoryToolsRef = useRef<Set<string>>(new Set());
  // Store prompt text for token estimation fallback
  const currentPromptTextRef = useRef<string>('');
  const textTokenizer = useMemo(() => new TextTokenizer(), []);
  const {
    startNewPrompt,
    getPromptCount,
    stats: sessionStates,
  } = useSessionStats();
  const storage = config.storage;
  const logger = useLogger(storage, sessionStates.sessionId);
  const gitService = useMemo(() => {
    if (!config.getProjectRoot()) {
      return;
    }
    return new GitService(config.getProjectRoot(), storage);
  }, [config, storage]);

  const [toolCalls, scheduleToolCalls, markToolsAsSubmitted] =
    useReactToolScheduler(
      async (completedToolCallsFromScheduler) => {
        // This onComplete is called when ALL scheduled tools for a given batch are done.
        if (completedToolCallsFromScheduler.length > 0) {
          // Add the final state of these tools to the history for display.
          addItem(
            mapTrackedToolCallsToDisplay(
              completedToolCallsFromScheduler as TrackedToolCall[],
            ),
            Date.now(),
          );

          // Handle tool response submission immediately when tools complete
          await handleCompletedTools(
            completedToolCallsFromScheduler as TrackedToolCall[],
          );
        }
      },
      config,
      getPreferredEditor,
      onEditorClose,
    );

  const pendingToolCallGroupDisplay = useMemo(
    () =>
      toolCalls.length ? mapTrackedToolCallsToDisplay(toolCalls) : undefined,
    [toolCalls],
  );

  const activeToolPtyId = useMemo(() => {
    const executingShellTool = toolCalls?.find(
      (tc) =>
        tc.status === 'executing' && tc.request.name === 'run_shell_command',
    );
    if (executingShellTool) {
      return (executingShellTool as { pid?: number }).pid;
    }
    return undefined;
  }, [toolCalls]);

  const loopDetectedRef = useRef(false);
  const [
    loopDetectionConfirmationRequest,
    setLoopDetectionConfirmationRequest,
  ] = useState<{
    onComplete: (result: { userSelection: 'disable' | 'keep' }) => void;
  } | null>(null);

  const stopRetryCountdownTimer = useCallback(() => {
    if (retryCountdownTimerRef.current) {
      clearInterval(retryCountdownTimerRef.current);
      retryCountdownTimerRef.current = null;
    }
  }, []);

  const clearRetryCountdown = useCallback(() => {
    stopRetryCountdownTimer();
    setPendingRetryErrorItem(null);
    setPendingRetryCountdownItem(null);
  }, [setPendingRetryCountdownItem, stopRetryCountdownTimer]);

  const startRetryCountdown = useCallback(
    (retryInfo: {
      message?: string;
      attempt: number;
      maxRetries: number;
      delayMs: number;
    }) => {
      stopRetryCountdownTimer();
      const startTime = Date.now();
      const { message, attempt, maxRetries, delayMs } = retryInfo;
      const retryReasonText =
        message ?? t('Rate limit exceeded. Please wait and try again.');

      // Error line stays static (red with ✕ prefix)
      setPendingRetryErrorItem({
        type: MessageType.ERROR,
        text: retryReasonText,
      });

      // Countdown line updates every second (dim/secondary color)
      const updateCountdown = () => {
        const elapsedMs = Date.now() - startTime;
        const remainingMs = Math.max(0, delayMs - elapsedMs);
        const remainingSec = Math.ceil(remainingMs / 1000);

        setPendingRetryCountdownItem({
          type: 'retry_countdown',
          text: t(
            'Retrying in {{seconds}} seconds… (attempt {{attempt}}/{{maxRetries}})',
            {
              seconds: String(remainingSec),
              attempt: String(attempt),
              maxRetries: String(maxRetries),
            },
          ),
        } as HistoryItemWithoutId);

        if (remainingMs <= 0) {
          stopRetryCountdownTimer();
        }
      };

      updateCountdown();
      retryCountdownTimerRef.current = setInterval(updateCountdown, 1000);
    },
    [setPendingRetryCountdownItem, stopRetryCountdownTimer],
  );

  useEffect(() => () => stopRetryCountdownTimer(), [stopRetryCountdownTimer]);

  // Throttled version of setPendingHistoryItem for streaming updates
  // This reduces terminal flickering by limiting UI update frequency
  const throttledSetPendingHistoryItem = useCallback(
    (item: HistoryItemWithoutId | null, force: boolean = false) => {
      // Always update ref immediately for internal state tracking
      pendingHistoryItemRef.current = item;
      pendingTextBufferRef.current = item?.text ?? '';

      const now = Date.now();
      const timeSinceLastUpdate = now - lastPendingUpdateRef.current;

      // Update state immediately if forced or enough time has passed
      if (force || timeSinceLastUpdate >= STREAM_UPDATE_THROTTLE_MS) {
        lastPendingUpdateRef.current = now;
        setPendingHistoryItem(item);
        
        // Clear any pending timer
        if (pendingUpdateTimerRef.current) {
          clearTimeout(pendingUpdateTimerRef.current);
          pendingUpdateTimerRef.current = null;
        }
      } else if (!pendingUpdateTimerRef.current) {
        // Schedule a deferred update if one isn't already pending
        pendingUpdateTimerRef.current = setTimeout(() => {
          pendingUpdateTimerRef.current = null;
          lastPendingUpdateRef.current = Date.now();
          setPendingHistoryItem(pendingHistoryItemRef.current);
        }, STREAM_UPDATE_THROTTLE_MS - timeSinceLastUpdate);
      }
    },
    [setPendingHistoryItem, pendingHistoryItemRef],
  );

  // Flush any pending throttled updates immediately
  const flushPendingHistoryItem = useCallback(() => {
    if (pendingUpdateTimerRef.current) {
      clearTimeout(pendingUpdateTimerRef.current);
      pendingUpdateTimerRef.current = null;
    }
    if (pendingHistoryItemRef.current !== pendingHistoryItem) {
      setPendingHistoryItem(pendingHistoryItemRef.current);
    }
  }, [setPendingHistoryItem, pendingHistoryItemRef, pendingHistoryItem]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pendingUpdateTimerRef.current) {
        clearTimeout(pendingUpdateTimerRef.current);
      }
    };
  }, []);

  const onExec = useCallback(async (done: Promise<void>) => {
    setIsResponding(true);
    await done;
    setIsResponding(false);
  }, []);
  const { handleShellCommand, activeShellPtyId } = useShellCommandProcessor(
    addItem,
    setPendingHistoryItem,
    onExec,
    onDebugMessage,
    config,
    ollamaClient,
    setShellInputFocused,
    terminalWidth,
    terminalHeight,
  );

  const { handleVisionSwitch, restoreOriginalModel } = useVisionAutoSwitch(
    config,
    addItem,
    visionModelPreviewEnabled,
    onVisionSwitchRequired,
  );
  const activePtyId = activeShellPtyId || activeToolPtyId;

  useEffect(() => {
    if (!activePtyId) {
      setShellInputFocused(false);
    }
  }, [activePtyId, setShellInputFocused]);

  const streamingState = useMemo(() => {
    if (toolCalls.some((tc) => tc.status === 'awaiting_approval')) {
      return StreamingState.WaitingForConfirmation;
    }
    if (
      isResponding ||
      toolCalls.some(
        (tc) =>
          tc.status === 'executing' ||
          tc.status === 'scheduled' ||
          tc.status === 'validating' ||
          ((tc.status === 'success' ||
            tc.status === 'error' ||
            tc.status === 'cancelled') &&
            !(tc as TrackedCompletedToolCall | TrackedCancelledToolCall)
              .responseSubmittedToGemini),
      )
    ) {
      return StreamingState.Responding;
    }
    return StreamingState.Idle;
  }, [isResponding, toolCalls]);

  useEffect(() => {
    if (
      config.getApprovalMode() === ApprovalMode.YOLO &&
      streamingState === StreamingState.Idle
    ) {
      // YOLO mode idle state handling
    }
  }, [streamingState, config, history]);

  const cancelOngoingRequest = useCallback(() => {
    if (streamingState !== StreamingState.Responding) {
      return;
    }
    if (turnCancelledRef.current) {
      return;
    }
    turnCancelledRef.current = true;
    isSubmittingQueryRef.current = false;
    abortControllerRef.current?.abort();

    if (pendingHistoryItemRef.current) {
      addItem(pendingHistoryItemRef.current, Date.now());
    }
    addItem(
      {
        type: MessageType.INFO,
        text: 'Request cancelled.',
      },
      Date.now(),
    );
    setPendingHistoryItem(null);
    clearRetryCountdown();
    onCancelSubmit();
    setIsResponding(false);
    setShellInputFocused(false);
  }, [
    streamingState,
    addItem,
    setPendingHistoryItem,
    onCancelSubmit,
    pendingHistoryItemRef,
    setShellInputFocused,
    clearRetryCountdown,
  ]);

  const prepareQueryForOllama = useCallback(
    async (
      query: PartListUnion,
      userMessageTimestamp: number,
      abortSignal: AbortSignal,
      prompt_id: string,
    ): Promise<{
      queryToSend: PartListUnion | null;
      shouldProceed: boolean;
    }> => {
      if (turnCancelledRef.current) {
        return { queryToSend: null, shouldProceed: false };
      }
      if (typeof query === 'string' && query.trim().length === 0) {
        return { queryToSend: null, shouldProceed: false };
      }

      let localQueryToSendToOllama: PartListUnion | null = null;

      if (typeof query === 'string') {
        const trimmedQuery = query.trim();
        // Log to debug file
        onDebugMessage(
          `Received user query (${trimmedQuery.length} chars): "${trimmedQuery.slice(0, 200)}${trimmedQuery.length > 200 ? '...' : ''}"`,
        );
        await logger?.logMessage(MessageSenderType.USER, trimmedQuery);

        // Handle UI-only commands first
        const slashCommandResult = isSlashCommand(trimmedQuery)
          ? await handleSlashCommand(trimmedQuery)
          : false;

        if (slashCommandResult) {
          switch (slashCommandResult.type) {
            case 'schedule_tool': {
              const { toolName, toolArgs } = slashCommandResult;
              const toolCallRequest: ToolCallRequestInfo = {
                callId: `${toolName}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                name: toolName,
                args: toolArgs,
                isClientInitiated: true,
                prompt_id,
              };
              scheduleToolCalls([toolCallRequest], abortSignal);
              return { queryToSend: null, shouldProceed: false };
            }
            case 'submit_prompt': {
              localQueryToSendToOllama = slashCommandResult.content;

              return {
                queryToSend: localQueryToSendToOllama,
                shouldProceed: true,
              };
            }
            case 'handled': {
              return { queryToSend: null, shouldProceed: false };
            }
            default: {
              const unreachable: never = slashCommandResult;
              throw new Error(
                `Unhandled slash command result type: ${unreachable}`,
              );
            }
          }
        }

        if (shellModeActive && handleShellCommand(trimmedQuery, abortSignal)) {
          return { queryToSend: null, shouldProceed: false };
        }

        localQueryToSendToOllama = trimmedQuery;

        addItem(
          { type: MessageType.USER, text: trimmedQuery },
          userMessageTimestamp,
        );

        // Handle @-commands (which might involve tool calls)
        if (isAtCommand(trimmedQuery)) {
          const atCommandResult = await handleAtCommand({
            query: trimmedQuery,
            config,
            onDebugMessage,
            messageId: userMessageTimestamp,
            signal: abortSignal,
            addItem,
          });

          if (!atCommandResult.shouldProceed) {
            return { queryToSend: null, shouldProceed: false };
          }
          localQueryToSendToOllama = atCommandResult.processedQuery;
        }
      } else {
        // It's a function response (PartListUnion that isn't a string)
        localQueryToSendToOllama = query;
      }

      if (localQueryToSendToOllama === null) {
        onDebugMessage(
          'Query processing resulted in null, not sending to Ollama.',
        );
        return { queryToSend: null, shouldProceed: false };
      }
      return { queryToSend: localQueryToSendToOllama, shouldProceed: true };
    },
    [
      config,
      addItem,
      onDebugMessage,
      handleShellCommand,
      handleSlashCommand,
      logger,
      shellModeActive,
      scheduleToolCalls,
    ],
  );

  // --- Stream Event Handlers ---

  const handleContentEvent = useCallback(
    (
      eventValue: ContentEvent['value'],
      currentOllamaMessageBuffer: string,
      userMessageTimestamp: number,
    ): string => {
      if (turnCancelledRef.current) {
        // Prevents additional output after a user initiated cancel.
        return '';
      }
      let newOllamaMessageBuffer = currentOllamaMessageBuffer + eventValue;
      if (
        pendingHistoryItemRef.current?.type !== 'ollama' &&
        pendingHistoryItemRef.current?.type !== 'ollama_content'
      ) {
        if (pendingHistoryItemRef.current) {
          addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        }
        throttledSetPendingHistoryItem({ type: 'ollama', text: '' }, true);
        newOllamaMessageBuffer = eventValue;
      }
      // Split large messages for better rendering performance. Ideally,
      // we should maximize the amount of output sent to <Static />.
      const splitPoint = findLastSafeSplitPoint(newOllamaMessageBuffer);
      if (splitPoint === newOllamaMessageBuffer.length) {
        // Update the existing message with accumulated content (throttled)
        const currentType = pendingHistoryItemRef.current?.type as 'ollama' | 'ollama_content' | undefined;
        throttledSetPendingHistoryItem({
          type: currentType ?? 'ollama',
          text: newOllamaMessageBuffer,
        });
      } else {
        // This indicates that we need to split up this Gemini Message.
        // Splitting a message is primarily a performance consideration. There is a
        // <Static> component at the root of App.tsx which takes care of rendering
        // content statically or dynamically. Everything but the last message is
        // treated as static in order to prevent re-rendering an entire message history
        // multiple times per-second (as streaming occurs). Prior to this change you'd
        // see heavy flickering of the terminal. This ensures that larger messages get
        // broken up so that there are more "statically" rendered.
        const beforeText = newOllamaMessageBuffer.substring(0, splitPoint);
        const afterText = newOllamaMessageBuffer.substring(splitPoint);
        addItem(
          {
            type: pendingHistoryItemRef.current?.type as
              | 'ollama'
              | 'ollama_content',
            text: beforeText,
          },
          userMessageTimestamp,
        );
        throttledSetPendingHistoryItem({ type: 'ollama_content', text: afterText }, true);
        newOllamaMessageBuffer = afterText;
      }
      return newOllamaMessageBuffer;
    },
    [addItem, pendingHistoryItemRef, throttledSetPendingHistoryItem],
  );

  const mergeThought = useCallback(
    (incoming: ThoughtSummary) => {
      setThought((prev) => {
        if (!prev) {
          return incoming;
        }
        const subject = incoming.subject || prev.subject;
        const description = `${prev.description ?? ''}${incoming.description ?? ''}`;
        return { subject, description };
      });
    },
    [setThought],
  );

  const handleThoughtEvent = useCallback(
    (
      eventValue: ThoughtSummary,
      currentThoughtBuffer: string,
      userMessageTimestamp: number,
    ): string => {
      if (turnCancelledRef.current) {
        return '';
      }

      // Extract the description text from the thought summary
      const thoughtText = eventValue.description ?? '';
      if (!thoughtText) {
        return currentThoughtBuffer;
      }

      let newThoughtBuffer = currentThoughtBuffer + thoughtText;

      const pendingType = pendingHistoryItemRef.current?.type;
      const isPendingThought =
        pendingType === 'ollama_thought' ||
        pendingType === 'ollama_thought_content';

      // If we're not already showing a thought, start a new one
      if (!isPendingThought) {
        // If there's a pending non-thought item, finalize it first
        if (pendingHistoryItemRef.current) {
          addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        }
        throttledSetPendingHistoryItem({ type: 'ollama_thought', text: '' }, true);
      }

      // Split large thought messages for better rendering performance (same rationale
      // as regular content streaming). This helps avoid terminal flicker caused by
      // constantly re-rendering an ever-growing "pending" block.
      const splitPoint = findLastSafeSplitPoint(newThoughtBuffer);
      const nextPendingType: 'ollama_thought' | 'ollama_thought_content' =
        isPendingThought && pendingType === 'ollama_thought_content'
          ? 'ollama_thought_content'
          : 'ollama_thought';

      if (splitPoint === newThoughtBuffer.length) {
        // Update the existing thought message with accumulated content (throttled)
        throttledSetPendingHistoryItem({
          type: nextPendingType,
          text: newThoughtBuffer,
        });
      } else {
        const beforeText = newThoughtBuffer.substring(0, splitPoint);
        const afterText = newThoughtBuffer.substring(splitPoint);
        addItem(
          {
            type: nextPendingType,
            text: beforeText,
          },
          userMessageTimestamp,
        );
        throttledSetPendingHistoryItem({
          type: 'ollama_thought_content',
          text: afterText,
        }, true);
        newThoughtBuffer = afterText;
      }

      // Also update the thought state for the loading indicator
      mergeThought(eventValue);

      return newThoughtBuffer;
    },
    [addItem, pendingHistoryItemRef, throttledSetPendingHistoryItem, mergeThought],
  );

  const handleUserCancelledEvent = useCallback(
    (userMessageTimestamp: number) => {
      if (turnCancelledRef.current) {
        return;
      }

      if (pendingHistoryItemRef.current) {
        if (pendingHistoryItemRef.current.type === 'tool_group') {
          const updatedTools = pendingHistoryItemRef.current.tools.map(
            (tool) =>
              tool.status === ToolCallStatus.Pending ||
              tool.status === ToolCallStatus.Confirming ||
              tool.status === ToolCallStatus.Executing
                ? { ...tool, status: ToolCallStatus.Canceled }
                : tool,
          );
          const pendingItem: HistoryItemToolGroup = {
            ...pendingHistoryItemRef.current,
            tools: updatedTools,
          };
          addItem(pendingItem, userMessageTimestamp);
        } else {
          addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        }
        setPendingHistoryItem(null);
      }
      addItem(
        { type: MessageType.INFO, text: 'User cancelled the request.' },
        userMessageTimestamp,
      );
      clearRetryCountdown();
      setIsResponding(false);
      setThought(null); // Reset thought when user cancels
    },
    [
      addItem,
      pendingHistoryItemRef,
      setPendingHistoryItem,
      setThought,
      clearRetryCountdown,
    ],
  );

  const handleErrorEvent = useCallback(
    (eventValue: OllamaErrorEventValue, userMessageTimestamp: number) => {
      if (pendingHistoryItemRef.current) {
        addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        setPendingHistoryItem(null);
      }
      addItem(
        {
          type: MessageType.ERROR,
          text: parseAndFormatApiError(
            eventValue.error,
            config.getContentGeneratorConfig()?.authType,
          ),
        },
        userMessageTimestamp,
      );
      clearRetryCountdown();
      setThought(null); // Reset thought when there's an error
    },
    [
      addItem,
      pendingHistoryItemRef,
      setPendingHistoryItem,
      config,
      setThought,
      clearRetryCountdown,
    ],
  );

  const handleCitationEvent = useCallback(
    (text: string, userMessageTimestamp: number) => {
      if (!showCitations(settings)) {
        return;
      }

      if (pendingHistoryItemRef.current) {
        addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        setPendingHistoryItem(null);
      }
      addItem({ type: MessageType.INFO, text }, userMessageTimestamp);
    },
    [addItem, pendingHistoryItemRef, setPendingHistoryItem, settings],
  );

  const handleFinishedEvent = useCallback(
    (event: ServerOllamaFinishedEvent, userMessageTimestamp: number) => {
      const finishReason = event.value.reason;
      if (!finishReason) {
        return;
      }

      // Record token usage for context progress bar
      const usageMetadata = event.value.usageMetadata;
      const model = config.getModel();

      // Debug log for token tracking
      debugLogger.info('Finished event received', {
        finishReason,
        hasUsageMetadata: !!usageMetadata,
        promptTokenCount: usageMetadata?.promptTokenCount,
        candidatesTokenCount: usageMetadata?.candidatesTokenCount,
      });

      // Use the new method with fallback support
      // When Ollama doesn't return prompt_eval_count, the telemetry service
      // will keep the last known value or use estimated tokens
      const promptTokens = usageMetadata?.promptTokenCount;
      const generatedTokens = usageMetadata?.candidatesTokenCount || 0;

      // If we have usageMetadata with prompt tokens, record them normally
      if (promptTokens && promptTokens > 0) {
        uiTelemetryService.recordTokenUsage(
          model,
          promptTokens,
          0, // cached tokens - not available in this context
          generatedTokens,
        );
      } else {
        // Fallback: Ollama didn't return prompt_eval_count
        // Use TextTokenizer to estimate tokens from the stored prompt text
        const promptText = currentPromptTextRef.current;
        const estimatedTokens = promptText
          ? textTokenizer.calculateTokensSync(promptText)
          : undefined;

        debugLogger.info(
          'No promptTokenCount in Finished event - using fallback token estimation',
          {
            generatedTokens,
            estimatedTokens,
            promptTextLength: promptText?.length,
          },
        );

        uiTelemetryService.recordTokenUsageWithFallback(
          model,
          promptTokens,
          generatedTokens,
          estimatedTokens,
        );
      }

      const finishReasonMessages: Record<FinishReason, string | undefined> = {
        [FinishReason.FINISH_REASON_UNSPECIFIED]: undefined,
        [FinishReason.STOP]: undefined,
        [FinishReason.MAX_TOKENS]: 'Response truncated due to token limits.',
        [FinishReason.SAFETY]: 'Response stopped due to safety reasons.',
        [FinishReason.RECITATION]: 'Response stopped due to recitation policy.',
        [FinishReason.TOOL_CALLS]: undefined, // Tool calls are normal, no message needed
        [FinishReason.ERROR]: 'Response stopped due to an error.',
        [FinishReason.LANGUAGE]:
          'Response stopped due to unsupported language.',
        [FinishReason.BLOCKLIST]: 'Response stopped due to forbidden terms.',
        [FinishReason.PROHIBITED_CONTENT]:
          'Response stopped due to prohibited content.',
        [FinishReason.SPII]:
          'Response stopped due to sensitive personally identifiable information.',
        [FinishReason.OTHER]: 'Response stopped for other reasons.',
        [FinishReason.MALFORMED_FUNCTION_CALL]:
          'Response stopped due to malformed function call.',
        [FinishReason.IMAGE_SAFETY]:
          'Response stopped due to image safety violations.',
        [FinishReason.UNEXPECTED_TOOL_CALL]:
          'Response stopped due to unexpected tool call.',
        [FinishReason.IMAGE_PROHIBITED_CONTENT]:
          'Response stopped due to image prohibited content.',
        [FinishReason.NO_IMAGE]: 'Response stopped due to no image.',
      };

      const message = finishReasonMessages[finishReason];
      if (message) {
        addItem(
          {
            type: 'info',
            text: `⚠️  ${message}`,
          },
          userMessageTimestamp,
        );
      }
      clearRetryCountdown();
    },
    [addItem, clearRetryCountdown, config, textTokenizer],
  );

  const handleChatCompressionEvent = useCallback(
    (
      eventValue: ServerOllamaChatCompressedEvent['value'],
      userMessageTimestamp: number,
    ) => {
      if (pendingHistoryItemRef.current) {
        addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        setPendingHistoryItem(null);
      }
      return addItem(
        {
          type: 'info',
          text:
            `IMPORTANT: This conversation approached the input token limit for ${config.getModel()}. ` +
            `A compressed context will be sent for future messages (compressed from: ` +
            `${eventValue?.originalTokenCount ?? 'unknown'} to ` +
            `${eventValue?.newTokenCount ?? 'unknown'} tokens).`,
        },
        Date.now(),
      );
    },
    [addItem, config, pendingHistoryItemRef, setPendingHistoryItem],
  );

  const handleMaxSessionTurnsEvent = useCallback(
    () =>
      addItem(
        {
          type: 'info',
          text:
            `The session has reached the maximum number of turns: ${config.getMaxSessionTurns()}. ` +
            `Please update this limit in your setting.json file.`,
        },
        Date.now(),
      ),
    [addItem, config],
  );

  const handleSessionTokenLimitExceededEvent = useCallback(
    (value: { currentTokens: number; limit: number; message: string }) =>
      addItem(
        {
          type: 'error',
          text:
            `🚫 Session token limit exceeded: ${value.currentTokens.toLocaleString()} tokens > ${value.limit.toLocaleString()} limit.\n\n` +
            `💡 Solutions:\n` +
            `   • Start a new session: Use /clear command\n` +
            `   • Increase limit: Add "sessionTokenLimit": (e.g., 128000) to your settings.json\n` +
            `   • Compress history: Use /compress command to compress history`,
        },
        Date.now(),
      ),
    [addItem],
  );

  const handleLoopDetectionConfirmation = useCallback(
    (result: { userSelection: 'disable' | 'keep' }) => {
      setLoopDetectionConfirmationRequest(null);

      if (result.userSelection === 'disable') {
        config.getOllamaClient().getLoopDetectionService().disableForSession();
        addItem(
          {
            type: 'info',
            text: `Loop detection has been disabled for this session. Please try your request again.`,
          },
          Date.now(),
        );
      } else {
        addItem(
          {
            type: 'info',
            text: `A potential loop was detected. This can happen due to repetitive tool calls or other model behavior. The request has been halted.`,
          },
          Date.now(),
        );
      }
    },
    [config, addItem],
  );

  const handleLoopDetectedEvent = useCallback(() => {
    // Show the confirmation dialog to choose whether to disable loop detection
    setLoopDetectionConfirmationRequest({
      onComplete: handleLoopDetectionConfirmation,
    });
  }, [handleLoopDetectionConfirmation]);

  const processOllamaStreamEvents = useCallback(
    async (
      stream: AsyncIterable<GeminiEvent>,
      userMessageTimestamp: number,
      signal: AbortSignal,
    ): Promise<StreamProcessingStatus> => {
      let ollamaMessageBuffer = '';
      let thoughtBuffer = '';
      const toolCallRequests: ToolCallRequestInfo[] = [];
      for await (const event of stream) {
        switch (event.type) {
          case ServerOllamaEventType.Thought:
            // If the thought has a subject, it's a discrete status update rather than
            // a streamed textual thought, so we update the thought state directly.
            if (event.value.subject) {
              setThought(event.value);
            } else {
              thoughtBuffer = handleThoughtEvent(
                event.value,
                thoughtBuffer,
                userMessageTimestamp,
              );
            }
            break;
          case ServerOllamaEventType.Content:
            ollamaMessageBuffer = handleContentEvent(
              event.value,
              ollamaMessageBuffer,
              userMessageTimestamp,
            );
            break;
          case ServerOllamaEventType.ToolCallRequest:
            toolCallRequests.push(event.value);
            break;
          case ServerOllamaEventType.UserCancelled:
            handleUserCancelledEvent(userMessageTimestamp);
            break;
          case ServerOllamaEventType.Error:
            handleErrorEvent(event.value, userMessageTimestamp);
            break;
          case ServerOllamaEventType.ChatCompressed:
            handleChatCompressionEvent(event.value, userMessageTimestamp);
            break;
          case ServerOllamaEventType.ToolCallConfirmation:
          case ServerOllamaEventType.ToolCallResponse:
            // do nothing
            break;
          case ServerOllamaEventType.MaxSessionTurns:
            handleMaxSessionTurnsEvent();
            break;
          case ServerOllamaEventType.SessionTokenLimitExceeded:
            handleSessionTokenLimitExceededEvent(event.value);
            break;
          case ServerOllamaEventType.Finished:
            handleFinishedEvent(
              event as ServerOllamaFinishedEvent,
              userMessageTimestamp,
            );
            break;
          case ServerOllamaEventType.Citation:
            handleCitationEvent(event.value, userMessageTimestamp);
            break;
          case ServerOllamaEventType.LoopDetected:
            // handle later because we want to move pending history to history
            // before we add loop detected message to history
            loopDetectedRef.current = true;
            break;
          case ServerOllamaEventType.Retry:
            // Clear any pending partial content from the failed attempt
            if (pendingHistoryItemRef.current) {
              setPendingHistoryItem(null);
            }
            // Show retry info if available (rate-limit / throttling errors)
            if (event.retryInfo) {
              startRetryCountdown(event.retryInfo);
            } else if (!pendingRetryCountdownItemRef.current) {
              clearRetryCountdown();
            }
            break;
          default: {
            // enforces exhaustive switch-case
            const unreachable: never = event;
            return unreachable;
          }
        }
      }
      if (toolCallRequests.length > 0) {
        scheduleToolCalls(toolCallRequests, signal);
      }
      return StreamProcessingStatus.Completed;
    },
    [
      handleContentEvent,
      handleThoughtEvent,
      handleUserCancelledEvent,
      handleErrorEvent,
      scheduleToolCalls,
      handleChatCompressionEvent,
      handleFinishedEvent,
      handleMaxSessionTurnsEvent,
      handleSessionTokenLimitExceededEvent,
      handleCitationEvent,
      startRetryCountdown,
      clearRetryCountdown,
      setThought,
      pendingHistoryItemRef,
      setPendingHistoryItem,
      pendingRetryCountdownItemRef,
    ],
  );

  const submitQuery = useCallback(
    async (
      query: PartListUnion,
      options?: { isContinuation: boolean },
      prompt_id?: string,
    ) => {
      // Prevent concurrent executions of submitQuery, but allow continuations
      // which are part of the same logical flow (tool responses)
      if (isSubmittingQueryRef.current && !options?.isContinuation) {
        return;
      }

      if (
        (streamingState === StreamingState.Responding ||
          streamingState === StreamingState.WaitingForConfirmation) &&
        !options?.isContinuation
      )
        return;

      // Set the flag to indicate we're now executing
      isSubmittingQueryRef.current = true;

      const userMessageTimestamp = Date.now();

      // Reset quota error flag when starting a new query (not a continuation)
      if (!options?.isContinuation) {
        setModelSwitchedFromQuotaError(false);
        // No quota-error / fallback routing mechanism currently; keep state minimal.
      }

      abortControllerRef.current = new AbortController();
      const abortSignal = abortControllerRef.current.signal;

      turnCancelledRef.current = false;

      if (!prompt_id) {
        prompt_id = config.getSessionId() + '########' + getPromptCount();
      }

      return promptIdContext.run(prompt_id, async () => {
        const { queryToSend, shouldProceed } = await prepareQueryForOllama(
          query,
          userMessageTimestamp,
          abortSignal,
          prompt_id!,
        );

        if (!shouldProceed || queryToSend === null) {
          isSubmittingQueryRef.current = false;
          return;
        }

        // Handle vision switch requirement
        const visionSwitchResult = await handleVisionSwitch(
          queryToSend,
          userMessageTimestamp,
          options?.isContinuation || false,
        );

        if (!visionSwitchResult.shouldProceed) {
          isSubmittingQueryRef.current = false;
          return;
        }

        const finalQueryToSend = queryToSend;

        // Store prompt text for token estimation fallback
        currentPromptTextRef.current = partToString(finalQueryToSend);

        if (!options?.isContinuation) {
          // trigger new prompt event for session stats in CLI
          startNewPrompt();

          // Reset thought when starting a new prompt
          setThought(null);
        }

        setIsResponding(true);
        setInitError(null);

        try {
          const stream = ollamaClient.sendMessageStream(
            finalQueryToSend,
            abortSignal,
            prompt_id!,
            options,
          );

          const processingStatus = await processOllamaStreamEvents(
            stream,
            userMessageTimestamp,
            abortSignal,
          );

          if (processingStatus === StreamProcessingStatus.UserCancelled) {
            // Restore original model if it was temporarily overridden
            restoreOriginalModel().catch((error) => {
              debugLogger.error('Failed to restore original model:', error);
            });
            isSubmittingQueryRef.current = false;
            return;
          }

          if (pendingHistoryItemRef.current) {
            // Flush any throttled updates before adding to history
            flushPendingHistoryItem();
            addItem(pendingHistoryItemRef.current, userMessageTimestamp);
            setPendingHistoryItem(null);
          }
          if (loopDetectedRef.current) {
            loopDetectedRef.current = false;
            handleLoopDetectedEvent();
          }

          // Restore original model if it was temporarily overridden
          restoreOriginalModel().catch((error) => {
            debugLogger.error('Failed to restore original model:', error);
          });
        } catch (error: unknown) {
          // Restore original model if it was temporarily overridden
          restoreOriginalModel().catch((error) => {
            debugLogger.error('Failed to restore original model:', error);
          });

          if (error instanceof UnauthorizedError) {
            onAuthError('Session expired or is unauthorized.');
          } else if (!isNodeError(error) || error.name !== 'AbortError') {
            addItem(
              {
                type: MessageType.ERROR,
                text: parseAndFormatApiError(
                  getErrorMessage(error) || 'Unknown error',
                  config.getContentGeneratorConfig()?.authType,
                ),
              },
              userMessageTimestamp,
            );
          }
        } finally {
          setIsResponding(false);
          isSubmittingQueryRef.current = false;
        }
      });
    },
    [
      streamingState,
      setModelSwitchedFromQuotaError,
      prepareQueryForOllama,
      processOllamaStreamEvents,
      pendingHistoryItemRef,
      addItem,
      setPendingHistoryItem,
      setInitError,
      ollamaClient,
      onAuthError,
      config,
      startNewPrompt,
      getPromptCount,
      handleLoopDetectedEvent,
      handleVisionSwitch,
      restoreOriginalModel,
    ],
  );

  const handleApprovalModeChange = useCallback(
    async (newApprovalMode: ApprovalMode) => {
      // Auto-approve pending tool calls when switching to auto-approval modes
      if (
        newApprovalMode === ApprovalMode.YOLO ||
        newApprovalMode === ApprovalMode.AUTO_EDIT
      ) {
        let awaitingApprovalCalls = toolCalls.filter(
          (call): call is TrackedWaitingToolCall =>
            call.status === 'awaiting_approval',
        );

        // For AUTO_EDIT mode, only approve edit tools (replace, write_file)
        if (newApprovalMode === ApprovalMode.AUTO_EDIT) {
          awaitingApprovalCalls = awaitingApprovalCalls.filter((call) =>
            EDIT_TOOL_NAMES.has(call.request.name),
          );
        }

        // Process pending tool calls sequentially to reduce UI chaos
        for (const call of awaitingApprovalCalls) {
          if (call.confirmationDetails?.onConfirm) {
            try {
              await call.confirmationDetails.onConfirm(
                ToolConfirmationOutcome.ProceedOnce,
              );
            } catch (error) {
              debugLogger.error(
                `Failed to auto-approve tool call ${call.request.callId}:`,
                error,
              );
            }
          }
        }
      }
    },
    [toolCalls],
  );

  const handleCompletedTools = useCallback(
    async (completedToolCallsFromScheduler: TrackedToolCall[]) => {
      if (isResponding) {
        return;
      }

      const completedAndReadyToSubmitTools =
        completedToolCallsFromScheduler.filter(
          (
            tc: TrackedToolCall,
          ): tc is TrackedCompletedToolCall | TrackedCancelledToolCall => {
            const isTerminalState =
              tc.status === 'success' ||
              tc.status === 'error' ||
              tc.status === 'cancelled';

            if (isTerminalState) {
              const completedOrCancelledCall = tc as
                | TrackedCompletedToolCall
                | TrackedCancelledToolCall;
              return (
                completedOrCancelledCall.response?.responseParts !== undefined
              );
            }
            return false;
          },
        );

      // Finalize any client-initiated tools as soon as they are done.
      const clientTools = completedAndReadyToSubmitTools.filter(
        (t) => t.request.isClientInitiated,
      );
      if (clientTools.length > 0) {
        markToolsAsSubmitted(clientTools.map((t) => t.request.callId));
      }

      // Identify new, successful save_memory calls that we haven't processed yet.
      const newSuccessfulMemorySaves = completedAndReadyToSubmitTools.filter(
        (t) =>
          t.request.name === 'save_memory' &&
          t.status === 'success' &&
          !processedMemoryToolsRef.current.has(t.request.callId),
      );

      if (newSuccessfulMemorySaves.length > 0) {
        // Perform the refresh only if there are new ones.
        void performMemoryRefresh();
        // Mark them as processed so we don't do this again on the next render.
        newSuccessfulMemorySaves.forEach((t) =>
          processedMemoryToolsRef.current.add(t.request.callId),
        );
      }

      const geminiTools = completedAndReadyToSubmitTools.filter(
        (t) => !t.request.isClientInitiated,
      );

      if (geminiTools.length === 0) {
        return;
      }

      // If all the tools were cancelled, don't submit a response to Ollama.
      const allToolsCancelled = geminiTools.every(
        (tc) => tc.status === 'cancelled',
      );

      if (allToolsCancelled) {
        if (ollamaClient) {
          // We need to manually add the function responses to the history
          // so the model knows the tools were cancelled.
          const combinedParts = geminiTools.flatMap(
            (toolCall) => toolCall.response.responseParts,
          );
          ollamaClient.addHistory({
            role: 'user',
            parts: combinedParts,
          });
        }

        const callIdsToMarkAsSubmitted = geminiTools.map(
          (toolCall) => toolCall.request.callId,
        );
        markToolsAsSubmitted(callIdsToMarkAsSubmitted);
        return;
      }

      const responsesToSend: Part[] = geminiTools.flatMap(
        (toolCall) => toolCall.response.responseParts,
      );
      const callIdsToMarkAsSubmitted = geminiTools.map(
        (toolCall) => toolCall.request.callId,
      );

      const prompt_ids = geminiTools.map(
        (toolCall) => toolCall.request.prompt_id,
      );

      markToolsAsSubmitted(callIdsToMarkAsSubmitted);

      // Don't continue if model was switched due to quota error
      if (modelSwitchedFromQuotaError) {
        return;
      }

      submitQuery(
        responsesToSend,
        {
          isContinuation: true,
        },
        prompt_ids[0],
      );
    },
    [
      isResponding,
      submitQuery,
      markToolsAsSubmitted,
      ollamaClient,
      performMemoryRefresh,
      modelSwitchedFromQuotaError,
    ],
  );

  const pendingHistoryItems = useMemo(
    () =>
      [
        pendingHistoryItem,
        pendingRetryErrorItem,
        pendingRetryCountdownItem,
        pendingToolCallGroupDisplay,
      ].filter((i) => i !== undefined && i !== null),
    [
      pendingHistoryItem,
      pendingRetryErrorItem,
      pendingRetryCountdownItem,
      pendingToolCallGroupDisplay,
    ],
  );

  useEffect(() => {
    const saveRestorableToolCalls = async () => {
      if (!config.getCheckpointingEnabled()) {
        return;
      }
      const restorableToolCalls = toolCalls.filter(
        (toolCall) =>
          EDIT_TOOL_NAMES.has(toolCall.request.name) &&
          toolCall.status === 'awaiting_approval',
      );

      if (restorableToolCalls.length > 0) {
        const checkpointDir = storage.getProjectTempCheckpointsDir();

        if (!checkpointDir) {
          return;
        }

        try {
          await fs.mkdir(checkpointDir, { recursive: true });
        } catch (error) {
          if (!isNodeError(error) || error.code !== 'EEXIST') {
            onDebugMessage(
              `Failed to create checkpoint directory: ${getErrorMessage(error)}`,
            );
            return;
          }
        }

        for (const toolCall of restorableToolCalls) {
          const filePath = toolCall.request.args['file_path'] as string;
          if (!filePath) {
            onDebugMessage(
              `Skipping restorable tool call due to missing file_path: ${toolCall.request.name}`,
            );
            continue;
          }

          try {
            if (!gitService) {
              onDebugMessage(
                `Checkpointing is enabled but Git service is not available. Failed to create snapshot for ${filePath}. Ensure Git is installed and working properly.`,
              );
              continue;
            }

            let commitHash: string | undefined;
            try {
              commitHash = await gitService.createFileSnapshot(
                `Snapshot for ${toolCall.request.name}`,
              );
            } catch (error) {
              onDebugMessage(
                `Failed to create new snapshot: ${getErrorMessage(error)}. Attempting to use current commit.`,
              );
            }

            if (!commitHash) {
              commitHash = await gitService.getCurrentCommitHash();
            }

            if (!commitHash) {
              onDebugMessage(
                `Failed to create snapshot for ${filePath}. Checkpointing may not be working properly. Ensure Git is installed and the project directory is accessible.`,
              );
              continue;
            }

            const timestamp = new Date()
              .toISOString()
              .replace(/:/g, '-')
              .replace(/\./g, '_');
            const toolName = toolCall.request.name;
            const fileName = path.basename(filePath);
            const toolCallWithSnapshotFileName = `${timestamp}-${fileName}-${toolName}.json`;
            const clientHistory = await ollamaClient?.getHistory();
            const toolCallWithSnapshotFilePath = path.join(
              checkpointDir,
              toolCallWithSnapshotFileName,
            );

            await fs.writeFile(
              toolCallWithSnapshotFilePath,
              JSON.stringify(
                {
                  history,
                  clientHistory,
                  toolCall: {
                    name: toolCall.request.name,
                    args: toolCall.request.args,
                  },
                  commitHash,
                  filePath,
                },
                null,
                2,
              ),
            );
          } catch (error) {
            onDebugMessage(
              `Failed to create checkpoint for ${filePath}: ${getErrorMessage(
                error,
              )}. This may indicate a problem with Git or file system permissions.`,
            );
          }
        }
      }
    };
    saveRestorableToolCalls();
  }, [
    toolCalls,
    config,
    onDebugMessage,
    gitService,
    history,
    ollamaClient,
    storage,
  ]);

  return {
    streamingState,
    submitQuery,
    initError,
    pendingHistoryItems,
    thought,
    cancelOngoingRequest,
    pendingToolCalls: toolCalls,
    handleApprovalModeChange,
    activePtyId,
    loopDetectionConfirmationRequest,
  };
};
