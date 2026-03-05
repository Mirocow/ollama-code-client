/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SSH Host Management Tools
 *
 * Tools for managing saved SSH host configurations.
 */

import type { Config } from '../../../config/config.js';
import { Storage, type SSHHostConfig } from '../../../config/storage.js';
import { ToolErrorType } from '../../../tools/tool-error.js';
import type {
  ToolInvocation,
  ToolResult,
} from '../../../tools/tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
} from '../../../tools/tools.js';

// ============================================================================
// SSH Add Host Tool
// ============================================================================

export interface SSHAddHostParams {
  /** Unique name for this SSH profile */
  name: string;
  /** Hostname or IP address */
  host: string;
  /** Username for SSH */
  user: string;
  /** SSH port (default: 22) */
  port?: number;
  /** Path to SSH private key file */
  identity_file?: string;
  /** Password (not recommended) */
  password?: string;
  /** Description of the host */
  description?: string;
  /** Tags for organization */
  tags?: string[];
}

export class SSHAddHostInvocation extends BaseToolInvocation<
  SSHAddHostParams,
  ToolResult
> {
  getDescription(): string {
    return `Add SSH profile '${this.params.name}' for ${this.params.user}@${this.params.host}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const config: SSHHostConfig = {
        host: this.params.host,
        user: this.params.user,
        port: this.params.port,
        identity_file: this.params.identity_file,
        password: this.params.password,
        description: this.params.description,
        tags: this.params.tags,
      };

      Storage.setSSHHost(this.params.name, config);

      const maskedConfig = {
        ...config,
        password: config.password ? '***' : undefined,
      };

      return {
        llmContent: `SSH profile '${this.params.name}' saved successfully.\n\nConfiguration:\n${JSON.stringify(maskedConfig, null, 2)}`,
        returnDisplay: `SSH profile '${this.params.name}' saved.`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to save SSH profile: ${errorMessage}`,
        returnDisplay: `Failed to save profile: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

function getAddHostDescription(): string {
  return `Saves an SSH host configuration for later use.

This tool creates a named SSH profile that can be used with the ssh_connect tool instead of specifying host/user each time.

**Security Note:**
- Passwords are stored in plain text in ~/.ollama-code/ssh_credentials.json
- Use identity_file (SSH key) authentication whenever possible
- Consider file permissions on the credentials file

**Parameters:**
- \`name\` - Unique name for this profile (required)
- \`host\` - Hostname or IP address (required)
- \`user\` - Username for SSH (required)
- \`port\` - SSH port (default: 22)
- \`identity_file\` - Path to SSH private key (recommended)
- \`password\` - Password (not recommended, use identity_file)
- \`description\` - Description of this host
- \`tags\` - Tags for organization (e.g., ["production", "aws"])

**Examples:**
1. Basic profile with SSH key:
   \`{ "name": "prod", "host": "192.168.1.100", "user": "admin", "identity_file": "~/.ssh/id_rsa" }\`

2. With custom port and tags:
   \`{ "name": "aws-dev", "host": "ec2-x-x-x-x.compute.amazonaws.com", "user": "ubuntu", "port": 22, "identity_file": "~/.ssh/aws_key.pem", "tags": ["aws", "dev"] }\`
`;
}

export class SSHAddHostTool extends BaseDeclarativeTool<
  SSHAddHostParams,
  ToolResult
> {
  static Name: string = 'ssh_add_host';

  constructor(_config: Config) {
    super(
      SSHAddHostTool.Name,
      'SSHAddHost',
      getAddHostDescription(),
      Kind.Edit,
      {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Unique name for this SSH profile.',
          },
          host: {
            type: 'string',
            description: 'Hostname or IP address.',
          },
          user: {
            type: 'string',
            description: 'Username for SSH.',
          },
          port: {
            type: 'number',
            description: 'SSH port (default: 22).',
          },
          identity_file: {
            type: 'string',
            description: 'Path to SSH private key file.',
          },
          password: {
            type: 'string',
            description: 'Password (not recommended, use identity_file instead).',
          },
          description: {
            type: 'string',
            description: 'Description of this host.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for organization.',
          },
        },
        required: ['name', 'host', 'user'],
      },
      true, // output is markdown
      false, // output cannot be updated
    );
  }

  protected override validateToolParamValues(params: SSHAddHostParams): string | null {
    if (!params.name?.trim()) {
      return 'Profile name is required.';
    }
    if (!params.host?.trim()) {
      return 'Host is required.';
    }
    if (!params.user?.trim()) {
      return 'User is required.';
    }
    if (params.port !== undefined && (params.port < 1 || params.port > 65535)) {
      return 'Port must be between 1 and 65535.';
    }
    return null;
  }

  protected createInvocation(params: SSHAddHostParams): ToolInvocation<SSHAddHostParams, ToolResult> {
    return new SSHAddHostInvocation(params);
  }
}

// ============================================================================
// SSH List Hosts Tool
// ============================================================================

export interface SSHListHostsParams {
  /** Filter by tag */
  tag?: string;
}

export class SSHListHostsInvocation extends BaseToolInvocation<
  SSHListHostsParams,
  ToolResult
> {
  getDescription(): string {
    return 'List saved SSH profiles';
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const hosts = Storage.listSSHHosts();

      let filteredHosts = hosts;
      if (this.params.tag) {
        filteredHosts = Object.fromEntries(
          Object.entries(hosts).filter(([_, config]) =>
            config.tags?.includes(this.params.tag!)
          )
        );
      }

      const hostCount = Object.keys(filteredHosts).length;

      if (hostCount === 0) {
        return {
          llmContent: this.params.tag
            ? `No SSH profiles found with tag '${this.params.tag}'.`
            : 'No SSH profiles saved. Use ssh_add_host to create one.',
          returnDisplay: 'No SSH profiles found.',
        };
      }

      const hostList = Object.entries(filteredHosts)
        .map(([name, config]) => {
          const parts = [
            `**${name}**: ${config.user}@${config.host}${config.port ? `:${config.port}` : ''}`,
          ];
          if (config.description) parts.push(`  Description: ${config.description}`);
          if (config.identity_file) parts.push(`  Key: ${config.identity_file}`);
          if (config.tags?.length) parts.push(`  Tags: ${config.tags.join(', ')}`);
          return parts.join('\n');
        })
        .join('\n\n');

      return {
        llmContent: `# SSH Profiles (${hostCount})\n\n${hostList}\n\nUse \`ssh_connect\` with profile name to connect.`,
        returnDisplay: `Found ${hostCount} SSH profile(s).`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to list SSH profiles: ${errorMessage}`,
        returnDisplay: `Failed to list profiles: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

function getListHostsDescription(): string {
  return `Lists all saved SSH host profiles.

**Parameters:**
- \`tag\` - Optional tag to filter profiles

**Example:**
\`{}\` - List all profiles
\`{ "tag": "production" }\` - List profiles tagged with "production"
`;
}

export class SSHListHostsTool extends BaseDeclarativeTool<
  SSHListHostsParams,
  ToolResult
> {
  static Name: string = 'ssh_list_hosts';

  constructor(_config: Config) {
    super(
      SSHListHostsTool.Name,
      'SSHListHosts',
      getListHostsDescription(),
      Kind.Read,
      {
        type: 'object',
        properties: {
          tag: {
            type: 'string',
            description: 'Filter profiles by tag.',
          },
        },
        required: [],
      },
      true, // output is markdown
      false, // output cannot be updated
    );
  }

  protected createInvocation(params: SSHListHostsParams): ToolInvocation<SSHListHostsParams, ToolResult> {
    return new SSHListHostsInvocation(params);
  }
}

// ============================================================================
// SSH Remove Host Tool
// ============================================================================

export interface SSHRemoveHostParams {
  /** Name of the profile to remove */
  name: string;
}

export class SSHRemoveHostInvocation extends BaseToolInvocation<
  SSHRemoveHostParams,
  ToolResult
> {
  getDescription(): string {
    return `Remove SSH profile '${this.params.name}'`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const removed = Storage.removeSSHHost(this.params.name);

      if (removed) {
        return {
          llmContent: `SSH profile '${this.params.name}' removed successfully.`,
          returnDisplay: `Profile '${this.params.name}' removed.`,
        };
      } else {
        return {
          llmContent: `SSH profile '${this.params.name}' not found.`,
          returnDisplay: `Profile '${this.params.name}' not found.`,
          error: {
            message: `Profile '${this.params.name}' not found`,
            type: ToolErrorType.EXECUTION_FAILED,
          },
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to remove SSH profile: ${errorMessage}`,
        returnDisplay: `Failed to remove profile: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

function getRemoveHostDescription(): string {
  return `Removes a saved SSH host profile.

**Parameters:**
- \`name\` - Name of the profile to remove (required)

**Example:**
\`{ "name": "old-server" }\`
`;
}

export class SSHRemoveHostTool extends BaseDeclarativeTool<
  SSHRemoveHostParams,
  ToolResult
> {
  static Name: string = 'ssh_remove_host';

  constructor(_config: Config) {
    super(
      SSHRemoveHostTool.Name,
      'SSHRemoveHost',
      getRemoveHostDescription(),
      Kind.Delete,
      {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the profile to remove.',
          },
        },
        required: ['name'],
      },
      true, // output is markdown
      false, // output cannot be updated
    );
  }

  protected override validateToolParamValues(params: SSHRemoveHostParams): string | null {
    if (!params.name?.trim()) {
      return 'Profile name is required.';
    }
    return null;
  }

  protected createInvocation(params: SSHRemoveHostParams): ToolInvocation<SSHRemoveHostParams, ToolResult> {
    return new SSHRemoveHostInvocation(params);
  }
}
