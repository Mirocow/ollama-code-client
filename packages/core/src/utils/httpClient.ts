/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * HTTP Client based on Axios with interceptors, retry logic, and timeout handling.
 * This module provides a centralized HTTP client for all API calls in the project.
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  AxiosError,
} from 'axios';
import { createDebugLogger } from './debugLogger.js';

const debugLogger = createDebugLogger('HTTP_CLIENT');

/**
 * Configuration options for HTTP client
 */
export interface HttpClientConfig {
  /** Base URL for all requests */
  baseURL?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Delay between retries in milliseconds (exponential backoff) */
  retryDelay?: number;
  /** API key for authentication */
  apiKey?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Extended request config with retry metadata
 */
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Status codes that should trigger a retry
 */
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Create a configured Axios instance with interceptors
 */
export function createHttpClient(config: HttpClientConfig = {}): AxiosInstance {
  const {
    baseURL,
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    apiKey,
    headers = {},
    debug = false,
  } = config;

  const instance = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });

  // Request interceptor for logging and modification
  instance.interceptors.request.use(
    (requestConfig: InternalAxiosRequestConfig) => {
      if (debug) {
        debugLogger.debug(`[REQUEST] ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`, {
          headers: requestConfig.headers,
          data: requestConfig.data,
        });
      }
      return requestConfig;
    },
    (error) => {
      if (debug) {
        debugLogger.debug('[REQUEST ERROR]', error.message);
      }
      return Promise.reject(error);
    }
  );

  // Response interceptor for logging and error handling
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      if (debug) {
        debugLogger.debug(`[RESPONSE] ${response.status} ${response.config.url}`, {
          data: response.data,
        });
      }
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as RetryableRequestConfig | undefined;

      if (debug) {
        debugLogger.debug(`[RESPONSE ERROR] ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
      }

      // Check if we should retry
      if (config && shouldRetry(error, config, maxRetries)) {
        config._retryCount = (config._retryCount || 0) + 1;

        const delay = calculateRetryDelay(
          retryDelay,
          config._retryCount,
          error.response?.headers['retry-after']
        );

        if (debug) {
          debugLogger.debug(
            `[RETRY] Attempt ${config._retryCount}/${maxRetries} after ${delay}ms`
          );
        }

        await sleep(delay);
        return instance.request(config);
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * Check if a request should be retried
 */
export function shouldRetry(
  error: AxiosError,
  config: RetryableRequestConfig,
  maxRetries: number
): boolean {
  // Don't retry if max retries exceeded
  if ((config._retryCount || 0) >= maxRetries) {
    return false;
  }

  // Retry on network errors (no response)
  if (!error.response) {
    return true;
  }

  // Retry on specific status codes
  return RETRYABLE_STATUS_CODES.includes(error.response.status);
}

/**
 * Calculate delay for retry with exponential backoff
 */
export function calculateRetryDelay(
  baseDelay: number,
  retryCount: number,
  retryAfter?: string | number
): number {
  // Use Retry-After header if present
  if (retryAfter) {
    const retryAfterMs =
      typeof retryAfter === 'string'
        ? parseInt(retryAfter, 10) * 1000
        : retryAfter * 1000;
    return Math.max(retryAfterMs, baseDelay);
  }

  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, retryCount - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default HTTP client instance for Ollama API
 */
let defaultClient: AxiosInstance | null = null;

/**
 * Get or create the default HTTP client
 */
export function getDefaultHttpClient(baseURL?: string, apiKey?: string): AxiosInstance {
  if (!defaultClient || baseURL || apiKey) {
    defaultClient = createHttpClient({
      baseURL: baseURL || process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434',
      apiKey: apiKey || process.env['OLLAMA_API_KEY'],
      debug: process.env['DEBUG'] === '1' || process.env['DEBUG'] === 'true',
    });
  }
  return defaultClient;
}

/**
 * Reset the default HTTP client (useful for testing)
 */
export function resetDefaultHttpClient(): void {
  defaultClient = null;
}

/**
 * Streaming adapter for Axios (for SSE/NDJSON responses)
 */
export async function* streamResponse(
  response: AxiosResponse,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const contentType = response.headers['content-type'] || '';

  // Handle NDJSON (newline-delimited JSON)
  if (contentType.includes('application/x-ndjson') || contentType.includes('application/jsonl')) {
    const data = response.data;
    if (typeof data === 'string') {
      const lines = data.split('\n').filter((line: string) => line.trim());
      for (const line of lines) {
        if (signal?.aborted) break;
        yield line;
      }
    }
    return;
  }

  // Handle regular response
  yield JSON.stringify(response.data);
}

/**
 * Convert Axios response to fetch-like Response object
 * (for backward compatibility with existing code)
 */
export function toFetchLikeResponse(response: AxiosResponse): Response {
  return new Response(JSON.stringify(response.data), {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(
      Object.entries(response.headers)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]) as Array<[string, string]>
    ),
  });
}

// Export types
export { AxiosError, type AxiosInstance, type AxiosResponse, type AxiosRequestConfig };


