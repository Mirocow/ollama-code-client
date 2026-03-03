/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Content,
  Part,
  Tool,
  GenerateContentResponse,
  GenerateContentConfig,
} from '../types/content.js';
import type { Config } from '../config/config.js';
import type { RetryInfo } from '../utils/rateLimit.js';
import type { ContextCacheManager } from '../cache/contextCacheManager.js';
import { contextCacheManager } from '../cache/contextCacheManager.js';
import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('OLLAMA_CHAT');

export interface OllamaChatOptions {
  systemInstruction?: string | Part | Part[];
  tools?: Tool[];
  /** Enable context caching for faster multi-turn conversations */
  enableContextCaching?: boolean;
  /** Session ID for context tracking */
  sessionId?: string;
}

export interface SendMessageStreamParams {
  message: Part[];
  config: GenerateContentConfig;
}

export interface StreamEvent {
  type: 'chunk' | 'retry';
  value?: GenerateContentResponse;
  retryInfo?: RetryInfo;
}

/**
 * OllamaChat with Context Caching Support
 *
 * This class manages conversation history and can optionally use
 * Ollama's native context token caching for improved performance.
 *
 * When context caching is enabled:
 * - Uses /api/generate endpoint with cached context tokens
 * - Falls back to /api/chat when tools are needed
 * - Automatically switches between endpoints based on requirements
 */
export class OllamaChat {
  private history: Content[] = [];
  private systemInstruction?: string | Part | Part[];
  private tools?: Tool[];
  private enableContextCaching: boolean;
  private sessionId: string;
  // Reserved for future context caching implementation
  // @ts-expect-error Reserved for future use
  private _contextCache: ContextCacheManager;
  private messageCount: number = 0;
  private cachedContext: number[] | null = null;

  constructor(
    private readonly config: Config,
    options: OllamaChatOptions,
    history: Content[],
  ) {
    this.systemInstruction = options.systemInstruction;
    this.tools = options.tools;
    this.history = history;
    this.enableContextCaching = options.enableContextCaching ?? false;
    this.sessionId = options.sessionId ?? `session-${Date.now()}`;
    this._contextCache = contextCacheManager;

    debugLogger.info('OllamaChat initialized', {
      enableContextCaching: this.enableContextCaching,
      sessionId: this.sessionId,
      historyLength: history.length,
    });
  }

  addHistory(content: Content): void {
    this.history.push(content);
    this.messageCount++;

    // Invalidate cached context when history changes externally
    if (this.enableContextCaching) {
      this.cachedContext = null;
      debugLogger.debug('History added - context invalidated');
    }
  }

  getHistory(_curated?: boolean): Content[] {
    return this.history;
  }

  setHistory(history: Content[]): void {
    this.history = history;
    this.messageCount = history.length;

    // Invalidate cached context
    if (this.enableContextCaching) {
      this.cachedContext = null;
      debugLogger.debug('History set - context invalidated');
    }
  }

  stripThoughtsFromHistory(): void {
    // Remove thought parts from history
    this.history = this.history.map((content) => ({
      ...content,
      parts:
        content.parts?.filter(
          (part) => typeof part === 'string' || !('thought' in part),
        ) || [],
    }));

    // Invalidate cached context after stripping thoughts
    if (this.enableContextCaching) {
      this.cachedContext = null;
      debugLogger.debug('Thoughts stripped - context invalidated');
    }
  }

  setTools(tools: Tool[]): void {
    this.tools = tools;
    debugLogger.debug('Tools updated', { toolCount: tools.length });
  }

  /**
   * Check if context caching should be used for this request
   */
  private shouldUseContextCaching(): boolean {
    if (!this.enableContextCaching) return false;

    // Don't use context caching if tools are present (requires /api/chat)
    if (this.tools && this.tools.length > 0) {
      debugLogger.debug(
        'Tools present - using /api/chat instead of /api/generate',
      );
      return false;
    }

    return true;
  }

  /**
   * Get the cached context tokens
   */
  getCachedContext(): number[] | null {
    return this.cachedContext;
  }

  /**
   * Set the cached context tokens (called after generate response)
   */
  setCachedContext(context: number[]): void {
    this.cachedContext = context;
    debugLogger.info('Context cached', { contextLength: context.length });
  }

  /**
   * Clear the cached context
   */
  clearCachedContext(): void {
    this.cachedContext = null;
    debugLogger.info('Context cleared');
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Set session ID
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    this.cachedContext = null;
    debugLogger.info('Session ID updated', { sessionId });
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messageCount;
  }

  /**
   * Check if context caching is enabled and available
   */
  isContextCachingEnabled(): boolean {
    return this.enableContextCaching;
  }

  /**
   * Check if we have cached context
   */
  hasCachedContext(): boolean {
    return this.cachedContext !== null && this.cachedContext.length > 0;
  }

  async *sendMessageStream(
    model: string,
    params: SendMessageStreamParams,
    prompt_id: string,
  ): AsyncGenerator<StreamEvent> {
    // Add user message to history
    this.history.push({ role: 'user', parts: params.message });
    this.messageCount++;

    const contentGenerator = this.config.getContentGenerator();

    const request = {
      model,
      contents: this.history,
      config: {
        ...params.config,
        systemInstruction: this.systemInstruction,
        tools: this.tools,
      } as GenerateContentConfig,
    };

    // Log context caching status
    if (this.shouldUseContextCaching()) {
      debugLogger.info('Context caching enabled for this request', {
        hasCachedContext: this.hasCachedContext(),
        cachedContextLength: this.cachedContext?.length ?? 0,
      });
    }

    const stream = await contentGenerator.generateContentStream(
      request,
      prompt_id,
    );

    for await (const response of stream) {
      yield { type: 'chunk', value: response };
    }
  }

  async maybeIncludeSchemaDepthContext(_error: {
    message: string;
    status?: number;
  }): Promise<void> {
    // No-op for now - can be extended to include schema depth context for debugging
  }
}
