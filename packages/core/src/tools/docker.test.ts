/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  DockerToolParams,
  DockerOperation,
  ContainerInfo,
  ImageInfo,
} from './docker.js';
import dockerTool from './docker.js';

// Mock execSync
vi.mock('node:child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    // Mock responses based on command
    if (cmd.includes('docker ps')) {
      return 'container1|my-container|nginx:latest|running|Up 2 hours|80:80';
    }
    if (cmd.includes('docker images')) {
      return 'sha256:abc123|nginx|latest|100MB|2024-01-01';
    }
    if (cmd.includes('docker network ls')) {
      return 'NETWORK_ID|bridge|bridge|local';
    }
    if (cmd.includes('docker volume ls')) {
      return 'DRIVER|VOLUME_NAME\nlocal|my_volume';
    }
    return '';
  }),
}));

describe('DockerTool', () => {
  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(dockerTool.name).toBe('docker');
    });

    it('should have correct display name', () => {
      expect(dockerTool.displayName).toBe('Docker');
    });

    it('should have description', () => {
      expect(dockerTool.description).toContain('Docker');
    });

    it('should have valid parameter schema', () => {
      expect(dockerTool.parameterSchema).toBeDefined();
      expect(dockerTool.parameterSchema.type).toBe('object');
      expect(dockerTool.parameterSchema.properties).toHaveProperty('operation');
    });
  });

  describe('Parameter Validation', () => {
    it('should require operation parameter', () => {
      const params = {} as DockerToolParams;
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeTruthy();
    });

    it('should validate valid params', () => {
      const params: DockerToolParams = {
        operation: 'ps',
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Docker Operations', () => {
    const validOperations: DockerOperation[] = [
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
    ];

    validOperations.forEach((operation) => {
      it(`should accept '${operation}' operation`, () => {
        const params: DockerToolParams = {
          operation,
        };
        const error = dockerTool.validateToolParams(params);
        expect(error).toBeNull();
      });
    });
  });

  describe('Container Operations', () => {
    it('should accept container name for stop', () => {
      const params: DockerToolParams = {
        operation: 'stop',
        container: 'my-container',
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept container name for start', () => {
      const params: DockerToolParams = {
        operation: 'start',
        container: 'my-container',
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept container name for remove', () => {
      const params: DockerToolParams = {
        operation: 'remove',
        container: 'my-container',
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept container name for logs', () => {
      const params: DockerToolParams = {
        operation: 'logs',
        container: 'my-container',
        options: {
          tail: 100,
          follow: false,
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept container name for exec', () => {
      const params: DockerToolParams = {
        operation: 'exec',
        container: 'my-container',
        command: 'ls -la',
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Image Operations', () => {
    it('should accept image name for run', () => {
      const params: DockerToolParams = {
        operation: 'run',
        image: 'nginx:latest',
        options: {
          detached: true,
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept image name for pull', () => {
      const params: DockerToolParams = {
        operation: 'pull',
        image: 'nginx:latest',
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept image name for push', () => {
      const params: DockerToolParams = {
        operation: 'push',
        image: 'myregistry/myimage:latest',
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Run Options', () => {
    it('should accept ports mapping', () => {
      const params: DockerToolParams = {
        operation: 'run',
        image: 'nginx:latest',
        options: {
          ports: ['80:80', '443:443'],
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept volumes mapping', () => {
      const params: DockerToolParams = {
        operation: 'run',
        image: 'nginx:latest',
        options: {
          volumes: ['/host/path:/container/path'],
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept environment variables', () => {
      const params: DockerToolParams = {
        operation: 'run',
        image: 'nginx:latest',
        options: {
          env: {
            NODE_ENV: 'production',
            PORT: '3000',
          },
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept network option', () => {
      const params: DockerToolParams = {
        operation: 'run',
        image: 'nginx:latest',
        options: {
          network: 'my-network',
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept workdir option', () => {
      const params: DockerToolParams = {
        operation: 'run',
        image: 'nginx:latest',
        options: {
          workdir: '/app',
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept user option', () => {
      const params: DockerToolParams = {
        operation: 'run',
        image: 'nginx:latest',
        options: {
          user: 'node',
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept memory limit', () => {
      const params: DockerToolParams = {
        operation: 'run',
        image: 'nginx:latest',
        options: {
          memory: '512m',
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });

    it('should accept cpu limit', () => {
      const params: DockerToolParams = {
        operation: 'run',
        image: 'nginx:latest',
        options: {
          cpu: 2,
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Prune Operations', () => {
    it('should accept all flag for prune', () => {
      const params: DockerToolParams = {
        operation: 'prune',
        options: {
          all: true,
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });

  describe('Compose Operations', () => {
    it('should accept composeFile option', () => {
      const params: DockerToolParams = {
        operation: 'compose',
        command: 'up -d',
        options: {
          composeFile: 'docker-compose.prod.yml',
        },
      };
      const error = dockerTool.validateToolParams(params);
      expect(error).toBeNull();
    });
  });
});

describe('Docker Types', () => {
  it('should define ContainerInfo interface correctly', () => {
    const container: ContainerInfo = {
      id: 'abc123',
      name: 'my-container',
      image: 'nginx:latest',
      status: 'Up 2 hours',
      state: 'running',
      ports: ['80:80'],
      created: '2024-01-01T00:00:00Z',
    };
    expect(container.id).toBe('abc123');
    expect(container.name).toBe('my-container');
    expect(container.state).toBe('running');
    expect(container.ports).toHaveLength(1);
  });

  it('should define ImageInfo interface correctly', () => {
    const image: ImageInfo = {
      id: 'sha256:abc123',
      repository: 'nginx',
      tag: 'latest',
      size: '100MB',
      created: '2024-01-01',
    };
    expect(image.id).toBe('sha256:abc123');
    expect(image.repository).toBe('nginx');
    expect(image.tag).toBe('latest');
    expect(image.size).toBe('100MB');
  });
});

describe('DockerToolInvocation', () => {
  it('should create invocation with valid params', () => {
    const params: DockerToolParams = {
      operation: 'ps',
    };
    const invocation = dockerTool.createInvocation(params);
    expect(invocation).toBeDefined();
    expect(invocation.getDescription()).toContain('containers');
  });

  it('should create invocation for images operation', () => {
    const params: DockerToolParams = {
      operation: 'images',
    };
    const invocation = dockerTool.createInvocation(params);
    expect(invocation.getDescription()).toContain('images');
  });

  it('should create invocation for run operation', () => {
    const params: DockerToolParams = {
      operation: 'run',
      image: 'nginx:latest',
    };
    const invocation = dockerTool.createInvocation(params);
    expect(invocation.getDescription()).toContain('nginx:latest');
  });
});
