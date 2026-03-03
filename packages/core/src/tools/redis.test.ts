/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  RedisToolParams,
  RedisOperation,
  RedisConfig,
} from './redis.js';
import redisTool from './redis.js';

// Mock execSync
vi.mock('node:child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    // Mock responses based on command
    if (cmd.includes('GET')) {
      return '"test_value"';
    }
    if (cmd.includes('SET')) {
      return 'OK';
    }
    if (cmd.includes('KEYS')) {
      return 'key1\nkey2\nkey3';
    }
    if (cmd.includes('INFO')) {
      return '# Server\nredis_version:7.0.0\n';
    }
    if (cmd.includes('PING')) {
      return 'PONG';
    }
    if (cmd.includes('DBSIZE')) {
      return ':100';
    }
    return '';
  }),
}));

describe('RedisTool', () => {
  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(redisTool.name).toBe('redis');
    });

    it('should have correct display name', () => {
      expect(redisTool.displayName).toBe('Redis');
    });

    it('should have description', () => {
      expect(redisTool.description).toContain('Redis');
    });

    it('should have valid parameter schema', () => {
      expect(redisTool.parameterSchema).toBeDefined();
      expect(redisTool.parameterSchema.type).toBe('object');
      expect(redisTool.parameterSchema.properties).toHaveProperty('operation');
    });
  });

  describe('Parameter Validation', () => {
    it('should require operation parameter', () => {
      const params = {} as RedisToolParams;
      const error = redisTool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid params', () => {
      const params: RedisToolParams = {
        operation: 'ping',
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Redis Operations', () => {
    const stringOperations: RedisOperation[] = [
      'get',
      'set',
      'del',
      'exists',
      'expire',
      'ttl',
      'incr',
      'decr',
    ];

    stringOperations.forEach((operation) => {
      it(`should accept '${operation}' operation`, () => {
        const params: RedisToolParams = {
          operation,
          key: 'test-key',
        };
        const error = redisTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });

    const hashOperations: RedisOperation[] = ['hget', 'hset', 'hdel', 'hgetall'];

    hashOperations.forEach((operation) => {
      it(`should accept '${operation}' hash operation`, () => {
        const params: RedisToolParams = {
          operation,
          key: 'test-hash',
          field: 'field1',
        };
        const error = redisTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });

    const listOperations: RedisOperation[] = [
      'lpush',
      'rpush',
      'lpop',
      'rpop',
      'llen',
      'lrange',
    ];

    listOperations.forEach((operation) => {
      it(`should accept '${operation}' list operation`, () => {
        const params: RedisToolParams = {
          operation,
          key: 'test-list',
        };
        const error = redisTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });

    const setOperations: RedisOperation[] = ['sadd', 'srem', 'smembers'];

    setOperations.forEach((operation) => {
      it(`should accept '${operation}' set operation`, () => {
        const params: RedisToolParams = {
          operation,
          key: 'test-set',
        };
        const error = redisTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });

    const sortedSetOperations: RedisOperation[] = ['zadd', 'zrange', 'zrem'];

    sortedSetOperations.forEach((operation) => {
      it(`should accept '${operation}' sorted set operation`, () => {
        const params: RedisToolParams = {
          operation,
          key: 'test-zset',
        };
        const error = redisTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });

    const serverOperations: RedisOperation[] = [
      'ping',
      'info',
      'dbsize',
      'keys',
      'scan',
      'flushdb',
    ];

    serverOperations.forEach((operation) => {
      it(`should accept '${operation}' server operation`, () => {
        const params: RedisToolParams = {
          operation,
        };
        const error = redisTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });

    it('should accept publish operation', () => {
      const params: RedisToolParams = {
        operation: 'publish',
        channel: 'my-channel',
        value: 'Hello World',
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept subscribe operation', () => {
      const params: RedisToolParams = {
        operation: 'subscribe',
        channel: 'my-channel',
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Redis Configuration', () => {
    it('should accept host configuration', () => {
      const config: RedisConfig = {
        host: 'localhost',
      };
      const params: RedisToolParams = {
        operation: 'ping',
        config,
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept port configuration', () => {
      const config: RedisConfig = {
        host: 'localhost',
        port: 6379,
      };
      const params: RedisToolParams = {
        operation: 'ping',
        config,
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept password configuration', () => {
      const config: RedisConfig = {
        host: 'localhost',
        password: 'secret',
      };
      const params: RedisToolParams = {
        operation: 'ping',
        config,
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept database number', () => {
      const config: RedisConfig = {
        host: 'localhost',
        database: 1,
      };
      const params: RedisToolParams = {
        operation: 'ping',
        config,
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept URL configuration', () => {
      const config: RedisConfig = {
        url: 'redis://localhost:6379',
      };
      const params: RedisToolParams = {
        operation: 'ping',
        config,
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Set Operation Options', () => {
    it('should accept NX option', () => {
      const params: RedisToolParams = {
        operation: 'set',
        key: 'test-key',
        value: 'test-value',
        options: {
          nx: true,
        },
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept XX option', () => {
      const params: RedisToolParams = {
        operation: 'set',
        key: 'test-key',
        value: 'test-value',
        options: {
          xx: true,
        },
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept EX option (expire in seconds)', () => {
      const params: RedisToolParams = {
        operation: 'set',
        key: 'test-key',
        value: 'test-value',
        options: {
          ex: 3600,
        },
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept PX option (expire in milliseconds)', () => {
      const params: RedisToolParams = {
        operation: 'set',
        key: 'test-key',
        value: 'test-value',
        options: {
          px: 3600000,
        },
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('List Operation Options', () => {
    it('should accept members for lpush/rpush', () => {
      const params: RedisToolParams = {
        operation: 'lpush',
        key: 'my-list',
        members: ['value1', 'value2', 'value3'],
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Sorted Set Operation Options', () => {
    it('should accept score for zadd', () => {
      const params: RedisToolParams = {
        operation: 'zadd',
        key: 'my-zset',
        score: 100,
        value: 'member1',
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept withScores for zrange', () => {
      const params: RedisToolParams = {
        operation: 'zrange',
        key: 'my-zset',
        start: 0,
        stop: -1,
        options: {
          withScores: true,
        },
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Scan Options', () => {
    it('should accept count option', () => {
      const params: RedisToolParams = {
        operation: 'scan',
        start: 0,
        options: {
          count: 100,
        },
      };
      const error = redisTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });
});

describe('RedisToolInvocation', () => {
  it('should create invocation with valid params', () => {
    const params: RedisToolParams = {
      operation: 'ping',
    };
    const invocation = redisTool.createInvocation(params);
    expect(invocation).toBeDefined();
    expect(invocation.getDescription()).toContain('Ping');
  });

  it('should create invocation for get operation', () => {
    const params: RedisToolParams = {
      operation: 'get',
      key: 'my-key',
    };
    const invocation = redisTool.createInvocation(params);
    expect(invocation.getDescription()).toContain('my-key');
  });

  it('should create invocation for set operation', () => {
    const params: RedisToolParams = {
      operation: 'set',
      key: 'my-key',
      value: 'my-value',
    };
    const invocation = redisTool.createInvocation(params);
    expect(invocation.getDescription()).toContain('set');
    expect(invocation.getDescription()).toContain('my-key');
  });

  it('should create invocation for info operation', () => {
    const params: RedisToolParams = {
      operation: 'info',
    };
    const invocation = redisTool.createInvocation(params);
    expect(invocation.getDescription()).toContain('info');
  });
});
