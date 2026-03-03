/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Streaming Controller
 * Combines chunk validation, backpressure handling, and cancellation
 * into a unified streaming management system.
 */

import { ChunkValidator, type ValidatedChunk, type ChunkValidationConfig } from './chunkValidator.js';
import { BackpressureController, type BackpressureConfig, type PressureState } from './backpressureController.js';
import type { CancellationToken} from './cancellation.js';
import { CancellationTokenSource, type CancellationTokenConfig, CancellationError } from './cancellation.js';
import { StreamBuffer, type BufferConfig } from './streamBuffer.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Streaming state enumeration
 */
export type StreamingState = 'idle' | 'connecting' | 'streaming' | 'paused' | 'completed' | 'error' | 'cancelled';

/**
 * Stream event types
 */
export type StreamEventType =
  | 'started'
  | 'chunk'
  | 'validation_error'
  | 'pressure_change'
  | 'state_change'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'timeout'
  | 'retry';

/**
 * Stream event
 */
export interface StreamEvent<T = unknown> {
  type: StreamEventType;
  timestamp: number;
  data?: T;
  error?: Error;
  state: StreamingState;
  metadata?: Record<string, unknown>;
}

/**
 * Stream event listener
 */
export type StreamEventListener<T = unknown> = (event: StreamEvent<T>) => void;

/**
 * Streaming configuration
 */
export interface StreamingConfig {
  /** Chunk validation config */
  validation: Partial<ChunkValidationConfig>;
  /** Backpressure config */
  backpressure: Partial<BackpressureConfig>;
  /** Buffer config */
  buffer: Partial<BufferConfig>;
  /** Cancellation config */
  cancellation: Partial<CancellationTokenConfig>;
  /** Auto-start streaming */
  autoStart: boolean;
  /** Maximum retries on error */
  maxRetries: number;
  /** Delay between retries (ms) */
  retryDelayMs: number;
  /** Exponential backoff for retries */
  retryBackoff: boolean;
  /** Enable automatic chunk aggregation */
  aggregateChunks: boolean;
  /** Maximum chunks to aggregate */
  maxAggregationSize: number;
  /** Event listeners */
  listeners: StreamEventListener[];
  /** Enable performance monitoring */
  enableMetrics: boolean;
  /** Metrics collection interval (ms) */
  metricsInterval: number;
}

/**
 * Streaming statistics
 */
export interface StreamingStats {
  /** Current state */
  state: StreamingState;
  /** Total chunks received */
  totalChunks: number;
  /** Total chunks validated successfully */
  validChunks: number;
  /** Total chunks with validation errors */
  invalidChunks: number;
  /** Total bytes processed */
  totalBytes: number;
  /** Average chunk size */
  averageChunkSize: number;
  /** Total processing time (ms) */
  totalProcessingTime: number;
  /** Average processing time per chunk (ms) */
  averageProcessingTime: number;
  /** Stream duration (ms) */
  duration: number;
  /** Current throughput (chunks/second) */
  throughput: number;
  /** Peak throughput */
  peakThroughput: number;
  /** Current pressure state */
  pressureState: PressureState;
  /** Number of retries */
  retries: number;
  /** Number of errors */
  errors: number;
  /** Buffer utilization (0-1) */
  bufferUtilization: number;
  /** Backpressure statistics */
  backpressure: ReturnType<BackpressureController['getStats']>;
  /** Start timestamp */
  startedAt?: number;
  /** End timestamp */
  endedAt?: number;
}

// ============================================================================
// Streaming Controller Implementation
// ============================================================================

/**
 * Default configuration
 */
const DEFAULT_CONFIG: StreamingConfig = {
  validation: {},
  backpressure: {},
  buffer: {},
  cancellation: {},
  autoStart: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  retryBackoff: true,
  aggregateChunks: false,
  maxAggregationSize: 10,
  listeners: [],
  enableMetrics: true,
  metricsInterval: 1000,
};

/**
 * Streaming Controller
 *
 * Unified streaming management with validation, backpressure,
 * and cancellation support.
 *
 * @example
 * const controller = new StreamingController({
 *   validation: { validateJson: true },
 *   backpressure: { maxBufferSize: 5 * 1024 * 1024 },
 * });
 *
 * controller.on('chunk', (event) => processChunk(event.data));
 * controller.on('error', (event) => handleError(event.error));
 *
 * await controller.start(async (emit) => {
 *   for await (const chunk of stream) {
 *     emit(chunk);
 *   }
 * });
 */
export class StreamingController<T = unknown> {
  private config: StreamingConfig;
  private validator: ChunkValidator<T>;
  private backpressure: BackpressureController<ValidatedChunk<T>>;
  private buffer: StreamBuffer<T>;
  private cancellationTokenSource: CancellationTokenSource;
  private state: StreamingState = 'idle';
  private stats: StreamingStats;
  private listeners: Map<StreamEventType, Set<StreamEventListener<T>>> = new Map();
  private startTime?: number;
  private endTime?: number;
  private throughputHistory: number[] = [];
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: Partial<StreamingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.validator = new ChunkValidator<T>(this.config.validation);
    this.backpressure = new BackpressureController<ValidatedChunk<T>>(
      this.config.backpressure,
    );
    this.buffer = new StreamBuffer<T>(this.config.buffer);
    this.cancellationTokenSource = new CancellationTokenSource(
      this.config.cancellation,
    );

    this.stats = this.createInitialStats();

    // Register event listeners from config
    for (const listener of this.config.listeners) {
      this.addEventListener(listener);
    }
  }

  /**
   * Get the cancellation token
   */
  get token(): CancellationToken {
    return this.cancellationTokenSource.token;
  }

  /**
   * Get current state
   */
  getState(): StreamingState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): StreamingStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Add event listener
   */
  addEventListener(listener: StreamEventListener<T>): void {
    // Add to all event types
    const types: StreamEventType[] = [
      'started',
      'chunk',
      'validation_error',
      'pressure_change',
      'state_change',
      'completed',
      'error',
      'cancelled',
      'timeout',
      'retry',
    ];

    for (const type of types) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type)!.add(listener);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: StreamEventListener<T>): void {
    for (const listeners of this.listeners.values()) {
      listeners.delete(listener);
    }
  }

  /**
   * Add listener for specific event type
   */
  on(type: StreamEventType, listener: StreamEventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  /**
   * Start streaming from an async generator
   */
  async start(
    source: (emit: (chunk: T) => Promise<void>) => Promise<void>,
  ): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start: current state is ${this.state}`);
    }

    this.setState('connecting');
    this.startTime = Date.now();
    this.stats.startedAt = this.startTime;

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    let retries = 0;

    while (retries <= this.config.maxRetries) {
      try {
        this.setState('streaming');
        this.emit('started', {});

        await source(async (chunk: T) => {
          await this.processChunk(chunk);
        });

        this.setState('completed');
        this.endTime = Date.now();
        this.stats.endedAt = this.endTime;
        this.emit('completed', {});
        return;
      } catch (error) {
        if (error instanceof CancellationError) {
          this.setState('cancelled');
          this.emit('cancelled', { error });
          return;
        }

        retries++;
        this.stats.retries = retries;

        if (retries > this.config.maxRetries) {
          this.setState('error');
          this.endTime = Date.now();
          this.stats.endedAt = this.endTime;
          this.stats.errors++;
          this.emit('error', { error: error as Error });
          throw error;
        }

        this.emit('retry', {
          error: error as Error,
          metadata: { attempt: retries },
        });

        const delay = this.config.retryBackoff
          ? this.config.retryDelayMs * Math.pow(2, retries - 1)
          : this.config.retryDelayMs;

        await this.sleep(delay);
      }
    }
  }

  /**
   * Process a streaming async iterable
   */
  async processStream(stream: AsyncIterable<T>): Promise<void> {
    await this.start(async (emit) => {
      for await (const chunk of stream) {
        if (this.token.isCancellationRequested) {
          break;
        }
        await emit(chunk);
      }
    });
  }

  /**
   * Get chunks from buffer (async iterator)
   */
  async *getChunks(): AsyncGenerator<ValidatedChunk<T>> {
    while (this.state === 'streaming' || !this.backpressure.isEmpty()) {
      if (this.token.isCancellationRequested) {
        break;
      }

      const chunk = await this.backpressure.dequeue();
      if (chunk) {
        yield chunk;
      } else if (this.state !== 'streaming') {
        break;
      }
    }
  }

  /**
   * Cancel the stream
   */
  cancel(reason?: string): void {
    this.cancellationTokenSource.cancel(reason);
  }

  /**
   * Pause the stream
   */
  pause(): void {
    if (this.state === 'streaming') {
      this.setState('paused');
      this.backpressure.pause();
    }
  }

  /**
   * Resume the stream
   */
  resume(): void {
    if (this.state === 'paused') {
      this.setState('streaming');
      this.backpressure.resume();
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopMetricsCollection();
    this.cancellationTokenSource.dispose();
    this.backpressure.clear();
    this.buffer.clear();
    this.listeners.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createInitialStats(): StreamingStats {
    return {
      state: 'idle',
      totalChunks: 0,
      validChunks: 0,
      invalidChunks: 0,
      totalBytes: 0,
      averageChunkSize: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      duration: 0,
      throughput: 0,
      peakThroughput: 0,
      pressureState: 'normal',
      retries: 0,
      errors: 0,
      bufferUtilization: 0,
      backpressure: this.backpressure.getStats(),
    };
  }

  private async processChunk(chunk: T): Promise<void> {
    // Check for cancellation
    this.token.throwIfCancellationRequested();

    // Check backpressure
    if (this.backpressure.shouldPause()) {
      await this.backpressure.waitForPressure();
    }

    // Validate chunk
    const result = this.validator.validate(chunk);

    if (result.valid && result.chunk) {
      // Enqueue validated chunk
      this.backpressure.enqueue(result.chunk);
      this.stats.totalChunks++;
      this.stats.validChunks++;
      this.stats.totalBytes += result.chunk.size;
      this.stats.totalProcessingTime += result.chunk.processingTime;

      this.emit('chunk', { data: result.chunk.data, metadata: { validated: true } });
    } else {
      this.stats.invalidChunks++;
      this.emit('validation_error', {
        error: new Error(result.errors.map((e) => e.message).join(', ')),
        metadata: { errors: result.errors },
      });
    }

    // Check pressure state
    const currentPressure = this.backpressure.getState();
    if (currentPressure !== this.stats.pressureState) {
      const previousState = this.stats.pressureState;
      this.stats.pressureState = currentPressure;
      this.emit('pressure_change', {
        metadata: { previousState, currentState: currentPressure },
      });
    }
  }

  private setState(newState: StreamingState): void {
    const previousState = this.state;
    this.state = newState;
    this.stats.state = newState;
    this.emit('state_change', {
      metadata: { previousState, currentState: newState },
    });
  }

  private emit(type: StreamEventType, event: Partial<StreamEvent<T>>): void {
    const fullEvent: StreamEvent<T> = {
      type,
      timestamp: Date.now(),
      state: this.state,
      ...event,
    };

    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(fullEvent);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  private updateStats(): void {
    if (this.startTime) {
      const duration = (this.endTime ?? Date.now()) - this.startTime;
      this.stats.duration = duration;
      this.stats.throughput =
        duration > 0 ? (this.stats.totalChunks / duration) * 1000 : 0;
      this.stats.averageChunkSize =
        this.stats.totalChunks > 0
          ? this.stats.totalBytes / this.stats.totalChunks
          : 0;
      this.stats.averageProcessingTime =
        this.stats.totalChunks > 0
          ? this.stats.totalProcessingTime / this.stats.totalChunks
          : 0;
      this.stats.bufferUtilization = this.backpressure.getUtilization();
      this.stats.backpressure = this.backpressure.getStats();

      // Update peak throughput
      if (this.stats.throughput > this.stats.peakThroughput) {
        this.stats.peakThroughput = this.stats.throughput;
      }
    }
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.throughputHistory.push(this.stats.throughput);
      if (this.throughputHistory.length > 60) {
        this.throughputHistory.shift();
      }
      this.updateStats();
    }, this.config.metricsInterval);
  }

  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default StreamingController;
