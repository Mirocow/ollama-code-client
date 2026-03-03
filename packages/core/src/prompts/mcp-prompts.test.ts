/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { getMCPServerPrompts } from './mcp-prompts.js';
import type { Config } from '../config/config.js';
import { PromptRegistry } from './prompt-registry.js';
import type { DiscoveredMCPPrompt } from '../plugins/builtin/mcp-tools/mcp-client/index.js';

describe('getMCPServerPrompts', () => {
  const createMockPrompt = (
    name: string,
    serverName: string,
  ): DiscoveredMCPPrompt => ({
    name,
    serverName,
    description: `Prompt ${name} from ${serverName}`,
    arguments: [],
  });

  const createMockConfig = (
    promptRegistry: PromptRegistry | null,
  ): Partial<Config> => ({
    getPromptRegistry: () => promptRegistry,
  });

  it('should return empty array when prompt registry is null', () => {
    const mockConfig = createMockConfig(null) as Config;
    const result = getMCPServerPrompts(mockConfig, 'test-server');
    expect(result).toEqual([]);
  });

  it('should return prompts for a specific server', () => {
    const registry = new PromptRegistry();
    registry.registerPrompt(createMockPrompt('prompt1', 'server-a'));
    registry.registerPrompt(createMockPrompt('prompt2', 'server-a'));
    registry.registerPrompt(createMockPrompt('prompt3', 'server-b'));

    const mockConfig = createMockConfig(registry) as Config;
    const result = getMCPServerPrompts(mockConfig, 'server-a');

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.name)).toEqual(['prompt1', 'prompt2']);
  });

  it('should return empty array for non-existent server', () => {
    const registry = new PromptRegistry();
    registry.registerPrompt(createMockPrompt('prompt1', 'server-a'));

    const mockConfig = createMockConfig(registry) as Config;
    const result = getMCPServerPrompts(mockConfig, 'nonexistent');

    expect(result).toEqual([]);
  });

  it('should return empty array when registry is empty', () => {
    const registry = new PromptRegistry();
    const mockConfig = createMockConfig(registry) as Config;

    const result = getMCPServerPrompts(mockConfig, 'any-server');
    expect(result).toEqual([]);
  });

  it('should return prompts sorted alphabetically', () => {
    const registry = new PromptRegistry();
    registry.registerPrompt(createMockPrompt('z-prompt', 'server'));
    registry.registerPrompt(createMockPrompt('a-prompt', 'server'));
    registry.registerPrompt(createMockPrompt('m-prompt', 'server'));

    const mockConfig = createMockConfig(registry) as Config;
    const result = getMCPServerPrompts(mockConfig, 'server');

    expect(result.map((p) => p.name)).toEqual([
      'a-prompt',
      'm-prompt',
      'z-prompt',
    ]);
  });

  it('should call getPromptRegistry on config', () => {
    const registry = new PromptRegistry();
    const mockGetPromptRegistry = vi.fn(() => registry);
    const mockConfig = {
      getPromptRegistry: mockGetPromptRegistry,
    } as unknown as Config;

    getMCPServerPrompts(mockConfig, 'test-server');

    expect(mockGetPromptRegistry).toHaveBeenCalledTimes(1);
  });

  it('should call getPromptsByServer with correct server name', () => {
    const registry = new PromptRegistry();
    const mockGetPromptsByServer = vi
      .spyOn(registry, 'getPromptsByServer')
      .mockReturnValue([]);

    const mockConfig = createMockConfig(registry) as Config;
    getMCPServerPrompts(mockConfig, 'my-server');

    expect(mockGetPromptsByServer).toHaveBeenCalledWith('my-server');

    mockGetPromptsByServer.mockRestore();
  });
});
