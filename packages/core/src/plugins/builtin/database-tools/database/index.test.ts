/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  DatabaseToolParams,
  DatabaseType,
  DatabaseOperation,
  QueryResult,
  TableSchema,
} from './index.js';
import databaseTool from './index.js';

describe('DatabaseTool', () => {
  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(databaseTool.name).toBe('database');
    });

    it('should have correct display name', () => {
      expect(databaseTool.displayName).toBe('Database');
    });

    it('should have description', () => {
      expect(databaseTool.description).toContain('database operations');
    });

    it('should have valid parameter schema', () => {
      expect(databaseTool.parameterSchema).toBeDefined();
      expect(databaseTool.parameterSchema.type).toBe('object');
      expect(databaseTool.parameterSchema.properties).toHaveProperty('operation');
      expect(databaseTool.parameterSchema.properties).toHaveProperty('config');
    });
  });

  describe('Parameter Validation', () => {
    it('should require operation parameter', () => {
      const params = { config: { type: 'sqlite' as const, database: 'test.db' } } as DatabaseToolParams;
      const error = databaseTool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should require config parameter', () => {
      const params = { operation: 'query' as DatabaseOperation } as DatabaseToolParams;
      const error = databaseTool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid params', () => {
      const params: DatabaseToolParams = {
        operation: 'tables',
        config: {
          type: 'sqlite',
          database: 'test.db',
        },
      };
      const error = databaseTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Database Types', () => {
    const validTypes: DatabaseType[] = ['sqlite', 'postgresql', 'mysql', 'mariadb'];

    validTypes.forEach((type) => {
      it(`should accept '${type}' database type`, () => {
        const params: DatabaseToolParams = {
          operation: 'tables',
          config: {
            type,
            database: type === 'sqlite' ? 'test.db' : 'testdb',
          },
        };
        const error = databaseTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Database Operations', () => {
    const validOperations: DatabaseOperation[] = [
      'query',
      'execute',
      'schema',
      'tables',
      'describe',
      'migrate',
      'backup',
      'restore',
    ];

    validOperations.forEach((operation) => {
      it(`should accept '${operation}' operation`, () => {
        const params: DatabaseToolParams = {
          operation,
          config: {
            type: 'sqlite',
            database: 'test.db',
          },
        };
        const error = databaseTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('SQLite Configuration', () => {
    it('should accept filename for sqlite', () => {
      const params: DatabaseToolParams = {
        operation: 'tables',
        config: {
          type: 'sqlite',
          database: 'test.db',
          filename: 'custom.db',
        },
      };
      const error = databaseTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('PostgreSQL Configuration', () => {
    it('should accept host and port for postgresql', () => {
      const params: DatabaseToolParams = {
        operation: 'tables',
        config: {
          type: 'postgresql',
          database: 'testdb',
          host: 'localhost',
          port: 5432,
        },
      };
      const error = databaseTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept username and password for postgresql', () => {
      const params: DatabaseToolParams = {
        operation: 'tables',
        config: {
          type: 'postgresql',
          database: 'testdb',
          username: 'user',
          password: 'pass',
        },
      };
      const error = databaseTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('MySQL Configuration', () => {
    it('should accept host and port for mysql', () => {
      const params: DatabaseToolParams = {
        operation: 'tables',
        config: {
          type: 'mysql',
          database: 'testdb',
          host: 'localhost',
          port: 3306,
        },
      };
      const error = databaseTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept username and password for mysql', () => {
      const params: DatabaseToolParams = {
        operation: 'tables',
        config: {
          type: 'mysql',
          database: 'testdb',
          username: 'root',
          password: 'secret',
        },
      };
      const error = databaseTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });
});

describe('Database Types', () => {
  it('should define QueryResult interface correctly', () => {
    const result: QueryResult = {
      rows: [{ id: 1, name: 'test' }],
      rowCount: 1,
      columns: ['id', 'name'],
    };
    expect(result.rows).toHaveLength(1);
    expect(result.rowCount).toBe(1);
    expect(result.columns).toHaveLength(2);
  });

  it('should define QueryResult with error', () => {
    const result: QueryResult = {
      rows: [],
      rowCount: 0,
      error: 'Connection failed',
    };
    expect(result.error).toBe('Connection failed');
    expect(result.rows).toHaveLength(0);
  });

  it('should define TableSchema interface correctly', () => {
    const schema: TableSchema = {
      name: 'users',
      columns: [
        {
          name: 'id',
          type: 'INTEGER',
          nullable: false,
          primaryKey: true,
        },
        {
          name: 'name',
          type: 'VARCHAR(255)',
          nullable: true,
          primaryKey: false,
        },
      ],
      indexes: [
        {
          name: 'idx_name',
          columns: ['name'],
          unique: false,
        },
      ],
    };
    expect(schema.name).toBe('users');
    expect(schema.columns).toHaveLength(2);
    expect(schema.indexes).toHaveLength(1);
  });

  it('should define TableSchema column with foreignKey', () => {
    const schema: TableSchema = {
      name: 'orders',
      columns: [
        {
          name: 'user_id',
          type: 'INTEGER',
          nullable: false,
          primaryKey: false,
          foreignKey: {
            table: 'users',
            column: 'id',
          },
        },
      ],
    };
    expect(schema.columns[0].foreignKey?.table).toBe('users');
    expect(schema.columns[0].foreignKey?.column).toBe('id');
  });
});

describe('DatabaseToolInvocation', () => {
  it('should create invocation with valid params', () => {
    const params: DatabaseToolParams = {
      operation: 'tables',
      config: {
        type: 'sqlite',
        database: 'test.db',
      },
    };
    const invocation = databaseTool.createInvocation(params);
    expect(invocation).toBeDefined();
    expect(invocation.getDescription()).toContain('tables');
  });

  it('should create invocation for query operation', () => {
    const params: DatabaseToolParams = {
      operation: 'query',
      config: {
        type: 'sqlite',
        database: 'test.db',
      },
      query: 'SELECT * FROM users',
    };
    const invocation = databaseTool.createInvocation(params);
    expect(invocation.getDescription()).toContain('query');
  });

  it('should create invocation for backup operation', () => {
    const params: DatabaseToolParams = {
      operation: 'backup',
      config: {
        type: 'sqlite',
        database: 'test.db',
      },
      backupPath: '/backup/test.db',
    };
    const invocation = databaseTool.createInvocation(params);
    expect(invocation.getDescription()).toContain('backup');
  });
});
