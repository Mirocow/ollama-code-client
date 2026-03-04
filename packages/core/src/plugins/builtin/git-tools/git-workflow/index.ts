/**
 * @license
 * Copyright 2025 Ollama Code Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Git Workflow Tool - Provides basic git workflow operations.
 *
 * Supported operations:
 * - status: check repository status
 * - add: stage files
 * - commit: commit staged changes
 * - push: push to remote
 * - pull: pull from remote
 * - fetch: fetch from remote without merging
 * - merge: merge branches
 * - create_branch: create and optionally checkout a new branch
 * - switch: switch to a branch
 * - log: show commit history
 * - diff: show differences
 * - create_mr: create Merge Request (GitLab)
 * - create_pr: create Pull Request (GitHub)
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
 * All supported git workflow operations
 */
export type GitWorkflowOperation =
  | 'status'
  | 'add'
  | 'commit'
  | 'push'
  | 'pull'
  | 'fetch'
  | 'merge'
  | 'create_branch'
  | 'switch'
  | 'log'
  | 'diff'
  | 'create_mr'
  | 'create_pr'
  | 'create_merge'
  | 'clone'
  | 'remote_info'
  | 'auth_status'
  | 'auth_login'
  | 'auth_logout'
  | 'auth_token';

/**
 * Parameters for the Git Workflow Tool
 */
export interface GitWorkflowToolParams {
  /** Type of git operation to perform */
  operation: GitWorkflowOperation;
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
 * Detects if the remote is GitHub
 */
function isGitHubRemote(cwd: string): boolean {
  const result = executeGitCommand('git remote get-url origin', cwd);
  if (!result.success) return false;
  return result.output.includes('github.com');
}

/**
 * Detects if the remote is GitLab (including self-hosted)
 */
function isGitLabRemote(cwd: string): boolean {
  const result = executeGitCommand('git remote get-url origin', cwd);
  if (!result.success) return false;
  const url = result.output.toLowerCase();
  return (
    url.includes('gitlab.com') ||
    url.includes('gitlab') ||
    // Check for self-hosted GitLab patterns
    (url.includes('gitlab') === false && !url.includes('github.com'))
  );
}

/**
 * Detects remote host type (github, gitlab, or unknown)
 */
function getRemoteHostType(cwd: string): 'github' | 'gitlab' | 'unknown' {
  const result = executeGitCommand('git remote get-url origin', cwd);
  if (!result.success) return 'unknown';
  const url = result.output.toLowerCase();
  if (url.includes('github.com')) return 'github';
  if (url.includes('gitlab')) return 'gitlab';
  // Default to GitLab for non-GitHub URLs (most self-hosted are GitLab)
  return url.includes('github') ? 'github' : 'gitlab';
}

/**
 * Gets current branch name
 */
function getCurrentBranch(cwd: string): string | null {
  const result = executeGitCommand('git branch --show-current', cwd);
  return result.success ? result.output : null;
}

/**
 * Gets remote URL info
 */
function getRemoteInfo(cwd: string, remote: string = 'origin'): { host: string; owner: string; repo: string } | null {
  const result = executeGitCommand(`git remote get-url ${remote}`, cwd);
  if (!result.success) return null;

  const url = result.output;

  // Parse SSH URL: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@([^:]+):([^/]+)\/([^.]+)(?:\.git)?/);
  if (sshMatch) {
    return { host: sshMatch[1], owner: sshMatch[2], repo: sshMatch[3] };
  }

  // Parse HTTPS URL: https://github.com/owner/repo.git
  const httpsMatch = url.match(/https?:\/\/([^/]+)\/([^/]+)\/([^.]+)(?:\.git)?/);
  if (httpsMatch) {
    return { host: httpsMatch[1], owner: httpsMatch[2], repo: httpsMatch[3] };
  }

  return null;
}

/**
 * Handlers for each git workflow operation
 */
const gitWorkflowHandlers: Record<
  GitWorkflowOperation,
  (args: Record<string, unknown>, cwd: string) => GitOperationResult
> = {
  // ---- STATUS ----
  status: (args, cwd) => {
    const short = args['short'] ? ' -s' : '';
    const branch = args['branch'] ? ' -b' : '';
    return executeGitCommand(`git status${short}${branch}`, cwd);
  },

  // ---- ADD ----
  add: (args, cwd) => {
    const files = args['files'];
    if (!files) {
      return executeGitCommand('git add -A', cwd);
    }
    const fileList = Array.isArray(files) ? files.join(' ') : files;
    return executeGitCommand(`git add ${fileList}`, cwd);
  },

  // ---- COMMIT ----
  commit: (args, cwd) => {
    const message = args['message'];
    if (!message || typeof message !== 'string') {
      return { success: false, output: '', error: 'Commit message is required' };
    }
    const amend = args['amend'] ? ' --amend' : '';
    const noVerify = args['noVerify'] ? ' --no-verify' : '';
    const signoff = args['signoff'] ? ' -s' : '';

    // Escape message for shell
    const escapedMessage = message.replace(/"/g, '\\"');
    return executeGitCommand(
      `git commit${amend}${noVerify}${signoff} -m "${escapedMessage}"`,
      cwd,
    );
  },

  // ---- PUSH ----
  push: (args, cwd) => {
    const remote = args['remote'] || 'origin';
    const branch = args['branch'] || getCurrentBranch(cwd);
    const setUpstream = args['setUpstream'] || args['set_upstream'] ? ` -u ${remote} ${branch}` : '';
    const force = args['force'] ? ' --force-with-lease' : '';
    const all = args['all'] ? ' --all' : '';

    if (setUpstream) {
      return executeGitCommand(`git push${setUpstream}${force}`, cwd);
    }

    if (all) {
      return executeGitCommand(`git push${all}${force}`, cwd);
    }

    return executeGitCommand(`git push ${remote} ${branch}${force}`, cwd);
  },

  // ---- PULL ----
  pull: (args, cwd) => {
    const remote = args['remote'] || 'origin';
    const branch = args['branch'];
    const rebase = args['rebase'] ? ' --rebase' : '';
    const noRebase = args['noRebase'] ? ' --no-rebase' : '';

    if (branch) {
      return executeGitCommand(`git pull ${remote} ${branch}${rebase}${noRebase}`, cwd);
    }

    return executeGitCommand(`git pull${rebase}${noRebase}`, cwd);
  },

  // ---- FETCH ----
  fetch: (args, cwd) => {
    const remote = args['remote'] || 'origin';
    const branch = args['branch'];
    const all = args['all'] ? ' --all' : '';
    const prune = args['prune'] ? ' --prune' : '';

    if (all) {
      return executeGitCommand(`git fetch${all}${prune}`, cwd);
    }

    if (branch) {
      return executeGitCommand(`git fetch ${remote} ${branch}${prune}`, cwd);
    }

    return executeGitCommand(`git fetch ${remote}${prune}`, cwd);
  },

  // ---- MERGE ----
  merge: (args, cwd) => {
    const branch = args['branch'];
    if (!branch || typeof branch !== 'string') {
      return { success: false, output: '', error: 'Branch name is required for merge' };
    }
    const noFf = args['noFf'] ? ' --no-ff' : '';
    const ffOnly = args['ffOnly'] ? ' --ff-only' : '';
    const message = args['message'] ? ` -m "${args['message']}"` : '';

    return executeGitCommand(`git merge${noFf}${ffOnly}${message} ${branch}`, cwd);
  },

  // ---- CREATE BRANCH ----
  create_branch: (args, cwd) => {
    const name = args['name'];
    if (!name || typeof name !== 'string') {
      return { success: false, output: '', error: 'Branch name is required' };
    }
    const checkout = args['checkout'] !== false ? ' -b' : '';
    const startPoint = args['startPoint'] ? ` ${args['startPoint']}` : '';

    if (checkout) {
      return executeGitCommand(`git checkout -b ${name}${startPoint}`, cwd);
    }

    return executeGitCommand(`git branch ${name}${startPoint}`, cwd);
  },

  // ---- SWITCH ----
  switch: (args, cwd) => {
    const branch = args['branch'];
    if (!branch || typeof branch !== 'string') {
      return { success: false, output: '', error: 'Branch name is required' };
    }
    const create = args['create'] ? ' -c' : '';

    return executeGitCommand(`git switch${create} ${branch}`, cwd);
  },

  // ---- LOG ----
  log: (args, cwd) => {
    const oneline = args['oneline'] ? ' --oneline' : '';
    const graph = args['graph'] ? ' --graph' : '';
    const count = args['count'] ? ` -${args['count']}` : '';
    const branch = args['branch'] ? ` ${args['branch']}` : '';

    return executeGitCommand(`git log${oneline}${graph}${count}${branch}`, cwd);
  },

  // ---- DIFF ----
  diff: (args, cwd) => {
    const staged = args['staged'] ? ' --staged' : '';
    const file = args['file'] ? ` "${args['file']}"` : '';
    const branch1 = args['branch1'];
    const branch2 = args['branch2'];

    if (branch1 && branch2) {
      return executeGitCommand(`git diff ${branch1}..${branch2}${file}`, cwd);
    }

    if (branch1) {
      return executeGitCommand(`git diff ${branch1}${file}`, cwd);
    }

    return executeGitCommand(`git diff${staged}${file}`, cwd);
  },

  // ---- CREATE MERGE REQUEST (GitLab) ----
  create_mr: (args, cwd) => {
    const title = args['title'];
    const description = args['description'] || '';
    const targetBranch = args['targetBranch'] || args['target_branch'] || 'main';
    const sourceBranch = args['sourceBranch'] || args['source_branch'] || getCurrentBranch(cwd);
    const assignee = args['assignee'] ? ` --assignee ${args['assignee']}` : '';
    const labels = args['labels'] ? ` --labels "${args['labels']}"` : '';
    const draft = args['draft'] ? ' --draft' : '';
    const push = args['push'] !== false ? true : false;

    // Check if this is a GitLab repository
    const remoteInfo = getRemoteInfo(cwd);
    if (!remoteInfo) {
      return { success: false, output: '', error: 'Could not determine remote repository info' };
    }

    // Push branch first if requested
    if (push) {
      const pushResult = executeGitCommand(`git push -u origin ${sourceBranch}`, cwd);
      if (!pushResult.success) {
        // Branch might already exist, try without -u
        const pushResult2 = executeGitCommand(`git push origin ${sourceBranch}`, cwd);
        if (!pushResult2.success && !pushResult2.error?.includes('up to date')) {
          return pushResult2;
        }
      }
    }

    // Check if glab CLI is available
    const glabCheck = executeGitCommand('glab version', cwd);
    if (!glabCheck.success) {
      // Fallback to providing instructions
      const escapedTitle = (title as string)?.replace(/"/g, '\\"') || '';
      const escapedDesc = (description as string)?.replace(/"/g, '\\"') || '';

      return {
        success: true,
        output: `GitLab CLI (glab) is not installed.

To create a Merge Request, you can:

1. Install glab CLI: https://gitlab.com/gitlab-org/cli
2. Run: glab auth login
3. Then run: glab mr create --title "${escapedTitle}" --description "${escapedDesc}" --target-branch ${targetBranch}

Or create MR manually at:
https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}/-/merge_requests/new?source_branch=${sourceBranch}

Git commands executed:
- Source branch: ${sourceBranch}
- Target branch: ${targetBranch}
- Push: ${push ? 'completed' : 'skipped'}`,
      };
    }

    // Use glab CLI to create MR
    const escapedTitle = (title as string)?.replace(/"/g, '\\"') || `Merge ${sourceBranch} into ${targetBranch}`;
    const escapedDesc = (description as string)?.replace(/"/g, '\\"') || '';

    return executeGitCommand(
      `glab mr create --title "${escapedTitle}" --description "${escapedDesc}" --target-branch ${targetBranch}${assignee}${labels}${draft} --yes`,
      cwd,
    );
  },

  // ---- CREATE PULL REQUEST (GitHub) ----
  create_pr: (args, cwd) => {
    const title = args['title'];
    const description = args['description'] || '';
    const base = args['base'] || 'main';
    const head = args['head'] || getCurrentBranch(cwd);
    const assignee = args['assignee'] ? ` --assignee ${args['assignee']}` : '';
    const labels = args['labels'] ? ` --label "${args['labels']}"` : '';
    const draft = args['draft'] ? ' --draft' : '';
    const push = args['push'] !== false ? true : false;

    // Check if this is a GitHub repository
    const remoteInfo = getRemoteInfo(cwd);
    if (!remoteInfo) {
      return { success: false, output: '', error: 'Could not determine remote repository info' };
    }

    // Push branch first if requested
    if (push) {
      const pushResult = executeGitCommand(`git push -u origin ${head}`, cwd);
      if (!pushResult.success) {
        const pushResult2 = executeGitCommand(`git push origin ${head}`, cwd);
        if (!pushResult2.success && !pushResult2.error?.includes('up to date')) {
          return pushResult2;
        }
      }
    }

    // Check if gh CLI is available
    const ghCheck = executeGitCommand('gh version', cwd);
    if (!ghCheck.success) {
      const escapedTitle = (title as string)?.replace(/"/g, '\\"') || '';
      const escapedDesc = (description as string)?.replace(/"/g, '\\"') || '';

      return {
        success: true,
        output: `GitHub CLI (gh) is not installed.

To create a Pull Request, you can:

1. Install gh CLI: https://cli.github.com
2. Run: gh auth login
3. Then run: gh pr create --title "${escapedTitle}" --body "${escapedDesc}" --base ${base}

Or create PR manually at:
https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}/compare/${base}...${head}?expand=1

Git commands executed:
- Head branch: ${head}
- Base branch: ${base}
- Push: ${push ? 'completed' : 'skipped'}`,
      };
    }

    // Use gh CLI to create PR
    const escapedTitle = (title as string)?.replace(/"/g, '\\"') || `Merge ${head} into ${base}`;
    const escapedDesc = (description as string)?.replace(/"/g, '\\"') || '';

    return executeGitCommand(
      `gh pr create --title "${escapedTitle}" --body "${escapedDesc}" --base ${base}${assignee}${labels}${draft}`,
      cwd,
    );
  },

  // ---- CREATE MERGE (Auto-detect GitHub/GitLab) ----
  create_merge: (args, cwd) => {
    const hostType = getRemoteHostType(cwd);
    const title = args['title'];
    const description = args['description'] || '';
    const targetBranch = args['targetBranch'] || args['target_branch'] || args['base'] || 'main';
    const sourceBranch = args['sourceBranch'] || args['source_branch'] || args['head'] || getCurrentBranch(cwd);
    const assignee = args['assignee'] ? ` --assignee ${args['assignee']}` : '';
    const labels = args['labels'] ? ` --labels "${args['labels']}"` : '';
    const draft = args['draft'] ? ' --draft' : '';
    const push = args['push'] !== false ? true : false;

    const remoteInfo = getRemoteInfo(cwd);
    if (!remoteInfo) {
      return { success: false, output: '', error: 'Could not determine remote repository info' };
    }

    // Push branch first if requested
    if (push) {
      const pushResult = executeGitCommand(`git push -u origin ${sourceBranch}`, cwd);
      if (!pushResult.success) {
        const pushResult2 = executeGitCommand(`git push origin ${sourceBranch}`, cwd);
        if (!pushResult2.success && !pushResult2.error?.includes('up to date')) {
          return pushResult2;
        }
      }
    }

    const escapedTitle = (title as string)?.replace(/"/g, '\\"') || `Merge ${sourceBranch} into ${targetBranch}`;
    const escapedDesc = (description as string)?.replace(/"/g, '\\"') || '';

    // GitHub
    if (hostType === 'github') {
      const ghCheck = executeGitCommand('gh version', cwd);
      if (!ghCheck.success) {
        return {
          success: true,
          output: `GitHub detected. GitHub CLI (gh) is not installed.

To create a Pull Request:

1. Install gh CLI: https://cli.github.com
2. Run: gh auth login
3. Then run: gh pr create --title "${escapedTitle}" --body "${escapedDesc}" --base ${targetBranch}

Or create PR manually at:
https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}/compare/${targetBranch}...${sourceBranch}?expand=1`,
        };
      }

      return executeGitCommand(
        `gh pr create --title "${escapedTitle}" --body "${escapedDesc}" --base ${targetBranch}${assignee}${labels}${draft}`,
        cwd,
      );
    }

    // GitLab (including self-hosted)
    const glabCheck = executeGitCommand('glab version', cwd);
    if (!glabCheck.success) {
      return {
        success: true,
        output: `GitLab detected. GitLab CLI (glab) is not installed.

To create a Merge Request:

1. Install glab CLI: https://gitlab.com/gitlab-org/cli
2. Run: glab auth login --hostname ${remoteInfo.host}
3. Then run: glab mr create --title "${escapedTitle}" --description "${escapedDesc}" --target-branch ${targetBranch}

Or create MR manually at:
https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}/-/merge_requests/new?source_branch=${sourceBranch}`,
      };
    }

    return executeGitCommand(
      `glab mr create --title "${escapedTitle}" --description "${escapedDesc}" --target-branch ${targetBranch}${assignee}${labels}${draft} --yes`,
      cwd,
    );
  },

  // ---- CLONE ----
  clone: (args, cwd) => {
    const url = args['url'];
    if (!url || typeof url !== 'string') {
      return { success: false, output: '', error: 'Repository URL is required' };
    }

    const directory = args['directory'] ? ` "${args['directory']}"` : '';
    const branch = args['branch'] ? ` --branch ${args['branch']}` : '';
    const depth = args['depth'] ? ` --depth ${args['depth']}` : '';
    const singleBranch = args['singleBranch'] ? ' --single-branch' : '';
    const recursive = args['recursive'] ? ' --recursive' : '';

    return executeGitCommand(
      `git clone${branch}${depth}${singleBranch}${recursive} ${url}${directory}`,
      cwd,
    );
  },

  // ---- REMOTE INFO ----
  remote_info: (_args, cwd) => {
    const remoteUrl = executeGitCommand('git remote get-url origin', cwd);
    const currentBranch = getCurrentBranch(cwd);
    const remoteInfo = getRemoteInfo(cwd);
    const isGitHub = isGitHubRemote(cwd);
    const isGitLab = isGitLabRemote(cwd);

    const lines = [
      '# Git Remote Information',
      '',
      `**Remote URL:** ${remoteUrl.success ? remoteUrl.output : 'Not configured'}`,
      `**Current Branch:** ${currentBranch || 'Unknown'}`,
      `**Platform:** ${isGitHub ? 'GitHub' : isGitLab ? 'GitLab' : 'Unknown'}`,
    ];

    if (remoteInfo) {
      lines.push('');
      lines.push('**Parsed Info:**');
      lines.push(`- Host: ${remoteInfo.host}`);
      lines.push(`- Owner: ${remoteInfo.owner}`);
      lines.push(`- Repo: ${remoteInfo.repo}`);
      lines.push('');
      lines.push('**Quick Links:**');
      if (isGitHub) {
        lines.push(`- Repository: https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}`);
        lines.push(`- Create PR: https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}/compare/main...${currentBranch}?expand=1`);
        lines.push(`- Actions: https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}/actions`);
      } else if (isGitLab) {
        lines.push(`- Repository: https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}`);
        lines.push(`- Create MR: https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}/-/merge_requests/new?source_branch=${currentBranch}`);
        lines.push(`- Pipelines: https://${remoteInfo.host}/${remoteInfo.owner}/${remoteInfo.repo}/-/pipelines`);
      }
    }

    return { success: true, output: lines.join('\n') };
  },

  // ---- AUTH STATUS ----
  auth_status: (args, cwd) => {
    const platform = args['platform'] || 'auto'; // 'github', 'gitlab', 'auto'
    const remoteInfo = getRemoteInfo(cwd);

    const results: string[] = ['# Git Authentication Status', ''];

    // Check Git credentials (global)
    const gitName = executeGitCommand('git config --global user.name', cwd);
    const gitEmail = executeGitCommand('git config --global user.email', cwd);
    results.push('## Git Configuration');
    results.push(`- **User Name:** ${gitName.success ? gitName.output : 'Not set'}`);
    results.push(`- **User Email:** ${gitEmail.success ? gitEmail.output : 'Not set'}`);
    results.push('');

    // Check GitHub CLI (if platform is github or auto)
    if (platform === 'github' || platform === 'auto') {
      const ghAuth = executeGitCommand('gh auth status', cwd);
      results.push('## GitHub CLI (gh)');
      if (ghAuth.success) {
        results.push('✅ **Status:** Authenticated');
        results.push('```');
        results.push(ghAuth.output);
        results.push('```');
      } else {
        results.push('❌ **Status:** Not authenticated or not installed');
        if (ghAuth.error?.includes('not found')) {
          results.push('');
          results.push('**Install:** `brew install gh` or see https://cli.github.com');
        }
      }
      results.push('');
    }

    // Check GitLab CLI (if platform is gitlab or auto)
    if (platform === 'gitlab' || platform === 'auto') {
      const glabAuth = executeGitCommand('glab auth status', cwd);
      results.push('## GitLab CLI (glab)');
      if (glabAuth.success) {
        results.push('✅ **Status:** Authenticated');
        results.push('```');
        results.push(glabAuth.output);
        results.push('```');
      } else {
        results.push('❌ **Status:** Not authenticated or not installed');
        if (glabAuth.error?.includes('not found')) {
          results.push('');
          results.push('**Install:** `brew install glab` or see https://gitlab.com/gitlab-org/cli');
        }
      }
      results.push('');
    }

    // Check SSH keys
    results.push('## SSH Keys');
    const sshDir = executeGitCommand('ls -la ~/.ssh/*.pub 2>/dev/null || echo "No public keys found"', cwd);
    results.push('```');
    results.push(sshDir.output || 'No SSH public keys found');
    results.push('```');
    results.push('');

    // Remote info
    if (remoteInfo) {
      results.push('## Detected Remote');
      results.push(`- **Host:** ${remoteInfo.host}`);
      results.push(`- **Platform:** ${remoteInfo.host.includes('github.com') ? 'GitHub' : 'GitLab'}`);
    }

    return { success: true, output: results.join('\n') };
  },

  // ---- AUTH LOGIN ----
  auth_login: (args, cwd) => {
    const platform = args['platform'] || 'auto'; // 'github', 'gitlab', 'auto'
    const method = args['method'] || 'web'; // 'web', 'token', 'ssh'
    const hostname = args['hostname'] as string; // for self-hosted GitLab
    const token = args['token'] as string;
    const remoteInfo = getRemoteInfo(cwd);

    const lines: string[] = ['# Git Authentication Setup', ''];

    // Determine platform
    let detectedPlatform = platform;
    if (platform === 'auto' && remoteInfo) {
      detectedPlatform = remoteInfo.host.includes('github.com') ? 'github' : 'gitlab';
    }

    if (detectedPlatform === 'github' || platform === 'auto') {
      lines.push('## GitHub Authentication');
      lines.push('');

      if (method === 'token' && token) {
        // Login with token
        const loginResult = executeGitCommand(`echo "${token}" | gh auth login --with-token`, cwd);
        if (loginResult.success) {
          lines.push('✅ **Successfully authenticated with GitHub using token!**');
        } else {
          lines.push(`❌ **Failed to authenticate:** ${loginResult.error}`);
        }
      } else {
        // Interactive login instructions
        lines.push('### Method 1: Interactive Login (Recommended)');
        lines.push('```bash');
        lines.push('gh auth login');
        lines.push('```');
        lines.push('');
        lines.push('Follow the prompts:');
        lines.push('1. Choose `GitHub.com` or `GitHub Enterprise`');
        lines.push('2. Choose `HTTPS` or `SSH` protocol');
        lines.push('3. Choose `Login with a web browser` (easiest)');
        lines.push('');
        lines.push('### Method 2: Login with Personal Access Token');
        lines.push('```bash');
        lines.push('# Create token at: https://github.com/settings/tokens');
        lines.push('# Required scopes: repo, workflow, user');
        lines.push('echo "YOUR_TOKEN" | gh auth login --with-token');
        lines.push('```');
        lines.push('');
        lines.push('### Method 3: SSH Key Setup');
        lines.push('```bash');
        lines.push('# Generate SSH key');
        lines.push('ssh-keygen -t ed25519 -C "your_email@example.com"');
        lines.push('');
        lines.push('# Start SSH agent');
        lines.push('eval "$(ssh-agent -s)"');
        lines.push('');
        lines.push('# Add key to agent');
        lines.push('ssh-add ~/.ssh/id_ed25519');
        lines.push('');
        lines.push('# Add public key to GitHub:');
        lines.push('# https://github.com/settings/ssh/new');
        lines.push('cat ~/.ssh/id_ed25519.pub');
        lines.push('```');
      }
      lines.push('');
    }

    if (detectedPlatform === 'gitlab' || (platform === 'auto' && !remoteInfo?.host?.includes('github.com'))) {
      lines.push('## GitLab Authentication');
      lines.push('');

      const gitlabHost = hostname || remoteInfo?.host || 'gitlab.com';

      if (method === 'token' && token) {
        const loginResult = executeGitCommand(`glab auth login --hostname ${gitlabHost} --token ${token}`, cwd);
        if (loginResult.success) {
          lines.push(`✅ **Successfully authenticated with ${gitlabHost} using token!**`);
        } else {
          lines.push(`❌ **Failed to authenticate:** ${loginResult.error}`);
        }
      } else {
        lines.push('### Method 1: Interactive Login (Recommended)');
        lines.push('```bash');
        if (gitlabHost !== 'gitlab.com') {
          lines.push(`glab auth login --hostname ${gitlabHost}`);
        } else {
          lines.push('glab auth login');
        }
        lines.push('```');
        lines.push('');
        lines.push('Follow the prompts:');
        lines.push('1. Choose `gitlab.com` or `Self-hosted GitLab`');
        lines.push('2. Choose `HTTPS` or `SSH` protocol');
        lines.push('3. Paste your Personal Access Token');
        lines.push('');
        lines.push('### Method 2: Login with Personal Access Token');
        lines.push('```bash');
        lines.push(`# Create token at: https://${gitlabHost}/-/profile/personal_access_tokens`);
        lines.push('# Required scopes: api, write_repository');
        lines.push(`glab auth login --hostname ${gitlabHost} --token YOUR_TOKEN`);
        lines.push('```');
        lines.push('');
        lines.push('### Method 3: SSH Key Setup');
        lines.push('```bash');
        lines.push('# Generate SSH key');
        lines.push('ssh-keygen -t ed25519 -C "your_email@example.com"');
        lines.push('');
        lines.push('# Add public key to GitLab:');
        lines.push(`# https://${gitlabHost}/-/profile/keys`);
        lines.push('cat ~/.ssh/id_ed25519.pub');
        lines.push('```');
      }
    }

    lines.push('');
    lines.push('## Verify Authentication');
    lines.push('```bash');
    lines.push('# GitHub');
    lines.push('gh auth status');
    lines.push('');
    lines.push('# GitLab');
    lines.push('glab auth status');
    lines.push('```');

    return { success: true, output: lines.join('\n') };
  },

  // ---- AUTH LOGOUT ----
  auth_logout: (args, cwd) => {
    const platform = args['platform'] || 'auto'; // 'github', 'gitlab', 'auto', 'all'
    const hostname = args['hostname'] as string;

    const lines: string[] = ['# Git Authentication Logout', ''];

    if (platform === 'github' || platform === 'all') {
      const ghLogout = executeGitCommand('gh auth logout', cwd);
      lines.push('## GitHub');
      if (ghLogout.success || ghLogout.output?.includes('logged out')) {
        lines.push('✅ Successfully logged out from GitHub');
      } else {
        lines.push(`Result: ${ghLogout.output || ghLogout.error || 'Not logged in'}`);
      }
      lines.push('');
    }

    if (platform === 'gitlab' || platform === 'all' || platform === 'auto') {
      const glabCmd = hostname ? `glab auth logout --hostname ${hostname}` : 'glab auth logout';
      const glabLogout = executeGitCommand(glabCmd, cwd);
      lines.push('## GitLab');
      if (glabLogout.success || glabLogout.output?.includes('logged out')) {
        lines.push('✅ Successfully logged out from GitLab');
      } else {
        lines.push(`Result: ${glabLogout.output || glabLogout.error || 'Not logged in'}`);
      }
    }

    return { success: true, output: lines.join('\n') };
  },

  // ---- AUTH TOKEN ----
  auth_token: (args, cwd) => {
    const platform = args['platform']; // 'github' or 'gitlab' (required)
    const token = args['token'] as string; // required
    const hostname = args['hostname'] as string; // for self-hosted GitLab

    if (!platform || !token) {
      return {
        success: false,
        output: '',
        error: 'Both "platform" (github/gitlab) and "token" are required',
      };
    }

    const lines: string[] = ['# Setting Authentication Token', ''];

    if (platform === 'github') {
      const loginResult = executeGitCommand(`echo "${token}" | gh auth login --with-token`, cwd);
      if (loginResult.success) {
        lines.push('✅ **GitHub token set successfully!**');
        lines.push('');
        lines.push('Verify with: `gh auth status`');
      } else {
        lines.push(`❌ **Failed:** ${loginResult.error}`);
      }
    } else if (platform === 'gitlab') {
      const gitlabHost = hostname || 'gitlab.com';
      const loginResult = executeGitCommand(`glab auth login --hostname ${gitlabHost} --token ${token}`, cwd);
      if (loginResult.success) {
        lines.push(`✅ **GitLab token set successfully for ${gitlabHost}!**`);
        lines.push('');
        lines.push('Verify with: `glab auth status`');
      } else {
        lines.push(`❌ **Failed:** ${loginResult.error}`);
      }
    }

    return { success: true, output: lines.join('\n') };
  },
};

// ============================================================================
// Tool Invocation
// ============================================================================

/**
 * Invocation class for Git Workflow Tool operations.
 */
class GitWorkflowToolInvocation extends BaseToolInvocation<
  GitWorkflowToolParams,
  ToolResult
> {
  constructor(
    params: GitWorkflowToolParams,
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

    if (args['message']) description += ` "${args['message']}"`;
    if (args['branch']) description += ` (${args['branch']})`;
    if (args['title']) description += ` "${args['title']}"`;

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
    if (!gitWorkflowHandlers[operation]) {
      return {
        llmContent: `Error: Unknown git workflow operation '${operation}'`,
        returnDisplay: `Unknown operation: ${operation}`,
        error: {
          message: `Unknown git workflow operation: ${operation}`,
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    // Execute the operation
    const result = gitWorkflowHandlers[operation](args, cwd);

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
    operation: GitWorkflowOperation,
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
  private formatErrorResult(operation: GitWorkflowOperation, error: string): string {
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
  private getNextSteps(operation: GitWorkflowOperation): string {
    const steps: Record<string, string> = {
      status: '- Use `add` to stage changes\n- Use `commit` to commit staged changes',
      add: '- Use `status` to verify staged changes\n- Use `commit` to commit staged changes',
      commit: '- Use `push` to push to remote\n- Use `log` to see commit history',
      push: '- Use `status` to check if up-to-date\n- Create MR/PR if needed',
      pull: '- Resolve conflicts if any\n- Use `status` to check current state',
      fetch: '- Use `status` to see if ahead/behind\n- Use `pull` to merge changes',
      create_branch: '- Use `switch` to change branches\n- Make changes and commit',
      switch: '- Use `status` to check branch state\n- Use `log` to see recent commits',
      create_mr: '- Wait for review\n- Address any feedback',
      create_pr: '- Wait for review\n- Address any feedback',
    };

    return steps[operation] || '';
  }

  /**
   * Returns troubleshooting tips for common errors.
   */
  private getTroubleshootingTips(operation: GitWorkflowOperation, error: string): string {
    if (error.includes('not a git repository')) {
      return '- Make sure you are in a git repository\n- Initialize with `git init` if needed';
    }

    if (error.includes('merge conflict')) {
      return '- Resolve the conflicts in the marked files\n- Use `git status` to see conflicted files';
    }

    if (error.includes('Authentication failed') || error.includes('permission denied')) {
      return '- Check your credentials (SSH key, token, etc.)\n- For HTTPS, you may need a personal access token';
    }

    const tips: Record<string, string> = {
      push: '- Make sure you have the right permissions\n- Try `git pull` first if behind remote\n- Use `--force-with-lease` only if necessary',
      pull: '- Commit or stash your changes first\n- Use `--rebase` for cleaner history',
      commit: '- Make sure you have staged changes with `git add`\n- Check pre-commit hooks if failing',
    };

    return tips[operation] || '- Check the error message for details\n- Use `git status` to see current state';
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * JSON Schema for Git Workflow Tool parameters
 */
const gitWorkflowToolSchema = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: [
        'status',
        'add',
        'commit',
        'push',
        'pull',
        'fetch',
        'merge',
        'create_branch',
        'switch',
        'log',
        'diff',
        'create_mr',
        'create_pr',
        'create_merge',
        'clone',
        'remote_info',
        'auth_status',
        'auth_login',
        'auth_logout',
        'auth_token',
      ],
      description: 'Type of git workflow operation to perform',
    },
    args: {
      type: 'object',
      description: 'Arguments specific to the operation',
      additionalProperties: true,
    },
    directory: {
      type: 'string',
      description: 'Working directory for git operations (optional, defaults to project root)',
    },
  },
  required: ['operation'],
};

/**
 * Tool description
 */
function getGitWorkflowToolDescription(): string {
  return `Performs git workflow operations including status, add, commit, push, pull, and MR/PR creation.

## Supported Operations

### Basic Operations
- **status**: Check repository status. Args: \`short\`, \`branch\`
- **add**: Stage files. Args: \`files\` (array or string, defaults to all)
- **commit**: Commit staged changes. Args: \`message\`, \`amend\`, \`noVerify\`, \`signoff\`
- **push**: Push to remote. Args: \`remote\`, \`branch\`, \`setUpstream\`, \`force\`
- **pull**: Pull from remote. Args: \`remote\`, \`branch\`, \`rebase\`
- **fetch**: Fetch from remote. Args: \`remote\`, \`branch\`, \`all\`, \`prune\`

### Branch Operations
- **create_branch**: Create new branch. Args: \`name\`, \`checkout\`, \`startPoint\`
- **switch**: Switch to branch. Args: \`branch\`, \`create\`
- **merge**: Merge branches. Args: \`branch\`, \`noFf\`, \`ffOnly\`, \`message\`

### Info Operations
- **log**: Show commit history. Args: \`oneline\`, \`graph\`, \`count\`, \`branch\`
- **diff**: Show differences. Args: \`staged\`, \`file\`, \`branch1\`, \`branch2\`
- **remote_info**: Get remote repository info (host, owner, repo, platform)

### MR/PR Operations
- **create_mr**: Create GitLab Merge Request. Args: \`title\`, \`description\`, \`targetBranch\`, \`sourceBranch\`, \`assignee\`, \`labels\`, \`draft\`, \`push\`
- **create_pr**: Create GitHub Pull Request. Args: \`title\`, \`description\`, \`base\`, \`head\`, \`assignee\`, \`labels\`, \`draft\`, \`push\`
- **create_merge**: Auto-detect platform and create MR/PR. Works with both GitHub and GitLab (including self-hosted). Args: \`title\`, \`description\`, \`targetBranch\`/ \`base\`, \`sourceBranch\`/ \`head\`, \`assignee\`, \`labels\`, \`draft\`, \`push\`

### Clone Operations
- **clone**: Clone repository. Args: \`url\`, \`directory\`, \`branch\`, \`depth\`, \`singleBranch\`, \`recursive\`

### Authentication Operations
- **auth_status**: Check authentication status for GitHub/GitLab. Args: \`platform\` ('github', 'gitlab', 'auto')
- **auth_login**: Get instructions for authentication setup. Args: \`platform\`, \`method\` ('web', 'token', 'ssh'), \`hostname\` (for self-hosted GitLab), \`token\`
- **auth_logout**: Logout from GitHub/GitLab. Args: \`platform\`, \`hostname\`
- **auth_token**: Set authentication token. Args: \`platform\` ('github'/'gitlab'), \`token\`, \`hostname\` (for self-hosted GitLab)

## Authentication Methods

### GitHub
1. **Interactive (Recommended)**: \`gh auth login\` - opens browser for OAuth
2. **Token**: Create at https://github.com/settings/tokens (scopes: repo, workflow, user)
3. **SSH**: Generate key and add to https://github.com/settings/ssh/new

### GitLab
1. **Interactive (Recommended)**: \`glab auth login\` - paste token when prompted
2. **Token**: Create at https://gitlab.com/-/profile/personal_access_tokens (scopes: api, write_repository)
3. **SSH**: Generate key and add to https://gitlab.com/-/profile/keys

### Self-Hosted GitLab
Add \`--hostname your-gitlab.com\` to glab commands or use \`hostname\` argument.

## Usage Notes
- **create_merge** is the recommended operation - it auto-detects GitHub vs GitLab
- MR/PR creation requires \`glab\` (GitLab) or \`gh\` (GitHub) CLI installed
- Without CLI, instructions are provided for manual creation
- Supports self-hosted GitLab instances
- All operations work in the configured project directory`;
}

/**
 * Git Workflow Tool - Provides basic git workflow operations.
 */
export class GitWorkflowTool extends BaseDeclarativeTool<
  GitWorkflowToolParams,
  ToolResult
> {
  static Name = 'git_workflow';

  constructor(private readonly config: Config) {
    super(
      GitWorkflowTool.Name,
      'GitWorkflow',
      getGitWorkflowToolDescription(),
      Kind.Execute,
      gitWorkflowToolSchema,
      true, // output is markdown
      false, // output cannot be updated
    );
  }

  /**
   * Validates the parameter values beyond JSON schema.
   */
  protected override validateToolParamValues(
    params: GitWorkflowToolParams,
  ): string | null {
    const operation = params.operation;
    const args = params.args || {};

    switch (operation) {
      case 'commit':
        if (!args['message']) {
          return 'commit requires a "message" argument';
        }
        break;

      case 'merge':
        if (!args['branch']) {
          return 'merge requires a "branch" argument';
        }
        break;

      case 'create_branch':
        if (!args['name']) {
          return 'create_branch requires a "name" argument';
        }
        break;

      case 'switch':
        if (!args['branch']) {
          return 'switch requires a "branch" argument';
        }
        break;

      case 'create_mr':
      case 'create_pr':
        if (!args['title']) {
          return `${operation} requires a "title" argument`;
        }
        break;
    }

    return null;
  }

  /**
   * Creates the tool invocation instance.
   */
  protected createInvocation(
    params: GitWorkflowToolParams,
  ): ToolInvocation<GitWorkflowToolParams, ToolResult> {
    return new GitWorkflowToolInvocation(params, this.config);
  }
}

/**
 * Factory function to create the Git Workflow Tool instance.
 */
export function gitWorkflowTool(config: Config): GitWorkflowTool {
  return new GitWorkflowTool(config);
}
