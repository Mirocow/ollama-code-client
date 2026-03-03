/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cancellation Support
 * Provides robust cancellation token support for streaming operations,
 * including timeout handling and linked tokens.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for cancellation token
 */
export interface CancellationTokenConfig {
  /** Whether cancellation is enabled */
  enabled: boolean;
  /** Timeout in milliseconds (0 = no timeout) */
  timeout: number;
  /** Callback when cancellation is requested */
  onCancel?: (reason: string) => void;
  /** Callback when timeout occurs */
  onTimeout?: () => void;
  /** Whether to throw on cancellation */
  throwOnCancellation: boolean;
}

/**
 * Cancellation reason
 */
export type CancellationReason =
  | 'user'
  | 'timeout'
  | 'linked'
  | 'error'
  | 'unknown';

/**
 * Registration for cancellation callback
 */
export interface CancellationRegistration {
  unregister(): void;
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Base cancellation error
 */
export class CancellationError extends Error {
  readonly reason: CancellationReason;
  readonly token?: CancellationToken;

  constructor(
    message: string,
    reason: CancellationReason,
    token?: CancellationToken,
  ) {
    super(message);
    this.name = 'CancellationError';
    this.reason = reason;
    this.token = token;
  }
}

/**
 * Error thrown when operation is cancelled by user
 */
export class OperationCanceledError extends CancellationError {
  constructor(message = 'Operation was cancelled', token?: CancellationToken) {
    super(message, 'user', token);
    this.name = 'OperationCanceledError';
  }
}

/**
 * Error thrown when operation times out
 */
export class TimeoutError extends CancellationError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string, token?: CancellationToken) {
    super(
      message ?? `Operation timed out after ${timeoutMs}ms`,
      'timeout',
      token,
    );
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

// ============================================================================
// Cancellation Token
// ============================================================================

/**
 * Cancellation Token
 *
 * Represents a cancellation signal that can be passed to operations
 * to support cooperative cancellation.
 *
 * @example
 * const source = new CancellationTokenSource();
 * const token = source.token;
 *
 * // Pass to async operation
 * const result = await fetchData({ signal: token });
 *
 * // Cancel after 5 seconds
 * setTimeout(() => source.cancel('Timeout'), 5000);
 */
export class CancellationToken {
  private _isCancellationRequested = false;
  private _reason: CancellationReason = 'unknown';
  private _message = '';
  private _callbacks: Array<(reason: string) => void> = [];
  private _timeoutId?: NodeJS.Timeout;
  private _linkedTokens: CancellationToken[] = [];
  private _parentRegistration?: CancellationRegistration;

  /**
   * Create a new cancellation token
   */
  constructor(
    private readonly _config: Partial<CancellationTokenConfig> = {},
  ) {}

  /**
   * Whether cancellation has been requested
   */
  get isCancellationRequested(): boolean {
    return this._isCancellationRequested;
  }

  /**
   * Whether the token can be cancelled
   */
  get canBeCancelled(): boolean {
    return this._config.enabled !== false;
  }

  /**
   * Reason for cancellation
   */
  get reason(): CancellationReason {
    return this._reason;
  }

  /**
   * Human-readable cancellation message
   */
  get message(): string {
    return this._message;
  }

  /**
   * Throw if cancellation was requested
   */
  throwIfCancellationRequested(): void {
    if (this._isCancellationRequested) {
      if (this._config.throwOnCancellation !== false) {
        if (this._reason === 'timeout') {
          throw new TimeoutError(
            this._config.timeout ?? 0,
            this._message,
            this,
          );
        }
        throw new OperationCanceledError(this._message, this);
      }
    }
  }

  /**
   * Register a callback for cancellation
   */
  register(callback: (reason: string) => void): CancellationRegistration {
    if (this._isCancellationRequested) {
      // Already cancelled, call immediately
      callback(this._message);
      return { unregister: () => {} };
    }

    this._callbacks.push(callback);
    return {
      unregister: () => {
        const index = this._callbacks.indexOf(callback);
        if (index >= 0) {
          this._callbacks.splice(index, 1);
        }
      },
    };
  }

  /**
   * Convert to AbortSignal for fetch API compatibility
   */
  toAbortSignal(): AbortSignal {
    const controller = new AbortController();

    if (this._isCancellationRequested) {
      controller.abort(this._message);
      return controller.signal;
    }

    const registration = this.register((reason) => {
      controller.abort(reason);
    });

    // Clean up registration when signal is aborted externally
    controller.signal.addEventListener('abort', () => {
      registration.unregister();
    });

    return controller.signal;
  }

  /**
   * Create a linked token that cancels when any of the sources cancel
   */
  static link(...tokens: CancellationToken[]): CancellationToken {
    const linkedToken = new CancellationToken();

    for (const token of tokens) {
      if (token._isCancellationRequested) {
        linkedToken._cancel(token._reason, token._message);
        return linkedToken;
      }

      const registration = token.register((reason) => {
        linkedToken._cancel('linked', reason);
      });

      linkedToken._linkedTokens.push(token);
      linkedToken._parentRegistration = registration;
    }

    return linkedToken;
  }

  /**
   * Create a token that times out after specified duration
   */
  static timeout(
    ms: number,
    config?: Partial<CancellationTokenConfig>,
  ): CancellationToken {
    const token = new CancellationToken({ ...config, timeout: ms });

    token._timeoutId = setTimeout(() => {
      token._cancel('timeout', `Operation timed out after ${ms}ms`);
      config?.onTimeout?.();
    }, ms);

    return token;
  }

  /**
   * Create a token that cannot be cancelled
   */
  static none: CancellationToken = new CancellationToken({ enabled: false });

  // ========================================================================
  // Internal Methods (used by CancellationTokenSource)
  // ========================================================================

  /**
   * Request cancellation (internal, used by source)
   */
  _cancel(reason: CancellationReason, message: string): void {
    if (this._isCancellationRequested || !this.canBeCancelled) {
      return;
    }

    this._isCancellationRequested = true;
    this._reason = reason;
    this._message = message;

    // Clear timeout
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = undefined;
    }

    // Notify callbacks
    for (const callback of this._callbacks) {
      try {
        callback(message);
      } catch {
        // Ignore callback errors
      }
    }

    // Call config callback
    this._config.onCancel?.(message);

    // Clean up parent registration
    this._parentRegistration?.unregister();
  }

  /**
   * Reset the token (for reuse)
   */
  _reset(): void {
    this._isCancellationRequested = false;
    this._reason = 'unknown';
    this._message = '';
    this._callbacks = [];

    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = undefined;
    }
  }
}

// ============================================================================
// Cancellation Token Source
// ============================================================================

/**
 * Cancellation Token Source
 *
 * Creates and manages cancellation tokens. Provides methods to cancel
 * operations and create tokens with various configurations.
 *
 * @example
 * // Basic usage
 * const source = new CancellationTokenSource();
 *
 * async function fetchData(signal: CancellationToken) {
 *   signal.throwIfCancellationRequested();
 *   const response = await fetch(url, { signal: signal.toAbortSignal() });
 *   signal.throwIfCancellationRequested();
 *   return response.json();
 * }
 *
 * fetchData(source.token);
 * source.cancel('User requested');
 *
 * @example
 * // With timeout
 * const source = new CancellationTokenSource({ timeout: 30000 });
 * // Will automatically cancel after 30 seconds
 *
 * @example
 * // Linked tokens
 * const userCancel = new CancellationTokenSource();
 * const timeoutCancel = CancellationTokenSource.timeout(5000);
 * const linked = CancellationTokenSource.link(userCancel.token, timeoutCancel.token);
 */
export class CancellationTokenSource {
  private _token: CancellationToken;
  private _disposed = false;

  /**
   * Create a new cancellation token source
   */
  constructor(config: Partial<CancellationTokenConfig> = {}) {
    this._token = new CancellationToken(config);

    // Set up timeout if specified
    if (config.timeout && config.timeout > 0) {
      const timeoutId = setTimeout(() => {
        this.cancel(`Timeout after ${config.timeout}ms`, 'timeout');
      }, config.timeout);

      // Clean up timeout when token is cancelled
      this._token.register(() => {
        clearTimeout(timeoutId);
      });
    }
  }

  /**
   * Get the cancellation token
   */
  get token(): CancellationToken {
    return this._token;
  }

  /**
   * Whether cancellation has been requested
   */
  get isCancellationRequested(): boolean {
    return this._token.isCancellationRequested;
  }

  /**
   * Cancel the token
   */
  cancel(reason?: string, cancelReason?: CancellationReason): void {
    if (this._disposed) {
      return;
    }

    this._token._cancel(
      cancelReason ?? 'user',
      reason ?? 'Operation cancelled',
    );
  }

  /**
   * Cancel after specified delay
   */
  cancelAfter(ms: number): void {
    if (this._disposed || this._token.isCancellationRequested) {
      return;
    }

    setTimeout(() => {
      this.cancel(`Cancelled after ${ms}ms`, 'timeout');
    }, ms);
  }

  /**
   * Dispose the source
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._token._reset();
  }

  /**
   * Create a source that times out after specified duration
   */
  static timeout(ms: number): CancellationTokenSource {
    return new CancellationTokenSource({ timeout: ms });
  }

  /**
   * Create a linked source that cancels when any source cancels
   */
  static link(...sources: CancellationTokenSource[]): CancellationTokenSource {
    const linkedSource = new CancellationTokenSource();
    const tokens = sources.map((s) => s.token);

    for (const token of tokens) {
      if (token.isCancellationRequested) {
        linkedSource.cancel(token.message, token.reason);
        return linkedSource;
      }

      token.register((reason) => {
        linkedSource.cancel(reason, 'linked');
      });
    }

    return linkedSource;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an abort signal from a cancellation token
 */
export function toAbortSignal(token: CancellationToken): AbortSignal {
  return token.toAbortSignal();
}

/**
 * Create a cancellation token from an abort signal
 */
export function fromAbortSignal(signal: AbortSignal): CancellationToken {
  const source = new CancellationTokenSource();

  if (signal.aborted) {
    source.cancel(signal.reason ?? 'Already aborted');
    return source.token;
  }

  signal.addEventListener('abort', () => {
    source.cancel(signal.reason ?? 'Aborted');
  });

  return source.token;
}

/**
 * Race multiple cancellation tokens
 */
export function raceCancellationTokens(
  ...tokens: CancellationToken[]
): CancellationToken {
  return CancellationToken.link(...tokens);
}

/**
 * Wait for cancellation with optional timeout
 */
export async function waitForCancellation(
  token: CancellationToken,
  timeoutMs?: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (token.isCancellationRequested) {
      resolve();
      return;
    }

    const registration = token.register(() => {
      clearTimeout(timeoutId);
      resolve();
    });

    const timeoutId = timeoutMs
      ? setTimeout(() => {
          registration.unregister();
          reject(new TimeoutError(timeoutMs));
        }, timeoutMs)
      : 0;
  });
}

export default CancellationTokenSource;
