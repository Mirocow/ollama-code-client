/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Native Ollama API client for direct communication with Ollama server.
 * This client uses the native Ollama REST API endpoints, not the OpenAI-compatible API.
 *
 * API Documentation: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import type { Config } from '../config/config.js';
import {
  OllamaApiError,
  OllamaTimeoutError,
  OllamaAbortError,
  OllamaStreamingError,
  detectOllamaError,
} from '../utils/ollamaErrors.js';
import { createDebugLogger } from '../utils/debugLogger.js';
import { apiLogger } from '../utils/apiLogger.js';
import { createHttpClient, type AxiosInstance } from '../utils/httpClient.js';

import { abortSignalAny } from '../utils/nodePolyfills.js';
// Lazy-initialized debug logger to ensure session is set before use
let _debugLogger: ReturnType<typeof createDebugLogger> | null = null;
function getDebugLogger() {
  if (!_debugLogger) {
    _debugLogger = createDebugLogger('OLLAMA_CLIENT');
  }
  return _debugLogger;
}

// Debug log - writes to file only
function debugLog(
  level: 'debug' | 'info' | 'warn' | 'error',
  ...args: unknown[]
) {
  const logger = getDebugLogger();
  logger[level](...args);
}

/**
 * Default Ollama base URL (native API, not OpenAI-compatible)
 */
export const DEFAULT_OLLAMA_NATIVE_URL = 'http://localhost:11434';

/**
 * Default timeout for API requests (5 minutes)
 */
export const DEFAULT_OLLAMA_TIMEOUT = 300000;

/**
 * Default keep_alive duration (5 minutes)
 * Controls how long the model stays loaded in memory after the request
 */
export const DEFAULT_KEEP_ALIVE = '5m';

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,
  retryOnErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'network error'],
};

// ============================================================================
// Types
// ============================================================================

/**
 * Model information returned by /api/tags and /api/show
 */
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: OllamaModelDetails;
  modelfile?: string;
  parameters?: string;
  template?: string;
  license?: string;
  system?: string;
}

/**
 * Detailed model information
 */
export interface OllamaModelDetails {
  format: string;
  family: string;
  families?: string[];
  parameter_size: string;
  quantization_level: string;
  parent_model?: string;
}

/**
 * Model info from /api/tags response
 */
export interface OllamaTagsResponse {
  models: OllamaModel[];
}

/**
 * Running model from /api/ps response
 */
export interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: OllamaModelDetails;
  expires_at: string;
  size_vram: number;
}

/**
 * Response from /api/ps
 */
export interface OllamaPsResponse {
  models: OllamaRunningModel[];
}

/**
 * JSON Schema for structured outputs
 */
export interface OllamaJsonSchema {
  type: string;
  properties?: Record<string, OllamaJsonSchema>;
  items?: OllamaJsonSchema;
  required?: string[];
  enum?: string[];
  description?: string;
  [key: string]: unknown;
}

/**
 * Format parameter - can be 'json', a string, or a JSON Schema object
 */
export type OllamaFormat = 'json' | string | OllamaJsonSchema;

/**
 * Request for /api/generate
 */
export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  suffix?: string;
  images?: string[]; // base64 encoded images
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  format?: OllamaFormat;
  keep_alive?: string | number;
  options?: OllamaModelOptions;
  /** Enable thinking mode for thinking models (DeepSeek R1, Qwen, etc.) */
  think?: boolean;
  /** Image generation parameters (experimental) */
  width?: number;
  height?: number;
  steps?: number;
}

/**
 * Response from /api/generate (streaming and non-streaming)
 */
export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  /** Reason for completion: 'stop', 'length', etc. */
  done_reason?: 'stop' | 'length' | 'load' | 'error';
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Chat message
 */
export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[]; // base64 encoded
  tool_calls?: OllamaToolCall[];
  /** Thinking content for thinking models */
  thinking?: string;
  /** Tool name for tool result messages */
  tool_name?: string;
}

/**
 * Tool call in a message
 */
export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/**
 * Tool definition
 */
export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Request for /api/chat
 */
export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  tools?: OllamaTool[];
  stream?: boolean;
  format?: OllamaFormat;
  keep_alive?: string | number;
  options?: OllamaModelOptions;
  /** Enable thinking mode for thinking models (DeepSeek R1, Qwen, etc.) */
  think?: boolean;
}

/**
 * Response from /api/chat
 */
export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaChatMessage;
  done: boolean;
  /** Reason for completion: 'stop', 'length', etc. */
  done_reason?: 'stop' | 'length' | 'load' | 'error';
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Model options for generation
 */
export interface OllamaModelOptions {
  numa?: boolean;
  num_ctx?: number;
  num_batch?: number;
  num_gpu?: number;
  main_gpu?: number;
  low_vram?: boolean;
  f16_kv?: boolean;
  logits_all?: boolean;
  vocab_only?: boolean;
  use_mmap?: boolean;
  use_mlock?: boolean;
  embedding_only?: boolean;
  num_thread?: number;
  num_keep?: number;
  seed?: number;
  num_predict?: number;
  top_k?: number;
  top_p?: number;
  tfs_z?: number;
  typical_p?: number;
  repeat_last_n?: number;
  temperature?: number;
  repeat_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  mirostat?: number;
  mirostat_tau?: number;
  mirostat_eta?: number;
  penalize_newline?: boolean;
  stop?: string[];
}

/**
 * Request for /api/embed
 */
export interface OllamaEmbedRequest {
  model: string;
  input: string | string[];
  truncate?: boolean;
  keep_alive?: string | number;
  options?: OllamaModelOptions;
}

/**
 * Response from /api/embed
 */
export interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
}

/**
 * Request for /api/embeddings (legacy)
 */
export interface OllamaEmbeddingsRequest {
  model: string;
  prompt: string;
  options?: OllamaModelOptions;
  keep_alive?: string | number;
}

/**
 * Response from /api/embeddings (legacy)
 */
export interface OllamaEmbeddingsResponse {
  embedding: number[];
}

/**
 * Request for /api/pull
 */
export interface OllamaPullRequest {
  name: string;
  insecure?: boolean;
  stream?: boolean;
}

/**
 * Response from /api/pull (streaming)
 */
export interface OllamaPullResponse {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

/**
 * Request for /api/push
 */
export interface OllamaPushRequest {
  name: string;
  insecure?: boolean;
  stream?: boolean;
}

/**
 * Response from /api/push (streaming)
 */
export interface OllamaPushResponse {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

/**
 * Request for /api/copy
 */
export interface OllamaCopyRequest {
  source: string;
  destination: string;
}

/**
 * Request for /api/delete
 */
export interface OllamaDeleteRequest {
  model: string;
}

/**
 * Request for /api/create
 * Create a model from a Modelfile
 */
export interface OllamaCreateRequest {
  name: string;
  modelfile?: string;
  from?: string; // Base model to create from
  stream?: boolean;
  quantize?: string; // Quantization level (e.g., 'q4_0', 'q8_0')
  /**
   * Parameters to override in the model
   */
  parameters?: Record<string, unknown>;
  /**
   * System prompt to set for the model
   */
  system?: string;
  /**
   * Template to use for the model
   */
  template?: string;
  /**
   * License for the model
   */
  license?: string;
}

/**
 * Response from /api/create (streaming)
 */
export interface OllamaCreateResponse {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

/**
 * Response from /api/create (final)
 */
export interface OllamaCreateResult {
  name: string;
  digest: string;
  created_at: string;
  modified_at: string;
  size: number;
}

/**
 * Request for /api/show
 */
export interface OllamaShowRequest {
  model: string;
  system?: string;
  template?: string;
  options?: OllamaModelOptions;
}

/**
 * Response from /api/show
 */
export interface OllamaShowResponse {
  modelfile: string;
  parameters: string;
  template: string;
  details: OllamaModelDetails;
  model_info?: Record<string, unknown>;
  license?: string;
  system?: string;
  capabilities?: string[]; // e.g., ["completion", "tools"]
}

/**
 * Response from /api/version
 */
export interface OllamaVersionResponse {
  version: string;
}

/**
 * Progress event for streaming operations
 */
export interface OllamaProgressEvent {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percentage?: number;
}

/**
 * Callback for streaming responses
 */
export type StreamCallback<T> = (chunk: T) => void;

/**
 * Callback for progress events
 */
export type ProgressCallback = (event: OllamaProgressEvent) => void;

/**
 * Options for generate and chat operations
 */
export interface RequestOptions {
  /** External AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Override keep_alive for this request */
  keepAlive?: string | number;
  /** Retry configuration for this request */
  retry?: Partial<RetryConfig>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  retryOnErrors: string[];
}

/**
 * Client configuration options
 */
export interface OllamaClientOptions {
  baseUrl?: string;
  timeout?: number;
  keepAlive?: string | number;
  retry?: Partial<RetryConfig>;
  config?: Config;
}

// ============================================================================
// OllamaNativeClient
// ============================================================================

/**
 * Native Ollama API client.
 * Provides methods to interact with all Ollama REST API endpoints.
 *
 * @example
 * const client = new OllamaNativeClient({
 *   baseUrl: 'http://localhost:11434',
 *   keepAlive: '5m',
 * });
 *
 * // Chat with streaming
 * await client.chat(
 *   { model: 'llama3.2', messages: [{ role: 'user', content: 'Hello!' }] },
 *   (chunk) => console.log(chunk.message.content),
 * );
 */
export class OllamaNativeClient {
  private baseUrl: string;
  private timeout: number;
  private keepAlive: string | number;
  private retryConfig: RetryConfig;
  private httpClient: AxiosInstance;

  constructor(options?: OllamaClientOptions) {
    // Normalize baseUrl: remove /v1 suffix if present (OpenAI-compatible path)
    // Ollama native API uses /api/chat, /api/generate etc. directly
    let url = options?.baseUrl ?? DEFAULT_OLLAMA_NATIVE_URL;
    url = url.replace(/\/v1\/?$/, ''); // Remove trailing /v1 or /v1/

    this.baseUrl = url;
    this.timeout = options?.timeout ?? DEFAULT_OLLAMA_TIMEOUT;
    this.keepAlive = options?.keepAlive ?? DEFAULT_KEEP_ALIVE;
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...options?.retry,
    };

    // Create axios HTTP client with configuration
    this.httpClient = createHttpClient({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      maxRetries: this.retryConfig.maxRetries,
      retryDelay: this.retryConfig.retryDelayMs,
      debug: process.env['DEBUG'] === '1' || process.env['DEBUG'] === 'true',
    });
    // options.config is reserved for future use (e.g., proxy settings)
  }

  /**
   * Get the base URL for the Ollama API
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the default keep_alive value
   */
  getKeepAlive(): string | number {
    return this.keepAlive;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error should trigger a retry
   */
  private shouldRetry(error: unknown): boolean {
    if (error instanceof OllamaAbortError) {
      return false;
    }

    const errorMessage =
      error instanceof Error ? error.message.toLowerCase() : '';
    const errorCode =
      (error as NodeJS.ErrnoException)?.code?.toString().toLowerCase() ?? '';

    return this.retryConfig.retryOnErrors.some(
      (retryError) =>
        errorMessage.includes(retryError.toLowerCase()) ||
        errorCode.includes(retryError.toLowerCase()),
    );
  }

  /**
   * Execute a request with retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    retryConfig?: Partial<RetryConfig>,
  ): Promise<T> {
    const config = { ...this.retryConfig, ...retryConfig };
    let lastError: unknown;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on abort
        if (error instanceof OllamaAbortError) {
          throw error;
        }

        // Check if we should retry
        if (attempt < config.maxRetries && this.shouldRetry(error)) {
          const delay = config.retryDelayMs * Math.pow(2, attempt); // Exponential backoff
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Make an HTTP request to the Ollama API using Axios
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: unknown,
    externalSignal?: AbortSignal,
    retryConfig?: Partial<RetryConfig>,
  ): Promise<T> {
    return this.withRetry(async () => {
      const url = `${this.baseUrl}${endpoint}`;

      debugLog('debug', 'Making API request', {
        method,
        endpoint,
        body: body ? JSON.stringify(body).slice(0, 500) : undefined,
      });

      // Log the request to API logger
      const requestLogData = {
        type: 'request',
        method,
        url,
        endpoint,
        body,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      };
      apiLogger.logInteraction(requestLogData).catch(() => {
        // Ignore logging errors
      });

      try {
        // Use axios for the request
        const config: import('axios').AxiosRequestConfig = {
          method,
          url: endpoint,
          data: body,
          signal: externalSignal,
          headers: {
            Accept: 'application/json',
          },
        };

        const response = await this.httpClient.request<T>(config);
        debugLog('debug', 'API request completed', { endpoint });

        // Log the response to API logger
        apiLogger
          .logInteraction(requestLogData, {
            type: 'response',
            status: response.status,
            body: response.data,
          })
          .catch(() => {
            // Ignore logging errors
          });

        return response.data;
      } catch (error) {
        // Handle Axios errors
        const axiosError = error as {
          response?: {
            status: number;
            data?: { error?: string };
            statusText?: string;
          };
          code?: string;
          message?: string;
        };

        // Handle timeout
        if (
          axiosError.code === 'ECONNABORTED' ||
          axiosError.message?.includes('timeout')
        ) {
          debugLog('error', 'API request timed out', {
            endpoint,
            timeout: this.timeout,
          });
          const timeoutError = new OllamaTimeoutError(this.timeout);
          apiLogger
            .logInteraction(requestLogData, undefined, timeoutError)
            .catch(() => {});
          throw timeoutError;
        }

        // Handle HTTP errors
        if (axiosError.response) {
          const status = axiosError.response.status;
          const errorData = axiosError.response.data;
          const errorMessage =
            errorData?.error ||
            `Ollama API error: ${status} ${axiosError.response.statusText}`;

          debugLog('error', 'API request failed', {
            status,
            error: errorMessage,
          });
          const wrappedError = detectOllamaError(new Error(errorMessage), {});
          apiLogger
            .logInteraction(
              requestLogData,
              { status, error: errorMessage, body: errorData },
              wrappedError,
            )
            .catch(() => {});
          throw wrappedError;
        }

        // Re-throw OllamaApiError as-is
        if (error instanceof OllamaApiError) {
          apiLogger
            .logInteraction(requestLogData, undefined, error)
            .catch(() => {});
          throw error;
        }

        // Wrap other errors (network errors, etc.)
        debugLog('error', 'API request error', {
          endpoint,
          error: error instanceof Error ? error.message : String(error),
        });
        const wrappedError = detectOllamaError(error, {
          timeoutMs: this.timeout,
        });
        apiLogger
          .logInteraction(requestLogData, undefined, wrappedError)
          .catch(() => {});
        throw wrappedError;
      }
    }, retryConfig);
  }

  /**
   * Make a streaming HTTP request to the Ollama API
   *
   * Improvements for latest Ollama API:
   * - Handles mid-stream errors (Ollama returns errors in NDJSON format)
   * - Refreshes timeout on each chunk to handle long-running generations
   * - Provides detailed logging for debugging
   * - Logs full request/response to API logger
   */
  private async streamingRequest<T>(
    endpoint: string,
    body: unknown,
    callback: StreamCallback<T>,
    externalSignal?: AbortSignal,
  ): Promise<void> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();

    // Use a refreshable timeout that resets on each chunk
    let timeoutId = setTimeout(() => controller.abort(), this.timeout);
    let isCleanedUp = false;

    const cleanup = () => {
      if (!isCleanedUp) {
        isCleanedUp = true;
        clearTimeout(timeoutId);
      }
    };

    const refreshTimeout = () => {
      if (isCleanedUp) return;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => controller.abort(), this.timeout);
    };

    // Combine external signal with timeout signal
    const combinedSignal = externalSignal
      ? abortSignalAny([externalSignal, controller.signal])
      : controller.signal;

    // Clean up internal timeout when external signal aborts (prevents memory leak)
    if (externalSignal) {
      if (externalSignal.aborted) {
        cleanup();
      } else {
        externalSignal.addEventListener('abort', cleanup, { once: true });
      }
    }

    const requestBody = {
      ...(body as Record<string, unknown>),
      stream: true,
    };

    debugLog('info', 'Starting streaming request', {
      url,
      bodySize: `${(JSON.stringify(requestBody).length / 1024).toFixed(1)}KB`,
      timeout: this.timeout,
      hasExternalSignal: !!externalSignal,
      externalSignalAborted: externalSignal?.aborted,
    });

    // Log the request to API logger
    const requestLogData = {
      type: 'request',
      method: 'POST',
      url,
      endpoint,
      body,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
      },
    };
    apiLogger.logInteraction(requestLogData).catch(() => {
      // Ignore logging errors
    });

    // Collect response chunks for logging
    const responseChunks: T[] = [];
    let responseError: Error | undefined;

    try {
      const fetchStartTime = Date.now();
      const response = await this.httpClient.post<import('stream').Readable>(
        endpoint,
        requestBody,
        {
          responseType: 'stream',
          signal: combinedSignal,
          headers: {
            Accept: 'application/x-ndjson',
          },
        },
      );
      const fetchDuration = Date.now() - fetchStartTime;

      debugLog('info', 'Axios streaming response received', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers['content-type'],
        fetchDuration: `${fetchDuration}ms`,
      });

      // Check for non-OK status
      if (response.status < 200 || response.status >= 300) {
        let errorMessage = `Ollama API error: ${response.status} ${response.statusText}`;
        // Try to read error from stream
        const chunks: Buffer[] = [];
        for await (const chunk of response.data) {
          chunks.push(chunk);
        }
        const errorText = Buffer.concat(chunks).toString('utf-8');
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorMessage = errorJson.error;
          }
        } catch {
          // Use default error message
        }
        debugLog('error', 'Streaming request failed', {
          status: response.status,
          error: errorMessage,
        });
        responseError = new Error(errorMessage);
        apiLogger
          .logInteraction(
            requestLogData,
            { status: response.status, error: errorMessage, body: errorText },
            responseError,
          )
          .catch(() => {});
        throw detectOllamaError(new Error(errorMessage), {});
      }

      // Process the stream
      const stream = response.data;
      let buffer = '';
      let chunkCount = 0;
      let bytesRead = 0;

      // Handle stream events
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          // Refresh timeout on each chunk to handle long-running generations
          refreshTimeout();
          chunkCount++;
          bytesRead += chunk.length;

          // Log chunk details for debugging (first 5 and every 10th)
          if (chunkCount <= 5 || chunkCount % 10 === 0) {
            debugLog('debug', `Received chunk #${chunkCount}`, {
              size: chunk.length,
              totalBytes: bytesRead,
            });
          }

          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line) as T;

                // Check for mid-stream errors (Ollama returns errors in NDJSON format)
                if (parsed && typeof parsed === 'object' && 'error' in parsed) {
                  const errorMsg = (parsed as { error: string }).error;
                  debugLog('error', 'Mid-stream error received', {
                    error: errorMsg,
                  });
                  responseError = new OllamaStreamingError(errorMsg, parsed);
                  apiLogger
                    .logInteraction(
                      requestLogData,
                      { chunks: responseChunks, error: errorMsg },
                      responseError,
                    )
                    .catch(() => {});
                  reject(responseError);
                  stream.destroy();
                  return;
                }

                // Log first few parsed chunks for debugging
                if (chunkCount <= 3) {
                  debugLog('debug', `Parsed chunk #${chunkCount}`, {
                    preview: JSON.stringify(parsed).slice(0, 200),
                  });
                }

                // Log tool_calls for debugging
                const parsedWithToolCalls = parsed as {
                  message?: { tool_calls?: unknown[] };
                };
                if (parsedWithToolCalls.message?.tool_calls) {
                  debugLog(
                    'info',
                    'TOOL_CALLS from Ollama:',
                    parsedWithToolCalls.message.tool_calls,
                  );
                }

                // Log done flag for debugging
                const parsedWithDone = parsed as { done?: boolean };
                if (parsedWithDone.done) {
                  const toolCallChunks = responseChunks.filter((c) => {
                    const chunk = c as { message?: { tool_calls?: unknown[] } };
                    return (
                      chunk.message?.tool_calls &&
                      chunk.message.tool_calls.length > 0
                    );
                  });
                  debugLog('debug', 'OLLAMA DONE CHUNK', {
                    chunkCount,
                    toolCallChunks: toolCallChunks.length,
                  });
                }

                // Collect response chunk for logging
                responseChunks.push(parsed);
                callback(parsed);
              } catch (parseError) {
                // If it's already an OllamaStreamingError, re-throw it
                if (parseError instanceof OllamaStreamingError) {
                  reject(parseError);
                  stream.destroy();
                  return;
                }
                // Skip malformed JSON lines but log them
                debugLog('warn', 'Skipping malformed JSON line', {
                  line: line.slice(0, 100),
                });
              }
            }
          }
        });

        stream.on('end', () => {
          debugLog('info', 'Streaming completed', {
            totalChunks: chunkCount,
            totalBytes: bytesRead,
          });

          // Process any remaining data
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer) as T;

              // Check for error in final chunk
              if (parsed && typeof parsed === 'object' && 'error' in parsed) {
                const errorMsg = (parsed as { error: string }).error;
                responseError = new OllamaStreamingError(errorMsg, parsed);
                apiLogger
                  .logInteraction(
                    requestLogData,
                    { chunks: responseChunks, error: errorMsg },
                    responseError,
                  )
                  .catch(() => {});
                reject(responseError);
                return;
              }

              responseChunks.push(parsed);
              callback(parsed);
            } catch (parseError) {
              if (parseError instanceof OllamaStreamingError) {
                reject(parseError);
                return;
              }
              // Skip malformed JSON
              debugLog('warn', 'Skipping malformed JSON in final buffer', {
                buffer: buffer.slice(0, 100),
              });
            }
          }

          // Log the complete response to API logger
          apiLogger
            .logInteraction(requestLogData, {
              type: 'streaming_response',
              totalChunks: responseChunks.length,
              chunks: responseChunks,
            })
            .catch(() => {
              // Ignore logging errors
            });

          resolve();
        });

        stream.on('error', (error: Error) => {
          debugLog('error', 'Stream error', {
            error: error.message,
          });
          reject(error);
        });
      });
    } catch (error) {
      // Handle timeout
      if (
        (error as Error).name === 'AbortError' ||
        (error as { code?: string }).code === 'ECONNABORTED' ||
        (error instanceof Error && error.message.includes('timeout'))
      ) {
        debugLog('error', 'Streaming request timed out', {
          timeout: this.timeout,
        });
        const timeoutError = new OllamaTimeoutError(this.timeout);
        apiLogger
          .logInteraction(
            requestLogData,
            { chunks: responseChunks },
            timeoutError,
          )
          .catch(() => {});
        throw timeoutError;
      }
      // Re-throw OllamaApiError as-is
      if (error instanceof OllamaApiError) {
        apiLogger
          .logInteraction(requestLogData, { chunks: responseChunks }, error)
          .catch(() => {});
        throw error;
      }
      // Wrap other errors
      debugLog('error', 'Streaming request error', {
        error: error instanceof Error ? error.message : String(error),
      });
      const wrappedError = detectOllamaError(error, {
        timeoutMs: this.timeout,
      });
      apiLogger
        .logInteraction(
          requestLogData,
          { chunks: responseChunks },
          wrappedError,
        )
        .catch(() => {});
      throw wrappedError;
    } finally {
      // Always cleanup
      cleanup();
    }
  }

  /**
   * Apply default keep_alive to request body
   */
  private applyDefaults<T extends { keep_alive?: string | number }>(
    body: T,
    options?: RequestOptions,
  ): T {
    return {
      ...body,
      keep_alive: options?.keepAlive ?? body.keep_alive ?? this.keepAlive,
    };
  }

  // ========================================================================
  // Model Management API
  // ========================================================================

  /**
   * List local models.
   * GET /api/tags
   *
   * @example
   * const models = await client.listModels();
   * console.log(models.models);
   */
  async listModels(): Promise<OllamaTagsResponse> {
    return this.request<OllamaTagsResponse>('/api/tags');
  }

  /**
   * Show model information.
   * POST /api/show
   *
   * @example
   * const info = await client.showModel('llama3.2');
   * console.log(info.modelfile);
   */
  async showModel(
    model: string | OllamaShowRequest,
  ): Promise<OllamaShowResponse> {
    const body = typeof model === 'string' ? { model } : model;
    return this.request<OllamaShowResponse>('/api/show', 'POST', body);
  }

  /**
   * Copy a model.
   * POST /api/copy
   *
   * @example
   * await client.copyModel('llama3.2', 'llama3-backup');
   */
  async copyModel(source: string, destination: string): Promise<void> {
    await this.request<void>('/api/copy', 'POST', { source, destination });
  }

  /**
   * Delete a model.
   * DELETE /api/delete
   *
   * @example
   * await client.deleteModel('llama3:13b');
   */
  async deleteModel(model: string): Promise<void> {
    await this.request<void>('/api/delete', 'DELETE', { model });
  }

  /**
   * Pull a model from the registry.
   * POST /api/pull
   *
   * @example
   * // Non-streaming
   * await client.pullModel('llama3.2');
   *
   * // With progress callback
   * await client.pullModel('llama3.2', (progress) => {
   *   console.log(`${progress.status}: ${progress.percentage?.toFixed(1)}%`);
   * });
   */
  async pullModel(
    name: string,
    progressCallback?: ProgressCallback,
  ): Promise<void> {
    if (progressCallback) {
      await this.streamingRequest<OllamaPullResponse>(
        '/api/pull',
        { name, stream: true },
        (response) => {
          const percentage = response.total
            ? ((response.completed ?? 0) / response.total) * 100
            : undefined;
          progressCallback({
            status: response.status,
            digest: response.digest,
            total: response.total,
            completed: response.completed,
            percentage,
          });
        },
      );
    } else {
      await this.request<void>('/api/pull', 'POST', { name, stream: false });
    }
  }

  /**
   * Push a model to the registry.
   * POST /api/push
   *
   * @example
   * await client.pushModel('mattw/pygmalion:latest', (progress) => {
   *   console.log(progress.status);
   * });
   */
  async pushModel(
    name: string,
    progressCallback?: ProgressCallback,
  ): Promise<void> {
    if (progressCallback) {
      await this.streamingRequest<OllamaPushResponse>(
        '/api/push',
        { name, stream: true },
        (response) => {
          const percentage = response.total
            ? ((response.completed ?? 0) / response.total) * 100
            : undefined;
          progressCallback({
            status: response.status,
            digest: response.digest,
            total: response.total,
            completed: response.completed,
            percentage,
          });
        },
      );
    } else {
      await this.request<void>('/api/push', 'POST', { name, stream: false });
    }
  }

  /**
   * Create a model from a Modelfile.
   * POST /api/create
   *
   * @example
   * // Create model from modelfile
   * await client.createModel({
   *   name: 'my-assistant',
   *   modelfile: 'FROM llama3.2\nSYSTEM You are a helpful assistant.',
   * });
   *
   * // Create model with streaming progress
   * await client.createModel({
   *   name: 'my-coder',
   *   from: 'llama3.2',
   *   system: 'You are an expert programmer.',
   * }, (progress) => {
   *   console.log(`${progress.status}: ${progress.percentage?.toFixed(1)}%`);
   * });
   */
  async createModel(
    request: OllamaCreateRequest,
    progressCallback?: ProgressCallback,
  ): Promise<OllamaCreateResult> {
    if (progressCallback) {
      let finalResult: OllamaCreateResult | null = null;
      await this.streamingRequest<OllamaCreateResponse>(
        '/api/create',
        { ...request, stream: true },
        (response) => {
          const percentage = response.total
            ? ((response.completed ?? 0) / response.total) * 100
            : undefined;
          progressCallback({
            status: response.status,
            digest: response.digest,
            total: response.total,
            completed: response.completed,
            percentage,
          });
          // Check for completion
          if (response.status === 'success' && response.digest) {
            finalResult = {
              name: request.name,
              digest: response.digest,
              created_at: new Date().toISOString(),
              modified_at: new Date().toISOString(),
              size: response.total ?? 0,
            };
          }
        },
      );
      if (!finalResult) {
        // Fallback: get model info after creation
        const modelInfo = await this.showModel(request.name);
        finalResult = {
          name: request.name,
          digest: modelInfo.details?.parent_model ?? '',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          size: 0,
        };
      }
      return finalResult;
    }

    return this.request<OllamaCreateResult>('/api/create', 'POST', {
      ...request,
      stream: false,
    });
  }

  /**
   * Create a model from a base model with custom settings.
   * Convenience method for common use cases.
   *
   * @example
   * const model = await client.createModelFrom('llama3.2', 'my-assistant', {
   *   system: 'You are a helpful coding assistant.',
   *   temperature: 0.7,
   * });
   */
  async createModelFrom(
    baseModel: string,
    newName: string,
    options?: {
      system?: string;
      template?: string;
      parameters?: Record<string, unknown>;
      quantize?: string;
      license?: string;
    },
    progressCallback?: ProgressCallback,
  ): Promise<OllamaCreateResult> {
    // Build modelfile content
    let modelfile = `FROM ${baseModel}\n`;

    if (options?.system) {
      modelfile += `SYSTEM ${options.system}\n`;
    }
    if (options?.template) {
      modelfile += `TEMPLATE ${options.template}\n`;
    }
    if (options?.parameters) {
      for (const [key, value] of Object.entries(options.parameters)) {
        modelfile += `PARAMETER ${key} ${value}\n`;
      }
    }
    if (options?.license) {
      modelfile += `LICENSE ${options.license}\n`;
    }

    return this.createModel(
      {
        name: newName,
        modelfile,
        quantize: options?.quantize,
      },
      progressCallback,
    );
  }

  // ========================================================================
  // Generation API
  // ========================================================================

  /**
   * Generate text from a prompt.
   * POST /api/generate
   *
   * @example
   * // Non-streaming
   * const response = await client.generate({
   *   model: 'llama3.2',
   *   prompt: 'Why is the sky blue?',
   * });
   * console.log(response.response);
   *
   * // Streaming
   * await client.generate({
   *   model: 'llama3.2',
   *   prompt: 'Tell me a story',
   * }, (chunk) => {
   *   process.stdout.write(chunk.response);
   * });
   *
   * // With abort signal
   * const controller = new AbortController();
   * await client.generate({ model: 'llama3.2', prompt: 'Hello' }, undefined, { signal: controller.signal });
   */
  async generate(
    request: OllamaGenerateRequest,
    streamCallback?: StreamCallback<OllamaGenerateResponse>,
    options?: RequestOptions,
  ): Promise<OllamaGenerateResponse> {
    const body = this.applyDefaults(request, options);

    if (streamCallback) {
      let finalResponse: OllamaGenerateResponse | null = null;
      await this.streamingRequest<OllamaGenerateResponse>(
        '/api/generate',
        body,
        (chunk) => {
          streamCallback(chunk);
          if (chunk.done) {
            finalResponse = chunk;
          }
        },
        options?.signal,
      );
      if (!finalResponse) {
        throw new OllamaApiError(
          'Stream ended without final response',
          'STREAM_ERROR',
        );
      }
      return finalResponse;
    }

    return this.request<OllamaGenerateResponse>(
      '/api/generate',
      'POST',
      { ...body, stream: false },
      options?.signal,
      options?.retry,
    );
  }

  /**
   * Chat with a model.
   * POST /api/chat
   *
   * @example
   * const response = await client.chat({
   *   model: 'llama3.2',
   *   messages: [
   *     { role: 'user', content: 'Hello!' }
   *   ],
   * });
   * console.log(response.message.content);
   *
   * // With abort signal
   * const controller = new AbortController();
   * await client.chat({ model: 'llama3.2', messages: [...] }, undefined, { signal: controller.signal });
   */
  async chat(
    request: OllamaChatRequest,
    streamCallback?: StreamCallback<OllamaChatResponse>,
    options?: RequestOptions,
  ): Promise<OllamaChatResponse> {
    const body = this.applyDefaults(request, options);

    if (streamCallback) {
      let finalResponse: OllamaChatResponse | null = null;
      await this.streamingRequest<OllamaChatResponse>(
        '/api/chat',
        body,
        (chunk) => {
          streamCallback(chunk);
          if (chunk.done) {
            finalResponse = chunk;
          }
        },
        options?.signal,
      );
      if (!finalResponse) {
        throw new OllamaApiError(
          'Stream ended without final response',
          'STREAM_ERROR',
        );
      }
      return finalResponse;
    }

    return this.request<OllamaChatResponse>(
      '/api/chat',
      'POST',
      { ...body, stream: false },
      options?.signal,
      options?.retry,
    );
  }

  // ========================================================================
  // Embeddings API
  // ========================================================================

  /**
   * Generate embeddings for text.
   * POST /api/embed
   *
   * @example
   * const response = await client.embed({
   *   model: 'all-minilm',
   *   input: ['Why is the sky blue?', 'Why is the grass green?'],
   * });
   * console.log(response.embeddings);
   */
  async embed(request: OllamaEmbedRequest): Promise<OllamaEmbedResponse> {
    const body = this.applyDefaults(request);
    return this.request<OllamaEmbedResponse>('/api/embed', 'POST', body);
  }

  /**
   * Generate embeddings (legacy endpoint).
   * POST /api/embeddings
   *
   * @example
   * const response = await client.embeddings({
   *   model: 'all-minilm',
   *   prompt: 'Here is an article about llamas...',
   * });
   * console.log(response.embedding);
   */
  async embeddings(
    request: OllamaEmbeddingsRequest,
  ): Promise<OllamaEmbeddingsResponse> {
    const body = this.applyDefaults(request);
    return this.request<OllamaEmbeddingsResponse>(
      '/api/embeddings',
      'POST',
      body,
    );
  }

  // ========================================================================
  // Server API
  // ========================================================================

  /**
   * Get the Ollama version.
   * GET /api/version
   *
   * @example
   * const { version } = await client.getVersion();
   * console.log(`Ollama version: ${version}`);
   */
  async getVersion(): Promise<OllamaVersionResponse> {
    return this.request<OllamaVersionResponse>('/api/version');
  }

  /**
   * List running models.
   * GET /api/ps
   *
   * @example
   * const { models } = await client.listRunningModels();
   * console.log('Running models:', models.map(m => m.name));
   */
  async listRunningModels(): Promise<OllamaPsResponse> {
    return this.request<OllamaPsResponse>('/api/ps');
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Check if Ollama server is running and accessible.
   */
  async isServerRunning(): Promise<boolean> {
    try {
      await this.getVersion();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for the Ollama server to be ready.
   *
   * @param maxAttempts Maximum number of connection attempts
   * @param delayMs Delay between attempts in milliseconds
   */
  async waitForServer(
    maxAttempts: number = 30,
    delayMs: number = 1000,
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      if (await this.isServerRunning()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return false;
  }

  /**
   * Check if a model is available locally.
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const { models } = await this.listModels();
      return models.some(
        (m) => m.name === modelName || m.name.startsWith(`${modelName}:`),
      );
    } catch {
      return false;
    }
  }

  /**
   * Ensure a model is available (pull if necessary).
   */
  async ensureModelAvailable(
    modelName: string,
    progressCallback?: ProgressCallback,
  ): Promise<void> {
    if (!(await this.isModelAvailable(modelName))) {
      await this.pullModel(modelName, progressCallback);
    }
  }

  /**
   * Unload a model from memory.
   * Uses keep_alive=0 to immediately unload.
   *
   * @example
   * await client.unloadModel('llama3.2');
   */
  async unloadModel(modelName: string): Promise<void> {
    await this.generate({
      model: modelName,
      prompt: '',
      keep_alive: 0,
    });
  }

  /**
   * Keep a model loaded in memory.
   *
   * @example
   * await client.keepModelLoaded('llama3.2', '10m');
   */
  async keepModelLoaded(
    modelName: string,
    duration: string | number = '10m',
  ): Promise<void> {
    await this.generate({
      model: modelName,
      prompt: '',
      keep_alive: duration,
    });
  }

  /**
   * Check if a model supports function calling (tools).
   * This checks the model's capabilities from /api/show response,
   * and falls back to model handler patterns.
   *
   * @param modelName The model name to check
   * @returns true if the model supports tools
   *
   * @example
   * const supportsTools = await client.supportsTools('llama3.2');
   * if (!supportsTools) {
   *   console.log('This model does not support function calling');
   * }
   */
  async supportsTools(modelName: string): Promise<boolean> {
    try {
      const info = await this.showModel(modelName);

      // Check capabilities array (newer Ollama versions)
      if (info.capabilities?.includes('tools')) {
        return true;
      }

      // Check model_info for general.capabilities (alternative location)
      if (info.model_info) {
        const capabilities = info.model_info['general.capabilities'];
        if (Array.isArray(capabilities) && capabilities.includes('tools')) {
          return true;
        }
      }

      // Fall back to model handler patterns
      // Import dynamically to avoid circular dependency
      const { getModelHandlerFactory } = await import(
        '../model-handlers/index.js'
      );
      const factory = getModelHandlerFactory();
      const handlerSupport = factory.supportsTools(modelName);

      if (handlerSupport) {
        debugLog('info', 'Model supports tools by handler pattern', {
          modelName,
        });
        return true;
      }

      return false;
    } catch (error) {
      debugLog(
        'warn',
        'Could not determine tool support, checking handler patterns',
        {
          modelName,
          error: error instanceof Error ? error.message : String(error),
        },
      );

      // Fall back to model handler patterns on error
      try {
        const { getModelHandlerFactory } = await import(
          '../model-handlers/index.js'
        );
        const factory = getModelHandlerFactory();
        return factory.supportsTools(modelName);
      } catch {
        // If all else fails, assume true - let the model try to use tools
        return true;
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an Ollama native API client.
 *
 * @example
 * const client = createOllamaClient();
 * const models = await client.listModels();
 */
export function createOllamaNativeClient(
  options?: OllamaClientOptions,
): OllamaNativeClient {
  return new OllamaNativeClient(options);
}
