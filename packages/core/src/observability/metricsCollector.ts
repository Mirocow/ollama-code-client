/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Metrics Collector
 * Collects and aggregates metrics for monitoring and export.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Metric definition
 */
export interface MetricDefinition {
  /** Metric name */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Description */
  description: string;
  /** Unit of measurement */
  unit?: string;
  /** Default labels */
  labels?: Record<string, string>;
  /** Histogram buckets (for histogram type) */
  buckets?: number[];
  /** Quantiles (for summary type) */
  quantiles?: number[];
}

/**
 * Metric value with metadata
 */
export interface MetricValue {
  /** Metric name */
  name: string;
  /** Value */
  value: number;
  /** Labels */
  labels: Record<string, string>;
  /** Timestamp */
  timestamp: number;
  /** Metric type */
  type: MetricType;
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  /** Default labels applied to all metrics */
  defaultLabels: Record<string, string>;
  /** Prefix for all metric names */
  prefix: string;
  /** Histogram buckets */
  defaultBuckets: number[];
  /** Summary quantiles */
  defaultQuantiles: number[];
  /** Maximum age for histogram data (ms) */
  histogramMaxAge: number;
  /** Maximum number of histogram buckets */
  maxHistogramSize: number;
  /** Enable collection */
  enabled: boolean;
  /** Registry of predefined metrics */
  predefinedMetrics: MetricDefinition[];
}

/**
 * Aggregated metric data
 */
export interface AggregatedMetric {
  name: string;
  type: MetricType;
  description?: string;
  unit?: string;
  values: Array<{
    value: number;
    labels: Record<string, string>;
    count?: number;
    sum?: number;
    min?: number;
    max?: number;
    buckets?: Record<string, number>;
    quantiles?: Record<string, number>;
  }>;
}

// ============================================================================
// Metrics Collector Implementation
// ============================================================================

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MetricsConfig = {
  defaultLabels: {},
  prefix: 'ollama_code_',
  defaultBuckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  defaultQuantiles: [0.5, 0.9, 0.95, 0.99],
  histogramMaxAge: 60000, // 1 minute
  maxHistogramSize: 1000,
  enabled: true,
  predefinedMetrics: [],
};

/**
 * Metrics Collector
 *
 * Collects, aggregates, and exposes metrics for monitoring.
 * Supports counters, gauges, histograms, and summaries.
 *
 * @example
 * const collector = new MetricsCollector({
 *   prefix: 'my_app_',
 * });
 *
 * // Register a metric
 * collector.register({
 *   name: 'http_requests_total',
 *   type: 'counter',
 *   description: 'Total HTTP requests',
 * });
 *
 * // Record values
 * collector.record('http_requests_total', 1, { method: 'GET', status: '200' });
 * collector.setGauge('active_connections', 42);
 * collector.recordHistogram('request_duration_ms', 150, { endpoint: '/api/users' });
 */
export class MetricsCollector {
  private config: MetricsConfig;
  private counters: Map<string, Map<string, number>> = new Map();
  private gauges: Map<string, Map<string, number>> = new Map();
  private histograms: Map<string, Map<string, { values: number[]; timestamps: number[] }>> = new Map();
  private summaries: Map<string, Map<string, number[]>> = new Map();
  private definitions: Map<string, MetricDefinition> = new Map();

  constructor(config: Partial<MetricsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Register predefined metrics
    for (const def of this.config.predefinedMetrics) {
      this.register(def);
    }
  }

  /**
   * Register a metric definition
   */
  register(definition: MetricDefinition): void {
    const name = this.prefixName(definition.name);
    this.definitions.set(name, { ...definition, name });

    // Initialize storage
    switch (definition.type) {
      case 'counter':
        this.counters.set(name, new Map());
        break;
      case 'gauge':
        this.gauges.set(name, new Map());
        break;
      case 'histogram':
        this.histograms.set(name, new Map());
        break;
      case 'summary':
        this.summaries.set(name, new Map());
        break;
      default:
        // Unknown metric type - default to counter
        this.counters.set(name, new Map());
        break;
    }
  }

  /**
   * Record a metric value (auto-detects type from registry)
   */
  record(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.config.enabled) return;

    const prefixedName = this.prefixName(name);
    const definition = this.definitions.get(prefixedName);
    const labelKey = this.labelsToKey(labels);

    if (definition) {
      switch (definition.type) {
        case 'counter':
          this.incrementCounterInternal(prefixedName, value, labelKey);
          break;
        case 'gauge':
          this.setGaugeValue(prefixedName, value, labelKey);
          break;
        case 'histogram':
          this.observeHistogram(prefixedName, value, labelKey, definition.buckets);
          break;
        case 'summary':
          this.observeSummary(prefixedName, value, labelKey);
          break;
        default:
          // Unknown type - default to counter
          this.incrementCounterInternal(prefixedName, value, labelKey);
          break;
      }
    } else {
      // Default to counter for unknown metrics
      this.incrementCounterInternal(prefixedName, value, labelKey);
    }
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.config.enabled) return;

    const prefixedName = this.prefixName(name);
    const labelKey = this.labelsToKey(labels);
    this.incrementCounterInternal(prefixedName, value, labelKey);
  }

  /**
   * Internal counter increment with labelKey
   */
  private incrementCounterInternal(prefixedName: string, value: number, labelKey: string): void {
    if (!this.counters.has(prefixedName)) {
      this.counters.set(prefixedName, new Map());
    }

    const counter = this.counters.get(prefixedName)!;
    const current = counter.get(labelKey) ?? 0;
    counter.set(labelKey, current + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.config.enabled) return;

    const prefixedName = this.prefixName(name);
    const labelKey = this.labelsToKey(labels);

    if (!this.gauges.has(prefixedName)) {
      this.gauges.set(prefixedName, new Map());
    }

    this.gauges.get(prefixedName)!.set(labelKey, value);
  }

  /**
   * Record a histogram observation
   */
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.config.enabled) return;

    const prefixedName = this.prefixName(name);
    const definition = this.definitions.get(prefixedName);
    const labelKey = this.labelsToKey(labels);

    this.observeHistogram(prefixedName, value, labelKey, definition?.buckets);
  }

  /**
   * Get all aggregated metrics
   */
  getAllMetrics(): AggregatedMetric[] {
    const metrics: AggregatedMetric[] = [];

    // Counters
    for (const [name, values] of this.counters.entries()) {
      const definition = this.definitions.get(name);
      metrics.push({
        name,
        type: 'counter',
        description: definition?.description,
        unit: definition?.unit,
        values: Array.from(values.entries()).map(([labelKey, value]) => ({
          value,
          labels: this.keyToLabels(labelKey),
        })),
      });
    }

    // Gauges
    for (const [name, values] of this.gauges.entries()) {
      const definition = this.definitions.get(name);
      metrics.push({
        name,
        type: 'gauge',
        description: definition?.description,
        unit: definition?.unit,
        values: Array.from(values.entries()).map(([labelKey, value]) => ({
          value,
          labels: this.keyToLabels(labelKey),
        })),
      });
    }

    // Histograms
    for (const [name, histogramData] of this.histograms.entries()) {
      const definition = this.definitions.get(name);
      const buckets = definition?.buckets ?? this.config.defaultBuckets;

      metrics.push({
        name,
        type: 'histogram',
        description: definition?.description,
        unit: definition?.unit,
        values: Array.from(histogramData.entries()).map(([labelKey, data]) => {
          const bucketCounts = this.calculateBucketCounts(data.values, buckets);
          return {
            value: data.values.length,
            labels: this.keyToLabels(labelKey),
            sum: data.values.reduce((a, b) => a + b, 0),
            count: data.values.length,
            min: data.values.length > 0 ? Math.min(...data.values) : undefined,
            max: data.values.length > 0 ? Math.max(...data.values) : undefined,
            buckets: bucketCounts,
          };
        }),
      });
    }

    // Summaries
    for (const [name, values] of this.summaries.entries()) {
      const definition = this.definitions.get(name);
      const quantiles = definition?.quantiles ?? this.config.defaultQuantiles;

      metrics.push({
        name,
        type: 'summary',
        description: definition?.description,
        unit: definition?.unit,
        values: Array.from(values.entries()).map(([labelKey, data]) => ({
          value: data.length,
          labels: this.keyToLabels(labelKey),
          sum: data.reduce((a, b) => a + b, 0),
          count: data.length,
          quantiles: this.calculateQuantiles(data, quantiles),
        })),
      });
    }

    return metrics;
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): AggregatedMetric | undefined {
    const prefixedName = this.prefixName(name);
    const allMetrics = this.getAllMetrics();
    return allMetrics.find((m) => m.name === prefixedName);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
  }

  /**
   * Get metric definition
   */
  getDefinition(name: string): MetricDefinition | undefined {
    return this.definitions.get(this.prefixName(name));
  }

  /**
   * Get all definitions
   */
  getDefinitions(): MetricDefinition[] {
    return Array.from(this.definitions.values());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private prefixName(name: string): string {
    if (name.startsWith(this.config.prefix)) {
      return name;
    }
    return this.config.prefix + name;
  }

  private labelsToKey(labels: Record<string, string>): string {
    const allLabels = { ...this.config.defaultLabels, ...labels };
    const sorted = Object.entries(allLabels).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([k, v]) => `${k}="${v}"`).join(',');
  }

  private keyToLabels(key: string): Record<string, string> {
    if (!key) return {};
    const labels: Record<string, string> = {};
    for (const pair of key.split(',')) {
      const match = pair.match(/^([^=]+)="([^"]*)"$/);
      if (match) {
        labels[match[1]] = match[2];
      }
    }
    return labels;
  }

  private setGaugeValue(name: string, value: number, labelKey: string): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Map());
    }
    this.gauges.get(name)!.set(labelKey, value);
  }

  private observeHistogram(
    name: string,
    value: number,
    labelKey: string,
    _buckets?: number[],
  ): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Map());
    }

    const histogram = this.histograms.get(name)!;
    if (!histogram.has(labelKey)) {
      histogram.set(labelKey, { values: [], timestamps: [] });
    }

    const data = histogram.get(labelKey)!;
    data.values.push(value);
    data.timestamps.push(Date.now());

    // Trim old data
    this.trimHistogramData(data);
  }

  private observeSummary(name: string, value: number, labelKey: string): void {
    if (!this.summaries.has(name)) {
      this.summaries.set(name, new Map());
    }

    const summary = this.summaries.get(name)!;
    if (!summary.has(labelKey)) {
      summary.set(labelKey, []);
    }

    summary.get(labelKey)!.push(value);

    // Trim to max size
    const data = summary.get(labelKey)!;
    if (data.length > this.config.maxHistogramSize) {
      data.shift();
    }
  }

  private trimHistogramData(data: { values: number[]; timestamps: number[] }): void {
    const cutoff = Date.now() - this.config.histogramMaxAge;
    while (data.timestamps.length > 0 && data.timestamps[0] < cutoff) {
      data.timestamps.shift();
      data.values.shift();
    }
  }

  private calculateBucketCounts(values: number[], buckets: number[]): Record<string, number> {
    const counts: Record<string, number> = {};
    let cumulative = 0;

    const sorted = [...values].sort((a, b) => a - b);
    let valueIndex = 0;

    for (const bucket of [...buckets, Infinity]) {
      while (valueIndex < sorted.length && sorted[valueIndex] <= bucket) {
        cumulative++;
        valueIndex++;
      }
      counts[bucket === Infinity ? '+Inf' : bucket.toString()] = cumulative;
    }

    return counts;
  }

  private calculateQuantiles(values: number[], quantiles: number[]): Record<string, number> {
    const sorted = [...values].sort((a, b) => a - b);
    const result: Record<string, number> = {};

    for (const q of quantiles) {
      const index = Math.floor(q * sorted.length);
      result[q.toString()] = sorted[index] ?? 0;
    }

    return result;
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();
export default MetricsCollector;
