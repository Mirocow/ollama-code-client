/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Redis Tool
 * Provides Redis caching, queue, and pub/sub operations
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolResult,
  type ToolResultDisplay,
} from '../../../../tools/tools.js';
import { ToolErrorType } from '../../../../tools/tool-error.js';
import { execSync } from 'node:child_process';

// ============================================================================
// Types
// ============================================================================

/**
 * Redis operation types
 */
export type RedisOperation =
  | 'get'
  | 'set'
  | 'del'
  | 'exists'
  | 'expire'
  | 'ttl'
  | 'incr'
  | 'decr'
  | 'hget'
  | 'hset'
  | 'hdel'
  | 'hgetall'
  | 'lpush'
  | 'rpush'
  | 'lpop'
  | 'rpop'
  | 'llen'
  | 'lrange'
  | 'sadd'
  | 'srem'
  | 'smembers'
  | 'zadd'
  | 'zrange'
  | 'zrem'
  | 'publish'
  | 'subscribe'
  | 'keys'
  | 'scan'
  | 'info'
  | 'dbsize'
  | 'flushdb'
  | 'ping';

/**
 * Redis connection configuration
 */
export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  database?: number;
  url?: string;
}

/**
 * Redis tool parameters
 */
export interface RedisToolParams {
  operation: RedisOperation;
  config?: RedisConfig;
  key?: string;
  value?: string;
  keys?: string[];
  field?: string;
  fields?: Record<string, string>;
  members?: string[];
  score?: number;
  channel?: string;
  pattern?: string;
  start?: number;
  stop?: number;
  ttl?: number;
  options?: {
    nx?: boolean; // Only set if not exists
    xx?: boolean; // Only set if exists
    ex?: number; // Expire in seconds
    px?: number; // Expire in milliseconds
    count?: number;
    withScores?: boolean;
  };
}

// ============================================================================
// Redis CLI Helper
// ============================================================================

function buildRedisCommand(config?: RedisConfig): string {
  if (config?.url) {
    return `redis-cli -u "${config.url}"`;
  }

  const parts = ['redis-cli'];
  const host = config?.host || 'localhost';
  const port = config?.port || 6379;

  parts.push('-h', host);
  parts.push('-p', port.toString());

  if (config?.password) {
    parts.push('-a', config.password);
  }

  if (config?.database !== undefined) {
    parts.push('-n', config.database.toString());
  }

  return parts.join(' ');
}

function executeRedis(
  args: string,
  config?: RedisConfig,
  timeout = 30000,
): { stdout: string; stderr: string; success: boolean } {
  try {
    const redisCmd = buildRedisCommand(config);
    const stdout = execSync(`${redisCmd} ${args}`, {
      encoding: 'utf-8',
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return { stdout, stderr: '', success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      stdout: '',
      stderr: errorMessage,
      success: false,
    };
  }
}

/**
 * Parse Redis bulk string reply
 */
function parseBulkString(result: string): string | null {
  const lines = result.trim().split('\n');
  if (lines[0] === '$-1') {
    return null; // Null bulk string
  }
  if (lines[0].startsWith('$')) {
    return lines.slice(1).join('\n').trim();
  }
  return result.trim();
}

/**
 * Parse Redis array reply
 */
function parseArray(result: string): string[] {
  const lines = result.trim().split('\n');
  const items: string[] = [];

  // Skip the array length line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('$')) {
      // Next line contains the value
      const value = lines[++i];
      if (value !== undefined) {
        items.push(value);
      }
    } else if (!line.startsWith('*') && line.length > 0) {
      items.push(line);
    }
  }

  return items;
}

/**
 * Parse Redis integer reply
 */
function parseInteger(result: string): number {
  const match = result.trim().match(/^:(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Try to parse directly
  const parsed = parseInt(result.trim(), 10);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================================================
// String Operations
// ============================================================================

function redisGet(key: string, config?: RedisConfig): string | null {
  const result = executeRedis(`GET "${key}"`, config);
  if (!result.success) {
    return null;
  }
  return parseBulkString(result.stdout);
}

function redisSet(
  key: string,
  value: string,
  config?: RedisConfig,
  options?: RedisToolParams['options'],
): { success: boolean; error?: string } {
  const args: string[] = ['SET', `"${key}"`, `"${value.replace(/"/g, '\\"')}"`];

  if (options?.nx) args.push('NX');
  if (options?.xx) args.push('XX');
  if (options?.ex) args.push('EX', options.ex.toString());
  if (options?.px) args.push('PX', options.px.toString());

  const result = executeRedis(args.join(' '), config);

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  return { success: true };
}

function redisDel(keys: string[], config?: RedisConfig): number {
  if (keys.length === 0) return 0;
  const result = executeRedis(
    `DEL ${keys.map((k) => `"${k}"`).join(' ')}`,
    config,
  );
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

function redisExists(key: string, config?: RedisConfig): boolean {
  const result = executeRedis(`EXISTS "${key}"`, config);
  if (!result.success) return false;
  return parseInteger(result.stdout) === 1;
}

function redisExpire(
  key: string,
  seconds: number,
  config?: RedisConfig,
): boolean {
  const result = executeRedis(`EXPIRE "${key}" ${seconds}`, config);
  if (!result.success) return false;
  return parseInteger(result.stdout) === 1;
}

function redisTTL(key: string, config?: RedisConfig): number {
  const result = executeRedis(`TTL "${key}"`, config);
  if (!result.success) return -2;
  return parseInteger(result.stdout);
}

function redisIncr(key: string, config?: RedisConfig): number {
  const result = executeRedis(`INCR "${key}"`, config);
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

function redisDecr(key: string, config?: RedisConfig): number {
  const result = executeRedis(`DECR "${key}"`, config);
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

// ============================================================================
// Hash Operations
// ============================================================================

function redisHGet(
  key: string,
  field: string,
  config?: RedisConfig,
): string | null {
  const result = executeRedis(`HGET "${key}" "${field}"`, config);
  if (!result.success) return null;
  return parseBulkString(result.stdout);
}

function redisHSet(
  key: string,
  field: string,
  value: string,
  config?: RedisConfig,
): boolean {
  const result = executeRedis(
    `HSET "${key}" "${field}" "${value.replace(/"/g, '\\"')}"`,
    config,
  );
  return result.success;
}

function redisHDel(key: string, field: string, config?: RedisConfig): boolean {
  const result = executeRedis(`HDEL "${key}" "${field}"`, config);
  if (!result.success) return false;
  return parseInteger(result.stdout) === 1;
}

function redisHGetAll(
  key: string,
  config?: RedisConfig,
): Record<string, string> {
  const result = executeRedis(`HGETALL "${key}"`, config);
  if (!result.success) return {};

  const lines = parseArray(result.stdout);
  const obj: Record<string, string> = {};

  for (let i = 0; i < lines.length; i += 2) {
    const field = lines[i];
    const value = lines[i + 1];
    if (field !== undefined && value !== undefined) {
      obj[field] = value;
    }
  }

  return obj;
}

// ============================================================================
// List Operations
// ============================================================================

function redisLPush(
  key: string,
  values: string[],
  config?: RedisConfig,
): number {
  if (values.length === 0) return 0;
  const result = executeRedis(
    `LPUSH "${key}" ${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(' ')}`,
    config,
  );
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

function redisRPush(
  key: string,
  values: string[],
  config?: RedisConfig,
): number {
  if (values.length === 0) return 0;
  const result = executeRedis(
    `RPUSH "${key}" ${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(' ')}`,
    config,
  );
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

function redisLPop(key: string, config?: RedisConfig): string | null {
  const result = executeRedis(`LPOP "${key}"`, config);
  if (!result.success) return null;
  return parseBulkString(result.stdout);
}

function redisRPop(key: string, config?: RedisConfig): string | null {
  const result = executeRedis(`RPOP "${key}"`, config);
  if (!result.success) return null;
  return parseBulkString(result.stdout);
}

function redisLLen(key: string, config?: RedisConfig): number {
  const result = executeRedis(`LLEN "${key}"`, config);
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

function redisLRange(
  key: string,
  start: number,
  stop: number,
  config?: RedisConfig,
): string[] {
  const result = executeRedis(`LRANGE "${key}" ${start} ${stop}`, config);
  if (!result.success) return [];
  return parseArray(result.stdout);
}

// ============================================================================
// Set Operations
// ============================================================================

function redisSAdd(
  key: string,
  members: string[],
  config?: RedisConfig,
): number {
  if (members.length === 0) return 0;
  const result = executeRedis(
    `SADD "${key}" ${members.map((m) => `"${m.replace(/"/g, '\\"')}"`).join(' ')}`,
    config,
  );
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

function redisSRem(
  key: string,
  members: string[],
  config?: RedisConfig,
): number {
  if (members.length === 0) return 0;
  const result = executeRedis(
    `SREM "${key}" ${members.map((m) => `"${m.replace(/"/g, '\\"')}"`).join(' ')}`,
    config,
  );
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

function redisSMembers(key: string, config?: RedisConfig): string[] {
  const result = executeRedis(`SMEMBERS "${key}"`, config);
  if (!result.success) return [];
  return parseArray(result.stdout);
}

// ============================================================================
// Sorted Set Operations
// ============================================================================

function redisZAdd(
  key: string,
  score: number,
  member: string,
  config?: RedisConfig,
): boolean {
  const result = executeRedis(
    `ZADD "${key}" ${score} "${member.replace(/"/g, '\\"')}"`,
    config,
  );
  return result.success;
}

function redisZRange(
  key: string,
  start: number,
  stop: number,
  withScores: boolean,
  config?: RedisConfig,
): string[] {
  const args = withScores ? 'WITHSCORES' : '';
  const result = executeRedis(
    `ZRANGE "${key}" ${start} ${stop} ${args}`,
    config,
  );
  if (!result.success) return [];
  return parseArray(result.stdout);
}

function redisZRem(key: string, member: string, config?: RedisConfig): boolean {
  const result = executeRedis(
    `ZREM "${key}" "${member.replace(/"/g, '\\"')}"`,
    config,
  );
  if (!result.success) return false;
  return parseInteger(result.stdout) === 1;
}

// ============================================================================
// Pub/Sub Operations
// ============================================================================

function redisPublish(
  channel: string,
  message: string,
  config?: RedisConfig,
): number {
  const result = executeRedis(
    `PUBLISH "${channel}" "${message.replace(/"/g, '\\"')}"`,
    config,
  );
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

// ============================================================================
// Key Operations
// ============================================================================

function redisKeys(pattern: string, config?: RedisConfig): string[] {
  const result = executeRedis(`KEYS "${pattern}"`, config);
  if (!result.success) return [];
  return result.stdout.trim().split('\n').filter(Boolean);
}

function redisScan(
  cursor: number,
  pattern: string,
  count: number,
  config?: RedisConfig,
): { cursor: number; keys: string[] } {
  const args = [`SCAN ${cursor}`];
  if (pattern) args.push(`MATCH "${pattern}"`);
  if (count > 0) args.push(`COUNT ${count}`);

  const result = executeRedis(args.join(' '), config);
  if (!result.success) return { cursor: 0, keys: [] };

  const lines = result.stdout.trim().split('\n');
  const newCursor = parseInt(lines[0] || '0', 10);
  const keys = lines.slice(1).filter(Boolean);

  return { cursor: newCursor, keys };
}

// ============================================================================
// Server Operations
// ============================================================================

function redisInfo(config?: RedisConfig): string {
  const result = executeRedis('INFO', config, 5000);
  if (!result.success) return `Error: ${result.stderr}`;
  return result.stdout;
}

function redisDBSize(config?: RedisConfig): number {
  const result = executeRedis('DBSIZE', config);
  if (!result.success) return 0;
  return parseInteger(result.stdout);
}

function redisFlushDB(config?: RedisConfig): boolean {
  const result = executeRedis('FLUSHDB', config);
  return result.success;
}

function redisPing(config?: RedisConfig): boolean {
  const result = executeRedis('PING', config);
  return result.success && result.stdout.includes('PONG');
}

// ============================================================================
// Tool Invocation
// ============================================================================

class RedisToolInvocation extends BaseToolInvocation<
  RedisToolParams,
  ToolResult
> {
  constructor(params: RedisToolParams) {
    super(params);
  }

  getDescription(): string {
    const { operation, key, channel } = this.params;

    switch (operation) {
      case 'get':
        return `Getting value for key ${key}`;
      case 'set':
        return `Setting value for key ${key}`;
      case 'del':
        return `Deleting keys`;
      case 'exists':
        return `Checking if key ${key} exists`;
      case 'expire':
        return `Setting expiry for key ${key}`;
      case 'ttl':
        return `Getting TTL for key ${key}`;
      case 'incr':
        return `Incrementing key ${key}`;
      case 'decr':
        return `Decrementing key ${key}`;
      case 'hget':
        return `Getting hash field from ${key}`;
      case 'hset':
        return `Setting hash field in ${key}`;
      case 'hgetall':
        return `Getting all hash fields from ${key}`;
      case 'lpush':
      case 'rpush':
        return `Pushing to list ${key}`;
      case 'lpop':
      case 'rpop':
        return `Popping from list ${key}`;
      case 'lrange':
        return `Getting list range from ${key}`;
      case 'sadd':
        return `Adding to set ${key}`;
      case 'smembers':
        return `Getting set members from ${key}`;
      case 'zadd':
        return `Adding to sorted set ${key}`;
      case 'zrange':
        return `Getting sorted set range from ${key}`;
      case 'publish':
        return `Publishing to channel ${channel}`;
      case 'keys':
        return `Listing keys matching pattern`;
      case 'scan':
        return `Scanning keys`;
      case 'info':
        return 'Getting Redis server info';
      case 'dbsize':
        return 'Getting database size';
      case 'ping':
        return 'Pinging Redis server';
      default:
        return `Redis operation: ${operation}`;
    }
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const {
      operation,
      config,
      key,
      value,
      keys,
      field,
      fields: _fields,
      members,
      score: _score,
      channel,
      pattern,
      start,
      stop,
      ttl,
      options,
    } = this.params;

    try {
      let result: string;
      let display: string;

      switch (operation) {
        case 'get': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for get operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const val = redisGet(key, config);
          if (val === null) {
            result = `Key "${key}" not found`;
            display = 'Key not found';
          } else {
            result = `## Value for "${key}"\n\n\`\`\`\n${val}\n\`\`\``;
            display = val.substring(0, 50) + (val.length > 50 ? '...' : '');
          }
          break;
        }

        case 'set': {
          if (!key || value === undefined) {
            return {
              llmContent: 'Error: key and value are required for set operation',
              returnDisplay: 'Key and value required',
              error: {
                message: 'Key and value are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const setResult = redisSet(key, value, config, options);
          if (!setResult.success) {
            return {
              llmContent: `Failed to set key: ${setResult.error}`,
              returnDisplay: 'Set failed',
              error: {
                message: setResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Key Set\n\n**Key:** ${key}\n**Value:** ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`;
          if (options?.ex) result += `\n**Expires in:** ${options.ex} seconds`;
          display = `Key ${key} set`;
          break;
        }

        case 'del': {
          const keysToDelete = keys || (key ? [key] : []);
          if (keysToDelete.length === 0) {
            return {
              llmContent:
                'Error: at least one key is required for del operation',
              returnDisplay: 'Key required',
              error: {
                message: 'At least one key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const deleted = redisDel(keysToDelete, config);
          result = `## Keys Deleted\n\n**Count:** ${deleted}\n**Keys:** ${keysToDelete.join(', ')}`;
          display = `${deleted} keys deleted`;
          break;
        }

        case 'exists': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for exists operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const exists = redisExists(key, config);
          result = `## Key Exists\n\n**Key:** ${key}\n**Exists:** ${exists}`;
          display = exists ? 'Key exists' : 'Key not found';
          break;
        }

        case 'expire': {
          if (!key || ttl === undefined) {
            return {
              llmContent:
                'Error: key and ttl are required for expire operation',
              returnDisplay: 'Key and TTL required',
              error: {
                message: 'Key and TTL are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const success = redisExpire(key, ttl, config);
          result = `## Expiry Set\n\n**Key:** ${key}\n**TTL:** ${ttl} seconds\n**Success:** ${success}`;
          display = success ? `Expiry set for ${key}` : 'Failed to set expiry';
          break;
        }

        case 'ttl': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for ttl operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const ttlValue = redisTTL(key, config);
          let ttlMeaning: string;
          if (ttlValue === -2) ttlMeaning = 'Key does not exist';
          else if (ttlValue === -1) ttlMeaning = 'No expiry set';
          else ttlMeaning = `${ttlValue} seconds`;

          result = `## TTL for "${key}"\n\n**TTL:** ${ttlMeaning}`;
          display = ttlMeaning;
          break;
        }

        case 'incr':
        case 'decr': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for incr/decr operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const newValue =
            operation === 'incr'
              ? redisIncr(key, config)
              : redisDecr(key, config);
          result = `## ${operation.toUpperCase()}\n\n**Key:** ${key}\n**New Value:** ${newValue}`;
          display = `Value: ${newValue}`;
          break;
        }

        case 'hget': {
          if (!key || !field) {
            return {
              llmContent:
                'Error: key and field are required for hget operation',
              returnDisplay: 'Key and field required',
              error: {
                message: 'Key and field are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const val = redisHGet(key, field, config);
          result = `## Hash Field\n\n**Key:** ${key}\n**Field:** ${field}\n**Value:** ${val || '(not found)'}`;
          display = val || 'Field not found';
          break;
        }

        case 'hset': {
          if (!key || !field || value === undefined) {
            return {
              llmContent:
                'Error: key, field, and value are required for hset operation',
              returnDisplay: 'Key, field, and value required',
              error: {
                message: 'Key, field, and value are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const success = redisHSet(key, field, value, config);
          result = `## Hash Field Set\n\n**Key:** ${key}\n**Field:** ${field}\n**Success:** ${success}`;
          display = success ? 'Field set' : 'Failed to set field';
          break;
        }

        case 'hgetall': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for hgetall operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const hash = redisHGetAll(key, config);
          const entries = Object.entries(hash);
          result = `## Hash "${key}"\n\n`;
          if (entries.length === 0) {
            result += 'Hash is empty or does not exist.';
          } else {
            result += '| Field | Value |\n|---|---|\n';
            entries.forEach(([f, v]) => {
              result += `| ${f} | ${v.substring(0, 50)}${v.length > 50 ? '...' : ''} |\n`;
            });
          }
          display = `${entries.length} fields`;
          break;
        }

        case 'lpush':
        case 'rpush': {
          if (!key || !members?.length) {
            return {
              llmContent:
                'Error: key and members are required for list push operation',
              returnDisplay: 'Key and members required',
              error: {
                message: 'Key and members are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const length =
            operation === 'lpush'
              ? redisLPush(key, members, config)
              : redisRPush(key, members, config);
          result = `## List Push\n\n**Key:** ${key}\n**Direction:** ${operation === 'lpush' ? 'LEFT' : 'RIGHT'}\n**New Length:** ${length}`;
          display = `List length: ${length}`;
          break;
        }

        case 'lpop':
        case 'rpop': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for list pop operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const val =
            operation === 'lpop'
              ? redisLPop(key, config)
              : redisRPop(key, config);
          result = `## List Pop\n\n**Key:** ${key}\n**Direction:** ${operation === 'lpop' ? 'LEFT' : 'RIGHT'}\n**Value:** ${val || '(list empty)'}`;
          display = val || 'List empty';
          break;
        }

        case 'lrange': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for lrange operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const elements = redisLRange(key, start ?? 0, stop ?? -1, config);
          result = `## List Range "${key}"\n\n`;
          if (elements.length === 0) {
            result += 'List is empty or does not exist.';
          } else {
            result += elements.map((el, idx) => `${idx + 1}. ${el}`).join('\n');
          }
          display = `${elements.length} elements`;
          break;
        }

        case 'sadd': {
          if (!key || !members?.length) {
            return {
              llmContent:
                'Error: key and members are required for sadd operation',
              returnDisplay: 'Key and members required',
              error: {
                message: 'Key and members are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const added = redisSAdd(key, members, config);
          result = `## Set Add\n\n**Key:** ${key}\n**Members Added:** ${added}`;
          display = `${added} members added`;
          break;
        }

        case 'smembers': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for smembers operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const members = redisSMembers(key, config);
          result = `## Set Members "${key}"\n\n`;
          if (members.length === 0) {
            result += 'Set is empty or does not exist.';
          } else {
            result += members.map((m) => `- ${m}`).join('\n');
          }
          display = `${members.length} members`;
          break;
        }

        case 'publish': {
          if (!channel || value === undefined) {
            return {
              llmContent:
                'Error: channel and value (message) are required for publish operation',
              returnDisplay: 'Channel and message required',
              error: {
                message: 'Channel and message are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const subscribers = redisPublish(channel, value, config);
          result = `## Message Published\n\n**Channel:** ${channel}\n**Subscribers:** ${subscribers}`;
          display = `Published to ${subscribers} subscribers`;
          break;
        }

        case 'keys': {
          const keysResult = redisKeys(pattern || '*', config);
          result = `## Keys matching "${pattern || '*'}"\n\n`;
          if (keysResult.length === 0) {
            result += 'No keys found.';
          } else {
            result += keysResult
              .slice(0, 100)
              .map((k) => `- ${k}`)
              .join('\n');
            if (keysResult.length > 100) {
              result += `\n\n*(Showing first 100 of ${keysResult.length} keys)*`;
            }
          }
          display = `${keysResult.length} keys`;
          break;
        }

        case 'scan': {
          const scanResult = redisScan(
            start ?? 0,
            pattern || '*',
            options?.count || 100,
            config,
          );
          result = `## Scan Result\n\n**Cursor:** ${scanResult.cursor}\n**Keys Found:**\n`;
          if (scanResult.keys.length === 0) {
            result += 'No keys found.';
          } else {
            result += scanResult.keys.map((k) => `- ${k}`).join('\n');
          }
          display = `${scanResult.keys.length} keys (cursor: ${scanResult.cursor})`;
          break;
        }

        case 'info': {
          const info = redisInfo(config);
          result = `## Redis Info\n\n\`\`\`\n${info}\n\`\`\``;
          display = 'Redis server info';
          break;
        }

        case 'dbsize': {
          const size = redisDBSize(config);
          result = `## Database Size\n\n**Key Count:** ${size.toLocaleString()}`;
          display = `${size.toLocaleString()} keys`;
          break;
        }

        case 'ping': {
          const pong = redisPing(config);
          result = `## PING\n\n**Response:** ${pong ? 'PONG' : 'Failed'}`;
          display = pong ? 'PONG' : 'Connection failed';
          break;
        }

        case 'flushdb': {
          const success = redisFlushDB(config);
          result = `## FLUSHDB\n\n**Success:** ${success}`;
          display = success ? 'Database flushed' : 'Flush failed';
          break;
        }

        case 'hdel': {
          if (!key || !field) {
            return {
              llmContent:
                'Error: key and field are required for hdel operation',
              returnDisplay: 'Key and field required',
              error: {
                message: 'Key and field are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const success = redisHDel(key, field, config);
          result = `## Hash Field Deleted\n\n**Key:** ${key}\n**Field:** ${field}\n**Success:** ${success}`;
          display = success ? 'Field deleted' : 'Field not found';
          break;
        }

        case 'llen': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for llen operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const length = redisLLen(key, config);
          result = `## List Length\n\n**Key:** ${key}\n**Length:** ${length}`;
          display = `Length: ${length}`;
          break;
        }

        case 'srem': {
          if (!key || !members?.length) {
            return {
              llmContent:
                'Error: key and members are required for srem operation',
              returnDisplay: 'Key and members required',
              error: {
                message: 'Key and members are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const removed = redisSRem(key, members, config);
          result = `## Set Remove\n\n**Key:** ${key}\n**Members Removed:** ${removed}`;
          display = `${removed} members removed`;
          break;
        }

        case 'zadd': {
          if (!key || !_score || !value) {
            return {
              llmContent:
                'Error: key, score, and value (member) are required for zadd operation',
              returnDisplay: 'Key, score, and member required',
              error: {
                message: 'Key, score, and member are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const success = redisZAdd(key, _score, value, config);
          result = `## Sorted Set Add\n\n**Key:** ${key}\n**Score:** ${_score}\n**Member:** ${value}\n**Success:** ${success}`;
          display = success ? 'Member added' : 'Failed to add';
          break;
        }

        case 'zrange': {
          if (!key) {
            return {
              llmContent: 'Error: key is required for zrange operation',
              returnDisplay: 'Key required',
              error: {
                message: 'Key is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const elements = redisZRange(
            key,
            start ?? 0,
            stop ?? -1,
            options?.withScores ?? false,
            config,
          );
          result = `## Sorted Set Range "${key}"\n\n`;
          if (elements.length === 0) {
            result += 'Sorted set is empty or does not exist.';
          } else {
            result += elements.map((el, idx) => `${idx + 1}. ${el}`).join('\n');
          }
          display = `${elements.length} elements`;
          break;
        }

        case 'zrem': {
          if (!key || !value) {
            return {
              llmContent:
                'Error: key and value (member) are required for zrem operation',
              returnDisplay: 'Key and member required',
              error: {
                message: 'Key and member are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const success = redisZRem(key, value, config);
          result = `## Sorted Set Remove\n\n**Key:** ${key}\n**Member:** ${value}\n**Success:** ${success}`;
          display = success ? 'Member removed' : 'Member not found';
          break;
        }

        default:
          return {
            llmContent: `Unknown operation: ${operation}`,
            returnDisplay: 'Unknown operation',
            error: {
              message: `Unknown operation: ${operation}`,
              type: ToolErrorType.INVALID_TOOL_PARAMS,
            },
          };
      }

      return {
        llmContent: result,
        returnDisplay: display,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Redis operation failed: ${errorMessage}`,
        returnDisplay: errorMessage,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Redis Tool class definition
 */
export class RedisTool extends BaseDeclarativeTool<RedisToolParams, ToolResult> {
  static readonly Name = 'redis';
  
  constructor() {
    super(
      RedisTool.Name,
      'Redis',
      `Provides Redis operations for caching, queuing, and pub/sub messaging.

String Operations:
- get/set/del: Basic key-value operations
- exists: Check if key exists
- expire/ttl: Manage key expiration
- incr/decr: Atomic counters

Hash Operations:
- hget/hset/hdel: Hash field operations
- hgetall: Get all hash fields

List Operations:
- lpush/rpush: Add to list ends
- lpop/rpop: Remove from list ends
- lrange: Get list range

Set Operations:
- sadd/srem: Add/remove set members
- smembers: Get all members

Sorted Set Operations:
- zadd/zrem: Add/remove with scores
- zrange: Get range by score

Pub/Sub:
- publish: Publish message to channel

Server:
- keys/scan: Key discovery
- info: Server information
- dbsize: Database size
- ping: Connection test

Use this tool for caching, message queues, and real-time features.`,
      Kind.Read,
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'get',
              'set',
              'del',
              'exists',
              'expire',
              'ttl',
              'incr',
              'decr',
              'hget',
              'hset',
              'hdel',
              'hgetall',
              'lpush',
              'rpush',
              'lpop',
              'rpop',
              'llen',
              'lrange',
              'sadd',
              'srem',
              'smembers',
              'zadd',
              'zrange',
              'zrem',
              'publish',
              'subscribe',
              'keys',
              'scan',
              'info',
              'dbsize',
              'flushdb',
              'ping',
            ],
            description: 'Redis operation to perform',
          },
          config: {
            type: 'object',
            properties: {
              host: {
                type: 'string',
                description: 'Redis host (default: localhost)',
              },
              port: {
                type: 'number',
                description: 'Redis port (default: 6379)',
              },
              password: { type: 'string', description: 'Redis password' },
              database: { type: 'number', description: 'Database number' },
              url: { type: 'string', description: 'Redis connection URL' },
            },
          },
          key: { type: 'string', description: 'Redis key' },
          value: { type: 'string', description: 'Value to set' },
          keys: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keys for multi-key operations',
          },
          field: { type: 'string', description: 'Hash field name' },
          fields: { type: 'object', description: 'Hash fields and values' },
          members: {
            type: 'array',
            items: { type: 'string' },
            description: 'Set/list members',
          },
          score: { type: 'number', description: 'Score for sorted set' },
          channel: { type: 'string', description: 'Pub/sub channel' },
          pattern: { type: 'string', description: 'Key pattern for search' },
          start: { type: 'number', description: 'Start index' },
          stop: { type: 'number', description: 'Stop index' },
          ttl: { type: 'number', description: 'Time to live in seconds' },
          options: {
            type: 'object',
            properties: {
              nx: { type: 'boolean', description: 'Only set if not exists' },
              xx: { type: 'boolean', description: 'Only set if exists' },
              ex: { type: 'number', description: 'Expire in seconds' },
              px: { type: 'number', description: 'Expire in milliseconds' },
              count: { type: 'number', description: 'Count for scan' },
              withScores: {
                type: 'boolean',
                description: 'Include scores in zrange',
              },
            },
          },
        },
        required: ['operation'],
      },
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  protected override createInvocation(
    params: RedisToolParams,
  ): RedisToolInvocation {
    return new RedisToolInvocation(params);
  }
}

export const redisTool = new RedisTool();
export default redisTool;
