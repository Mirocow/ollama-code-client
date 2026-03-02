/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Git Advanced Tool - Provides advanced git operations.
 *
 * Supported operations:
 * - stash: save, pop, apply, list, drop, clear
 * - cherry-pick: apply commits from other branches
 * - rebase: interactive simulation for rebasing
 * - bisect: binary search for finding bugs
 * - blame: show file annotation with commit info
 * - branch: create, delete, rename, list branches
 * - remote: manage remote repositories
 */

import { execSync, type ExecException } from 'node:child_process';
import type { Config } from '../../../../config/config.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
  type ToolResultDisplay,
} from '../../../../tools/tools.js';
import { ToolErrorType } from '../../../../tools/tool-error.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * All supported git operations
 */
export type GitOperation =
  | 'stash_save'
  | 'stash_pop'
  | 'stash_apply'
  | 'stash_list'
  | 'stash_drop'
  | 'stash_clear'
  | 'cherry_pick'
  | 'cherry_pick_continue'
  | 'cherry_pick_abort'
  | 'rebase_start'
  | 'rebase_continue'
  | 'rebase_abort'
  | 'rebase_status'
  | 'bisect_start'
  | 'bisect_good'
  | 'bisect_bad'
  | 'bisect_reset'
  | 'bisect_log'
  | 'blame'
  | 'branch_create'
  | 'branch_delete'
  | 'branch_rename'
  | 'branch_list'
  | 'remote_add'
  | 'remote_remove'
  | 'remote_list'
  | 'remote_set_url';

/**
 * Parameters for the Git Advanced Tool
 */
export interface GitAdvancedToolParams {
  /** Type of git operation to perform */
  operation: GitOperation;
  /** Arguments specific to the operation */
  args: Record<string, unknown>;
  /** Working directory for git operations (optional, defaults to project root) */
  directory?: string;
}

/**
 * Result of a git operation
 */
interface GitOperationResult {
  success: boolean;
  output: string;
  error?: string;
}

// ============================================================================
// Git Operation Handlers
// ============================================================================

/**
 * Executes a git command and returns the result
 */
function executeGitCommand(
  command: string,
  cwd: string,
): GitOperationResult {
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: output.trim() };
  } catch (error) {
    const execError = error as ExecException & { stderr?: string };
    return {
      success: false,
      output: '',
      error: execError.stderr || execError.message || 'Unknown error',
    };
  }
}

/**
 * Handlers for each git operation type
 */
const gitOperationHandlers: Record<
  GitOperation,
  (args: Record<string, unknown>, cwd: string) => GitOperationResult
> = {
  // ---- STASH OPERATIONS ----
  stash_save: (args, cwd) => {
    const message = args['message'] ? ` -m "${args['message']}"` : '';
    const includeUntracked = args['includeUntracked'] ? ' --include-untracked' : '';
    const keepIndex = args['keepIndex'] ? ' --keep-index' : '';
    return executeGitCommand(
      `git stash push${message}${includeUntracked}${keepIndex}`,
      cwd,
    );
  },

  stash_pop: (args, cwd) => {
    const stash = args['stash'] ? ` ${args['stash']}` : '';
    return executeGitCommand(`git stash pop${stash}`, cwd);
  },

  stash_apply: (args, cwd) => {
    const stash = args['stash'] ? ` ${args['stash']}` : '';
    return executeGitCommand(`git stash apply${stash}`, cwd);
  },

  stash_list: (_args, cwd) => executeGitCommand('git stash list', cwd),

  stash_drop: (args, cwd) => {
    const stash = args['stash'] ? ` ${args['stash']}` : '';
    return executeGitCommand(`git stash drop${stash}`, cwd);
  },

  stash_clear: (_args, cwd) => executeGitCommand('git stash clear', cwd),

  // ---- CHERRY-PICK OPERATIONS ----
  cherry_pick: (args, cwd) => {
    const commit = args['commit'];
    if (!commit || typeof commit !== 'string') {
      return { success: false, output: '', error: 'Commit hash is required' };
    }
    const noCommit = args['noCommit'] ? ' --no-commit' : '';
    const signoff = args['signoff'] ? ' --signoff' : '';
    return executeGitCommand(
      `git cherry-pick${noCommit}${signoff} ${commit}`,
      cwd,
    );
  },

  cherry_pick_continue: (_args, cwd) => executeGitCommand('git cherry-pick --continue', cwd),

  cherry_pick_abort: (_args, cwd) => executeGitCommand('git cherry-pick --abort', cwd),

  // ---- REBASE OPERATIONS ----
  rebase_start: (args, cwd) => {
    const onto = args['onto'] ? ` --onto ${args['onto']}` : '';
    const upstream = args['upstream'];
    if (!upstream || typeof upstream !== 'string') {
      return {
        success: false,
        output: '',
        error: 'Upstream branch is required for rebase',
      };
    }
    const interactive = args['interactive'] ? ' -i' : '';
    return executeGitCommand(
      `git rebase${interactive}${onto} ${upstream}`,
      cwd,
    );
  },

  rebase_continue: (_args, cwd) => executeGitCommand('git rebase --continue', cwd),

  rebase_abort: (_args, cwd) => executeGitCommand('git rebase --abort', cwd),

  rebase_status: (_args, cwd) => {
    // Check if we're in the middle of a rebase
    const statusResult = executeGitCommand(
      'test -d .git/rebase-merge || test -d .git/rebase-apply && echo "in_progress" || echo "not_in_rebase"',
      cwd,
    );
    if (statusResult.success) {
      if (statusResult.output.includes('in_progress')) {
        const todoList = executeGitCommand(
          'cat .git/rebase-merge/git-rebase-todo 2>/dev/null || echo "No todo list available"',
          cwd,
        );
        const doneList = executeGitCommand(
          'cat .git/rebase-merge/done 2>/dev/null || echo "No completed list available"',
          cwd,
        );
        return {
          success: true,
          output: `Rebase in progress.\n\nPending operations:\n${todoList.output}\n\nCompleted operations:\n${doneList.output}`,
        };
      }
      return { success: true, output: 'No rebase in progress.' };
    }
    return statusResult;
  },

  // ---- BISECT OPERATIONS ----
  bisect_start: (args, cwd) => {
    const bad = args['bad'] ? ` ${args['bad']}` : '';
    const good = args['good'] ? ` ${args['good']}` : '';
    const noCheckout = args['noCheckout'] ? ' --no-checkout' : '';
    return executeGitCommand(
      `git bisect start${noCheckout}${bad}${good}`,
      cwd,
    );
  },

  bisect_good: (args, cwd) => {
    const ref = args['ref'] ? ` ${args['ref']}` : '';
    return executeGitCommand(`git bisect good${ref}`, cwd);
  },

  bisect_bad: (args, cwd) => {
    const ref = args['ref'] ? ` ${args['ref']}` : '';
    return executeGitCommand(`git bisect bad${ref}`, cwd);
  },

  bisect_reset: (args, cwd) => {
    const commit = args['commit'] ? ` ${args['commit']}` : '';
    return executeGitCommand(`git bisect reset${commit}`, cwd);
  },

  bisect_log: (_args, cwd) => executeGitCommand('git bisect log', cwd),

  // ---- BLAME OPERATIONS ----
  blame: (args, cwd) => {
    const file = args['file'];
    if (!file || typeof file !== 'string') {
      return { success: false, output: '', error: 'File path is required' };
    }
    const lineRange =
      args['startLine'] && args['endLine']
        ? ` -L ${args['startLine']},${args['endLine']}`
        : '';
    const showEmail = args['showEmail'] ? ' -e' : '';
    const showLineNumber = args['showLineNumber'] !== false ? ' -n' : '';
    return executeGitCommand(
      `git blame${lineRange}${showEmail}${showLineNumber} "${file}"`,
      cwd,
    );
  },

  // ---- BRANCH OPERATIONS ----
  branch_create: (args, cwd) => {
    const name = args['name'];
    if (!name || typeof name !== 'string') {
      return {
        success: false,
        output: '',
        error: 'Branch name is required',
      };
    }
    const startPoint = args['startPoint'] ? ` ${args['startPoint']}` : '';
    const checkout = args['checkout'] ? ' -b' : '';
    return executeGitCommand(
      `git branch${checkout} "${name}"${startPoint}`,
      cwd,
    );
  },

  branch_delete: (args, cwd) => {
    const name = args['name'];
    if (!name || typeof name !== 'string') {
      return {
        success: false,
        output: '',
        error: 'Branch name is required',
      };
    }
    const force = args['force'] ? ' -D' : ' -d';
    const remote = args['remote'] ? ' -r' : '';
    return executeGitCommand(`git branch${force}${remote} "${name}"`, cwd);
  },

  branch_rename: (args, cwd) => {
    const oldName = args['oldName'];
    const newName = args['newName'];
    if (!oldName || !newName) {
      return {
        success: false,
        output: '',
        error: 'Both oldName and newName are required',
      };
    }
    return executeGitCommand(
      `git branch -m "${oldName}" "${newName}"`,
      cwd,
    );
  },

  branch_list: (args, cwd) => {
    const all = args['all'] ? ' -a' : '';
    const remote = args['remote'] ? ' -r' : '';
    const pattern = args['pattern'] ? ` "${args['pattern']}"` : '';
    const verbose = args['verbose'] ? ' -vv' : '';
    return executeGitCommand(
      `git branch${all}${remote}${verbose}${pattern}`,
      cwd,
    );
  },

  // ---- REMOTE OPERATIONS ----
  remote_add: (args, cwd) => {
    const name = args['name'];
    const url = args['url'];
    if (!name || !url) {
      return {
        success: false,
        output: '',
        error: 'Both name and url are required',
      };
    }
    const fetch = args['fetch'] === false ? ' --no-fetch' : '';
    return executeGitCommand(
      `git remote add${fetch} "${name}" "${url}"`,
      cwd,
    );
  },

  remote_remove: (args, cwd) => {
    const name = args['name'];
    if (!name || typeof name !== 'string') {
      return {
        success: false,
        output: '',
        error: 'Remote name is required',
      };
    }
    return executeGitCommand(`git remote remove "${name}"`, cwd);
  },

  remote_list: (args, cwd) => {
    const verbose = args['verbose'] ? ' -v' : '';
    return executeGitCommand(`git remote${verbose}`, cwd);
  },

  remote_set_url: (args, cwd) => {
    const name = args['name'];
    const url = args['url'];
    if (!name || !url) {
      return {
        success: false,
        output: '',
        error: 'Both name and url are required',
      };
    }
    const push = args['push'] ? ' --push' : '';
    return executeGitCommand(
      `git remote set-url${push} "${name}" "${url}"`,
      cwd,
    );
  },
};

// ============================================================================
// Tool Invocation
// ============================================================================

/**
 * Invocation class for Git Advanced Tool operations.
 * Handles the execution of git commands and formatting of results.
 */
class GitAdvancedToolInvocation extends BaseToolInvocation<
  GitAdvancedToolParams,
  ToolResult
> {
  constructor(
    params: GitAdvancedToolParams,
    private readonly config: Config,
  ) {
    super(params);
  }

  /**
   * Returns a human-readable description of the operation.
   */
  getDescription(): string {
    const operation = this.params.operation;
    const args = this.params.args;
    const dir = this.params.directory || this.config.getTargetDir();

    let description = `git ${operation.replace(/_/g, ' ')}`;

    // Add key argument to description for context
    if (args['commit']) description += ` (${args['commit']})`;
    if (args['name']) description += ` (${args['name']})`;
    if (args['file']) description += ` (${args['file']})`;
    if (args['upstream']) description += ` onto ${args['upstream']}`;

    description += ` [in ${dir}]`;

    return description;
  }

  /**
   * Executes the git operation.
   */
  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const cwd = this.params.directory || this.config.getTargetDir();
    const operation = this.params.operation;
    const args = this.params.args;

    // Validate that operation is supported
    if (!gitOperationHandlers[operation]) {
      return {
        llmContent: `Error: Unknown git operation '${operation}'`,
        returnDisplay: `Unknown operation: ${operation}`,
        error: {
          message: `Unknown git operation: ${operation}`,
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    // Execute the operation
    const result = gitOperationHandlers[operation](args, cwd);

    if (!result.success) {
      return {
        llmContent: this.formatErrorResult(operation, result.error || 'Unknown error'),
        returnDisplay: `❌ Git ${operation.replace(/_/g, ' ')} failed: ${result.error}`,
        error: {
          message: result.error || 'Git operation failed',
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }

    return {
      llmContent: this.formatSuccessResult(operation, result.output, args),
      returnDisplay: `✅ Git ${operation.replace(/_/g, ' ')} succeeded`,
    };
  }

  /**
   * Formats successful operation result as markdown.
   */
  private formatSuccessResult(
    operation: GitOperation,
    output: string,
    _args: Record<string, unknown>,
  ): string {
    const lines: string[] = [
      `# Git ${operation.replace(/_/g, ' ')} - Success`,
      '',
    ];

    if (output) {
      lines.push('## Output');
      lines.push('');
      lines.push('```');
      lines.push(output);
      lines.push('```');
    } else {
      lines.push('_No output_');
    }

    // Add helpful next steps based on operation type
    const nextSteps = this.getNextSteps(operation);
    if (nextSteps) {
      lines.push('');
      lines.push('## Suggested Next Steps');
      lines.push(nextSteps);
    }

    return lines.join('\n');
  }

  /**
   * Formats error result as markdown.
   */
  private formatErrorResult(operation: GitOperation, error: string): string {
    return [
      `# Git ${operation.replace(/_/g, ' ')} - Failed`,
      '',
      '## Error',
      '',
      '```',
      error,
      '```',
      '',
      '## Troubleshooting',
      this.getTroubleshootingTips(operation, error),
    ].join('\n');
  }

  /**
   * Returns suggested next steps for an operation.
   */
  private getNextSteps(operation: GitOperation): string {
    const steps: Record<string, string> = {
      stash_save: '- Use `stash_list` to see all stashes\n- Use `stash_pop` to apply and remove the stash',
      stash_pop: '- Check for merge conflicts if any\n- Use `git status` to see current state',
      stash_apply: '- Check for merge conflicts if any\n- Use `stash_drop` to remove the stash after applying',
      cherry_pick: '- Resolve conflicts if any\n- Use `cherry_pick_continue` after resolving\n- Use `cherry_pick_abort` to cancel',
      rebase_start: '- Resolve conflicts if any\n- Use `rebase_continue` after resolving\n- Use `rebase_abort` to cancel',
      bisect_start: '- Use `bisect_good` to mark good commits\n- Use `bisect_bad` to mark bad commits\n- Git will guide you to the problematic commit',
      branch_create: '- Use `git checkout` to switch to the new branch\n- Use `git push -u origin <branch>` to push',
      remote_add: '- Use `git fetch <name>` to fetch from the remote\n- Use `git branch -r` to see remote branches',
    };

    return steps[operation] || '';
  }

  /**
   * Returns troubleshooting tips for common errors.
   */
  private getTroubleshootingTips(operation: GitOperation, error: string): string {
    // Common error patterns and tips
    if (error.includes('not a git repository')) {
      return '- Make sure you are in a git repository\n- Initialize with `git init` if needed';
    }

    if (error.includes('merge conflict')) {
      return '- Resolve the conflicts in the marked files\n- Use `git status` to see conflicted files\n- After resolving, continue the operation';
    }

    if (error.includes('not found') || error.includes('does not exist')) {
      return '- Check that the reference (commit, branch, etc.) exists\n- Use `git log` or `git branch` to verify';
    }

    // Operation-specific tips
    const tips: Record<string, string> = {
      cherry_pick: '- Ensure the commit hash is correct\n- Check if there are uncommitted changes that might interfere',
      rebase_start: '- Ensure the upstream branch exists\n- Consider using `--onto` for more control\n- Interactive mode (`-i`) allows editing commits',
      bisect_start: '- Make sure you have a known good and bad commit\n- Use `bisect_log` to track progress',
      branch_delete: '- Use `-D` flag for forced deletion\n- Cannot delete the current branch\n- Use `-r` flag for remote branches',
      remote_add: '- Check the remote URL is correct\n- Use `remote_list` to see existing remotes',
    };

    return tips[operation] || '- Check the error message for details\n- Use `git status` to see current state';
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * JSON Schema for Git Advanced Tool parameters
 */
const gitAdvancedToolSchema = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: [
        'stash_save',
        'stash_pop',
        'stash_apply',
        'stash_list',
        'stash_drop',
        'stash_clear',
        'cherry_pick',
        'cherry_pick_continue',
        'cherry_pick_abort',
        'rebase_start',
        'rebase_continue',
        'rebase_abort',
        'rebase_status',
        'bisect_start',
        'bisect_good',
        'bisect_bad',
        'bisect_reset',
        'bisect_log',
        'blame',
        'branch_create',
        'branch_delete',
        'branch_rename',
        'branch_list',
        'remote_add',
        'remote_remove',
        'remote_list',
        'remote_set_url',
      ],
      description: 'Type of git operation to perform',
    },
    args: {
      type: 'object',
      description: 'Arguments specific to the operation',
      additionalProperties: true,
    },
    directory: {
      type: 'string',
      description:
        'Working directory for git operations (optional, defaults to project root)',
    },
  },
  required: ['operation'],
};

/**
 * Tool description
 */
function getGitAdvancedToolDescription(): string {
  return `Performs advanced git operations including stash management, cherry-pick, rebase, bisect, blame, and branch/remote management.

## Supported Operations

### Stash Operations
- **stash_save**: Save local changes to stash. Args: \`message\`, \`includeUntracked\`, \`keepIndex\`
- **stash_pop**: Apply and remove stash. Args: \`stash\` (e.g., "stash@{0}")
- **stash_apply**: Apply stash without removing. Args: \`stash\`
- **stash_list**: List all stashes
- **stash_drop**: Remove a stash. Args: \`stash\`
- **stash_clear**: Remove all stashes

### Cherry-Pick Operations
- **cherry_pick**: Apply commit from another branch. Args: \`commit\`, \`noCommit\`, \`signoff\`
- **cherry_pick_continue**: Continue after resolving conflicts
- **cherry_pick_abort**: Abort the cherry-pick

### Rebase Operations
- **rebase_start**: Start a rebase. Args: \`upstream\`, \`onto\`, \`interactive\`
- **rebase_continue**: Continue after resolving conflicts
- **rebase_abort**: Abort the rebase
- **rebase_status**: Check current rebase status

### Bisect Operations
- **bisect_start**: Start binary search. Args: \`bad\`, \`good\`, \`noCheckout\`
- **bisect_good**: Mark current commit as good. Args: \`ref\`
- **bisect_bad**: Mark current commit as bad. Args: \`ref\`
- **bisect_reset**: End bisect. Args: \`commit\`
- **bisect_log**: Show bisect log

### Blame Operations
- **blame**: Show file annotation. Args: \`file\`, \`startLine\`, \`endLine\`, \`showEmail\`, \`showLineNumber\`

### Branch Operations
- **branch_create**: Create new branch. Args: \`name\`, \`startPoint\`, \`checkout\`
- **branch_delete**: Delete branch. Args: \`name\`, \`force\`, \`remote\`
- **branch_rename**: Rename branch. Args: \`oldName\`, \`newName\`
- **branch_list**: List branches. Args: \`all\`, \`remote\`, \`pattern\`, \`verbose\`

### Remote Operations
- **remote_add**: Add remote. Args: \`name\`, \`url\`, \`fetch\`
- **remote_remove**: Remove remote. Args: \`name\`
- **remote_list**: List remotes. Args: \`verbose\`
- **remote_set_url**: Set remote URL. Args: \`name\`, \`url\`, \`push\`

## Usage Notes
- Always ensure you are in a git repository
- For operations that may have conflicts, have a backup strategy
- Use \`git status\` to check current state before/after operations`;
}

/**
 * Git Advanced Tool - Provides advanced git operations.
 *
 * This tool extends BaseDeclarativeTool and provides a comprehensive
 * set of git operations beyond basic add/commit/push.
 */
export class GitAdvancedTool extends BaseDeclarativeTool<
  GitAdvancedToolParams,
  ToolResult
> {
  static Name = 'git_advanced';

  constructor(private readonly config: Config) {
    super(
      GitAdvancedTool.Name,
      'GitAdvanced',
      getGitAdvancedToolDescription(),
      Kind.Execute,
      gitAdvancedToolSchema,
      true, // output is markdown
      false, // output cannot be updated
    );
  }

  /**
   * Validates the parameter values beyond JSON schema.
   */
  protected override validateToolParamValues(
    params: GitAdvancedToolParams,
  ): string | null {
    // Validate args based on operation type
    const operation = params.operation;
    const args = params.args || {};

    // Operation-specific validation
    switch (operation) {
      case 'cherry_pick':
        if (!args['commit']) {
          return 'cherry_pick requires a "commit" argument';
        }
        break;

      case 'rebase_start':
        if (!args['upstream']) {
          return 'rebase_start requires an "upstream" argument';
        }
        break;

      case 'blame':
        if (!args['file']) {
          return 'blame requires a "file" argument';
        }
        break;

      case 'branch_create':
        if (!args['name']) {
          return 'branch_create requires a "name" argument';
        }
        break;

      case 'branch_delete':
        if (!args['name']) {
          return 'branch_delete requires a "name" argument';
        }
        break;

      case 'branch_rename':
        if (!args['oldName'] || !args['newName']) {
          return 'branch_rename requires both "oldName" and "newName" arguments';
        }
        break;

      case 'remote_add':
        if (!args['name'] || !args['url']) {
          return 'remote_add requires both "name" and "url" arguments';
        }
        break;

      case 'remote_remove':
        if (!args['name']) {
          return 'remote_remove requires a "name" argument';
        }
        break;

      case 'remote_set_url':
        if (!args['name'] || !args['url']) {
          return 'remote_set_url requires both "name" and "url" arguments';
        }
        break;
    }

    return null;
  }

  /**
   * Creates the tool invocation instance.
   */
  protected createInvocation(
    params: GitAdvancedToolParams,
  ): ToolInvocation<GitAdvancedToolParams, ToolResult> {
    return new GitAdvancedToolInvocation(params, this.config);
  }
}

/**
 * Factory function to create the Git Advanced Tool instance.
 */
export function gitAdvancedTool(config: Config): GitAdvancedTool {
  return new GitAdvancedTool(config);
}
