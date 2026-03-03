/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Prompt selector - chooses appropriate prompt based on model size.
 *
 * Model size tiers:
 * - compact: <=8B parameters (minimal instructions)
 * - standard: <=14B parameters (balanced instructions)
 * - full: <=32B parameters (complete instructions)
 * - extended: <=70B parameters (comprehensive instructions)
 * - maximum: >70B parameters (full documentation and examples)
 */

import os from 'node:os';
import process from 'node:process';
import { getCompactPrompt } from './compact.js';
import { getStandardPrompt } from './standard.js';
import { getFullPrompt } from './full.js';
import { getExtendedPrompt } from './extended.js';
import { getMaximumPrompt } from './maximum.js';
import { isGitRepository } from '../../utils/gitUtils.js';
import { supportsTools } from '../../model-definitions/index.js';
import {
  getToolLearningManager,
  type LearningFeedback,
} from '../../learning/tool-learning.js';

export type PromptTier =
  | 'compact'
  | 'standard'
  | 'full'
  | 'extended'
  | 'maximum';

export interface PromptContext {
  cwd: string;
  homeDir: string;
  isGitRepo: boolean;
  hasTools: boolean;
  isSandbox: boolean;
  sandboxType?: 'seatbelt' | 'generic';
  env: {
    ollamaBaseUrl: string;
    ollamaModel?: string;
    nodeVersion: string;
    platform: string;
    debugMode: string;
  };
  toolLearning?: LearningFeedback[];
}

// Size thresholds in billions of parameters
const SIZE_THRESHOLDS = {
  compact: 8, // <=8B
  standard: 14, // <=14B
  full: 32, // <=32B
  extended: 70, // <=70B
  // maximum: >70B
} as const;

/**
 * Extract model size from model name.
 * Common patterns: qwen3-14b, llama-70b, gpt-4, mixtral-8x7b, etc.
 */
export function extractModelSize(modelName: string): number | null {
  if (!modelName || modelName.length > 100) {
    return null;
  }

  // Match MoE patterns like "8x7b", "8x22b" first (total parameters)
  const moeMatch = modelName.match(/(\d+)x(\d+(?:\.\d+)?)b/i);
  if (moeMatch) {
    // For MoE, use total active parameters (experts * params per expert)
    // E.g., 8x7b = 8 experts * 7B = 56B total
    return parseInt(moeMatch[1], 10) * parseFloat(moeMatch[2]);
  }

  // Match patterns like "14b", "70b", "3b" (standalone)
  const sizeMatch = modelName.match(/(\d+(?:\.\d+)?)\s*b(?:\b|_)/i);
  if (sizeMatch) {
    return parseFloat(sizeMatch[1]);
  }

  // Match patterns like "qwen3-14b-instruct", "model-32.5b"
  const sizeInName = modelName.match(/-(\d+(?:\.\d+)?)b/i);
  if (sizeInName) {
    return parseFloat(sizeInName[1]);
  }

  // Known model families with approximate sizes
  const knownSizes: Record<string, number> = {
    // OpenAI
    'gpt-4': 1000, // ~1T params (treated as large)
    'gpt-4o': 200,
    'gpt-4-turbo': 176,
    'gpt-3.5': 175,
    o1: 200,
    'o1-mini': 20,
    o3: 200,
    'o3-mini': 20,

    // Anthropic
    'claude-3-opus': 200,
    'claude-3-sonnet': 70,
    'claude-3-haiku': 20,
    'claude-3.5': 70,

    // Google
    'gemini-ultra': 100,
    'gemini-pro': 35,
    'gemini-flash': 20,
    'gemma-7b': 7,
    'gemma-2b': 2,

    // Meta
    'llama-70b': 70,
    'llama-8b': 8,
    'llama-3-70b': 70,
    'llama-3-8b': 8,
    'llama-3.1-70b': 70,
    'llama-3.1-8b': 8,
    codellama: 34,

    // Mistral
    'mixtral-8x7b': 47, // 8x7 but sparse, ~47B active
    'mixtral-8x22b': 141,
    'mistral-large': 123,
    'mistral-medium': 70,
    'mistral-small': 22,
    'mistral-7b': 7,
    codestral: 22,

    // DeepSeek
    'deepseek-v3': 685,
    'deepseek-v2': 236,
    'deepseek-coder': 33,

    // Qwen
    'qwen-72b': 72,
    'qwen-14b': 14,
    'qwen-7b': 7,
    'qwen-1.8b': 1.8,
    'qwen-0.5b': 0.5,
    'qwen2.5-72b': 72,
    'qwen2.5-32b': 32,
    'qwen2.5-14b': 14,
    'qwen2.5-7b': 7,
    'qwen2.5-3b': 3,
    'qwen2.5-1.5b': 1.5,
    'qwen2.5-0.5b': 0.5,
    'qwen3-coder': 14, // default coder size
    qwen3: 14, // default qwen3 size

    // Other
    'phi-3': 4,
    'phi-3.5': 4,
    'phi-2': 3,
    'phi-1': 1,
    'yi-34b': 34,
    'yi-6b': 6,
    starcoder: 15,
    starcoder2: 15,
    'command-r': 35,
    'command-r-plus': 104,
  };

  const lowerName = modelName.toLowerCase();

  // Check exact matches first
  for (const [key, size] of Object.entries(knownSizes)) {
    if (
      lowerName === key ||
      lowerName.startsWith(key + '-') ||
      lowerName.startsWith(key + ':')
    ) {
      return size;
    }
  }

  // Check partial matches
  for (const [key, size] of Object.entries(knownSizes)) {
    if (lowerName.includes(key)) {
      return size;
    }
  }

  return null;
}

/**
 * Determine prompt tier based on model size.
 * Returns the most appropriate prompt complexity for the model's capabilities.
 */
export function getPromptTier(modelName?: string): PromptTier {
  if (!modelName) {
    return 'standard'; // Default to standard when no model specified
  }

  const size = extractModelSize(modelName);

  if (size === null) {
    return 'standard'; // Unknown size, use standard
  }

  // Size-based tier selection
  if (size <= SIZE_THRESHOLDS.compact) {
    return 'compact';
  }

  if (size <= SIZE_THRESHOLDS.standard) {
    return 'standard';
  }

  if (size <= SIZE_THRESHOLDS.full) {
    return 'full';
  }

  if (size <= SIZE_THRESHOLDS.extended) {
    return 'extended';
  }

  return 'maximum';
}

/**
 * Build context for prompt generation.
 */
export function buildPromptContext(modelName?: string): PromptContext {
  const isGitRepo = isGitRepository(process.cwd());
  const hasTools = modelName ? supportsTools(modelName) : true;

  const isSandboxExec = process.env['SANDBOX'] === 'sandbox-exec';
  const isGenericSandbox = !!process.env['SANDBOX'];

  // Get tool learning feedback
  let toolLearning: LearningFeedback[] | undefined;
  try {
    const manager = getToolLearningManager();
    toolLearning = manager.generateLearningFeedback();
  } catch {
    // Ignore errors
  }

  return {
    cwd: process.cwd(),
    homeDir: os.homedir(),
    isGitRepo,
    hasTools,
    isSandbox: isGenericSandbox,
    sandboxType: isSandboxExec
      ? 'seatbelt'
      : isGenericSandbox
        ? 'generic'
        : undefined,
    env: {
      ollamaBaseUrl:
        process.env['OLLAMA_BASE_URL'] ||
        process.env['OLLAMA_HOST'] ||
        'http://localhost:11434',
      ollamaModel: process.env['OLLAMA_MODEL'],
      nodeVersion: process.version,
      platform: process.platform,
      debugMode: process.env['DEBUG'] ? 'enabled' : 'disabled',
    },
    toolLearning,
  };
}

/**
 * Get appropriate system prompt based on model size.
 */
export function getPromptForModel(modelName?: string): string {
  const tier = getPromptTier(modelName);
  const context = buildPromptContext(modelName);

  switch (tier) {
    case 'compact':
      return getCompactPrompt(context);
    case 'standard':
      return getStandardPrompt(context);
    case 'full':
      return getFullPrompt(context);
    case 'extended':
      return getExtendedPrompt(context);
    case 'maximum':
      return getMaximumPrompt(context);
    default:
      return getStandardPrompt(context);
  }
}

/**
 * Get prompt tier name for debugging/logging.
 */
export function getPromptTierName(modelName?: string): string {
  return getPromptTier(modelName);
}

/**
 * Get size thresholds for documentation/debugging.
 */
export function getSizeThresholds(): typeof SIZE_THRESHOLDS {
  return { ...SIZE_THRESHOLDS };
}

export {
  getCompactPrompt,
  getStandardPrompt,
  getFullPrompt,
  getExtendedPrompt,
  getMaximumPrompt,
};
