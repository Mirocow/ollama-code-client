/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptRegistry } from './prompt-registry.js';
import type { DiscoveredMCPPrompt } from '../plugins/builtin/mcp-tools/mcp-client/index.js';

describe('PromptRegistry', () => {
  let registry: PromptRegistry;

  beforeEach(() => {
    registry = new PromptRegistry();
  });

  const createMockPrompt = (
    name: string,
    serverName: string = 'test-server',
  ): DiscoveredMCPPrompt => ({
    name,
    serverName,
    description: `Prompt ${name}`,
    arguments: [],
  });

  describe('registerPrompt', () => {
    it('should register a prompt', () => {
      const prompt = createMockPrompt('test-prompt');
      registry.registerPrompt(prompt);

      const retrieved = registry.getPrompt('test-prompt');
      expect(retrieved).toEqual(prompt);
    });

    it('should register multiple prompts from different servers', () => {
      const prompt1 = createMockPrompt('prompt1', 'server1');
      const prompt2 = createMockPrompt('prompt2', 'server2');

      registry.registerPrompt(prompt1);
      registry.registerPrompt(prompt2);

      expect(registry.getPrompt('prompt1')).toEqual(prompt1);
      expect(registry.getPrompt('prompt2')).toEqual(prompt2);
    });

    it('should rename prompt if name already exists', () => {
      const prompt1 = createMockPrompt('duplicate-name', 'server1');
      const prompt2 = createMockPrompt('duplicate-name', 'server2');

      registry.registerPrompt(prompt1);
      registry.registerPrompt(prompt2);

      // Original prompt should still exist
      expect(registry.getPrompt('duplicate-name')).toEqual(prompt1);

      // New prompt should be renamed
      const renamedPrompt = registry.getPrompt('server2_duplicate-name');
      expect(renamedPrompt).toBeDefined();
      expect(renamedPrompt?.name).toBe('server2_duplicate-name');
      expect(renamedPrompt?.serverName).toBe('server2');
    });

    it('should preserve prompt with same name from same server', () => {
      const prompt1 = createMockPrompt('test-prompt', 'server1');
      const prompt2 = createMockPrompt('test-prompt', 'server1');

      registry.registerPrompt(prompt1);
      registry.registerPrompt(prompt2);

      // Both registrations from same server - second should trigger rename
      const renamedPrompt = registry.getPrompt('server1_test-prompt');
      expect(renamedPrompt).toBeDefined();
    });
  });

  describe('getAllPrompts', () => {
    it('should return empty array when no prompts registered', () => {
      expect(registry.getAllPrompts()).toEqual([]);
    });

    it('should return all registered prompts', () => {
      const prompt1 = createMockPrompt('alpha', 'server1');
      const prompt2 = createMockPrompt('beta', 'server2');
      const prompt3 = createMockPrompt('gamma', 'server3');

      registry.registerPrompt(prompt1);
      registry.registerPrompt(prompt2);
      registry.registerPrompt(prompt3);

      const all = registry.getAllPrompts();
      expect(all).toHaveLength(3);

      // Should be sorted by name
      expect(all[0].name).toBe('alpha');
      expect(all[1].name).toBe('beta');
      expect(all[2].name).toBe('gamma');
    });

    it('should return prompts sorted alphabetically', () => {
      const prompts = ['zebra', 'apple', 'mango', 'banana'];
      prompts.forEach((name) => {
        registry.registerPrompt(createMockPrompt(name));
      });

      const all = registry.getAllPrompts();
      expect(all.map((p) => p.name)).toEqual([
        'apple',
        'banana',
        'mango',
        'zebra',
      ]);
    });
  });

  describe('getPrompt', () => {
    it('should return undefined for non-existent prompt', () => {
      expect(registry.getPrompt('nonexistent')).toBeUndefined();
    });

    it('should return the prompt by name', () => {
      const prompt = createMockPrompt('my-prompt');
      registry.registerPrompt(prompt);

      expect(registry.getPrompt('my-prompt')).toEqual(prompt);
    });
  });

  describe('getPromptsByServer', () => {
    it('should return empty array for non-existent server', () => {
      expect(registry.getPromptsByServer('nonexistent')).toEqual([]);
    });

    it('should return prompts for a specific server', () => {
      const prompt1 = createMockPrompt('prompt1', 'server-a');
      const prompt2 = createMockPrompt('prompt2', 'server-a');
      const prompt3 = createMockPrompt('prompt3', 'server-b');

      registry.registerPrompt(prompt1);
      registry.registerPrompt(prompt2);
      registry.registerPrompt(prompt3);

      const serverAPrompts = registry.getPromptsByServer('server-a');
      expect(serverAPrompts).toHaveLength(2);
      expect(serverAPrompts.map((p) => p.name)).toEqual(['prompt1', 'prompt2']);

      const serverBPrompts = registry.getPromptsByServer('server-b');
      expect(serverBPrompts).toHaveLength(1);
      expect(serverBPrompts[0].name).toBe('prompt3');
    });

    it('should return prompts sorted alphabetically', () => {
      registry.registerPrompt(createMockPrompt('z-prompt', 'server'));
      registry.registerPrompt(createMockPrompt('a-prompt', 'server'));
      registry.registerPrompt(createMockPrompt('m-prompt', 'server'));

      const prompts = registry.getPromptsByServer('server');
      expect(prompts.map((p) => p.name)).toEqual([
        'a-prompt',
        'm-prompt',
        'z-prompt',
      ]);
    });
  });

  describe('clear', () => {
    it('should clear all prompts', () => {
      registry.registerPrompt(createMockPrompt('prompt1'));
      registry.registerPrompt(createMockPrompt('prompt2'));

      expect(registry.getAllPrompts()).toHaveLength(2);

      registry.clear();

      expect(registry.getAllPrompts()).toEqual([]);
      expect(registry.getPrompt('prompt1')).toBeUndefined();
    });
  });

  describe('removePromptsByServer', () => {
    it('should remove prompts from a specific server', () => {
      registry.registerPrompt(createMockPrompt('prompt1', 'server-a'));
      registry.registerPrompt(createMockPrompt('prompt2', 'server-a'));
      registry.registerPrompt(createMockPrompt('prompt3', 'server-b'));

      registry.removePromptsByServer('server-a');

      expect(registry.getPromptsByServer('server-a')).toEqual([]);
      expect(registry.getPromptsByServer('server-b')).toHaveLength(1);
    });

    it('should not affect prompts from other servers', () => {
      registry.registerPrompt(createMockPrompt('prompt1', 'server-a'));
      registry.registerPrompt(createMockPrompt('prompt2', 'server-b'));

      registry.removePromptsByServer('server-a');

      expect(registry.getPrompt('prompt2')).toBeDefined();
    });

    it('should handle removing from non-existent server', () => {
      registry.registerPrompt(createMockPrompt('prompt1'));
      registry.removePromptsByServer('nonexistent');

      expect(registry.getAllPrompts()).toHaveLength(1);
    });
  });

  describe('complex scenarios', () => {
    it('should handle registering prompts with complex arguments', () => {
      const prompt: DiscoveredMCPPrompt = {
        name: 'complex-prompt',
        serverName: 'test-server',
        description: 'A complex prompt',
        arguments: [
          {
            name: 'arg1',
            description: 'First argument',
            required: true,
          },
          {
            name: 'arg2',
            description: 'Second argument',
            required: false,
          },
        ],
      };

      registry.registerPrompt(prompt);
      const retrieved = registry.getPrompt('complex-prompt');

      expect(retrieved?.arguments).toHaveLength(2);
      expect(retrieved?.arguments?.[0].name).toBe('arg1');
      expect(retrieved?.arguments?.[0].required).toBe(true);
    });

    it('should handle clear and re-register', () => {
      registry.registerPrompt(createMockPrompt('prompt1'));
      registry.clear();
      registry.registerPrompt(createMockPrompt('prompt2'));

      expect(registry.getAllPrompts()).toHaveLength(1);
      expect(registry.getPrompt('prompt2')).toBeDefined();
    });
  });
});
