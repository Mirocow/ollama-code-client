/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  ApiTesterToolParams,
  HttpMethod,
  PerformanceMetrics,
  ValidationResult} from './api-tester.js';
import {
  ApiTesterTool,
  ApiTesterResult,
  AuthConfig,
  ValidationConfig,
  createApiTesterTool,
} from './api-tester.js';
import type { Config } from '../config/config.js';
import { ApprovalMode } from '../config/config.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Config
const mockConfig = {
  getTargetDir: () => '/test/project',
  getWorkspaceContext: () => ({
    getDirectories: () => ['/test/project'],
    isPathWithinWorkspace: () => true,
  }),
  getFileSystemService: () => ({
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
  }),
  getShouldUseNodePtyShell: () => false,
  getDebugMode: () => false,
  getSessionId: () => 'test-session',
  getApprovalMode: () => ApprovalMode.DEFAULT,
  setApprovalMode: vi.fn(),
} as unknown as Config;

describe('ApiTesterTool', () => {
  let tool: ApiTesterTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ApiTesterTool(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(ApiTesterTool.Name).toBe('api_tester');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('API Tester');
    });

    it('should have description', () => {
      expect(tool.description).toContain('REST API');
    });

    it('should have valid parameter schema', () => {
      expect(tool.parameterSchema).toBeDefined();
      expect(tool.parameterSchema.type).toBe('object');
      expect(tool.parameterSchema.properties).toHaveProperty('url');
      expect(tool.parameterSchema.properties).toHaveProperty('method');
    });
  });

  describe('Parameter Validation', () => {
    it('should require url parameter', () => {
      const params = { method: 'GET' as HttpMethod } as ApiTesterToolParams;
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('url');
    });

    it('should require method parameter', () => {
      const params = { url: 'https://api.example.com' } as ApiTesterToolParams;
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('method');
    });

    it('should validate valid params', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should reject empty url', () => {
      const params: ApiTesterToolParams = {
        url: '',
        method: 'GET',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('url');
    });

    it('should reject invalid url', () => {
      const params: ApiTesterToolParams = {
        url: 'not-a-valid-url',
        method: 'GET',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('url');
    });

    it('should reject non-http url', () => {
      const params: ApiTesterToolParams = {
        url: 'ftp://example.com',
        method: 'GET',
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('http');
    });
  });

  describe('HTTP Methods', () => {
    const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    validMethods.forEach((method) => {
      it(`should accept '${method}' method`, () => {
        const params: ApiTesterToolParams = {
          url: 'https://api.example.com',
          method,
        };
        const error = tool.validateToolParamValues(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Authentication', () => {
    it('should accept bearer auth', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        auth: {
          type: 'bearer',
          token: 'my-token',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should reject bearer auth without token', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        auth: {
          type: 'bearer',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('token');
    });

    it('should accept basic auth', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        auth: {
          type: 'basic',
          username: 'user',
          password: 'pass',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should reject basic auth without username/password', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        auth: {
          type: 'basic',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('username');
    });

    it('should accept api-key auth', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        auth: {
          type: 'api-key',
          key: 'X-API-Key',
          value: 'my-api-key',
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should reject api-key auth without key/value', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        auth: {
          type: 'api-key',
        key: 'X-API-Key',
        // Missing value
        value: undefined as unknown as string,
        // value: undefined,
        // } as ApiTesterToolParams;
        // const error = tool.validateToolParamValues(params);
        // expect(error).toBeTruthy();
        // expect(error).toContain('value');
          // This test checks that api-key auth without value is rejected
        // The test expects an error about 'value' being required
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('value');
    });
  });

  describe('Validation Config', () => {
    it('should accept statusCode validation', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        validate: {
          statusCode: 200,
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept schema validation', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        validate: {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
            },
          },
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should accept headers validation', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        validate: {
          headers: {
            'content-type': 'application/json',
          },
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });
  });

  describe('Timeout Validation', () => {
    it('should accept valid timeout', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        timeout: 30000,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should reject timeout below minimum', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        timeout: 500,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });

    it('should reject timeout above maximum', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        timeout: 400000,
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('timeout');
    });
  });

  describe('Retry Configuration', () => {
    it('should accept valid retry config', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        retry: {
          count: 3,
          delayMs: 1000,
          retryOnStatusCodes: [500, 502, 503],
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeNull();
    });

    it('should reject retry count above maximum', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        retry: {
          count: 15,
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('retry.count');
    });

    it('should reject retry delay above maximum', () => {
      const params: ApiTesterToolParams = {
        url: 'https://api.example.com',
        method: 'GET',
        retry: {
          delayMs: 50000,
        },
      };
      const error = tool.validateToolParamValues(params);
      expect(error).toBeTruthy();
      expect(error).toContain('retry.delayMs');
    });
  });
});

describe('ApiTester Types', () => {
  it('should define PerformanceMetrics interface correctly', () => {
    const metrics: PerformanceMetrics = {
      responseTimeMs: 150,
      dnsTimeMs: 20,
      ttfbMs: 50,
      responseSizeBytes: 1024,
      retryAttempts: 0,
    };
    expect(metrics.responseTimeMs).toBe(150);
    expect(metrics.responseSizeBytes).toBe(1024);
  });

  it('should define ValidationResult interface correctly', () => {
    const validation: ValidationResult = {
      statusCodeValid: true,
      expectedStatusCode: 200,
      actualStatusCode: 200,
      schemaValid: true,
      passed: true,
    };
    expect(validation.passed).toBe(true);
    expect(validation.statusCodeValid).toBe(true);
  });

  it('should define ValidationResult with errors', () => {
    const validation: ValidationResult = {
      schemaValid: false,
      schemaErrors: ['Missing required property: id'],
      actualStatusCode: 400,
      passed: false,
    };
    expect(validation.passed).toBe(false);
    expect(validation.schemaErrors).toHaveLength(1);
  });

  it('should define header validation results', () => {
    const validation: ValidationResult = {
      actualStatusCode: 200,
      headerValidation: [
        {
          header: 'content-type',
          expected: 'application/json',
          actual: 'application/json',
          valid: true,
        },
      ],
      passed: true,
    };
    expect(validation.headerValidation).toHaveLength(1);
    expect(validation.headerValidation?.[0].valid).toBe(true);
  });
});

describe('ApiTesterToolInvocation', () => {
  let tool: ApiTesterTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ApiTesterTool(mockConfig);
  });

  it('should create invocation with valid params', () => {
    const params: ApiTesterToolParams = {
      url: 'https://api.example.com/users',
      method: 'GET',
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation).toBeDefined();
    expect(invocation.getDescription()).toContain('GET');
    expect(invocation.getDescription()).toContain('api.example.com');
  });

  it('should create invocation with auth info', () => {
    const params: ApiTesterToolParams = {
      url: 'https://api.example.com/users',
      method: 'GET',
      auth: {
        type: 'bearer',
        token: 'test-token',
      },
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('bearer');
  });

  it('should create invocation with body info', () => {
    const params: ApiTesterToolParams = {
      url: 'https://api.example.com/users',
      method: 'POST',
      body: { name: 'John' },
    };
    const invocation = tool['createInvocation'](params);
    expect(invocation.getDescription()).toContain('body');
  });
});

describe('createApiTesterTool', () => {
  it('should create tool instance', () => {
    const tool = createApiTesterTool(mockConfig);
    expect(tool).toBeInstanceOf(ApiTesterTool);
  });
});
