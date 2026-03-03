/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { SystemPromptOptimizer } from './promptOptimizer.js';
import {
  getPromptOptimizer,
  getOptimizedToolsForMessage,
  ToolCategories,
} from './promptOptimizer.js';

describe('SystemPromptOptimizer', () => {
  let optimizer: SystemPromptOptimizer;

  beforeEach(() => {
    optimizer = getPromptOptimizer();
    optimizer.clearCache();
  });

  describe('splitPrompt', () => {
    it('should split prompt into static and dynamic parts', () => {
      const prompt = `You are an AI assistant.

# Core Mandates
Some static content here.

## Environment
Dynamic environment info here.`;

      const { staticPart, dynamicPart } = optimizer.splitPrompt(prompt);

      expect(staticPart).toContain('Core Mandates');
      expect(dynamicPart).toContain('Environment');
    });

    it('should handle prompts without dynamic markers', () => {
      const prompt = 'Just static content without markers.';

      const { staticPart, dynamicPart } = optimizer.splitPrompt(prompt);

      expect(staticPart).toBe(prompt);
      expect(dynamicPart).toBe('');
    });
  });

  describe('getCachedStaticPrompt', () => {
    it('should cache static prompt on first call', () => {
      const prompt = 'Test prompt with some content.';

      const result = optimizer.getCachedStaticPrompt(prompt);

      expect(result.isNew).toBe(true);
      expect(result.staticPart).toBeDefined();
      expect(result.hash).toBeDefined();
    });

    it('should return cached prompt on second call', () => {
      const prompt = 'Test prompt with some content.';

      optimizer.getCachedStaticPrompt(prompt);
      const result = optimizer.getCachedStaticPrompt(prompt);

      expect(result.isNew).toBe(false);
    });

    it('should generate different hashes for different prompts', () => {
      const result1 = optimizer.getCachedStaticPrompt('First prompt');
      const result2 = optimizer.getCachedStaticPrompt('Second prompt');

      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for simple text', () => {
      const text = 'Hello world'; // ~11 chars
      const tokens = optimizer.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should handle code differently from text', () => {
      const code = 'function test() { return 1; }';
      const text = 'This is a simple text with words';

      const codeTokens = optimizer.estimateTokens(code);
      const textTokens = optimizer.estimateTokens(text);

      // Code typically has more tokens per character
      expect(codeTokens).toBeDefined();
      expect(textTokens).toBeDefined();
    });
  });

  describe('detectTaskCategories', () => {
    it('should detect web-related tasks', () => {
      const categories = optimizer.detectTaskCategories(
        'fetch data from API endpoint',
      );

      expect(categories).toContain('web');
    });

    it('should detect database-related tasks', () => {
      const categories = optimizer.detectTaskCategories(
        'query the SQL database',
      );

      expect(categories).toContain('database');
    });

    it('should detect Python tasks', () => {
      const categories = optimizer.detectTaskCategories('run Python script');

      expect(categories).toContain('python');
    });

    it('should detect Node.js tasks', () => {
      const categories = optimizer.detectTaskCategories(
        'create a React component',
      );

      expect(categories).toContain('nodejs');
    });

    it('should always include core tools', () => {
      const categories = optimizer.detectTaskCategories('simple task');

      expect(categories).toContain('core');
      expect(categories).toContain('taskManagement');
    });

    it('should detect multiple categories', () => {
      const categories = optimizer.detectTaskCategories(
        'fetch API data and save to database',
      );

      expect(categories).toContain('web');
      expect(categories).toContain('database');
    });
  });

  describe('getToolsForCategories', () => {
    it('should return tools for single category', () => {
      const tools = optimizer.getToolsForCategories(['core']);

      expect(tools).toContain('read_file');
      expect(tools).toContain('write_file');
    });

    it('should dedupe tools across categories', () => {
      const tools = optimizer.getToolsForCategories(['core', 'taskManagement']);

      // Check that each tool appears only once
      const uniqueTools = [...new Set(tools)];
      expect(tools.length).toBe(uniqueTools.length);
    });
  });

  describe('getOptimizedToolNames', () => {
    const allTools = [
      'read_file',
      'write_file',
      'run_shell_command',
      'web_fetch',
      'web_search',
      'python_dev',
      'nodejs_dev',
      'todo_write',
      'save_memory',
      'task',
      'skill',
    ];

    it('should return subset of tools based on context', () => {
      const tools = optimizer.getOptimizedToolNames(
        'fetch data from API',
        allTools,
      );

      expect(tools.length).toBeLessThan(allTools.length);
      expect(tools).toContain('web_fetch');
    });

    it('should include all tools when includeAll is true', () => {
      const tools = optimizer.getOptimizedToolNames('simple task', allTools, {
        includeAll: true,
      });

      expect(tools.length).toBe(allTools.length);
    });

    it('should respect maxTools limit', () => {
      const tools = optimizer.getOptimizedToolNames('complex task', allTools, {
        maxTools: 5,
      });

      expect(tools.length).toBeLessThanOrEqual(5);
    });
  });

  describe('estimateSavings', () => {
    it('should calculate token savings', () => {
      const savings = optimizer.estimateSavings('Test prompt', 20, 10);

      expect(savings.toolTokensSaved).toBeGreaterThan(0);
      expect(savings.totalSaved).toBeGreaterThan(0);
    });

    it('should show no savings when tool counts are equal', () => {
      const savings = optimizer.estimateSavings('Test prompt', 10, 10);

      expect(savings.toolTokensSaved).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return empty stats initially', () => {
      const stats = optimizer.getStats();

      expect(stats.hasCache).toBe(false);
      expect(stats.cachedTokenCount).toBe(0);
    });

    it('should return stats after caching', () => {
      optimizer.getCachedStaticPrompt('Test prompt');
      const stats = optimizer.getStats();

      expect(stats.hasCache).toBe(true);
      expect(stats.cachedTokenCount).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      optimizer.getCachedStaticPrompt('Test prompt');
      optimizer.clearCache();
      const stats = optimizer.getStats();

      expect(stats.hasCache).toBe(false);
    });
  });
});

describe('getOptimizedToolsForMessage', () => {
  it('should return optimized tool list', () => {
    const allTools = ['read_file', 'write_file', 'web_fetch', 'python_dev'];
    const tools = getOptimizedToolsForMessage('read the file', allTools);

    expect(tools).toContain('read_file');
  });
});

describe('ToolCategories', () => {
  it('should have core tools defined', () => {
    expect(ToolCategories.core).toBeDefined();
    expect(ToolCategories.core).toContain('read_file');
    expect(ToolCategories.core).toContain('write_file');
  });

  it('should have language-specific tools', () => {
    expect(ToolCategories.python).toContain('python_dev');
    expect(ToolCategories.nodejs).toContain('nodejs_dev');
    expect(ToolCategories.golang).toContain('golang_dev');
  });
});
