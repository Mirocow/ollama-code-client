/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Stream Buffer
 * Provides buffering capabilities for streaming data with
 * chunk aggregation, ordering, and efficient memory management.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Buffer configuration
 */
export interface BufferConfig {
  /** Maximum buffer size in bytes */
  maxSize: number;
  /** Maximum number of items */
  maxItems: number;
  /** Whether to preserve order */
  preserveOrder: boolean;
  /** Time to live for buffered items (ms) */
  ttl: number;
  /** Enable chunk aggregation */
  enableAggregation: boolean;
  /** Maximum size of aggregated chunk */
  maxAggregatedSize: number;
  /** Minimum items to aggregate */
  minAggregationItems: number;
  /** Aggregation timeout (ms) */
  aggregationTimeout: number;
  /** Callback when item expires */
  onExpire?: (item: BufferItem<unknown>) => void;
  /** Callback when buffer is full */
  onFull?: () => void;
}

/**
 * Buffered item with metadata
 */
export interface BufferItem<T = unknown> {
  /** Item data */
  data: T;
  /** Sequence number */
  sequence: number;
  /** Timestamp when added */
  timestamp: number;
  /** Item size in bytes */
  size: number;
  /** Priority (higher = more important) */
  priority: number;
  /** Whether item is aggregated */
  aggregated?: boolean;
  /** Original items if aggregated */
  originalItems?: Array<BufferItem<T>>;
}

/**
 * Buffer statistics
 */
export interface BufferStats {
  /** Current number of items */
  itemCount: number;
  /** Current size in bytes */
  size: number;
  /** Utilization (0-1) */
  utilization: number;
  /** Total items added */
  totalAdded: number;
  /** Total items removed */
  totalRemoved: number;
  /** Total items expired */
  totalExpired: number;
  /** Total items aggregated */
  totalAggregated: number;
  /** Peak item count */
  peakItems: number;
  /** Peak size */
  peakSize: number;
  /** Average item size */
  averageItemSize: number;
  /** Number of aggregation operations */
  aggregationOperations: number;
}

// ============================================================================
// Stream Buffer Implementation
// ============================================================================

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BufferConfig = {
  maxSize: 10 * 1024 * 1024, // 10MB
  maxItems: 10000,
  preserveOrder: true,
  ttl: 60000, // 1 minute
  enableAggregation: true,
  maxAggregatedSize: 1024 * 1024, // 1MB
  minAggregationItems: 2,
  aggregationTimeout: 100, // 100ms
};

/**
 * Stream Buffer
 *
 * Provides buffering for streaming data with optional aggregation,
 * ordering, and TTL management.
 *
 * @example
 * const buffer = new StreamBuffer({
 *   maxSize: 5 * 1024 * 1024,
 *   enableAggregation: true,
 * });
 *
 * buffer.add(chunk1);
 * buffer.add(chunk2);
 *
 * const aggregated = buffer.getAggregated(); // Returns combined chunks
 */
export class StreamBuffer<T = unknown> {
  private config: BufferConfig;
  private buffer: Array<BufferItem<T>> = [];
  private currentSize = 0;
  private sequence = 0;
  private stats: BufferStats;
  private aggregationTimer?: NodeJS.Timeout;
  private aggregationBuffer: Array<BufferItem<T>> = [];

  constructor(config: Partial<BufferConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = this.createInitialStats();
  }

  /**
   * Add an item to the buffer
   */
  add(data: T, priority = 0): boolean {
    const size = this.calculateSize(data);

    // Check capacity
    if (
      this.buffer.length >= this.config.maxItems ||
      this.currentSize + size > this.config.maxSize
    ) {
      this.config.onFull?.();
      return false;
    }

    const item: BufferItem<T> = {
      data,
      sequence: this.sequence++,
      timestamp: Date.now(),
      size,
      priority,
    };

    // Add to aggregation buffer if enabled
    if (this.config.enableAggregation && this.shouldAggregate(item)) {
      this.addToAggregation(item);
      return true;
    }

    this.buffer.push(item);
    this.currentSize += size;
    this.updateStats('add', size);

    return true;
  }

  /**
   * Get the next item from the buffer
   */
  get(): BufferItem<T> | undefined {
    this.pruneExpired();

    if (this.buffer.length === 0) {
      return undefined;
    }

    const item = this.config.preserveOrder
      ? this.buffer.shift()
      : this.buffer.pop();

    if (item) {
      this.currentSize -= item.size;
      this.stats.totalRemoved++;
      this.stats.size = this.currentSize;
      this.stats.itemCount = this.buffer.length;
    }

    return item;
  }

  /**
   * Peek at the next item without removing
   */
  peek(): BufferItem<T> | undefined {
    this.pruneExpired();
    return this.buffer[0];
  }

  /**
   * Get aggregated chunks
   */
  getAggregated(): BufferItem<T> | undefined {
    if (!this.config.enableAggregation) {
      return this.get();
    }

    // Force aggregation of pending items
    this.flushAggregation();

    if (this.aggregationBuffer.length === 0) {
      return this.get();
    }

    const items = this.aggregationBuffer;
    this.aggregationBuffer = [];

    if (items.length === 1) {
      return items[0];
    }

    // Create aggregated item
    const aggregatedData = this.aggregateData(items);
    const aggregatedItem: BufferItem<T> = {
      data: aggregatedData,
      sequence: Math.min(...items.map((i) => i.sequence)),
      timestamp: Math.min(...items.map((i) => i.timestamp)),
      size: items.reduce((sum, i) => sum + i.size, 0),
      priority: Math.max(...items.map((i) => i.priority)),
      aggregated: true,
      originalItems: items,
    };

    this.stats.totalAggregated += items.length;
    this.stats.aggregationOperations++;

    return aggregatedItem;
  }

  /**
   * Get all items (clears buffer)
   */
  getAll(): Array<BufferItem<T>> {
    this.pruneExpired();
    this.flushAggregation();

    const items = [...this.buffer];
    this.buffer = [];
    this.currentSize = 0;
    this.stats.totalRemoved += items.length;
    this.stats.size = 0;
    this.stats.itemCount = 0;

    return items;
  }

  /**
   * Get buffer length
   */
  get length(): number {
    return this.buffer.length;
  }

  /**
   * Get buffer size in bytes
   */
  get size(): number {
    return this.currentSize;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return (
      this.buffer.length >= this.config.maxItems ||
      this.currentSize >= this.config.maxSize
    );
  }

  /**
   * Get statistics
   */
  getStats(): BufferStats {
    return { ...this.stats };
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
    this.aggregationBuffer = [];
    this.currentSize = 0;
    this.sequence = 0;
    if (this.aggregationTimer) {
      clearTimeout(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }
    this.stats = this.createInitialStats();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BufferConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Create an async iterator for the buffer
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<BufferItem<T>> {
    while (!this.isEmpty()) {
      yield this.get()!;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createInitialStats(): BufferStats {
    return {
      itemCount: 0,
      size: 0,
      utilization: 0,
      totalAdded: 0,
      totalRemoved: 0,
      totalExpired: 0,
      totalAggregated: 0,
      peakItems: 0,
      peakSize: 0,
      averageItemSize: 0,
      aggregationOperations: 0,
    };
  }

  private calculateSize(data: T): number {
    if (data === null || data === undefined) {
      return 0;
    }
    if (typeof data === 'string') {
      return data.length * 2;
    }
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    if (ArrayBuffer.isView(data)) {
      return data.byteLength;
    }
    try {
      return JSON.stringify(data).length * 2;
    } catch {
      return 1024;
    }
  }

  private updateStats(action: 'add' | 'expire', _size: number): void {
    if (action === 'add') {
      this.stats.totalAdded++;
      this.stats.size = this.currentSize;
      this.stats.itemCount = this.buffer.length;
      this.stats.utilization = this.currentSize / this.config.maxSize;

      if (this.buffer.length > this.stats.peakItems) {
        this.stats.peakItems = this.buffer.length;
      }
      if (this.currentSize > this.stats.peakSize) {
        this.stats.peakSize = this.currentSize;
      }

      this.stats.averageItemSize =
        this.stats.totalAdded > 0
          ? this.currentSize / this.buffer.length
          : 0;
    } else if (action === 'expire') {
      this.stats.totalExpired++;
    }
  }

  private pruneExpired(): void {
    if (this.config.ttl <= 0) {
      return;
    }

    const now = Date.now();
    const cutoff = now - this.config.ttl;

    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].timestamp < cutoff) {
        const item = this.buffer.splice(i, 1)[0];
        this.currentSize -= item.size;
        this.config.onExpire?.(item);
        this.updateStats('expire', item.size);
      }
    }
  }

  private shouldAggregate(item: BufferItem<T>): boolean {
    // Don't aggregate if size is too large
    if (item.size > this.config.maxAggregatedSize / 2) {
      return false;
    }

    // Check if we have compatible items to aggregate with
    return true;
  }

  private addToAggregation(item: BufferItem<T>): void {
    this.aggregationBuffer.push(item);
    this.currentSize += item.size;

    // Check if we should flush
    const totalSize = this.aggregationBuffer.reduce((sum, i) => sum + i.size, 0);
    if (
      this.aggregationBuffer.length >= this.config.minAggregationItems &&
      totalSize >= this.config.maxAggregatedSize * 0.5
    ) {
      this.flushAggregation();
      return;
    }

    // Set timeout for aggregation
    if (!this.aggregationTimer) {
      this.aggregationTimer = setTimeout(() => {
        this.flushAggregation();
      }, this.config.aggregationTimeout);
    }
  }

  private flushAggregation(): void {
    if (this.aggregationTimer) {
      clearTimeout(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }

    if (this.aggregationBuffer.length === 0) {
      return;
    }

    // If only one item, add directly to buffer
    if (this.aggregationBuffer.length === 1) {
      const item = this.aggregationBuffer[0];
      this.buffer.push(item);
      this.updateStats('add', item.size);
      this.aggregationBuffer = [];
      return;
    }

    // Create aggregated item
    const items = this.aggregationBuffer;
    const aggregatedData = this.aggregateData(items);

    const aggregatedItem: BufferItem<T> = {
      data: aggregatedData,
      sequence: Math.min(...items.map((i) => i.sequence)),
      timestamp: Math.min(...items.map((i) => i.timestamp)),
      size: items.reduce((sum, i) => sum + i.size, 0),
      priority: Math.max(...items.map((i) => i.priority)),
      aggregated: true,
      originalItems: items,
    };

    this.buffer.push(aggregatedItem);
    this.stats.totalAggregated += items.length;
    this.stats.aggregationOperations++;
    this.updateStats('add', aggregatedItem.size);

    this.aggregationBuffer = [];
  }

  private aggregateData(items: Array<BufferItem<T>>): T {
    // Check if items are strings
    if (
      items.every((i) => typeof i.data === 'string') &&
      typeof items[0].data === 'string'
    ) {
      return items.map((i) => i.data).join('') as T;
    }

    // Check if items are arrays
    if (
      items.every((i) => Array.isArray(i.data)) &&
      Array.isArray(items[0].data)
    ) {
      return items.flatMap((i) => i.data as unknown[]) as T;
    }

    // Default: return as array
    return items.map((i) => i.data) as T;
  }
}

export default StreamBuffer;
