/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Custom error classes for Ollama API operations.
 * Provides structured error handling with detailed error information.
 */

/**
 * Base error class for all Ollama API errors.
 */
export class OllamaApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'OllamaApiError';
  }

  /**
   * Returns a formatted string representation of the error.
   */
  override toString(): string {
    let result = `${this.name} [${this.code}]`;
    if (this.statusCode) {
      result += ` (HTTP ${this.statusCode})`;
    }
    result += `: ${this.message}`;
    if (this.details) {
      result += `\nDetails: ${JSON.stringify(this.details, null, 2)}`;
    }
    return result;
  }

  /**
   * Returns a JSON representation of the error.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Error thrown when connection to Ollama server fails.
 */
export class OllamaConnectionError extends OllamaApiError {
  override readonly cause?: Error;

  constructor(
    message: string = 'Failed to connect to Ollama server',
    cause?: Error,
  ) {
    super(message, 'CONNECTION_ERROR', undefined, { cause: cause?.message });
    this.name = 'OllamaConnectionError';
    this.cause = cause;
  }
}

/**
 * Error thrown when a model is not found.
 */
export class OllamaModelNotFoundError extends OllamaApiError {
  constructor(modelName: string) {
    super(
      `Model '${modelName}' not found. Make sure the model is installed.`,
      'MODEL_NOT_FOUND',
      404,
      { modelName },
    );
    this.name = 'OllamaModelNotFoundError';
  }
}

/**
 * Error thrown when model loading fails.
 */
export class OllamaModelLoadError extends OllamaApiError {
  constructor(modelName: string, reason?: string) {
    super(
      `Failed to load model '${modelName}'${reason ? `: ${reason}` : ''}`,
      'MODEL_LOAD_ERROR',
      undefined,
      { modelName, reason },
    );
    this.name = 'OllamaModelLoadError';
  }
}

/**
 * Error thrown when generation fails.
 */
export class OllamaGenerationError extends OllamaApiError {
  constructor(
    message: string = 'Generation failed',
    readonly partialResponse?: string,
  ) {
    super(message, 'GENERATION_ERROR', undefined, { partialResponse });
    this.name = 'OllamaGenerationError';
  }
}

/**
 * Error thrown when the request times out.
 */
export class OllamaTimeoutError extends OllamaApiError {
  constructor(timeoutMs: number) {
    super(
      `Request timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR',
      undefined,
      { timeoutMs },
    );
    this.name = 'OllamaTimeoutError';
  }
}

/**
 * Error thrown when the request is aborted.
 */
export class OllamaAbortError extends OllamaApiError {
  constructor(reason?: string) {
    super(
      `Request was aborted${reason ? `: ${reason}` : ''}`,
      'ABORT_ERROR',
      undefined,
      { reason },
    );
    this.name = 'OllamaAbortError';
  }
}

/**
 * Error thrown when Ollama returns an invalid response.
 */
export class OllamaInvalidResponseError extends OllamaApiError {
  constructor(
    message: string = 'Invalid response from Ollama server',
    readonly rawData?: unknown,
  ) {
    super(message, 'INVALID_RESPONSE', undefined, { rawData });
    this.name = 'OllamaInvalidResponseError';
  }
}

/**
 * Error thrown when authentication fails.
 */
export class OllamaAuthenticationError extends OllamaApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'OllamaAuthenticationError';
  }
}

/**
 * Error thrown when a streaming error occurs.
 */
export class OllamaStreamingError extends OllamaApiError {
  constructor(
    message: string = 'Streaming error',
    readonly lastValidChunk?: unknown,
  ) {
    super(message, 'STREAMING_ERROR', undefined, { lastValidChunk });
    this.name = 'OllamaStreamingError';
  }
}

/**
 * Error thrown when context length is exceeded.
 */
export class OllamaContextLengthError extends OllamaApiError {
  constructor(
    readonly tokenCount: number,
    readonly maxTokens: number,
  ) {
    super(
      `Context length exceeded: ${tokenCount} tokens > ${maxTokens} max tokens`,
      'CONTEXT_LENGTH_EXCEEDED',
      400,
      { tokenCount, maxTokens },
    );
    this.name = 'OllamaContextLengthError';
  }
}

/**
 * Error thrown when GPU/memory resources are insufficient.
 */
export class OllamaResourceError extends OllamaApiError {
  constructor(
    message: string = 'Insufficient GPU/memory resources',
    readonly requiredMemory?: number,
    readonly availableMemory?: number,
  ) {
    super(message, 'RESOURCE_ERROR', undefined, {
      requiredMemory,
      availableMemory,
    });
    this.name = 'OllamaResourceError';
  }
}

// ============================================================================
// Error Detection Utilities
// ============================================================================

/**
 * Error patterns for detecting specific error types from Ollama responses.
 */
const ERROR_PATTERNS = {
  modelNotFound: /model ".*" not found|model .* does not exist|model .* not found|\bnot found\b.*model/i,
  contextLength: /context length|token limit|maximum context/i,
  memory: /out of memory|OOM|CUDA out of memory|GPU memory/i,
  connection: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network|connection refused/i,
  abort: /abort|cancel|ABORT_ERR/i,
  timeout: /timeout|ETIMEDOUT/i,
  load: /loading model|failed to load|error loading/i,
} as const;

/**
 * Detects the type of error from an error message or error object.
 */
export function detectOllamaError(
  error: unknown,
  context?: { modelName?: string; timeoutMs?: number },
): OllamaApiError {
  // Already an OllamaApiError
  if (error instanceof OllamaApiError) {
    return error;
  }

  // AbortError
  if (isAbortError(error)) {
    return new OllamaAbortError();
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Model not found
  if (ERROR_PATTERNS.modelNotFound.test(errorMessage)) {
    return new OllamaModelNotFoundError(context?.modelName ?? 'unknown');
  }

  // Context length exceeded
  if (ERROR_PATTERNS.contextLength.test(errorMessage)) {
    return new OllamaContextLengthError(0, 0);
  }

  // Memory/GPU resources
  if (ERROR_PATTERNS.memory.test(errorMessage)) {
    return new OllamaResourceError(errorMessage);
  }

  // Connection error
  if (ERROR_PATTERNS.connection.test(errorMessage)) {
    return new OllamaConnectionError(errorMessage, error instanceof Error ? error : undefined);
  }

  // Timeout
  if (ERROR_PATTERNS.timeout.test(errorMessage) || (context?.timeoutMs && errorMessage.includes('abort'))) {
    return new OllamaTimeoutError(context?.timeoutMs ?? 0);
  }

  // Model load error
  if (ERROR_PATTERNS.load.test(errorMessage)) {
    return new OllamaModelLoadError(context?.modelName ?? 'unknown', errorMessage);
  }

  // Default: wrap as generic API error
  return new OllamaApiError(
    errorMessage,
    'UNKNOWN_ERROR',
    undefined,
    { originalError: error },
  );
}

/**
 * Check if the error is an abort error.
 */
function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  const nodeError = error as NodeJS.ErrnoException;
  return nodeError.code === 'ABORT_ERR';
}

/**
 * Wraps an error with additional context.
 */
export function wrapOllamaError(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>,
): OllamaApiError {
  if (error instanceof OllamaApiError) {
    return error;
  }

  const ollamaError = detectOllamaError(error);
  const message = `${operation}: ${ollamaError.message}`;

  const combinedDetails = { ...(ollamaError.details ?? {}), ...context, operation };
  return new OllamaApiError(
    message,
    ollamaError.code,
    ollamaError.statusCode,
    combinedDetails,
  );
}

/**
 * Get a user-friendly error message.
 */
export function getFriendlyOllamaErrorMessage(error: unknown): string {
  if (error instanceof OllamaModelNotFoundError) {
    return `Model not found. Run 'ollama pull <model-name>' to download the model.`;
  }

  if (error instanceof OllamaConnectionError) {
    return `Cannot connect to Ollama server. Make sure Ollama is running (ollama serve)`;
  }

  if (error instanceof OllamaTimeoutError) {
    return `Request timed out. Try using a smaller model or reducing the context length.`;
  }

  if (error instanceof OllamaContextLengthError) {
    return `The conversation is too long. Try starting a new conversation or using a model with a larger context window.`;
  }

  if (error instanceof OllamaResourceError) {
    return `Not enough GPU memory. Try using a smaller quantization or closing other GPU-intensive applications.`;
  }

  if (error instanceof OllamaAbortError) {
    return `The request was cancelled.`;
  }

  if (error instanceof OllamaApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}
