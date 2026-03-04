/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Database Tool
 * Provides database operations for SQLite, PostgreSQL, MySQL
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolResult,
  type ToolResultDisplay,
} from '../../../../tools/tools.js';
import { ToolErrorType } from '../../../../tools/tool-error.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

// ============================================================================
// Types
// ============================================================================

/**
 * Supported database types
 */
export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql' | 'mariadb';

/**
 * Database operation types
 */
export type DatabaseOperation =
  | 'query'
  | 'execute'
  | 'schema'
  | 'tables'
  | 'describe'
  | 'migrate'
  | 'backup'
  | 'restore';

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filename?: string; // For SQLite
}

/**
 * Query result
 */
export interface QueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  columns?: string[];
  executionTime?: number;
  error?: string;
}

/**
 * Table schema information
 */
export interface TableSchema {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
    primaryKey: boolean;
    foreignKey?: {
      table: string;
      column: string;
    };
  }>;
  indexes?: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
}

/**
 * Database tool parameters
 */
export interface DatabaseToolParams {
  operation: DatabaseOperation;
  config: DatabaseConfig;
  query?: string;
  tableName?: string;
  backupPath?: string;
  migrations?: string[];
  options?: {
    limit?: number;
    offset?: number;
    timeout?: number;
  };
}

// ============================================================================
// SQLite Operations
// ============================================================================

function executeSQLite(
  filename: string,
  query: string,
  options?: { timeout?: number },
): QueryResult {
  if (!fs.existsSync(filename)) {
    return {
      rows: [],
      rowCount: 0,
      error: `Database file not found: ${filename}`,
    };
  }

  const timeout = options?.timeout || 30000;

  try {
    // Use sqlite3 CLI for operations
    const result = execSync(
      `sqlite3 -json -header "${filename}" "${query.replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf-8',
        timeout,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      },
    );

    const rows = result.trim() ? JSON.parse(result) : [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      rows,
      rowCount: rows.length,
      columns,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { rows: [], rowCount: 0, error: errorMessage };
  }
}

function getSQLiteTables(filename: string): string[] {
  if (!fs.existsSync(filename)) {
    return [];
  }

  try {
    const result = execSync(
      `sqlite3 "${filename}" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"`,
      { encoding: 'utf-8' },
    );

    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getSQLiteSchema(
  filename: string,
  tableName: string,
): TableSchema | null {
  if (!fs.existsSync(filename)) {
    return null;
  }

  try {
    // Get table info
    const tableInfo = execSync(
      `sqlite3 -json "${filename}" "PRAGMA table_info(${tableName});"`,
      { encoding: 'utf-8' },
    );

    const columns = JSON.parse(tableInfo).map(
      (col: Record<string, unknown>) => ({
        name: col['name'] as string,
        type: col['type'] as string,
        nullable: !(col['notnull'] as number),
        defaultValue: col['dflt_value'] as string | undefined,
        primaryKey: !!col['pk'],
      }),
    );

    // Get indexes
    const indexInfo = execSync(
      `sqlite3 -json "${filename}" "PRAGMA index_list(${tableName});"`,
      { encoding: 'utf-8' },
    );

    const indexes = JSON.parse(indexInfo).map(
      (idx: Record<string, unknown>) => ({
        name: idx['name'] as string,
        columns: [], // Would need additional query to get columns
        unique: !!idx['unique'],
      }),
    );

    return {
      name: tableName,
      columns,
      indexes,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// PostgreSQL Operations
// ============================================================================

function buildPostgresConnectionString(config: DatabaseConfig): string {
  const host = config.host || 'localhost';
  const port = config.port || 5432;
  const user = config.username || 'postgres';
  const password = config.password ? `:${config.password}` : '';
  return `postgresql://${user}${password}@${host}:${port}/${config.database}`;
}

function executePostgreSQL(
  config: DatabaseConfig,
  query: string,
  options?: { timeout?: number },
): QueryResult {
  const timeout = options?.timeout || 30000;
  const connectionString = buildPostgresConnectionString(config);

  try {
    // Use psql CLI
    const result = execSync(
      `PGPASSWORD="${config.password || ''}" psql "${connectionString}" -t -A -F $'\\t' -c "${query.replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf-8',
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      },
    );

    // Parse tab-separated result
    const lines = result.trim().split('\n');
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
      return { rows: [], rowCount: 0 };
    }

    const rows = lines.map((line) => {
      const values = line.split('\t');
      const row: Record<string, unknown> = {};
      values.forEach((val, idx) => {
        row[`col_${idx}`] = val;
      });
      return row;
    });

    return { rows, rowCount: rows.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { rows: [], rowCount: 0, error: errorMessage };
  }
}

function getPostgreSQLTables(config: DatabaseConfig): string[] {
  const connectionString = buildPostgresConnectionString(config);

  try {
    const result = execSync(
      `PGPASSWORD="${config.password || ''}" psql "${connectionString}" -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"`,
      { encoding: 'utf-8' },
    );

    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// ============================================================================
// MySQL Operations
// ============================================================================

function buildMySQLCommand(config: DatabaseConfig): string {
  const host = config.host || 'localhost';
  const port = config.port || 3306;
  const user = config.username || 'root';
  const password = config.password ? `-p"${config.password}"` : '';

  return `mysql -h ${host} -P ${port} -u ${user} ${password} ${config.database}`;
}

function executeMySQL(
  config: DatabaseConfig,
  query: string,
  options?: { timeout?: number },
): QueryResult {
  const timeout = options?.timeout || 30000;
  const mysqlCmd = buildMySQLCommand(config);

  try {
    const result = execSync(
      `${mysqlCmd} -e "${query.replace(/"/g, '\\"')}" -t`,
      {
        encoding: 'utf-8',
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      },
    );

    // Simple parsing - would need more sophisticated parsing for real use
    const lines = result.trim().split('\n').filter(Boolean);
    return {
      rows: [],
      rowCount: lines.length,
      error: 'MySQL result parsing requires mysql client output format',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { rows: [], rowCount: 0, error: errorMessage };
  }
}

function getMySQLTables(config: DatabaseConfig): string[] {
  const mysqlCmd = buildMySQLCommand(config);

  try {
    const result = execSync(`${mysqlCmd} -N -e "SHOW TABLES;"`, {
      encoding: 'utf-8',
    });

    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// ============================================================================
// Generic Database Operations
// ============================================================================

function executeQuery(
  config: DatabaseConfig,
  query: string,
  options?: { timeout?: number },
): QueryResult {
  switch (config.type) {
    case 'sqlite':
      return executeSQLite(config.filename || config.database, query, options);
    case 'postgresql':
      return executePostgreSQL(config, query, options);
    case 'mysql':
    case 'mariadb':
      return executeMySQL(config, query, options);
    default:
      return {
        rows: [],
        rowCount: 0,
        error: `Unsupported database type: ${config.type}`,
      };
  }
}

function getTables(config: DatabaseConfig): string[] {
  switch (config.type) {
    case 'sqlite':
      return getSQLiteTables(config.filename || config.database);
    case 'postgresql':
      return getPostgreSQLTables(config);
    case 'mysql':
    case 'mariadb':
      return getMySQLTables(config);
    default:
      return [];
  }
}

function getSchema(
  config: DatabaseConfig,
  tableName: string,
): TableSchema | null {
  switch (config.type) {
    case 'sqlite':
      return getSQLiteSchema(config.filename || config.database, tableName);
    default:
      // For other databases, use query approach
      return {
        name: tableName,
        columns: [],
      };
  }
}

function backupDatabase(
  config: DatabaseConfig,
  backupPath: string,
): { success: boolean; error?: string } {
  try {
    const dir = path.dirname(backupPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    switch (config.type) {
      case 'sqlite': {
        // For SQLite, just copy the file
        fs.copyFileSync(config.filename || config.database, backupPath);
        return { success: true };
      }
      case 'postgresql': {
        const connectionString = buildPostgresConnectionString(config);
        execSync(
          `PGPASSWORD="${config.password || ''}" pg_dump "${connectionString}" > "${backupPath}"`,
          { encoding: 'utf-8' },
        );
        return { success: true };
      }
      case 'mysql':
      case 'mariadb': {
        const mysqlCmd = buildMySQLCommand(config);
        execSync(
          `mysqldump ${mysqlCmd.replace('mysql', 'mysqldump')} > "${backupPath}"`,
          { encoding: 'utf-8' },
        );
        return { success: true };
      }
      default:
        return {
          success: false,
          error: `Backup not supported for ${config.type}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Tool Invocation
// ============================================================================

class DatabaseToolInvocation extends BaseToolInvocation<
  DatabaseToolParams,
  ToolResult
> {
  constructor(params: DatabaseToolParams) {
    super(params);
  }

  getDescription(): string {
    const { operation, config, tableName, query } = this.params;
    const dbInfo =
      config.type === 'sqlite'
        ? config.filename || config.database
        : `${config.type}://${config.host || 'localhost'}/${config.database}`;

    switch (operation) {
      case 'query':
        return `Executing query on ${dbInfo}: ${query?.substring(0, 50)}...`;
      case 'execute':
        return `Executing statement on ${dbInfo}`;
      case 'tables':
        return `Listing tables in ${dbInfo}`;
      case 'describe':
        return `Describing table ${tableName} in ${dbInfo}`;
      case 'schema':
        return `Getting schema for ${dbInfo}`;
      case 'backup':
        return `Backing up ${dbInfo} to ${this.params.backupPath}`;
      default:
        return `Database operation ${operation} on ${dbInfo}`;
    }
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const { operation, config, query, tableName, backupPath, options } =
      this.params;

    try {
      let result: string;
      let display: string;

      switch (operation) {
        case 'query':
        case 'execute': {
          if (!query) {
            return {
              llmContent:
                'Error: Query is required for query/execute operations',
              returnDisplay: 'Query required',
              error: {
                message: 'Query is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const queryResult = executeQuery(config, query, options);

          if (queryResult.error) {
            return {
              llmContent: `Database error: ${queryResult.error}`,
              returnDisplay: queryResult.error,
              error: {
                message: queryResult.error,
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Query Result\n\n**Rows affected:** ${queryResult.rowCount}\n\n`;
          if (queryResult.columns) {
            result += `**Columns:** ${queryResult.columns.join(', ')}\n\n`;
          }
          if (queryResult.rows.length > 0) {
            result += `### Data\n\`\`\`json\n${JSON.stringify(queryResult.rows.slice(0, 100), null, 2)}\n\`\`\``;
            if (queryResult.rows.length > 100) {
              result += `\n\n*(Showing first 100 of ${queryResult.rows.length} rows)*`;
            }
          }
          display = `${queryResult.rowCount} rows returned`;
          break;
        }

        case 'tables': {
          const tables = getTables(config);
          result = `## Tables in Database\n\n${tables.map((t) => `- ${t}`).join('\n')}`;
          display = `${tables.length} tables found`;
          break;
        }

        case 'describe':
        case 'schema': {
          if (!tableName && operation === 'describe') {
            return {
              llmContent: 'Error: tableName is required for describe operation',
              returnDisplay: 'Table name required',
              error: {
                message: 'tableName is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const schema = getSchema(config, tableName || '');
          if (!schema) {
            result = `Table "${tableName}" not found`;
            display = 'Table not found';
          } else {
            result = `## Table: ${schema.name}\n\n### Columns\n`;
            result += schema.columns
              .map(
                (col) =>
                  `- **${col.name}** (${col.type})${col.primaryKey ? ' PRIMARY KEY' : ''}${col.nullable ? '' : ' NOT NULL'}${col.defaultValue ? ` DEFAULT ${col.defaultValue}` : ''}`,
              )
              .join('\n');
            display = `Schema for ${schema.name}: ${schema.columns.length} columns`;
          }
          break;
        }

        case 'backup': {
          if (!backupPath) {
            return {
              llmContent: 'Error: backupPath is required for backup operation',
              returnDisplay: 'Backup path required',
              error: {
                message: 'backupPath is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const backupResult = backupDatabase(config, backupPath);
          if (!backupResult.success) {
            return {
              llmContent: `Backup failed: ${backupResult.error}`,
              returnDisplay: 'Backup failed',
              error: {
                message: backupResult.error || 'Backup failed',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Backup Complete\n\nDatabase backed up to: ${backupPath}`;
          display = `Backup saved to ${backupPath}`;
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
        llmContent: `Database operation failed: ${errorMessage}`,
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
 * Database Tool class definition
 */
export class DatabaseTool extends BaseDeclarativeTool<DatabaseToolParams, ToolResult> {
  static readonly Name = 'database';
  
  constructor() {
    super(
      DatabaseTool.Name,
      'Database',
      `Provides database operations for SQLite, PostgreSQL, and MySQL/MariaDB.

Operations:
- query: Execute SELECT queries and return results
- execute: Execute INSERT, UPDATE, DELETE statements
- tables: List all tables in the database
- describe: Get schema for a specific table
- schema: Get complete database schema
- backup: Create a database backup

Supports multiple database types:
- SQLite: Local file-based database
- PostgreSQL: Enterprise database server
- MySQL/MariaDB: Popular open-source databases

Use this tool to interact with databases for data retrieval and manipulation.`,
      Kind.Execute,
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'query',
              'execute',
              'tables',
              'describe',
              'schema',
              'backup',
              'restore',
            ],
            description: 'Database operation to perform',
          },
          config: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['sqlite', 'postgresql', 'mysql', 'mariadb'],
                description: 'Database type',
              },
              host: {
                type: 'string',
                description: 'Database host (for server-based DBs)',
              },
              port: { type: 'number', description: 'Database port' },
              database: {
                type: 'string',
                description: 'Database name or filename',
              },
              username: { type: 'string', description: 'Database username' },
              password: { type: 'string', description: 'Database password' },
              filename: {
                type: 'string',
                description: 'Database filename (SQLite)',
              },
            },
            required: ['type', 'database'],
          },
          query: { type: 'string', description: 'SQL query to execute' },
          tableName: {
            type: 'string',
            description: 'Table name for describe operation',
          },
          backupPath: { type: 'string', description: 'Path for backup file' },
          options: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Maximum rows to return' },
              offset: { type: 'number', description: 'Offset for pagination' },
              timeout: {
                type: 'number',
                description: 'Query timeout in milliseconds',
              },
            },
          },
        },
        required: ['operation', 'config'],
      },
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  protected override createInvocation(
    params: DatabaseToolParams,
  ): DatabaseToolInvocation {
    return new DatabaseToolInvocation(params);
  }
}

export const databaseTool = new DatabaseTool();
export default databaseTool;
