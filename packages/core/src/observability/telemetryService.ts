/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Telemetry Service
 * Main telemetry coordination service that manages metrics, tracing,
 * and logging for comprehensive observability.
 */

import { MetricsCollector, type MetricsConfig } from './metricsCollector.js';
import type { Span as TracerSpan} from './tracer.js';
import { Tracer, type TracerConfig, SpanContext } from './tracer.js';
import { PrometheusExporter, type PrometheusConfig } from './prometheusExporter.js';

// Re-export Span from tracer for backward compatibility
export { Span } from './tracer.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Telemetry service configuration
 */
export interface TelemetryServiceConfig {
  /** Service name for identification */
  serviceName: string;
  /** Service version */
  serviceVersion: string;
  /** Environment (development, production, etc.) */
  environment: string;
  /** Enable metrics collection */
  enableMetrics: boolean;
  /** Enable distributed tracing */
  enableTracing: boolean;
  /** Enable logging */
  enableLogging: boolean;
  /** Metrics configuration */
  metrics: Partial<MetricsConfig>;
  /** Tracer configuration */
  tracing: Partial<TracerConfig>;
  /** Prometheus exporter configuration */
  prometheus: Partial<PrometheusConfig>;
  /** Sampling rate for traces (0-1) */
  samplingRate: number;
  /** Enable console output */
  consoleOutput: boolean;
  /** Export interval in ms */
  exportIntervalMs: number;
  /** Resource attributes */
  resourceAttributes: Record<string, string>;
}

/**
 * Telemetry statistics
 */
export interface TelemetryStats {
  /** Total spans created */
  totalSpans: number;
  /** Active spans */
  activeSpans: number;
  /** Total metrics recorded */
  totalMetrics: number;
  /** Total events logged */
  totalEvents: number;
  /** Export count */
  exportCount: number;
  /** Last export time */
  lastExportTime?: number;
  /** Errors */
  errors: number;
}

/**
 * Telemetry event
 */
export interface TelemetryEvent {
  /** Event name */
  name: string;
  /** Timestamp */
  timestamp: number;
  /** Event attributes */
  attributes: Record<string, unknown>;
  /** Trace context */
  traceContext?: {
    traceId: string;
    spanId: string;
  };
}

// ============================================================================
// Telemetry Service Implementation
// ============================================================================

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TelemetryServiceConfig = {
  serviceName: 'ollama-code',
  serviceVersion: '0.10.5',
  environment: process.env['NODE_ENV'] ?? 'development',
  enableMetrics: true,
  enableTracing: true,
  enableLogging: true,
  metrics: {},
  tracing: {},
  prometheus: {},
  samplingRate: 1.0,
  consoleOutput: false,
  exportIntervalMs: 60000, // 1 minute
  resourceAttributes: {},
};

/**
 * Telemetry Service
 *
 * Central coordination service for observability features.
 * Manages metrics collection, distributed tracing, and event logging.
 *
 * @example
 * const telemetry = new TelemetryService({
 *   serviceName: 'my-service',
 *   enableMetrics: true,
 *   enableTracing: true,
 * });
 *
 * // Start a span
 * const span = telemetry.startSpan('operation', { attributes: { key: 'value' } });
 * // ... do work ...
 * span.end();
 *
 * // Record a metric
 * telemetry.recordMetric('operations_total', 1, { operation: 'read' });
 */
export class TelemetryService {
  private config: TelemetryServiceConfig;
  private metricsCollector: MetricsCollector;
  private tracer: Tracer;
  private prometheusExporter?: PrometheusExporter;
  private stats: TelemetryStats;
  private events: TelemetryEvent[] = [];
  private exportInterval?: NodeJS.Timeout;

  constructor(config: Partial<TelemetryServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = this.createInitialStats();

    // Initialize components
    this.metricsCollector = new MetricsCollector(this.config.metrics);
    this.tracer = new Tracer({
      ...this.config.tracing,
      serviceName: this.config.serviceName,
      samplingRate: this.config.samplingRate,
    });

    if (this.config.prometheus.enabled !== false) {
      this.prometheusExporter = new PrometheusExporter(
        this.config.prometheus,
        this.metricsCollector,
      );
    }

    // Start export interval
    this.startExportInterval();
  }

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.config.serviceName;
  }

  /**
   * Get environment
   */
  getEnvironment(): string {
    return this.config.environment;
  }

  // ============================================================================
  // Tracing
  // ============================================================================

  /**
   * Start a new span
   */
  startSpan(
    name: string,
    options?: {
      kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
      attributes?: Record<string, unknown>;
      parent?: { traceId: string; spanId: string };
    },
  ): TracerSpan {
    if (!this.config.enableTracing) {
      return this.tracer.startSpan(name, { noop: true });
    }

    this.stats.totalSpans++;
    // Convert parent to SpanContext format if provided
    if (options?.parent) {
      const { parent, ...restOptions } = options;
      return this.tracer.startSpan(name, {
        ...restOptions,
        parent: new SpanContext(parent.traceId, parent.spanId),
      });
    }
    // No parent, pass options without parent property
    return this.tracer.startSpan(name, options ? { kind: options.kind, attributes: options.attributes } : undefined);
  }

  /**
   * Get active span
   */
  getActiveSpan(): TracerSpan | undefined {
    return this.tracer.getActiveSpan();
  }

  /**
   * Run function within a span context
   */
  async withSpan<T>(
    name: string,
    fn: (span: TracerSpan) => Promise<T>,
    options?: {
      kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
      attributes?: Record<string, unknown>;
    },
  ): Promise<T> {
    const span = this.startSpan(name, options);
    try {
      const result = await fn(span);
      span.setStatus({ code: 'ok' });
      return result;
    } catch (error) {
      span.setStatus({
        code: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  /**
   * Record a metric value
   */
  recordMetric(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    if (!this.config.enableMetrics) return;

    this.metricsCollector.record(name, value, labels);
    this.stats.totalMetrics++;
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels?: Record<string, string>): void {
    this.recordMetric(name, 1, labels);
  }

  /**
   * Record a gauge value
   */
  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.metricsCollector.setGauge(name, value, labels);
    this.stats.totalMetrics++;
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.metricsCollector.recordHistogram(name, value, labels);
    this.stats.totalMetrics++;
  }

  /**
   * Time an operation
   */
  timeOperation<T>(
    name: string,
    fn: () => T,
    labels?: Record<string, string>,
  ): T {
    const start = Date.now();
    try {
      return fn();
    } finally {
      const duration = Date.now() - start;
      this.recordHistogram(`${name}_duration_ms`, duration, labels);
    }
  }

  /**
   * Time an async operation
   */
  async timeOperationAsync<T>(
    name: string,
    fn: () => Promise<T>,
    labels?: Record<string, string>,
  ): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      const duration = Date.now() - start;
      this.recordHistogram(`${name}_duration_ms`, duration, labels);
    }
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Log an event
   */
  logEvent(
    name: string,
    attributes: Record<string, unknown> = {},
  ): void {
    if (!this.config.enableLogging) return;

    const activeSpan = this.tracer.getActiveSpan();
    const event: TelemetryEvent = {
      name,
      timestamp: Date.now(),
      attributes,
      traceContext: activeSpan
        ? { traceId: activeSpan.traceId, spanId: activeSpan.spanId }
        : undefined,
    };

    this.events.push(event);
    this.stats.totalEvents++;

    if (this.config.consoleOutput) {
      console.log(`[TELEMETRY] ${name}`, attributes);
    }
  }

  /**
   * Get recent events
   */
  getEvents(limit = 100): TelemetryEvent[] {
    return this.events.slice(-limit);
  }

  // ============================================================================
  // Statistics and Export
  // ============================================================================

  /**
   * Get telemetry statistics
   */
  getStats(): TelemetryStats {
    this.stats.activeSpans = this.tracer.getActiveSpanCount();
    return { ...this.stats };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    if (!this.prometheusExporter) {
      return '';
    }
    return this.prometheusExporter.export();
  }

  /**
   * Force export
   */
  async export(): Promise<void> {
    this.stats.exportCount++;
    this.stats.lastExportTime = Date.now();

    // Export metrics via Prometheus exporter
    if (this.prometheusExporter) {
      await this.prometheusExporter.flush();
    }
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
      this.exportInterval = undefined;
    }

    await this.export();

    this.metricsCollector.clear();
    this.events = [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createInitialStats(): TelemetryStats {
    return {
      totalSpans: 0,
      activeSpans: 0,
      totalMetrics: 0,
      totalEvents: 0,
      exportCount: 0,
      errors: 0,
    };
  }

  private startExportInterval(): void {
    if (this.config.exportIntervalMs > 0) {
      this.exportInterval = setInterval(() => {
        this.export().catch(() => {
          this.stats.errors++;
        });
      }, this.config.exportIntervalMs);
    }
  }
}

// Singleton instance
export const telemetryService = new TelemetryService();
export default TelemetryService;
