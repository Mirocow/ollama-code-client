/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Docker Tool
 * Provides Docker container and image management operations
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
 * Docker operation types
 */
export type DockerOperation =
  | 'ps'
  | 'images'
  | 'run'
  | 'stop'
  | 'start'
  | 'restart'
  | 'remove'
  | 'logs'
  | 'exec'
  | 'build'
  | 'pull'
  | 'push'
  | 'inspect'
  | 'network'
  | 'volume'
  | 'compose'
  | 'prune';

/**
 * Container state
 */
export type ContainerState =
  | 'running'
  | 'exited'
  | 'paused'
  | 'created'
  | 'dead';

/**
 * Container information
 */
export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: ContainerState;
  ports: string[];
  created: string;
}

/**
 * Image information
 */
export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

/**
 * Docker tool parameters
 */
export interface DockerToolParams {
  operation: DockerOperation;
  container?: string;
  image?: string;
  command?: string;
  options?: {
    detached?: boolean;
    interactive?: boolean;
    tty?: boolean;
    remove?: boolean;
    ports?: string[];
    volumes?: string[];
    env?: Record<string, string>;
    network?: string;
    workdir?: string;
    user?: string;
    memory?: string;
    cpu?: number;
    timeout?: number;
    composeFile?: string;
    services?: string[];
    force?: boolean;
    all?: boolean;
    filter?: string;
    tail?: number;
    follow?: boolean;
  };
}

// ============================================================================
// Docker CLI Helper
// ============================================================================

function executeDocker(
  args: string,
  timeout = 60000,
): { stdout: string; stderr: string; success: boolean } {
  try {
    const stdout = execSync(`docker ${args}`, {
      encoding: 'utf-8',
      timeout,
      maxBuffer: 50 * 1024 * 1024,
    });
    return { stdout, stderr: '', success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Try to extract stdout/stderr from error
    const stdoutMatch = errorMessage.match(/stdout:\s*'([^']*)'/);
    const stderrMatch = errorMessage.match(/stderr:\s*'([^']*)'/);
    return {
      stdout: stdoutMatch?.[1] || '',
      stderr: stderrMatch?.[1] || errorMessage,
      success: false,
    };
  }
}

function executeDockerCompose(
  args: string,
  composeFile?: string,
  timeout = 120000,
): { stdout: string; stderr: string; success: boolean } {
  try {
    const composeFlag = composeFile ? `-f "${composeFile}" ` : '';
    const stdout = execSync(`docker compose ${composeFlag}${args}`, {
      encoding: 'utf-8',
      timeout,
      maxBuffer: 50 * 1024 * 1024,
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

// ============================================================================
// Container Operations
// ============================================================================

function listContainers(all = false): ContainerInfo[] {
  const allFlag = all ? '-a' : '';
  const result = executeDocker(
    `ps ${allFlag} --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}|{{.CreatedAt}}"`,
  );

  if (!result.success || !result.stdout.trim()) {
    return [];
  }

  return result.stdout
    .trim()
    .split('\n')
    .map((line) => {
      const [id, name, image, status, state, ports, created] = line.split('|');
      return {
        id: id.trim(),
        name: name.trim(),
        image: image.trim(),
        status: status.trim(),
        state: state.trim() as ContainerState,
        ports: ports
          ? ports
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
          : [],
        created: created.trim(),
      };
    });
}

function getContainerLogs(
  container: string,
  tail?: number,
  follow?: boolean,
): string {
  const tailFlag = tail ? `--tail ${tail}` : '';
  const followFlag = follow ? '-f' : '';
  const result = executeDocker(
    `logs ${followFlag} ${tailFlag} ${container}`,
    10000,
  );

  if (!result.success) {
    return `Error getting logs: ${result.stderr}`;
  }

  return result.stdout || 'No logs available';
}

function inspectContainer(container: string): Record<string, unknown> | null {
  const result = executeDocker(`inspect ${container}`);

  if (!result.success || !result.stdout.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return parsed[0] || null;
  } catch {
    return null;
  }
}

function runContainer(
  image: string,
  options: DockerToolParams['options'],
): { success: boolean; containerId?: string; error?: string } {
  const args: string[] = ['run'];

  if (options?.detached) args.push('-d');
  if (options?.interactive) args.push('-i');
  if (options?.tty) args.push('-t');
  if (options?.remove) args.push('--rm');

  if (options?.ports) {
    options.ports.forEach((p) => args.push('-p', p));
  }

  if (options?.volumes) {
    options.volumes.forEach((v) => args.push('-v', v));
  }

  if (options?.env) {
    Object.entries(options.env).forEach(([key, value]) => {
      args.push('-e', `${key}=${value}`);
    });
  }

  if (options?.network) args.push('--network', options.network);
  if (options?.workdir) args.push('-w', options.workdir);
  if (options?.user) args.push('-u', options.user);
  if (options?.memory) args.push('--memory', options.memory);
  if (options?.cpu) args.push('--cpus', options.cpu.toString());

  args.push(image);

  const result = executeDocker(args.join(' '));

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  return { success: true, containerId: result.stdout.trim() };
}

function stopContainer(
  container: string,
  timeout?: number,
): { success: boolean; error?: string } {
  const timeoutFlag = timeout ? `-t ${timeout}` : '';
  const result = executeDocker(`stop ${timeoutFlag} ${container}`);

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  return { success: true };
}

function startContainer(container: string): {
  success: boolean;
  error?: string;
} {
  const result = executeDocker(`start ${container}`);

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  return { success: true };
}

function restartContainer(
  container: string,
  timeout?: number,
): { success: boolean; error?: string } {
  const timeoutFlag = timeout ? `-t ${timeout}` : '';
  const result = executeDocker(`restart ${timeoutFlag} ${container}`);

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  return { success: true };
}

function removeContainer(
  container: string,
  force = false,
): { success: boolean; error?: string } {
  const forceFlag = force ? '-f' : '';
  const result = executeDocker(`rm ${forceFlag} ${container}`);

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  return { success: true };
}

function execInContainer(
  container: string,
  command: string,
  options?: DockerToolParams['options'],
): { success: boolean; output?: string; error?: string } {
  const args: string[] = ['exec'];

  if (options?.interactive) args.push('-i');
  if (options?.tty) args.push('-t');
  if (options?.user) args.push('-u', options.user);
  if (options?.workdir) args.push('-w', options.workdir);

  args.push(container);
  args.push(command);

  const result = executeDocker(args.join(' '), options?.timeout);

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  return { success: true, output: result.stdout };
}

// ============================================================================
// Image Operations
// ============================================================================

function listImages(): ImageInfo[] {
  const result = executeDocker(
    'images --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}"',
  );

  if (!result.success || !result.stdout.trim()) {
    return [];
  }

  return result.stdout
    .trim()
    .split('\n')
    .map((line) => {
      const [id, repository, tag, size, created] = line.split('|');
      return {
        id: id.trim(),
        repository: repository.trim(),
        tag: tag.trim(),
        size: size.trim(),
        created: created.trim(),
      };
    });
}

function pullImage(image: string): { success: boolean; error?: string } {
  const result = executeDocker(`pull ${image}`, 300000); // 5 min timeout

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  return { success: true };
}

function buildImage(
  context: string,
  tag?: string,
  dockerfile?: string,
): { success: boolean; imageId?: string; error?: string } {
  const tagFlag = tag ? `-t ${tag}` : '';
  const dockerfileFlag = dockerfile ? `-f ${dockerfile}` : '';
  const result = executeDocker(
    `build ${tagFlag} ${dockerfileFlag} ${context}`,
    600000,
  ); // 10 min timeout

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  // Extract image ID from output
  const match = result.stdout.match(/Successfully built ([a-f0-9]+)/);
  return { success: true, imageId: match?.[1] };
}

// ============================================================================
// System Operations
// ============================================================================

function pruneSystem(all = false): {
  success: boolean;
  output?: string;
  error?: string;
} {
  const allFlag = all ? '-a' : '';
  const result = executeDocker(`system prune ${allFlag} -f`, 300000);

  if (!result.success) {
    return { success: false, error: result.stderr };
  }

  return { success: true, output: result.stdout };
}

function getNetworks(): string {
  const result = executeDocker('network ls');

  if (!result.success) {
    return `Error: ${result.stderr}`;
  }

  return result.stdout;
}

function getVolumes(): string {
  const result = executeDocker('volume ls');

  if (!result.success) {
    return `Error: ${result.stderr}`;
  }

  return result.stdout;
}

// ============================================================================
// Tool Invocation
// ============================================================================

class DockerToolInvocation extends BaseToolInvocation<
  DockerToolParams,
  ToolResult
> {
  constructor(params: DockerToolParams) {
    super(params);
  }

  getDescription(): string {
    const { operation, container, image } = this.params;

    switch (operation) {
      case 'ps':
        return 'Listing Docker containers';
      case 'images':
        return 'Listing Docker images';
      case 'run':
        return `Running container from image ${image}`;
      case 'stop':
        return `Stopping container ${container}`;
      case 'start':
        return `Starting container ${container}`;
      case 'restart':
        return `Restarting container ${container}`;
      case 'remove':
        return `Removing container ${container}`;
      case 'logs':
        return `Getting logs for container ${container}`;
      case 'exec':
        return `Executing command in container ${container}`;
      case 'build':
        return `Building Docker image`;
      case 'pull':
        return `Pulling image ${image}`;
      case 'push':
        return `Pushing image ${image}`;
      case 'inspect':
        return `Inspecting container ${container}`;
      case 'network':
        return 'Listing Docker networks';
      case 'volume':
        return 'Listing Docker volumes';
      case 'compose':
        return 'Running Docker Compose operation';
      case 'prune':
        return 'Pruning unused Docker resources';
      default:
        return `Docker operation: ${operation}`;
    }
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const { operation, container, image, command, options } = this.params;

    try {
      let result: string;
      let display: string;

      switch (operation) {
        case 'ps': {
          const containers = listContainers(options?.all ?? false);
          result = `## Docker Containers\n\n`;
          if (containers.length === 0) {
            result += 'No containers found.';
          } else {
            result += '| ID | Name | Image | State | Status | Ports |\n';
            result += '|---|---|---|---|---|---|\n';
            containers.forEach((c) => {
              result += `| ${c.id.substring(0, 12)} | ${c.name} | ${c.image} | ${c.state} | ${c.status} | ${c.ports.join(', ') || '-'} |\n`;
            });
          }
          display = `${containers.length} containers`;
          break;
        }

        case 'images': {
          const images = listImages();
          result = `## Docker Images\n\n`;
          if (images.length === 0) {
            result += 'No images found.';
          } else {
            result += '| ID | Repository | Tag | Size | Created |\n';
            result += '|---|---|---|---|---|\n';
            images.forEach((img) => {
              result += `| ${img.id.substring(0, 12)} | ${img.repository} | ${img.tag} | ${img.size} | ${img.created} |\n`;
            });
          }
          display = `${images.length} images`;
          break;
        }

        case 'run': {
          if (!image) {
            return {
              llmContent: 'Error: image is required for run operation',
              returnDisplay: 'Image required',
              error: {
                message: 'Image is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const runResult = runContainer(image, options);
          if (!runResult.success) {
            return {
              llmContent: `Failed to run container: ${runResult.error}`,
              returnDisplay: 'Container run failed',
              error: {
                message: runResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Container Started\n\n**Container ID:** ${runResult.containerId}\n**Image:** ${image}`;
          display = `Container ${runResult.containerId?.substring(0, 12)} started`;
          break;
        }

        case 'stop': {
          if (!container) {
            return {
              llmContent: 'Error: container is required for stop operation',
              returnDisplay: 'Container required',
              error: {
                message: 'Container is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const stopResult = stopContainer(container, options?.timeout);
          if (!stopResult.success) {
            return {
              llmContent: `Failed to stop container: ${stopResult.error}`,
              returnDisplay: 'Stop failed',
              error: {
                message: stopResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Container Stopped\n\n**Container:** ${container}`;
          display = `Container ${container} stopped`;
          break;
        }

        case 'start': {
          if (!container) {
            return {
              llmContent: 'Error: container is required for start operation',
              returnDisplay: 'Container required',
              error: {
                message: 'Container is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const startResult = startContainer(container);
          if (!startResult.success) {
            return {
              llmContent: `Failed to start container: ${startResult.error}`,
              returnDisplay: 'Start failed',
              error: {
                message: startResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Container Started\n\n**Container:** ${container}`;
          display = `Container ${container} started`;
          break;
        }

        case 'restart': {
          if (!container) {
            return {
              llmContent: 'Error: container is required for restart operation',
              returnDisplay: 'Container required',
              error: {
                message: 'Container is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const restartResult = restartContainer(container, options?.timeout);
          if (!restartResult.success) {
            return {
              llmContent: `Failed to restart container: ${restartResult.error}`,
              returnDisplay: 'Restart failed',
              error: {
                message: restartResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Container Restarted\n\n**Container:** ${container}`;
          display = `Container ${container} restarted`;
          break;
        }

        case 'remove': {
          if (!container) {
            return {
              llmContent: 'Error: container is required for remove operation',
              returnDisplay: 'Container required',
              error: {
                message: 'Container is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const removeResult = removeContainer(container, options?.force);
          if (!removeResult.success) {
            return {
              llmContent: `Failed to remove container: ${removeResult.error}`,
              returnDisplay: 'Remove failed',
              error: {
                message: removeResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Container Removed\n\n**Container:** ${container}`;
          display = `Container ${container} removed`;
          break;
        }

        case 'logs': {
          if (!container) {
            return {
              llmContent: 'Error: container is required for logs operation',
              returnDisplay: 'Container required',
              error: {
                message: 'Container is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const logs = getContainerLogs(
            container,
            options?.tail,
            options?.follow,
          );
          result = `## Logs for ${container}\n\n\`\`\`\n${logs}\n\`\`\``;
          display = `Logs for ${container}`;
          break;
        }

        case 'exec': {
          if (!container || !command) {
            return {
              llmContent:
                'Error: container and command are required for exec operation',
              returnDisplay: 'Container and command required',
              error: {
                message: 'Container and command are required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const execResult = execInContainer(container, command, options);
          if (!execResult.success) {
            return {
              llmContent: `Failed to execute command: ${execResult.error}`,
              returnDisplay: 'Exec failed',
              error: {
                message: execResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Command Output\n\n\`\`\`\n${execResult.output}\n\`\`\``;
          display = `Command executed in ${container}`;
          break;
        }

        case 'pull': {
          if (!image) {
            return {
              llmContent: 'Error: image is required for pull operation',
              returnDisplay: 'Image required',
              error: {
                message: 'Image is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const pullResult = pullImage(image);
          if (!pullResult.success) {
            return {
              llmContent: `Failed to pull image: ${pullResult.error}`,
              returnDisplay: 'Pull failed',
              error: {
                message: pullResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Image Pulled\n\n**Image:** ${image}`;
          display = `Image ${image} pulled`;
          break;
        }

        case 'inspect': {
          if (!container) {
            return {
              llmContent: 'Error: container is required for inspect operation',
              returnDisplay: 'Container required',
              error: {
                message: 'Container is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const inspectResult = inspectContainer(container);
          if (!inspectResult) {
            return {
              llmContent: `Container not found: ${container}`,
              returnDisplay: 'Container not found',
              error: {
                message: 'Container not found',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Container Details\n\n\`\`\`json\n${JSON.stringify(inspectResult, null, 2)}\n\`\`\``;
          display = `Container ${container} details`;
          break;
        }

        case 'network': {
          const networks = getNetworks();
          result = `## Docker Networks\n\n\`\`\`\n${networks}\n\`\`\``;
          display = 'Docker networks';
          break;
        }

        case 'volume': {
          const volumes = getVolumes();
          result = `## Docker Volumes\n\n\`\`\`\n${volumes}\n\`\`\``;
          display = 'Docker volumes';
          break;
        }

        case 'prune': {
          const pruneResult = pruneSystem(options?.all);
          if (!pruneResult.success) {
            return {
              llmContent: `Failed to prune: ${pruneResult.error}`,
              returnDisplay: 'Prune failed',
              error: {
                message: pruneResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Prune Complete\n\n\`\`\`\n${pruneResult.output}\n\`\`\``;
          display = 'Docker resources pruned';
          break;
        }

        case 'compose': {
          const composeResult = executeDockerCompose(
            command || 'ps',
            options?.composeFile,
          );
          if (!composeResult.success) {
            return {
              llmContent: `Docker Compose failed: ${composeResult.stderr}`,
              returnDisplay: 'Compose failed',
              error: {
                message: composeResult.stderr || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Docker Compose\n\n\`\`\`\n${composeResult.stdout}\n\`\`\``;
          display = 'Docker Compose executed';
          break;
        }

        case 'build': {
          if (!image) {
            return {
              llmContent:
                'Error: image (context path) is required for build operation',
              returnDisplay: 'Image context required',
              error: {
                message: 'Image context is required',
                type: ToolErrorType.INVALID_TOOL_PARAMS,
              },
            };
          }

          const buildResult = buildImage(image, options?.workdir, command);
          if (!buildResult.success) {
            return {
              llmContent: `Failed to build image: ${buildResult.error}`,
              returnDisplay: 'Build failed',
              error: {
                message: buildResult.error || 'Unknown error',
                type: ToolErrorType.EXECUTION_FAILED,
              },
            };
          }

          result = `## Image Built\n\n**Context:** ${image}\n**Image ID:** ${buildResult.imageId || 'N/A'}`;
          display = `Image built from ${image}`;
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
        llmContent: `Docker operation failed: ${errorMessage}`,
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
 * Docker Tool class definition
 */
export class DockerTool extends BaseDeclarativeTool<DockerToolParams, ToolResult> {
  static readonly Name = 'docker';
  
  constructor() {
    super(
      DockerTool.Name,
      'Docker',
      `Provides Docker container and image management operations.

Container Operations:
- ps: List running (or all) containers
- run: Create and start a container
- stop/start/restart: Manage container lifecycle
- remove: Remove a container
- logs: View container logs
- exec: Execute command in container
- inspect: Get container details

Image Operations:
- images: List available images
- pull: Pull image from registry
- build: Build image from Dockerfile
- push: Push image to registry

System Operations:
- network: List Docker networks
- volume: List Docker volumes
- prune: Remove unused resources
- compose: Docker Compose operations

Use this tool to manage Docker containers, images, and system resources.`,
      Kind.Execute,
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'ps',
              'images',
              'run',
              'stop',
              'start',
              'restart',
              'remove',
              'logs',
              'exec',
              'build',
              'pull',
              'push',
              'inspect',
              'network',
              'volume',
              'compose',
              'prune',
            ],
            description: 'Docker operation to perform',
          },
          container: { type: 'string', description: 'Container name or ID' },
          image: {
            type: 'string',
            description: 'Image name (e.g., nginx:latest)',
          },
          command: { type: 'string', description: 'Command to execute' },
          options: {
            type: 'object',
            properties: {
              detached: { type: 'boolean', description: 'Run in background' },
              interactive: { type: 'boolean', description: 'Keep STDIN open' },
              tty: { type: 'boolean', description: 'Allocate TTY' },
              remove: {
                type: 'boolean',
                description: 'Remove container after exit',
              },
              ports: {
                type: 'array',
                items: { type: 'string' },
                description: 'Port mappings (e.g., ["8080:80"])',
              },
              volumes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Volume mounts',
              },
              env: { type: 'object', description: 'Environment variables' },
              network: { type: 'string', description: 'Network to connect' },
              workdir: { type: 'string', description: 'Working directory' },
              user: { type: 'string', description: 'User to run as' },
              memory: { type: 'string', description: 'Memory limit' },
              cpu: { type: 'number', description: 'CPU limit' },
              timeout: {
                type: 'number',
                description: 'Operation timeout in ms',
              },
              force: { type: 'boolean', description: 'Force operation' },
              all: {
                type: 'boolean',
                description: 'Show all (including stopped)',
              },
              tail: { type: 'number', description: 'Number of log lines' },
              follow: { type: 'boolean', description: 'Follow log output' },
              composeFile: {
                type: 'string',
                description: 'Docker Compose file path',
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
    params: DockerToolParams,
  ): DockerToolInvocation {
    return new DockerToolInvocation(params);
  }
}

export const dockerTool = new DockerTool();
export default dockerTool;
