/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Distributed Tracer
 * Provides distributed tracing capabilities for request flow tracking.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Span kind
 */
export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

/**
 * Span status
 */
export type SpanStatus = {
  code: 'ok' | 'error' | 'unset';
  message?: string;
};

/**
 * Span options
 */
export interface SpanOptions {
  /** Span kind */
  kind?: SpanKind;
  /** Start time (default: now) */
  startTime?: number;
  /** Attributes */
  attributes?: Record<string, unknown>;
  /** Parent context */
  parent?: SpanContext;
  /** Links to other spans */
  links?: Array<{ context: SpanContext; attributes?: Record<string, unknown> }>;
}

/**
 * Span event
 */
export interface SpanEvent {
  /** Event name */
  name: string;
  /** Timestamp */
  timestamp: number;
  /** Event attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Span context for propagation
 */
export class SpanContext {
  constructor(
    readonly traceId: string,
    readonly spanId: string,
    readonly traceFlags: number = 1,
    readonly traceState: string = '',
  ) {}

  static fromString(str: string): SpanContext | null {
    const parts = str.split('-');
    if (parts.length >= 2) {
      return new SpanContext(parts[0], parts[1], parseInt(parts[2] ?? '1', 10));
    }
    return null;
  }

  toString(): string {
    return `${this.traceId}-${this.spanId}-${this.traceFlags}`;
  }

  isValid(): boolean {
    return (
      this.traceId.length === 32 &&
      this.spanId.length === 16 &&
      /^[0-9a-f]+$/.test(this.traceId) &&
      /^[0-9a-f]+$/.test(this.spanId)
    );
  }
}

/**
 * Tracer configuration
 */
export interface TracerConfig {
  /** Service name */
  serviceName: string;
  /** Service version */
  serviceVersion?: string;
  /** Sampling rate (0-1) */
  samplingRate: number;
  /** Maximum spans per trace */
  maxSpansPerTrace: number;
  /** Span attribute limits */
  attributeLimits: {
    count: number;
    valueLength: number;
  };
  /** Event limits */
  eventLimits: {
    count: number;
    attributeCount: number;
  };
  /** Link limits */
  linkLimits: {
    count: number;
    attributeCount: number;
  };
  /** Export batch size */
  exportBatchSize: number;
  /** Export timeout (ms) */
  exportTimeoutMs: number;
  /** Callback when span ends */
  onSpanEnd?: (span: CompletedSpan) => void;
}

/**
 * Completed span for export
 */
export interface CompletedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime: number;
  duration: number;
  status: SpanStatus;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
  links: Array<{ context: SpanContext; attributes?: Record<string, unknown> }>;
  resource: Record<string, unknown>;
}

// ============================================================================
// Span Implementation
// ============================================================================

/**
 * Span represents a unit of work in a trace
 */
export class Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: SpanKind;
  readonly startTime: number;
  readonly context: SpanContext;

  private attributes: Record<string, unknown> = {};
  private events: SpanEvent[] = [];
  private status: SpanStatus = { code: 'unset' };
  private endTime?: number;
  private ended = false;
  private droppedAttributes = 0;
  private droppedEvents = 0;

  constructor(
    name: string,
    private readonly tracer: Tracer,
    options: SpanOptions & { traceId?: string; spanId?: string; parentSpanId?: string } = {},
  ) {
    this.name = name;
    this.kind = options.kind ?? 'internal';
    this.startTime = options.startTime ?? Date.now();

    this.traceId = options.traceId ?? generateTraceId();
    this.spanId = options.spanId ?? generateSpanId();
    this.parentSpanId = options.parentSpanId;

    this.context = new SpanContext(this.traceId, this.spanId);

    if (options.attributes) {
      this.setAttributes(options.attributes);
    }
  }

  /**
   * Set an attribute
   */
  setAttribute(key: string, value: unknown): this {
    if (this.ended) return this;

    const limits = this.tracer.getConfig().attributeLimits;
    const keys = Object.keys(this.attributes);

    if (keys.length >= limits.count) {
      this.droppedAttributes++;
      return this;
    }

    // Truncate long string values
    if (typeof value === 'string' && value.length > limits.valueLength) {
      value = value.substring(0, limits.valueLength);
    }

    this.attributes[key] = value;
    return this;
  }

  /**
   * Set multiple attributes
   */
  setAttributes(attributes: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(attributes)) {
      this.setAttribute(key, value);
    }
    return this;
  }

  /**
   * Add an event
   */
  addEvent(name: string, attributes?: Record<string, unknown>, timestamp?: number): this {
    if (this.ended) return this;

    const limits = this.tracer.getConfig().eventLimits;

    if (this.events.length >= limits.count) {
      this.droppedEvents++;
      return this;
    }

    // Limit event attributes
    const limitedAttrs: Record<string, unknown> = {};
    if (attributes) {
      const attrKeys = Object.keys(attributes).slice(0, limits.attributeCount);
      for (const key of attrKeys) {
        limitedAttrs[key] = attributes[key];
      }
    }

    this.events.push({
      name,
      timestamp: timestamp ?? Date.now(),
      attributes: limitedAttrs,
    });

    return this;
  }

  /**
   * Set span status
   */
  setStatus(status: SpanStatus): this {
    if (this.ended) return this;
    this.status = status;
    return this;
  }

  /**
   * Record an exception
   */
  recordException(error: Error, timestamp?: number): this {
    if (this.ended) return this;

    this.addEvent(
      'exception',
      {
        'exception.type': error.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack,
      },
      timestamp,
    );

    this.setStatus({ code: 'error', message: error.message });
    return this;
  }

  /**
   * End the span
   */
  end(endTime?: number): void {
    if (this.ended) return;

    this.ended = true;
    this.endTime = endTime ?? Date.now();

    // Add dropped counts as attributes
    if (this.droppedAttributes > 0) {
      this.attributes['otel.dropped_attributes_count'] = this.droppedAttributes;
    }
    if (this.droppedEvents > 0) {
      this.attributes['otel.dropped_events_count'] = this.droppedEvents;
    }

    // Notify tracer
    this.tracer.onSpanEnd(this);
  }

  /**
   * Check if span is ended
   */
  isEnded(): boolean {
    return this.ended;
  }

  /**
   * Get span duration
   */
  get duration(): number {
    return (this.endTime ?? Date.now()) - this.startTime;
  }

  /**
   * Convert to completed span for export
   */
  toCompletedSpan(): CompletedSpan {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      kind: this.kind,
      startTime: this.startTime,
      endTime: this.endTime ?? Date.now(),
      duration: this.duration,
      status: this.status,
      attributes: { ...this.attributes },
      events: [...this.events],
      links: [],
      resource: {
        'service.name': this.tracer.getConfig().serviceName,
        'service.version': this.tracer.getConfig().serviceVersion ?? 'unknown',
      },
    };
  }

  /**
   * Create child span
   */
  startChild(name: string, options?: SpanOptions): Span {
    return this.tracer.startSpan(name, {
      ...options,
      parent: this.context,
    });
  }
}

// ============================================================================
// Tracer Implementation
// ============================================================================

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TracerConfig = {
  serviceName: 'ollama-code',
  serviceVersion: '0.10.5',
  samplingRate: 1.0,
  maxSpansPerTrace: 1000,
  attributeLimits: {
    count: 128,
    valueLength: 1024,
  },
  eventLimits: {
    count: 128,
    attributeCount: 32,
  },
  linkLimits: {
    count: 128,
    attributeCount: 32,
  },
  exportBatchSize: 100,
  exportTimeoutMs: 30000,
};

/**
 * Tracer creates and manages spans for distributed tracing
 */
export class Tracer {
  private config: TracerConfig;
  private activeSpans: Map<string, Span> = new Map();
  private spanCounts: Map<string, number> = new Map();
  private completedSpans: CompletedSpan[] = [];

  constructor(config: Partial<TracerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): TracerConfig {
    return this.config;
  }

  /**
   * Start a new span
   */
  startSpan(
    name: string,
    options: SpanOptions & { noop?: boolean } = {},
  ): Span {
    // Check sampling
    if (Math.random() > this.config.samplingRate) {
      return new NoopSpan(name);
    }

    // Check trace span limit
    const traceId = options.parent?.traceId ?? generateTraceId();
    const spanCount = this.spanCounts.get(traceId) ?? 0;

    if (spanCount >= this.config.maxSpansPerTrace) {
      return new NoopSpan(name);
    }

    this.spanCounts.set(traceId, spanCount + 1);

    // Create span with parent context
    const span = new Span(name, this, {
      ...options,
      traceId: options.parent?.traceId ?? traceId,
      parentSpanId: options.parent?.spanId,
    });

    this.activeSpans.set(span.spanId, span);
    return span;
  }

  /**
   * Get active span by ID
   */
  getActiveSpan(spanId?: string): Span | undefined {
    if (spanId) {
      return this.activeSpans.get(spanId);
    }
    // Return most recently created span
    const spans = Array.from(this.activeSpans.values());
    return spans[spans.length - 1];
  }

  /**
   * Get count of active spans
   */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  /**
   * Get completed spans
   */
  getCompletedSpans(): CompletedSpan[] {
    return [...this.completedSpans];
  }

  /**
   * Clear completed spans
   */
  clearCompletedSpans(): void {
    this.completedSpans = [];
  }

  /**
   * Export spans (returns and clears)
   */
  export(): CompletedSpan[] {
    const spans = this.completedSpans;
    this.completedSpans = [];
    return spans;
  }

  /**
   * Called when a span ends
   */
  onSpanEnd(span: Span): void {
    this.activeSpans.delete(span.spanId);

    const completed = span.toCompletedSpan();
    this.completedSpans.push(completed);

    // Call callback
    this.config.onSpanEnd?.(completed);

    // Cleanup trace count if no more active spans for this trace
    const traceSpans = Array.from(this.activeSpans.values()).filter(
      (s) => s.traceId === span.traceId,
    );
    if (traceSpans.length === 0) {
      this.spanCounts.delete(span.traceId);
    }
  }
}

/**
 * NoopSpan is a no-op span used when tracing is disabled or sampling rejects
 */
class NoopSpan extends Span {
  constructor(name: string) {
    super(name, {} as Tracer, {});
  }

  override setAttribute(_key: string, _value: unknown): this {
    return this;
  }

  override setAttributes(_attributes: Record<string, unknown>): this {
    return this;
  }

  override addEvent(_name: string, _attributes?: Record<string, unknown>, _timestamp?: number): this {
    return this;
  }

  override setStatus(_status: SpanStatus): this {
    return this;
  }

  override recordException(_error: Error, _timestamp?: number): this {
    return this;
  }

  override end(_endTime?: number): void {
    // No-op
  }

  override isEnded(): boolean {
    return true;
  }

  override startChild(name: string, _options?: SpanOptions): Span {
    return new NoopSpan(name);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function generateTraceId(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
}

function generateSpanId(): string {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
}

// Singleton instance
export const tracer = new Tracer();
export default Tracer;
