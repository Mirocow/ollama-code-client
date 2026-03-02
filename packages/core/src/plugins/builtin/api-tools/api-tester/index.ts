/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * API Tester Tool - A comprehensive tool for testing REST API endpoints.
 *
 * Features:
 * - Supports GET, POST, PUT, DELETE, PATCH methods
 * - Custom headers support
 * - Request body (JSON, form-data)
 * - Authentication (Bearer token, Basic, API Key)
 * - Response validation (status code, headers, body schema)
 * - Performance metrics (response time, size)
 * - Retry logic with configurable attempts
 */

import type {
  ToolCallConfirmationDetails,
  ToolInvocation,
  ToolResult,
} from '../../../../tools/tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolConfirmationOutcome,
} from '../../../../tools/tools.js';
import { ToolErrorType } from '../../../../tools/tool-error.js';
import type { Config } from '../../../../config/config.js';
import { ApprovalMode } from '../../../../config/config.js';
import { createDebugLogger, type DebugLogger } from '../../../../utils/debugLogger.js';
import axios, { type AxiosResponse } from 'axios';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * HTTP methods supported by the API Tester
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Authentication configuration types
 */
export interface AuthConfig {
  /** Type of authentication to use */
  type: 'bearer' | 'basic' | 'api-key';
  /** Bearer token (for 'bearer' type) */
  token?: string;
  /** Username (for 'basic' type) */
  username?: string;
  /** Password (for 'basic' type) */
  password?: string;
  /** API Key header name (for 'api-key' type) */
  key?: string;
  /** API Key value (for 'api-key' type) */
  value?: string;
}

/**
 * Response validation configuration
 */
export interface ValidationConfig {
  /** Expected HTTP status code */
  statusCode?: number;
  /** JSON Schema for response body validation */
  schema?: object;
  /** Expected response headers */
  headers?: Record<string, string | RegExp>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Number of retry attempts (default: 3) */
  count?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  delayMs?: number;
  /** HTTP status codes that should trigger a retry */
  retryOnStatusCodes?: number[];
}

/**
 * Parameters for the API Tester tool
 */
export interface ApiTesterToolParams {
  /** The URL endpoint to test */
  url: string;
  /** HTTP method to use */
  method: HttpMethod;
  /** Custom headers to include in the request */
  headers?: Record<string, string>;
  /** Request body (will be JSON-encoded if object) */
  body?: unknown;
  /** Authentication configuration */
  auth?: AuthConfig;
  /** Response validation configuration */
  validate?: ValidationConfig;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Retry configuration for failed requests */
  retry?: RetryConfig;
}

/**
 * Performance metrics collected during the request
 */
export interface PerformanceMetrics {
  /** Total response time in milliseconds */
  responseTimeMs: number;
  /** DNS resolution time in milliseconds (if available) */
  dnsTimeMs?: number;
  /** Time to first byte in milliseconds (if available) */
  ttfbMs?: number;
  /** Response body size in bytes */
  responseSizeBytes: number;
  /** Number of retry attempts made */
  retryAttempts: number;
}

/**
 * Validation results
 */
export interface ValidationResult {
  /** Whether the status code matches expected */
  statusCodeValid?: boolean;
  /** Expected status code */
  expectedStatusCode?: number;
  /** Actual status code */
  actualStatusCode: number;
  /** Whether the response schema is valid */
  schemaValid?: boolean;
  /** Schema validation errors (if any) */
  schemaErrors?: string[];
  /** Header validation results */
  headerValidation?: Array<{
    header: string;
    expected: string | RegExp;
    actual: string;
    valid: boolean;
  }>;
  /** Overall validation passed */
  passed: boolean;
}

/**
 * API Tester tool result
 */
export interface ApiTesterResult extends ToolResult {
  /** HTTP status code */
  statusCode: number;
  /** Response body (parsed JSON or raw string) */
  responseBody: unknown;
  /** Response headers */
  responseHeaders: Record<string, string>;
  /** Performance metrics */
  metrics: PerformanceMetrics;
  /** Validation results (if validation was requested) */
  validation?: ValidationResult;
  /** Request ID for tracking */
  requestId: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validates a response body against a JSON Schema
 */
function validateSchema(
  body: unknown,
  schema: object,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Simple schema validation implementation
  // In production, consider using a library like ajv
  function validate(
    value: unknown,
    schemaNode: Record<string, unknown>,
    path: string = '',
  ): void {
    if (typeof schemaNode !== 'object' || schemaNode === null) {
      return;
    }

    const type = schemaNode['type'] as string | undefined;
    const required = schemaNode['required'] as string[] | undefined;
    const properties = schemaNode['properties'] as
      | Record<string, unknown>
      | undefined;

    // Type checking
    if (type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== type) {
        errors.push(`${path}: expected type "${type}", got "${actualType}"`);
        return;
      }
    }

    // Required properties check
    if (
      required &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      for (const prop of required) {
        if (!(prop in (value as Record<string, unknown>))) {
          errors.push(`${path}: missing required property "${prop}"`);
        }
      }
    }

    // Properties validation
    if (
      properties &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      for (const [propName, propSchema] of Object.entries(properties)) {
        const propPath = path ? `${path}.${propName}` : propName;
        const propValue = (value as Record<string, unknown>)[propName];
        if (propValue !== undefined) {
          validate(propValue, propSchema as Record<string, unknown>, propPath);
        }
      }
    }

    // Array items validation
    const items = schemaNode['items'] as Record<string, unknown> | undefined;
    if (items && Array.isArray(value)) {
      value.forEach((item, index) => {
        validate(item, items, `${path}[${index}]`);
      });
    }

    // Enum validation
    const enumValues = schemaNode['enum'] as unknown[] | undefined;
    if (enumValues && !enumValues.includes(value)) {
      errors.push(`${path}: value must be one of [${enumValues.join(', ')}]`);
    }

    // Min/max for numbers
    if (typeof value === 'number') {
      const minimum = schemaNode['minimum'] as number | undefined;
      const maximum = schemaNode['maximum'] as number | undefined;
      if (minimum !== undefined && value < minimum) {
        errors.push(`${path}: value ${value} is less than minimum ${minimum}`);
      }
      if (maximum !== undefined && value > maximum) {
        errors.push(
          `${path}: value ${value} is greater than maximum ${maximum}`,
        );
      }
    }

    // MinLength/maxLength for strings
    if (typeof value === 'string') {
      const minLength = schemaNode['minLength'] as number | undefined;
      const maxLength = schemaNode['maxLength'] as number | undefined;
      if (minLength !== undefined && value.length < minLength) {
        errors.push(
          `${path}: string length ${value.length} is less than minimum ${minLength}`,
        );
      }
      if (maxLength !== undefined && value.length > maxLength) {
        errors.push(
          `${path}: string length ${value.length} is greater than maximum ${maxLength}`,
        );
      }
    }
  }

  validate(body, schema as Record<string, unknown>);

  return { valid: errors.length === 0, errors };
}

/**
 * Validates response headers against expected patterns
 */
function validateHeaders(
  actualHeaders: Record<string, string>,
  expectedHeaders: Record<string, string | RegExp>,
): Array<{
  header: string;
  expected: string | RegExp;
  actual: string;
  valid: boolean;
}> {
  const results: Array<{
    header: string;
    expected: string | RegExp;
    actual: string;
    valid: boolean;
  }> = [];

  for (const [header, expected] of Object.entries(expectedHeaders)) {
    const actual = actualHeaders[header.toLowerCase()] || '';
    const valid =
      expected instanceof RegExp ? expected.test(actual) : actual === expected;
    results.push({ header, expected, actual, valid });
  }

  return results;
}

/**
 * Sleeps for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// API Tester Tool Invocation
// ============================================================================

/**
 * Implementation of the API Tester tool invocation logic
 */
class ApiTesterToolInvocation extends BaseToolInvocation<
  ApiTesterToolParams,
  ApiTesterResult
> {
  private readonly debugLogger: DebugLogger;
  private readonly requestId: string;

  constructor(
    private readonly config: Config,
    params: ApiTesterToolParams,
  ) {
    super(params);
    this.debugLogger = createDebugLogger('API_TESTER');
    this.requestId = generateRequestId();
  }

  /**
   * Builds the request headers including authentication
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.params.headers,
    };

    // Add authentication headers
    if (this.params.auth) {
      switch (this.params.auth.type) {
        case 'bearer':
          if (this.params.auth.token) {
            headers['Authorization'] = `Bearer ${this.params.auth.token}`;
          }
          break;

        case 'basic':
          if (this.params.auth.username && this.params.auth.password) {
            const credentials = Buffer.from(
              `${this.params.auth.username}:${this.params.auth.password}`,
            ).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;

        case 'api-key':
          if (this.params.auth.key && this.params.auth.value) {
            headers[this.params.auth.key] = this.params.auth.value;
          }
          break;

        default:
          // Unknown auth type - no action needed
          break;
      }
    }

    // Set Content-Type for requests with body
    if (this.params.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  /**
   * Executes a single HTTP request using axios
   */
  private async executeRequest(
    signal: AbortSignal,
    timeout: number,
  ): Promise<{ response: AxiosResponse; responseTimeMs: number }> {
    const headers = this.buildHeaders();
    const startTime = Date.now();

    this.debugLogger.debug(
      `[ApiTester] Making ${this.params.method} request to ${this.params.url}`,
    );
    this.debugLogger.debug(
      `[ApiTester] Headers: ${JSON.stringify(headers, null, 2)}`,
    );

    if (this.params.body) {
      this.debugLogger.debug(
        `[ApiTester] Body: ${JSON.stringify(this.params.body, null, 2)}`,
      );
    }

    const response = await axios.request({
      url: this.params.url,
      method: this.params.method,
      headers,
      data: this.params.body,
      signal,
      timeout,
      transformResponse: [(data) => data], // Get raw response
    });

    const responseTimeMs = Date.now() - startTime;

    return { response, responseTimeMs };
  }

  /**
   * Parses the response body
   */
  private parseResponseBody(response: AxiosResponse): {
    body: unknown;
    sizeBytes: number;
  } {
    const text = response.data;
    const sizeBytes = Buffer.byteLength(text, 'utf8');

    // Try to parse as JSON
    try {
      return { body: JSON.parse(text), sizeBytes };
    } catch {
      // Return as string if not valid JSON
      return { body: text, sizeBytes };
    }
  }

  /**
   * Extracts headers from the response
   */
  private extractHeaders(response: AxiosResponse): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
        headers[key.toLowerCase()] = String(value);
      }
    }
    return headers;
  }

  /**
   * Validates the response
   */
  private validateResponse(
    statusCode: number,
    body: unknown,
    headers: Record<string, string>,
  ): ValidationResult {
    const validation = this.params.validate;
    const result: ValidationResult = {
      actualStatusCode: statusCode,
      passed: true,
    };

    // Validate status code
    if (validation?.statusCode !== undefined) {
      result.statusCodeValid = statusCode === validation.statusCode;
      result.expectedStatusCode = validation.statusCode;
      if (!result.statusCodeValid) {
        result.passed = false;
      }
    }

    // Validate schema
    if (validation?.schema) {
      const schemaResult = validateSchema(body, validation.schema);
      result.schemaValid = schemaResult.valid;
      result.schemaErrors = schemaResult.errors;
      if (!schemaResult.valid) {
        result.passed = false;
      }
    }

    // Validate headers
    if (validation?.headers) {
      result.headerValidation = validateHeaders(headers, validation.headers);
      if (result.headerValidation.some((h) => !h.valid)) {
        result.passed = false;
      }
    }

    return result;
  }

  override getDescription(): string {
    const authInfo = this.params.auth
      ? ` with ${this.params.auth.type} auth`
      : '';
    const bodyInfo = this.params.body ? ` with body` : '';
    return `Testing ${this.params.method} ${this.params.url}${authInfo}${bodyInfo}`;
  }

  override async shouldConfirmExecute(): Promise<
    ToolCallConfirmationDetails | false
  > {
    // Auto-execute in AUTO_EDIT mode and PLAN mode
    if (
      this.config.getApprovalMode() === ApprovalMode.AUTO_EDIT ||
      this.config.getApprovalMode() === ApprovalMode.PLAN
    ) {
      return false;
    }

    // Request confirmation for potentially destructive operations
    const destructiveMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (destructiveMethods.includes(this.params.method)) {
      const confirmationDetails: ToolCallConfirmationDetails = {
        type: 'info',
        title: `Confirm API Request`,
        prompt: `Are you sure you want to make a ${this.params.method} request to ${this.params.url}?`,
        urls: [this.params.url],
        onConfirm: async (outcome: ToolConfirmationOutcome) => {
          if (outcome === ToolConfirmationOutcome.ProceedAlways) {
            this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
          }
        },
      };
      return confirmationDetails;
    }

    return false;
  }

  async execute(signal: AbortSignal): Promise<ApiTesterResult> {
    const timeout = this.params.timeout ?? DEFAULT_TIMEOUT_MS;
    const retryCount = this.params.retry?.count ?? DEFAULT_RETRY_COUNT;
    const retryDelayMs = this.params.retry?.delayMs ?? DEFAULT_RETRY_DELAY_MS;
    const retryOnStatusCodes = this.params.retry?.retryOnStatusCodes ?? [
      408, 429, 500, 502, 503, 504,
    ];

    let lastError: Error | null = null;
    let retryAttempts = 0;

    for (let attempt = 0; attempt < retryCount; attempt++) {
      if (signal.aborted) {
        throw new Error('Request was aborted');
      }

      try {
        const { response, responseTimeMs } = await this.executeRequest(
          signal,
          timeout,
        );
        const statusCode = response.status;
        const headers = this.extractHeaders(response);
        const { body, sizeBytes } = this.parseResponseBody(response);

        this.debugLogger.debug(
          `[ApiTester] Response: ${statusCode} in ${responseTimeMs}ms, ${sizeBytes} bytes`,
        );

        // Check if we should retry
        if (
          attempt < retryCount - 1 &&
          retryOnStatusCodes.includes(statusCode)
        ) {
          this.debugLogger.debug(
            `[ApiTester] Status ${statusCode} triggers retry (${attempt + 1}/${retryCount})`,
          );
          retryAttempts++;
          await sleep(retryDelayMs);
          continue;
        }

        // Build metrics
        const metrics: PerformanceMetrics = {
          responseTimeMs,
          responseSizeBytes: sizeBytes,
          retryAttempts,
        };

        // Build result
        const result: ApiTesterResult = {
          statusCode,
          responseBody: body,
          responseHeaders: headers,
          metrics,
          requestId: this.requestId,
          llmContent: '',
          returnDisplay: '',
        };

        // Validate if requested
        if (this.params.validate) {
          result.validation = this.validateResponse(statusCode, body, headers);
        }

        // Build LLM content
        const validationInfo = result.validation
          ? `\n\n**Validation**: ${result.validation.passed ? '✅ Passed' : '❌ Failed'}`
          : '';

        result.llmContent = `**API Test Result**
- Request ID: ${this.requestId}
- Method: ${this.params.method}
- URL: ${this.params.url}
- Status Code: ${statusCode}
- Response Time: ${responseTimeMs}ms
- Response Size: ${sizeBytes} bytes
- Retry Attempts: ${retryAttempts}${validationInfo}

**Response Body:**
\`\`\`json
${typeof body === 'object' ? JSON.stringify(body, null, 2) : body}
\`\`\`

**Response Headers:**
\`\`\`json
${JSON.stringify(headers, null, 2)}
\`\`\``;

        result.returnDisplay = `${this.params.method} ${this.params.url} → ${statusCode} (${responseTimeMs}ms)`;

        // Add error info if status code indicates failure
        if (statusCode >= 400) {
          result.error = {
            message: `HTTP ${statusCode}: ${response.statusText}`,
            type: ToolErrorType.EXECUTION_FAILED,
          };
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.debugLogger.error(
          `[ApiTester] Attempt ${attempt + 1} failed: ${lastError.message}`,
        );

        if (attempt < retryCount - 1) {
          retryAttempts++;
          await sleep(retryDelayMs);
        }
      }
    }

    // All retries exhausted
    const errorMessage = lastError?.message ?? 'Unknown error';
    return {
      statusCode: 0,
      responseBody: null,
      responseHeaders: {},
      metrics: {
        responseTimeMs: 0,
        responseSizeBytes: 0,
        retryAttempts,
      },
      requestId: this.requestId,
      llmContent: `**API Test Failed**
- Request ID: ${this.requestId}
- Method: ${this.params.method}
- URL: ${this.params.url}
- Error: ${errorMessage}
- Retry Attempts: ${retryAttempts}`,
      returnDisplay: `${this.params.method} ${this.params.url} → Error: ${errorMessage}`,
      error: {
        message: errorMessage,
        type: ToolErrorType.EXECUTION_FAILED,
      },
    };
  }
}

// ============================================================================
// API Tester Tool
// ============================================================================

/**
 * JSON Schema for the API Tester tool parameters
 */
const API_TESTER_PARAMS_SCHEMA = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description:
        'The URL endpoint to test. Must be a valid HTTP or HTTPS URL.',
    },
    method: {
      type: 'string',
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      description: 'HTTP method to use for the request.',
    },
    headers: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Custom headers to include in the request.',
    },
    body: {
      description:
        'Request body (will be JSON-encoded if object). Only used for POST, PUT, PATCH methods.',
    },
    auth: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['bearer', 'basic', 'api-key'],
          description: 'Type of authentication to use.',
        },
        token: {
          type: 'string',
          description: 'Bearer token (for "bearer" type).',
        },
        username: {
          type: 'string',
          description: 'Username (for "basic" type).',
        },
        password: {
          type: 'string',
          description: 'Password (for "basic" type).',
        },
        key: {
          type: 'string',
          description: 'API Key header name (for "api-key" type).',
        },
        value: {
          type: 'string',
          description: 'API Key value (for "api-key" type).',
        },
      },
      required: ['type'],
      description: 'Authentication configuration.',
    },
    validate: {
      type: 'object',
      properties: {
        statusCode: {
          type: 'number',
          description: 'Expected HTTP status code.',
        },
        schema: {
          type: 'object',
          description: 'JSON Schema for response body validation.',
        },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description:
            'Expected response headers (values can be strings or regex patterns).',
        },
      },
      description: 'Response validation configuration.',
    },
    timeout: {
      type: 'number',
      description: 'Request timeout in milliseconds. Default: 30000.',
      minimum: 1000,
      maximum: 300000,
    },
    retry: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of retry attempts. Default: 3.',
          minimum: 1,
          maximum: 10,
        },
        delayMs: {
          type: 'number',
          description: 'Delay between retries in milliseconds. Default: 1000.',
          minimum: 100,
          maximum: 30000,
        },
        retryOnStatusCodes: {
          type: 'array',
          items: { type: 'number' },
          description:
            'HTTP status codes that should trigger a retry. Default: [408, 429, 500, 502, 503, 504].',
        },
      },
      description: 'Retry configuration for failed requests.',
    },
  },
  required: ['url', 'method'],
};

/**
 * API Tester Tool
 *
 * A comprehensive tool for testing REST API endpoints with support for:
 * - Multiple HTTP methods (GET, POST, PUT, DELETE, PATCH)
 * - Custom headers and request bodies
 * - Multiple authentication types (Bearer, Basic, API Key)
 * - Response validation (status code, schema, headers)
 * - Performance metrics collection
 * - Automatic retry logic for transient failures
 *
 * @example
 * ```typescript
 * // Simple GET request
 * const result = await apiTesterTool.buildAndExecute({
 *   url: 'https://api.example.com/users',
 *   method: 'GET',
 * });
 *
 * // POST with authentication and validation
 * const result = await apiTesterTool.buildAndExecute({
 *   url: 'https://api.example.com/users',
 *   method: 'POST',
 *   auth: { type: 'bearer', token: 'your-token' },
 *   body: { name: 'John', email: 'john@example.com' },
 *   validate: { statusCode: 201 },
 * });
 * ```
 */
export class ApiTesterTool extends BaseDeclarativeTool<
  ApiTesterToolParams,
  ApiTesterResult
> {
  static readonly Name = 'api_tester';

  constructor(private readonly config: Config) {
    super(
      ApiTesterTool.Name,
      'API Tester',
      `A comprehensive tool for testing REST API endpoints.

Features:
- HTTP Methods: GET, POST, PUT, DELETE, PATCH
- Custom headers support
- Request body support (JSON, form-data)
- Authentication types:
  - Bearer token
  - Basic authentication
  - API Key (custom header)
- Response validation:
  - Status code checking
  - JSON Schema validation
  - Header validation
- Performance metrics:
  - Response time
  - Response size
  - Retry attempts
- Automatic retry logic for transient failures

Usage notes:
  - The URL must be a valid HTTP or HTTPS endpoint
  - Use the 'validate' parameter to verify expected responses
  - Use the 'retry' parameter to handle transient failures
  - Performance metrics are always collected and returned
  - Results include a unique request ID for tracking`,
      Kind.Fetch,
      API_TESTER_PARAMS_SCHEMA,
    );
  }

  protected override validateToolParamValues(
    params: ApiTesterToolParams,
  ): string | null {
    // Validate URL
    if (!params.url || params.url.trim() === '') {
      return "The 'url' parameter cannot be empty.";
    }

    try {
      const url = new URL(params.url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return "The 'url' must use http:// or https:// protocol.";
      }
    } catch {
      return "The 'url' must be a valid URL.";
    }

    // Validate method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (!validMethods.includes(params.method)) {
      return `The 'method' must be one of: ${validMethods.join(', ')}.`;
    }

    // Validate body is not used with GET or DELETE
    if (
      params.body &&
      (params.method === 'GET' || params.method === 'DELETE')
    ) {
      this.createDebugLogger().debug(
        `[ApiTester] Warning: Body provided for ${params.method} request, which typically doesn't use a body.`,
      );
    }

    // Validate auth configuration
    if (params.auth) {
      switch (params.auth.type) {
        case 'bearer':
          if (!params.auth.token) {
            return "Bearer authentication requires 'token' parameter.";
          }
          break;
        case 'basic':
          if (!params.auth.username || !params.auth.password) {
            return "Basic authentication requires 'username' and 'password' parameters.";
          }
          break;
        case 'api-key':
          if (!params.auth.key || !params.auth.value) {
            return "API Key authentication requires 'key' and 'value' parameters.";
          }
          break;
        default:
          // Unknown auth type - validation not needed
          break;
      }
    }

    // Validate timeout
    if (params.timeout !== undefined) {
      if (params.timeout < 1000 || params.timeout > 300000) {
        return "The 'timeout' must be between 1000 and 300000 milliseconds.";
      }
    }

    // Validate retry configuration
    if (params.retry) {
      if (
        params.retry.count !== undefined &&
        (params.retry.count < 1 || params.retry.count > 10)
      ) {
        return "The 'retry.count' must be between 1 and 10.";
      }
      if (
        params.retry.delayMs !== undefined &&
        (params.retry.delayMs < 100 || params.retry.delayMs > 30000)
      ) {
        return "The 'retry.delayMs' must be between 100 and 30000 milliseconds.";
      }
    }

    return null;
  }

  private createDebugLogger(): DebugLogger {
    return createDebugLogger('API_TESTER');
  }

  protected createInvocation(
    params: ApiTesterToolParams,
  ): ToolInvocation<ApiTesterToolParams, ApiTesterResult> {
    return new ApiTesterToolInvocation(this.config, params);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates an instance of the API Tester tool
 * @param config - Configuration object
 * @returns API Tester tool instance
 */
export function createApiTesterTool(config: Config): ApiTesterTool {
  return new ApiTesterTool(config);
}

// Default export for convenience
let _apiTesterTool: ApiTesterTool | null = null;

/**
 * Gets or creates a singleton instance of the API Tester tool
 * @param config - Configuration object (required on first call)
 * @returns API Tester tool instance
 */
export function getApiTesterTool(config?: Config): ApiTesterTool {
  if (!_apiTesterTool && config) {
    _apiTesterTool = new ApiTesterTool(config);
  }
  if (!_apiTesterTool) {
    throw new Error('ApiTesterTool not initialized. Call with config first.');
  }
  return _apiTesterTool;
}

/**
 * Factory function that creates an API Tester tool instance.
 * This is the primary export for the API Tester tool.
 *
 * @param config - Configuration object
 * @returns Configured API Tester tool instance
 *
 * @example
 * ```typescript
 * import { apiTesterTool } from './tools/api-tester.js';
 *
 * // Create tool with config
 * const tool = apiTesterTool(config);
 *
 * // Execute a GET request
 * const result = await tool.buildAndExecute({
 *   url: 'https://api.example.com/users',
 *   method: 'GET',
 * });
 * ```
 */
export function apiTesterTool(config: Config): ApiTesterTool {
  return new ApiTesterTool(config);
}
