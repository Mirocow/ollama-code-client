/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * New system prompt generator using template-based approach.
 * Templates are optimized for different model sizes.
 */

import * as process from 'node:process';
import * as os from 'node:os';
import {
  getSystemPromptTemplate,
  fillTemplatePlaceholders,
  type TemplatePlaceholders,
} from '../prompts/index.js';
import { isGitRepository } from '../utils/gitUtils.js';
import { getToolLearningManager } from '../learning/tool-learning.js';
import { supportsTools } from '../model-definitions/index.js';

/**
 * Gets tool learning context for the prompt
 */
function getToolLearningContext(): string {
  try {
    const toolLearning = getToolLearningManager();
    const feedback = toolLearning.generateLearningFeedback();

    if (feedback.length === 0) {
      return '';
    }

    const lines: string[] = [
      '',
      '# Tool Learning Context',
      '',
      'You have made the following tool call errors in recent sessions. Learn from these mistakes:',
      '',
    ];

    for (const f of feedback.slice(0, 3)) {
      lines.push(
        `## Wrong: "${f.incorrectTool}" → Correct: "${f.correctTool}"`,
      );
      lines.push(f.explanation);
      lines.push(`**Example:** \`${f.example}\``);
      lines.push('');
    }

    const commonMistakes = toolLearning.getCommonMistakes(5);
    if (commonMistakes.length > 0) {
      lines.push('### Common Tool Name Mistakes to Avoid');
      for (const m of commonMistakes) {
        lines.push(`- ❌ "${m.wrongName}" → ✅ use "${m.correct}"`);
      }
      lines.push('');
    }

    lines.push(
      '**IMPORTANT:** Always use EXACT tool names as listed in the Available Tools section.',
    );

    return lines.join('\n');
  } catch {
    return '';
  }
}

/**
 * Gets environment info for the prompt
 */
function getEnvironmentInfo(): string {
  const envLines: string[] = [];

  const ollamaBaseUrl =
    process.env['OLLAMA_BASE_URL'] ||
    process.env['OLLAMA_HOST'] ||
    'http://localhost:11434';
  const ollamaModel = process.env['OLLAMA_MODEL'];
  const ollamaKeepAlive = process.env['OLLAMA_KEEP_ALIVE'];
  const ollamaApiKey = process.env['OLLAMA_API_KEY'] ? '(set)' : '(not set)';

  const debugMode = process.env['DEBUG'] ? 'enabled' : 'disabled';

  const nodeVersion = process.version;
  const platform = process.platform;
  const cwd = process.cwd();
  const homeDir = os.homedir();

  envLines.push('## Environment');
  envLines.push('');
  envLines.push('You are running in the following environment:');
  envLines.push('');
  envLines.push('### Ollama Configuration');
  envLines.push(`- **OLLAMA_BASE_URL**: ${ollamaBaseUrl}`);
  if (ollamaModel) {
    envLines.push(`- **OLLAMA_MODEL**: ${ollamaModel}`);
  }
  if (ollamaKeepAlive) {
    envLines.push(`- **OLLAMA_KEEP_ALIVE**: ${ollamaKeepAlive}`);
  }
  envLines.push(`- **OLLAMA_API_KEY**: ${ollamaApiKey}`);
  envLines.push('');
  envLines.push('### System Information');
  envLines.push(`- **Node.js Version**: ${nodeVersion}`);
  envLines.push(`- **Platform**: ${platform}`);
  envLines.push(`- **Current Working Directory**: ${cwd}`);
  envLines.push(`- **Home Directory**: ${homeDir}`);
  envLines.push('');
  envLines.push('### Debug Settings');
  envLines.push(`- **DEBUG Mode**: ${debugMode}`);

  return envLines.join('\n');
}

/**
 * Gets sandbox info for the prompt
 */
function getSandboxInfo(): string {
  const isSandboxExec = process.env['SANDBOX'] === 'sandbox-exec';
  const isGenericSandbox = !!process.env['SANDBOX'];

  if (isSandboxExec) {
    return `# macOS Seatbelt
You are running under macos seatbelt with limited access to files outside the project directory or system temp directory, and with limited access to host system resources such as ports. If you encounter failures that could be due to MacOS Seatbelt (e.g. if a command fails with 'Operation not permitted' or similar error), as you report the error to the user, also explain why you think it could be due to MacOS Seatbelt, and how the user may need to adjust their Seatbelt profile.`;
  } else if (isGenericSandbox) {
    return `# Sandbox
You are running in a sandbox container with limited access to files outside the project directory or system temp directory, and with limited access to host system resources such as ports. If you encounter failures that could be due to sandboxing (e.g. if a command fails with 'Operation not permitted' or similar error), when you report the error to the user, also explain why you think it could be due to sandboxing, and how the user may need to adjust their sandbox configuration.`;
  }

  return `# Outside of Sandbox
You are running outside of a sandbox container, directly on the user's system. For critical commands that are particularly likely to modify the user's system outside of the project directory or system temp directory, as you explain the command to the user (per the Explain Critical Commands rule above), also remind the user to consider enabling sandboxing.`;
}

/**
 * Gets git info for the prompt
 */
function getGitInfo(): string {
  if (isGitRepository(process.cwd())) {
    return `# Git Repository
- The current working (project) directory is being managed by a git repository.
- When asked to commit changes or prepare a commit, always start by gathering information using shell commands:
  - \`git status\` to ensure that all relevant files are tracked and staged, using \`git add ...\` as needed.
  - \`git diff HEAD\` to review all changes (including unstaged changes) to tracked files in work tree since last commit.
  - \`git log -n 3\` to review recent commit messages and match their style.
- Combine shell commands whenever possible: \`git status && git diff HEAD && git log -n 3\`.
- Always propose a draft commit message. Never just ask the user to give you the full commit message.
- Prefer commit messages that are clear, concise, and focused more on "why" and less on "what".
- Never push changes to a remote repository without being asked explicitly by the user.`;
  }
  return '';
}

/**
 * Gets tool call format instructions for models without native tool support
 */
function getToolCallFormatInstructions(model?: string): string {
  if (!model || supportsTools(model)) {
    return '';
  }

  return `# Tool Call Format (IMPORTANT)

This model does not have native tool calling support. You MUST format tool calls as JSON objects.

## Correct Format

Use one of these formats to call tools:

### Format 1: Tool Call Tag (Preferred)
\`\`\`
<tool_call={"name": "tool_name", "arguments": {"param": "value"}}>
\`\`\`

### Format 2: JSON in Code Block
\`\`\`json
{"name": "tool_name", "arguments": {"param": "value"}}
\`\`\`

## Available Tool Names

Use ONLY these exact tool names:
- \`read_file\` - Read a single file
- \`write_file\` - Create or overwrite a file
- \`edit\` - Edit an existing file
- \`run_shell_command\` - Execute shell commands
- \`grep_search\` - Search file contents
- \`glob\` - Find files by pattern
- \`list_directory\` - List directory contents
- \`python_dev\` - Python development commands
- \`nodejs_dev\` - Node.js/JavaScript commands
- \`golang_dev\` - Go development commands
- \`todo_write\` - Manage task list
- \`save_memory\` - Save information for later

**NEVER use names like:** git_dev, shell_dev, bash_dev, javascript_dev, etc.
These are NOT valid tool names!`;
}

/**
 * Get the new template-based system prompt
 *
 * This function loads a template based on model size and fills in dynamic placeholders.
 * Templates are optimized for different model capacities:
 * - small (<=10B): Compact, essential rules only
 * - medium (<=30B): Standard detail level
 * - large (<=60B): Extended instructions
 * - xlarge (>60B): Full detail with all features
 *
 * @param userMemory - Optional user memory to append
 * @param model - Model name for template selection
 * @returns Complete system prompt
 */
export function getCoreSystemPromptV2(
  userMemory?: string,
  model?: string,
): string {
  // Get the appropriate template based on model size
  const template = getSystemPromptTemplate(model);

  // Build placeholders
  const placeholders: Partial<TemplatePlaceholders> = {
    ENVIRONMENT_INFO: getEnvironmentInfo(),
    TOOL_LEARNING: getToolLearningContext(),
    TOOL_CALL_FORMAT: getToolCallFormatInstructions(model),
    SANDBOX_INFO: getSandboxInfo(),
    GIT_INFO: getGitInfo(),
    ROOT: process.cwd(),
  };

  // Fill template
  const prompt = fillTemplatePlaceholders(template, placeholders);

  // Append user memory
  const memorySuffix =
    userMemory && userMemory.trim().length > 0
      ? `\n\n---\n\n${userMemory.trim()}`
      : '';

  return `${prompt}${memorySuffix}`;
}

/**
 * Check if templates should be used
 */
export function shouldUseTemplates(): boolean {
  const envValue = process.env['OLLAMA_CODE_USE_TEMPLATES'];

  // Default to true if not set
  if (envValue === undefined || envValue === '') {
    return true;
  }

  // Check for false values
  return !['0', 'false', 'no', 'off'].includes(envValue.toLowerCase());
}
