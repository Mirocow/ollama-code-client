/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Chunk Validator
 * Validates streaming chunks for integrity, format, and content.
 * Supports multiple chunk formats (Ollama, OpenAI, etc.)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Base chunk interface for streaming responses
 */
export interface BaseChunk {
  /** Model identifier */
  model?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Whether this is the final chunk */
  done?: boolean;
  /** Reason for completion */
  done_reason?: 'stop' | 'length' | 'load' | 'error';
}

/**
 * Ollama chat chunk format
 */
export interface OllamaChatChunk extends BaseChunk {
  message?: {
    role?: string;
    content?: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
    thinking?: string;
  };
  error?: string;
}

/**
 * Ollama generate chunk format
 */
export interface OllamaGenerateChunk extends BaseChunk {
  response?: string;
  context?: number[];
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  error?: string;
}

/**
 * Generic chunk type
 */
export type StreamChunk =
  | OllamaChatChunk
  | OllamaGenerateChunk
  | Record<string, unknown>;

/**
 * Validated chunk wrapper
 */
export interface ValidatedChunk<T = StreamChunk> {
  /** Original chunk data */
  data: T;
  /** Validation timestamp */
  validatedAt: number;
  /** Chunk sequence number */
  sequenceNumber: number;
  /** Validation status */
  isValid: boolean;
  /** Validation errors if any */
  errors: ChunkValidationError[];
  /** Warnings (non-fatal issues) */
  warnings: string[];
  /** Chunk size in bytes */
  size: number;
  /** Processing time in ms */
  processingTime: number;
}

/**
 * Result of chunk validation
 */
export interface ChunkValidationResult<T = StreamChunk> {
  /** Whether validation passed */
  valid: boolean;
  /** Validated chunk if successful */
  chunk?: ValidatedChunk<T>;
  /** Errors if validation failed */
  errors: ChunkValidationError[];
  /** Warnings (non-fatal issues) */
  warnings: string[];
}

/**
 * Configuration for chunk validation
 */
export interface ChunkValidationConfig {
  /** Maximum chunk size in bytes (default: 1MB) */
  maxChunkSize: number;
  /** Minimum chunk size in bytes (default: 1) */
  minChunkSize: number;
  /** Whether to validate JSON structure */
  validateJson: boolean;
  /** Whether to validate required fields */
  validateRequiredFields: boolean;
  /** Required fields for different chunk types */
  requiredFields: {
    chat: string[];
    generate: string[];
    embedding: string[];
  };
  /** Maximum allowed sequence gap */
  maxSequenceGap: number;
  /** Whether to validate timestamps */
  validateTimestamps: boolean;
  /** Maximum age of chunks in ms (for timestamp validation) */
  maxChunkAge: number;
  /** Whether to validate model consistency */
  validateModelConsistency: boolean;
  /** Whether to detect and handle errors in chunks */
  detectChunkErrors: boolean;
  /** Custom validation functions */
  customValidators: Array<(chunk: StreamChunk) => ChunkValidationError | null>;
  /** Whether to accumulate partial chunks */
  allowPartialChunks: boolean;
  /** Maximum number of validation errors before aborting */
  maxValidationErrors: number;
}

/**
 * Chunk validation error
 */
export class ChunkValidationError extends Error {
  readonly code: ChunkValidationErrorCode;
  readonly chunk?: StreamChunk;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ChunkValidationErrorCode,
    chunk?: StreamChunk,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ChunkValidationError';
    this.code = code;
    this.chunk = chunk;
    this.details = details;
  }
}

/**
 * Validation error codes
 */
export type ChunkValidationErrorCode =
  | 'INVALID_JSON'
  | 'CHUNK_TOO_LARGE'
  | 'CHUNK_TOO_SMALL'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FIELD_TYPE'
  | 'INVALID_FIELD_VALUE'
  | 'TIMESTAMP_TOO_OLD'
  | 'TIMESTAMP_IN_FUTURE'
  | 'MODEL_MISMATCH'
  | 'SEQUENCE_GAP'
  | 'CHUNK_ERROR'
  | 'CUSTOM_VALIDATION_FAILED'
  | 'ENCODING_ERROR'
  | 'SCHEMA_VIOLATION';

// ============================================================================
// Chunk Validator Implementation
// ============================================================================

/**
 * Default validation configuration
 */
const DEFAULT_CONFIG: ChunkValidationConfig = {
  maxChunkSize: 1024 * 1024, // 1MB
  minChunkSize: 1,
  validateJson: true,
  validateRequiredFields: true,
  requiredFields: {
    chat: [],
    generate: [],
    embedding: ['embedding'],
  },
  maxSequenceGap: 10,
  validateTimestamps: true,
  maxChunkAge: 300000, // 5 minutes
  validateModelConsistency: true,
  detectChunkErrors: true,
  customValidators: [],
  allowPartialChunks: true,
  maxValidationErrors: 100,
};

/**
 * Chunk Validator
 *
 * Validates streaming chunks for integrity and format compliance.
 * Supports multiple chunk formats and custom validation rules.
 *
 * @example
 * const validator = new ChunkValidator({
 *   validateJson: true,
 *   detectChunkErrors: true,
 * });
 *
 * const result = validator.validate(chunk);
 * if (result.valid) {
 *   processChunk(result.chunk);
 * } else {
 *   handleErrors(result.errors);
 * }
 */
export class ChunkValidator<T = StreamChunk> {
  private config: ChunkValidationConfig;
  private sequenceNumber = 0;
  private lastModel?: string;
  private errorCount = 0;
  private lastTimestamp?: number;

  constructor(config: Partial<ChunkValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate a chunk
   */
  validate(rawData: unknown, rawSize?: number): ChunkValidationResult<T> {
    const startTime = Date.now();
    const errors: ChunkValidationError[] = [];
    const warnings: string[] = [];

    // Calculate size
    const size =
      rawSize ??
      (typeof rawData === 'string'
        ? rawData.length
        : JSON.stringify(rawData).length);

    // Size validation
    if (size > this.config.maxChunkSize) {
      errors.push(
        new ChunkValidationError(
          `Chunk size ${size} exceeds maximum ${this.config.maxChunkSize}`,
          'CHUNK_TOO_LARGE',
          rawData as StreamChunk,
          { size, maxSize: this.config.maxChunkSize },
        ),
      );
    }

    if (size < this.config.minChunkSize) {
      errors.push(
        new ChunkValidationError(
          `Chunk size ${size} below minimum ${this.config.minChunkSize}`,
          'CHUNK_TOO_SMALL',
          rawData as StreamChunk,
          { size, minSize: this.config.minChunkSize },
        ),
      );
    }

    // JSON validation
    let parsedData: T;
    if (this.config.validateJson) {
      try {
        if (typeof rawData === 'string') {
          parsedData = JSON.parse(rawData) as T;
        } else if (typeof rawData === 'object' && rawData !== null) {
          parsedData = rawData as T;
        } else {
          throw new Error('Invalid data type');
        }
      } catch (e) {
        errors.push(
          new ChunkValidationError(
            `Failed to parse chunk: ${e instanceof Error ? e.message : String(e)}`,
            'INVALID_JSON',
            rawData as StreamChunk,
          ),
        );
        this.incrementErrorCount();
        return { valid: false, errors, warnings };
      }
    } else {
      parsedData = rawData as T;
    }

    // Detect errors in chunk
    if (this.config.detectChunkErrors) {
      const chunkError = this.detectError(parsedData);
      if (chunkError) {
        errors.push(chunkError);
        this.incrementErrorCount();
      }
    }

    // Timestamp validation
    if (this.config.validateTimestamps) {
      const timestampError = this.validateTimestamp(parsedData);
      if (timestampError) {
        warnings.push(timestampError.message);
      }
    }

    // Model consistency validation
    if (this.config.validateModelConsistency) {
      const modelError = this.validateModel(parsedData);
      if (modelError) {
        warnings.push(modelError.message);
      }
    }

    // Required fields validation
    if (this.config.validateRequiredFields) {
      const fieldErrors = this.validateRequiredFields(parsedData);
      errors.push(...fieldErrors);
    }

    // Custom validators
    for (const validator of this.config.customValidators) {
      const customError = validator(parsedData as StreamChunk);
      if (customError) {
        errors.push(customError);
      }
    }

    // Check error threshold
    if (errors.length > 0) {
      this.incrementErrorCount();
    }

    const processingTime = Date.now() - startTime;
    this.sequenceNumber++;

    // Build validated chunk
    const validatedChunk: ValidatedChunk<T> = {
      data: parsedData,
      validatedAt: Date.now(),
      sequenceNumber: this.sequenceNumber,
      isValid: errors.length === 0,
      errors,
      warnings,
      size,
      processingTime,
    };

    return {
      valid: errors.length === 0,
      chunk: validatedChunk,
      errors,
      warnings,
    };
  }

  /**
   * Validate a batch of chunks
   */
  validateBatch(chunks: unknown[]): Array<ChunkValidationResult<T>> {
    return chunks.map((chunk) => this.validate(chunk));
  }

  /**
   * Reset validator state
   */
  reset(): void {
    this.sequenceNumber = 0;
    this.lastModel = undefined;
    this.errorCount = 0;
    this.lastTimestamp = undefined;
  }

  /**
   * Get validation statistics
   */
  getStats(): {
    totalChunks: number;
    errorCount: number;
    lastModel?: string;
    lastTimestamp?: number;
  } {
    return {
      totalChunks: this.sequenceNumber,
      errorCount: this.errorCount,
      lastModel: this.lastModel,
      lastTimestamp: this.lastTimestamp,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ChunkValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private incrementErrorCount(): void {
    this.errorCount++;
    if (this.errorCount >= this.config.maxValidationErrors) {
      throw new ChunkValidationError(
        `Maximum validation errors (${this.config.maxValidationErrors}) exceeded`,
        'CUSTOM_VALIDATION_FAILED',
      );
    }
  }

  private detectError(data: T): ChunkValidationError | null {
    const chunk = data as Record<string, unknown>;

    // Check for error field in chunk
    if (chunk['error']) {
      return new ChunkValidationError(
        `Chunk contains error: ${chunk['error']}`,
        'CHUNK_ERROR',
        chunk as StreamChunk,
        { error: chunk['error'] },
      );
    }

    // Check for done_reason = 'error'
    if (chunk['done_reason'] === 'error') {
      return new ChunkValidationError(
        'Chunk indicates stream ended with error',
        'CHUNK_ERROR',
        chunk as StreamChunk,
        { done_reason: 'error' },
      );
    }

    return null;
  }

  private validateTimestamp(data: T): ChunkValidationError | null {
    const chunk = data as Record<string, unknown>;
    const timestamp = chunk['created_at'];

    if (!timestamp) {
      return null;
    }

    let timestampMs: number;
    if (typeof timestamp === 'string') {
      timestampMs = new Date(timestamp).getTime();
    } else if (typeof timestamp === 'number') {
      timestampMs = timestamp;
    } else {
      return null;
    }

    const now = Date.now();
    this.lastTimestamp = timestampMs;

    // Check for future timestamp
    if (timestampMs > now + 60000) {
      // 1 minute tolerance
      return new ChunkValidationError(
        'Chunk timestamp is in the future',
        'TIMESTAMP_IN_FUTURE',
        chunk as StreamChunk,
        { timestamp: timestampMs, now },
      );
    }

    // Check for old timestamp
    if (timestampMs < now - this.config.maxChunkAge) {
      return new ChunkValidationError(
        `Chunk timestamp is too old (age: ${now - timestampMs}ms)`,
        'TIMESTAMP_TOO_OLD',
        chunk as StreamChunk,
        { timestamp: timestampMs, maxAge: this.config.maxChunkAge },
      );
    }

    return null;
  }

  private validateModel(data: T): ChunkValidationError | null {
    const chunk = data as Record<string, unknown>;
    const model = chunk['model'] as string | undefined;

    if (!model) {
      return null;
    }

    if (this.lastModel && model !== this.lastModel) {
      return new ChunkValidationError(
        `Model changed from ${this.lastModel} to ${model}`,
        'MODEL_MISMATCH',
        chunk as StreamChunk,
        { previousModel: this.lastModel, currentModel: model },
      );
    }

    this.lastModel = model;
    return null;
  }

  private validateRequiredFields(data: T): ChunkValidationError[] {
    const errors: ChunkValidationError[] = [];
    const chunk = data as Record<string, unknown>;

    // Determine chunk type
    const isChat = 'message' in chunk;
    const isGenerate = 'response' in chunk;

    if (isChat) {
      const required = this.config.requiredFields.chat;
      for (const field of required) {
        if (!(field in chunk)) {
          errors.push(
            new ChunkValidationError(
              `Missing required field: ${field}`,
              'MISSING_REQUIRED_FIELD',
              chunk as StreamChunk,
              { field },
            ),
          );
        }
      }
    } else if (isGenerate) {
      const required = this.config.requiredFields.generate;
      for (const field of required) {
        if (!(field in chunk)) {
          errors.push(
            new ChunkValidationError(
              `Missing required field: ${field}`,
              'MISSING_REQUIRED_FIELD',
              chunk as StreamChunk,
              { field },
            ),
          );
        }
      }
    }

    return errors;
  }
}

export default ChunkValidator;
