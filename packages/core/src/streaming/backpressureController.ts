/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Backpressure Controller
 * Manages flow control for streaming data to prevent memory issues
 * and ensure smooth data flow between producer and consumer.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Pressure state enumeration
 */
export type PressureState = 'normal' | 'warning' | 'critical';

/**
 * Configuration for backpressure controller
 */
export interface BackpressureConfig {
  /** Maximum buffer size in bytes before applying backpressure */
  maxBufferSize: number;
  /** Warning threshold (fraction of max buffer size, 0-1) */
  warningThreshold: number;
  /** Critical threshold (fraction of max buffer size, 0-1) */
  criticalThreshold: number;
  /** Maximum number of items in buffer */
  maxBufferItems: number;
  /** Time to wait when pressure is high (ms) */
  pressureDelayMs: number;
  /** Whether to drop chunks when in critical state */
  dropOnCritical: boolean;
  /** Maximum time to wait for consumer (ms) before timeout */
  consumerTimeoutMs: number;
  /** Sampling interval for stats calculation (ms) */
  statsIntervalMs: number;
  /** Callback for pressure state changes */
  onStateChange?: (state: PressureState, previousState: PressureState) => void;
  /** Callback when chunks are dropped */
  onChunkDropped?: (chunk: unknown, reason: string) => void;
  /** Enable adaptive rate limiting */
  adaptiveRateLimit: boolean;
  /** Initial rate limit (items per second) */
  initialRateLimit: number;
  /** Minimum rate limit when adapting */
  minRateLimit: number;
  /** Maximum rate limit when adapting */
  maxRateLimit: number;
}

/**
 * Statistics for backpressure monitoring
 */
export interface BackpressureStats {
  /** Current buffer size in bytes */
  currentBufferSize: number;
  /** Current number of items in buffer */
  currentBufferItems: number;
  /** Current pressure state */
  currentState: PressureState;
  /** Total chunks processed */
  totalChunksProcessed: number;
  /** Total chunks dropped */
  totalChunksDropped: number;
  /** Total bytes processed */
  totalBytesProcessed: number;
  /** Average processing rate (chunks/second) */
  averageRate: number;
  /** Current rate limit */
  currentRateLimit: number;
  /** Time spent in warning state (ms) */
  timeInWarning: number;
  /** Time spent in critical state (ms) */
  timeInCritical: number;
  /** Number of state transitions */
  stateTransitions: number;
  /** Last state change timestamp */
  lastStateChange?: number;
  /** Average consumer latency (ms) */
  averageConsumerLatency: number;
  /** Peak buffer size */
  peakBufferSize: number;
  /** Peak buffer items */
  peakBufferItems: number;
}

/**
 * Buffer item with metadata
 */
interface BufferItem<T = unknown> {
  data: T;
  size: number;
  timestamp: number;
  priority: number;
}

// ============================================================================
// Backpressure Controller Implementation
// ============================================================================

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BackpressureConfig = {
  maxBufferSize: 10 * 1024 * 1024, // 10MB
  warningThreshold: 0.7,
  criticalThreshold: 0.9,
  maxBufferItems: 10000,
  pressureDelayMs: 10,
  dropOnCritical: false,
  consumerTimeoutMs: 30000,
  statsIntervalMs: 1000,
  adaptiveRateLimit: true,
  initialRateLimit: 1000,
  minRateLimit: 10,
  maxRateLimit: 5000,
};

/**
 * Backpressure Controller
 *
 * Manages flow control for streaming data to prevent memory issues
 * and ensure smooth data flow between producer and consumer.
 *
 * @example
 * const controller = new BackpressureController({
 *   maxBufferSize: 5 * 1024 * 1024, // 5MB
 *   onStateChange: (state, prev) => {
 *     console.log(`Pressure changed: ${prev} -> ${state}`);
 *   },
 * });
 *
 * // Producer side
 * for (const chunk of chunks) {
 *   if (controller.shouldPause()) {
 *     await controller.waitForPressure();
 *   }
 *   controller.enqueue(chunk);
 * }
 *
 * // Consumer side
 * while (true) {
 *   const chunk = await controller.dequeue();
 *   if (!chunk) break;
 *   process(chunk);
 * }
 */
export class BackpressureController<T = unknown> {
  private config: BackpressureConfig;
  private buffer: Array<BufferItem<T>> = [];
  private currentBufferSize = 0;
  private state: PressureState = 'normal';
  private stats: BackpressureStats;
  private stateChangeTime = Date.now();
  private rateLimitTimestamps: number[] = [];
  private currentRateLimit: number;
  private resolveWait?: () => void;
  private consumerLatencies: number[] = [];
  private isPaused = false;

  constructor(config: Partial<BackpressureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentRateLimit = this.config.initialRateLimit;
    this.stats = this.createInitialStats();
  }

  /**
   * Check if producer should pause
   */
  shouldPause(): boolean {
    return this.state !== 'normal' || this.isPaused;
  }

  /**
   * Wait for pressure to decrease
   */
  async waitForPressure(): Promise<void> {
    if (this.state === 'normal') {
      return;
    }

    return new Promise((resolve) => {
      this.resolveWait = resolve;
      this.checkAndNotify();
    });
  }

  /**
   * Enqueue a chunk with optional priority
   */
  enqueue(data: T, priority = 0): boolean {
    const size = this.calculateSize(data);

    // Check rate limit
    if (!this.checkRateLimit()) {
      if (this.config.dropOnCritical && this.state === 'critical') {
        this.config.onChunkDropped?.(data, 'rate_limit_exceeded');
        this.stats.totalChunksDropped++;
        return false;
      }
    }

    // Check buffer limits
    if (this.buffer.length >= this.config.maxBufferItems) {
      if (this.config.dropOnCritical) {
        // Drop oldest low-priority item
        const dropIndex = this.buffer.findIndex((item) => item.priority < priority);
        if (dropIndex >= 0) {
          const dropped = this.buffer.splice(dropIndex, 1)[0];
          this.currentBufferSize -= dropped.size;
          this.config.onChunkDropped?.(dropped.data, 'buffer_full');
          this.stats.totalChunksDropped++;
        } else {
          this.config.onChunkDropped?.(data, 'buffer_full');
          this.stats.totalChunksDropped++;
          return false;
        }
      } else {
        // Block until space is available
        this.updateState();
        return false;
      }
    }

    // Add to buffer
    const item: BufferItem<T> = {
      data,
      size,
      timestamp: Date.now(),
      priority,
    };

    this.buffer.push(item);
    this.currentBufferSize += size;
    this.stats.totalChunksProcessed++;
    this.stats.totalBytesProcessed += size;
    this.stats.currentBufferSize = this.currentBufferSize;
    this.stats.currentBufferItems = this.buffer.length;

    // Update peaks
    if (this.currentBufferSize > this.stats.peakBufferSize) {
      this.stats.peakBufferSize = this.currentBufferSize;
    }
    if (this.buffer.length > this.stats.peakBufferItems) {
      this.stats.peakBufferItems = this.buffer.length;
    }

    this.updateState();
    return true;
  }

  /**
   * Dequeue a chunk
   */
  async dequeue(): Promise<T | null> {
    const startTime = Date.now();

    // Wait for data if buffer is empty
    while (this.buffer.length === 0) {
      if (Date.now() - startTime > this.config.consumerTimeoutMs) {
        return null;
      }
      await this.sleep(10);
    }

    const item = this.buffer.shift();
    if (!item) {
      return null;
    }

    this.currentBufferSize -= item.size;
    this.stats.currentBufferSize = this.currentBufferSize;
    this.stats.currentBufferItems = this.buffer.length;

    // Track consumer latency
    const latency = Date.now() - item.timestamp;
    this.consumerLatencies.push(latency);
    if (this.consumerLatencies.length > 100) {
      this.consumerLatencies.shift();
    }
    this.stats.averageConsumerLatency =
      this.consumerLatencies.reduce((a, b) => a + b, 0) /
      this.consumerLatencies.length;

    this.updateState();
    return item.data;
  }

  /**
   * Get current buffer length
   */
  get length(): number {
    return this.buffer.length;
  }

  /**
   * Get current buffer size in bytes
   */
  get size(): number {
    return this.currentBufferSize;
  }

  /**
   * Get current pressure state
   */
  getState(): PressureState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): BackpressureStats {
    this.updateRateStats();
    return { ...this.stats };
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    const droppedCount = this.buffer.length;
    for (const item of this.buffer) {
      this.config.onChunkDropped?.(item.data, 'buffer_cleared');
    }
    this.buffer = [];
    this.currentBufferSize = 0;
    this.stats.totalChunksDropped += droppedCount;
    this.stats.currentBufferSize = 0;
    this.stats.currentBufferItems = 0;
    this.updateState();
  }

  /**
   * Pause the controller
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the controller
   */
  resume(): void {
    this.isPaused = false;
    this.checkAndNotify();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BackpressureConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateState();
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Peek at the next item without removing it
   */
  peek(): T | undefined {
    return this.buffer[0]?.data;
  }

  /**
   * Get buffer utilization (0-1)
   */
  getUtilization(): number {
    return this.currentBufferSize / this.config.maxBufferSize;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createInitialStats(): BackpressureStats {
    return {
      currentBufferSize: 0,
      currentBufferItems: 0,
      currentState: 'normal',
      totalChunksProcessed: 0,
      totalChunksDropped: 0,
      totalBytesProcessed: 0,
      averageRate: 0,
      currentRateLimit: this.currentRateLimit,
      timeInWarning: 0,
      timeInCritical: 0,
      stateTransitions: 0,
      averageConsumerLatency: 0,
      peakBufferSize: 0,
      peakBufferItems: 0,
    };
  }

  private calculateSize(data: T): number {
    if (data === null || data === undefined) {
      return 0;
    }
    if (typeof data === 'string') {
      return data.length * 2; // UTF-16
    }
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    if (ArrayBuffer.isView(data)) {
      return data.byteLength;
    }
    // Estimate object size
    try {
      return JSON.stringify(data).length * 2;
    } catch {
      return 1024; // Default estimate
    }
  }

  private updateState(): void {
    const utilization = this.getUtilization();
    const previousState = this.state;

    if (utilization >= this.config.criticalThreshold) {
      this.state = 'critical';
    } else if (utilization >= this.config.warningThreshold) {
      this.state = 'warning';
    } else {
      this.state = 'normal';
    }

    // Track time in states
    const now = Date.now();
    const elapsed = now - this.stateChangeTime;
    if (previousState === 'warning') {
      this.stats.timeInWarning += elapsed;
    } else if (previousState === 'critical') {
      this.stats.timeInCritical += elapsed;
    }

    if (this.state !== previousState) {
      this.stateChangeTime = now;
      this.stats.stateTransitions++;
      this.stats.lastStateChange = now;
      this.stats.currentState = this.state;
      this.config.onStateChange?.(this.state, previousState);

      // Adaptive rate limiting
      if (this.config.adaptiveRateLimit) {
        this.adjustRateLimit();
      }
    }

    this.checkAndNotify();
  }

  private checkAndNotify(): void {
    if (this.state === 'normal' && this.resolveWait) {
      this.resolveWait();
      this.resolveWait = undefined;
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - 1000; // 1 second window

    // Clean old timestamps
    this.rateLimitTimestamps = this.rateLimitTimestamps.filter(
      (ts) => ts > windowStart,
    );

    if (this.rateLimitTimestamps.length >= this.currentRateLimit) {
      return false;
    }

    this.rateLimitTimestamps.push(now);
    return true;
  }

  private adjustRateLimit(): void {
    if (this.state === 'critical') {
      // Reduce rate limit
      this.currentRateLimit = Math.max(
        this.config.minRateLimit,
        this.currentRateLimit * 0.8,
      );
    } else if (this.state === 'warning') {
      // Slightly reduce
      this.currentRateLimit = Math.max(
        this.config.minRateLimit,
        this.currentRateLimit * 0.95,
      );
    } else {
      // Gradually increase
      this.currentRateLimit = Math.min(
        this.config.maxRateLimit,
        this.currentRateLimit * 1.05,
      );
    }
    this.stats.currentRateLimit = this.currentRateLimit;
  }

  private updateRateStats(): void {
    const now = Date.now();
    const windowStart = now - 1000;
    const recentCount = this.rateLimitTimestamps.filter(
      (ts) => ts > windowStart,
    ).length;
    this.stats.averageRate = recentCount;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default BackpressureController;
