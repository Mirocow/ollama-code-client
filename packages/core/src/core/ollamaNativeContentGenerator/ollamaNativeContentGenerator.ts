/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Native Ollama Content Generator.
 * Uses the native Ollama REST API (/api/chat, /api/generate) instead of
 * the OpenAI-compatible API.
 */

import type {
  ContentGenerator,
  ContentGeneratorConfig,
} from '../contentGenerator.js';
import type { Config } from '../../config/config.js';
import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '../../types/content.js';
import {
  OllamaNativeClient,
  DEFAULT_OLLAMA_NATIVE_URL,
  type OllamaChatResponse,
} from '../ollamaNativeClient.js';
import { OllamaContentConverter } from './converter.js';
import { RequestTokenEstimator } from '../../utils/request-tokenizer/index.js';
import { isAbortError } from '../../utils/errors.js';
import { createDebugLogger } from '../../utils/debugLogger.js';
import { DEFAULT_OLLAMA_EMBEDDING_MODEL } from '../../config/models.js';

const debugLogger = createDebugLogger('OLLAMA_NATIVE');

/**
 * Native Ollama content generator implementation.
 * Communicates directly with Ollama's native REST API endpoints.
 */
export class OllamaNativeContentGenerator implements ContentGenerator {
  private client: OllamaNativeClient;
  private converter: OllamaContentConverter;
  private config: ContentGeneratorConfig;
  private _supportsTools: boolean | undefined;

  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    _cliConfig: Config,
  ) {
    this.config = contentGeneratorConfig;

    // Create native Ollama client
    const baseUrl = contentGeneratorConfig.baseUrl || DEFAULT_OLLAMA_NATIVE_URL;
    this.client = new OllamaNativeClient({
      baseUrl,
      timeout: contentGeneratorConfig.timeout,
      config: _cliConfig,
    });

    // Create converter for format transformation
    this.converter = new OllamaContentConverter(contentGeneratorConfig.model);
  }

  /**
   * Check if the current model supports function calling (tools)
   */
  async checkToolSupport(): Promise<boolean> {
    if (this._supportsTools !== undefined) {
      return this._supportsTools;
    }

    try {
      this._supportsTools = await this.client.supportsTools(this.config.model);
      debugLogger.info('Tool support check', {
        model: this.config.model,
        supportsTools: this._supportsTools,
      });
      return this._supportsTools;
    } catch (error) {
      debugLogger.warn('Could not check tool support', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Assume true on error
      this._supportsTools = true;
      return true;
    }
  }

  /**
   * Generate content using native Ollama API
   */
  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    debugLogger.debug('Generating content with native Ollama API', {
      model: this.config.model,
      userPromptId,
    });

    try {
      // Convert GenAI request to Ollama format
      const ollamaRequest = this.converter.convertGenAIRequestToOllama(request);

      // Handle tools asynchronously if present (tools are in config)
      if (request.config?.tools) {
        ollamaRequest.tools =
          await this.converter.convertGenAIToolsToOllamaAsync(
            request.config.tools,
          );
      }

      // Apply config-level options
      this.applyConfigOptions(ollamaRequest);

      debugLogger.debug('Ollama request', {
        request: JSON.stringify(ollamaRequest, null, 2),
      });

      // Make the API call
      const ollamaResponse = await this.client.chat(ollamaRequest);

      debugLogger.debug('Ollama response', {
        response: JSON.stringify(ollamaResponse, null, 2),
      });

      // Convert response back to GenAI format
      return this.converter.convertOllamaResponseToGenAI(ollamaResponse);
    } catch (error) {
      debugLogger.error('Ollama native API error:', error);
      throw this.handleError(error, request);
    }
  }

  /**
   * Generate content stream using native Ollama API
   * Yields chunks as they arrive from the server for true streaming behavior.
   */
  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    debugLogger.debug('Generating content stream with native Ollama API', {
      model: this.config.model,
      userPromptId,
    });

    // Log user messages for debugging (file only)
    if (request.contents) {
      const userMessages = request.contents
        .flatMap((c) => ('parts' in c ? c.parts : []))
        .filter((p) => typeof p === 'string' || ('text' in p && p.text))
        .map((p) => (typeof p === 'string' ? p : (p as { text: string }).text));
      const messagesStr = userMessages.join('\n---\n');
      debugLogger.info('User messages:', messagesStr);
    }

    // Convert request once
    const ollamaRequest = this.converter.convertGenAIRequestToOllama(request);
    if (request.config?.tools) {
      ollamaRequest.tools = await this.converter.convertGenAIToolsToOllamaAsync(
        request.config.tools,
      );
    }
    this.applyConfigOptions(ollamaRequest);

    // Log full request before sending (file only)
    const requestJson = JSON.stringify(ollamaRequest, null, 2);
    debugLogger.info('FULL OLLAMA REQUEST:', requestJson);

    // Store references for the generator
    const client = this.client;
    const converter = this.converter;
    const handleError = this.handleError.bind(this);
    const abortSignal = request.config?.abortSignal;

    // Create async generator with queue-based streaming
    return (async function* (): AsyncGenerator<GenerateContentResponse> {
      // Queue for streaming chunks
      const chunkQueue: GenerateContentResponse[] = [];
      let resolveNext:
        | ((value: IteratorResult<GenerateContentResponse>) => void)
        | null = null;
      let error: Error | null = null;
      let done = false;
      let chunkCount = 0;

      // Accumulate tool calls across chunks
      const accumulatedToolCalls = new Map<
        number,
        { name: string; args: string }
      >();

      // Accumulate text content for text-based tool call parsing
      const accumulatedContent = { text: '' };

      // Process streaming response - pass abortSignal to enable cancellation
      const streamPromise = client
        .chat(ollamaRequest, (chunk: OllamaChatResponse) => {
          chunkCount++;
          if (chunkCount <= 3) {
            debugLogger.debug(`Received chunk #${chunkCount}`);
          }

          // Convert each chunk to GenAI format and queue it
          const genaiResponse = converter.convertOllamaChunkToGenAI(
            chunk,
            accumulatedToolCalls,
            accumulatedContent,
          );
          chunkQueue.push(genaiResponse);

          // Resolve pending promise if any
          if (resolveNext) {
            const nextChunk = chunkQueue.shift()!;
            resolveNext({ value: nextChunk, done: false });
            resolveNext = null;
          }
        }, { signal: abortSignal })
        .then(() => {
          debugLogger.info(`Stream completed, total chunks: ${chunkCount}`);
          done = true;
          // Resolve any pending promise
          if (resolveNext) {
            resolveNext({
              value: undefined as unknown as GenerateContentResponse,
              done: true,
            });
            resolveNext = null;
          }
        })
        .catch((err) => {
          debugLogger.error('Stream error:', err);
          error = err;
          done = true;
          if (resolveNext) {
            resolveNext({
              value: undefined as unknown as GenerateContentResponse,
              done: true,
            });
            resolveNext = null;
          }
        });

      // Yield chunks as they become available
      while (!done || chunkQueue.length > 0) {
        // Check for abort signal - exit early if cancelled
        if (abortSignal?.aborted) {
          debugLogger.info('Stream aborted by abortSignal');
          break;
        }
        
        if (chunkQueue.length > 0) {
          yield chunkQueue.shift()!;
        } else if (!done) {
          // Wait for next chunk with abort support
          const nextValue = await new Promise<GenerateContentResponse | null>(
            (resolve) => {
              // Set up abort handler to resolve immediately on cancellation
              const abortHandler = () => {
                resolve(null);
              };
              abortSignal?.addEventListener('abort', abortHandler, { once: true });
              
              resolveNext = (result) => {
                abortSignal?.removeEventListener('abort', abortHandler);
                if (result.done) {
                  resolve(null);
                } else {
                  resolve(result.value);
                }
              };
            },
          );
          // Check for null (stream ended or aborted)
          if (nextValue === null && chunkQueue.length === 0 && done) break;
          // Also break if we got null due to abort
          if (abortSignal?.aborted) break;
          if (nextValue !== null) {
            yield nextValue;
          }
        }
      }

      // Wait for stream to complete and check for errors
      await streamPromise;
      if (error) {
        debugLogger.error('Ollama native streaming error:', error);
        throw handleError(error, request);
      }
    })();
  }

  /**
   * Count tokens using estimation (Ollama doesn't have a native token counting endpoint)
   */
  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    try {
      // Use the request token estimator (character-based)
      const estimator = new RequestTokenEstimator();
      const result = await estimator.calculateTokens(request);

      return {
        totalTokens: result.totalTokens,
      };
    } catch (error) {
      debugLogger.warn(
        'Failed to calculate tokens, falling back to simple method:',
        error,
      );

      // Fallback to simple estimation
      const content = JSON.stringify(request.contents);
      const totalTokens = Math.ceil(content.length / 4);

      return {
        totalTokens,
      };
    }
  }

  /**
   * Generate embeddings using native Ollama API
   */
  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Extract text from contents
    let text = '';

    // Handle batch contents (Content[])
    if (Array.isArray(request.contents)) {
      text = request.contents
        .map((content) => {
          if (typeof content === 'string') return content;
          if ('parts' in content && content.parts) {
            return content.parts
              .map((part) =>
                typeof part === 'string'
                  ? part
                  : 'text' in part
                    ? (part as { text?: string }).text || ''
                    : '',
              )
              .join(' ');
          }
          return '';
        })
        .join(' ');
    } else if (request.content) {
      // Handle single content
      if ('parts' in request.content && request.content.parts) {
        text = request.content.parts
          .map((part: { text?: string }) =>
            typeof part === 'string' ? part : (part.text ?? ''),
          )
          .join(' ');
      }
    }

    try {
      // Use Ollama embedding model
      const embedding = await this.client.embed({
        model: DEFAULT_OLLAMA_EMBEDDING_MODEL,
        input: text,
      });

      return {
        embedding: {
          values: embedding.embeddings[0],
        },
      };
    } catch (error) {
      debugLogger.error('Ollama embedding error:', error);
      throw new Error(
        `Ollama embedding error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Whether to use summarized thinking (not supported in native Ollama)
   */
  useSummarizedThinking(): boolean {
    return false;
  }

  /**
   * Apply config-level options to the Ollama request
   */
  private applyConfigOptions(
    ollamaRequest: ReturnType<
      typeof this.converter.convertGenAIRequestToOllama
    >,
  ): void {
    if (!ollamaRequest.options) {
      ollamaRequest.options = {};
    }

    // Apply sampling parameters
    const sampling = this.config.samplingParams;
    if (sampling) {
      if (sampling.temperature !== undefined) {
        ollamaRequest.options.temperature = sampling.temperature;
      }
      if (sampling.top_p !== undefined) {
        ollamaRequest.options.top_p = sampling.top_p;
      }
      if (sampling.top_k !== undefined) {
        ollamaRequest.options.top_k = sampling.top_k;
      }
      if (sampling.max_tokens !== undefined) {
        ollamaRequest.options.num_predict = sampling.max_tokens;
      }
      if (sampling.repetition_penalty !== undefined) {
        ollamaRequest.options.repeat_penalty = sampling.repetition_penalty;
      }
      if (sampling.presence_penalty !== undefined) {
        ollamaRequest.options.presence_penalty = sampling.presence_penalty;
      }
      if (sampling.frequency_penalty !== undefined) {
        ollamaRequest.options.frequency_penalty = sampling.frequency_penalty;
      }
    }

    // Apply context window size
    if (this.config.contextWindowSize !== undefined) {
      ollamaRequest.options.num_ctx = this.config.contextWindowSize;
    }
  }

  /**
   * Handle errors from the Ollama API
   */
  private handleError(
    error: unknown,
    request: GenerateContentParameters,
  ): Error {
    if (isAbortError(error) && request.config?.abortSignal?.aborted) {
      // User cancelled the request
      return error as Error;
    }

    // If it's already an OllamaApiError, preserve it
    if (error instanceof Error) {
      return error;
    }

    const message = String(error);
    return new Error(`Ollama API error: ${message}`);
  }
}
