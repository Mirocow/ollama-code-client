/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool name constants to avoid circular dependencies.
 * These constants are used across multiple files and should be kept in sync
 * with the actual tool class names.
 */
export const ToolNames = {
  EDIT: 'edit',
  WRITE_FILE: 'write_file',
  READ_FILE: 'read_file',
  READ_MANY_FILES: 'read_many_files',
  GREP: 'grep_search',
  GLOB: 'glob',
  SHELL: 'run_shell_command',
  SSH: 'ssh_connect',
  SSH_ADD_HOST: 'ssh_add_host',
  SSH_LIST_HOSTS: 'ssh_list_hosts',
  SSH_REMOVE_HOST: 'ssh_remove_host',
  TODO_WRITE: 'todo_write',
  MEMORY: 'save_memory',
  TASK: 'task',
  SKILL: 'skill',
  EXIT_PLAN_MODE: 'exit_plan_mode',
  WEB_FETCH: 'web_fetch',
  WEB_SEARCH: 'web_search',
  LS: 'list_directory',
  LSP: 'lsp',
  PYTHON: 'python_dev',
  NODEJS: 'nodejs_dev',
  GOLANG: 'golang_dev',
  PHP: 'php_dev',
  JAVA: 'java_dev',
  CPP: 'cpp_dev',
  RUST: 'rust_dev',
  SWIFT: 'swift_dev',
  TYPESCRIPT: 'typescript_dev',
  GIT_ADVANCED: 'git_advanced',
  GIT_WORKFLOW: 'git_workflow',
} as const;

export type ToolName = (typeof ToolNames)[keyof typeof ToolNames];

/**
 * Tool display name constants to avoid circular dependencies.
 * These constants are used across multiple files and should be kept in sync
 * with the actual tool display names.
 */
export const ToolDisplayNames = {
  EDIT: 'Edit',
  WRITE_FILE: 'WriteFile',
  READ_FILE: 'ReadFile',
  READ_MANY_FILES: 'ReadManyFiles',
  GREP: 'Grep',
  GLOB: 'Glob',
  SHELL: 'Shell',
  SSH: 'SSH',
  SSH_ADD_HOST: 'SSHAddHost',
  SSH_LIST_HOSTS: 'SSHListHosts',
  SSH_REMOVE_HOST: 'SSHRemoveHost',
  TODO_WRITE: 'TodoWrite',
  MEMORY: 'SaveMemory',
  TASK: 'Task',
  SKILL: 'Skill',
  EXIT_PLAN_MODE: 'ExitPlanMode',
  WEB_FETCH: 'WebFetch',
  WEB_SEARCH: 'WebSearch',
  LS: 'ListFiles',
  LSP: 'Lsp',
  PYTHON: 'PythonDev',
  NODEJS: 'NodeJsDev',
  GOLANG: 'GolangDev',
  PHP: 'PHPDev',
  JAVA: 'JavaDev',
  CPP: 'CppDev',
  RUST: 'RustDev',
  SWIFT: 'SwiftDev',
  TYPESCRIPT: 'TypeScriptDev',
  GIT_ADVANCED: 'GitAdvanced',
  GIT_WORKFLOW: 'GitWorkflow',
} as const;

// Migration from old tool names to new tool names
// These legacy tool names were used in earlier versions and need to be supported
// for backward compatibility with existing user configurations
export const ToolNamesMigration = {
  search_file_content: ToolNames.GREP, // Legacy name from grep tool
  replace: ToolNames.EDIT, // Legacy name from edit tool
} as const;

// Migration from old tool display names to new tool display names
// These legacy display names were used before the tool naming standardization
export const ToolDisplayNamesMigration = {
  SearchFiles: ToolDisplayNames.GREP, // Old display name for Grep
  FindFiles: ToolDisplayNames.GLOB, // Old display name for Glob
  ReadFolder: ToolDisplayNames.LS, // Old display name for ListFiles
} as const;

/**
 * Tool aliases - short names that can be used instead of canonical tool names.
 * This allows models to use shorter, more intuitive names for common tools.
 * For example: 'run' instead of 'run_shell_command'
 */
export const ToolAliases: Record<string, ToolName> = {
  // ═══════════════════════════════════════════════════════════════════════
  // Shell tool aliases (run_shell_command)
  // ═══════════════════════════════════════════════════════════════════════
  run: ToolNames.SHELL,
  shell: ToolNames.SHELL,
  exec: ToolNames.SHELL,
  cmd: ToolNames.SHELL,
  shell_dev: ToolNames.SHELL,
  bash: ToolNames.SHELL,
  zsh: ToolNames.SHELL,
  terminal: ToolNames.SHELL,
  command: ToolNames.SHELL,
  bash_dev: ToolNames.SHELL,
  zsh_dev: ToolNames.SHELL,
  cli: ToolNames.SHELL,

  // ═══════════════════════════════════════════════════════════════════════
  // Edit tool aliases
  // ═══════════════════════════════════════════════════════════════════════
  edit: ToolNames.EDIT,
  replace: ToolNames.EDIT,
  modify: ToolNames.EDIT,
  patch: ToolNames.EDIT,
  sed: ToolNames.EDIT,

  // ═══════════════════════════════════════════════════════════════════════
  // Write file aliases
  // ═══════════════════════════════════════════════════════════════════════
  write: ToolNames.WRITE_FILE,
  create: ToolNames.WRITE_FILE,
  write_file: ToolNames.WRITE_FILE,
  save_file: ToolNames.WRITE_FILE,
  new_file: ToolNames.WRITE_FILE,

  // ═══════════════════════════════════════════════════════════════════════
  // Read file aliases
  // ═══════════════════════════════════════════════════════════════════════
  read: ToolNames.READ_FILE,
  read_file: ToolNames.READ_FILE,
  cat_file: ToolNames.READ_FILE,
  open: ToolNames.READ_FILE,
  view: ToolNames.READ_FILE,

  // ═══════════════════════════════════════════════════════════════════════
  // Read many files aliases
  // ═══════════════════════════════════════════════════════════════════════
  readmany: ToolNames.READ_MANY_FILES,
  read_all: ToolNames.READ_MANY_FILES,
  cat: ToolNames.READ_MANY_FILES,
  read_many: ToolNames.READ_MANY_FILES,
  read_files: ToolNames.READ_MANY_FILES,

  // ═══════════════════════════════════════════════════════════════════════
  // Grep aliases
  // ═══════════════════════════════════════════════════════════════════════
  grep: ToolNames.GREP,
  search: ToolNames.GREP,
  find: ToolNames.GREP,
  grep_search: ToolNames.GREP,
  search_content: ToolNames.GREP,
  search_text: ToolNames.GREP,
  rg: ToolNames.GREP,

  // ═══════════════════════════════════════════════════════════════════════
  // Glob aliases
  // ═══════════════════════════════════════════════════════════════════════
  glob: ToolNames.GLOB,
  files: ToolNames.GLOB,
  find_files: ToolNames.GLOB,
  glob_search: ToolNames.GLOB,
  pattern: ToolNames.GLOB,

  // ═══════════════════════════════════════════════════════════════════════
  // List directory aliases
  // ═══════════════════════════════════════════════════════════════════════
  ls: ToolNames.LS,
  list: ToolNames.LS,
  dir: ToolNames.LS,
  list_directory: ToolNames.LS,
  list_dir: ToolNames.LS,
  list_files: ToolNames.LS,

  // ═══════════════════════════════════════════════════════════════════════
  // Todo aliases
  // ═══════════════════════════════════════════════════════════════════════
  todo: ToolNames.TODO_WRITE,
  todos: ToolNames.TODO_WRITE,
  todo_write: ToolNames.TODO_WRITE,
  task_list: ToolNames.TODO_WRITE,

  // ═══════════════════════════════════════════════════════════════════════
  // Memory aliases
  // ═══════════════════════════════════════════════════════════════════════
  memory: ToolNames.MEMORY,
  save: ToolNames.MEMORY,
  save_memory: ToolNames.MEMORY,
  remember: ToolNames.MEMORY,

  // ═══════════════════════════════════════════════════════════════════════
  // Web search aliases
  // ═══════════════════════════════════════════════════════════════════════
  websearch: ToolNames.WEB_SEARCH,
  web: ToolNames.WEB_SEARCH,
  web_search: ToolNames.WEB_SEARCH,
  search_web: ToolNames.WEB_SEARCH,
  google: ToolNames.WEB_SEARCH,

  // ═══════════════════════════════════════════════════════════════════════
  // Web fetch aliases
  // ═══════════════════════════════════════════════════════════════════════
  webfetch: ToolNames.WEB_FETCH,
  fetch: ToolNames.WEB_FETCH,
  url: ToolNames.WEB_FETCH,
  web_fetch: ToolNames.WEB_FETCH,
  curl: ToolNames.WEB_FETCH,
  wget: ToolNames.WEB_FETCH,
  http: ToolNames.WEB_FETCH,

  // ═══════════════════════════════════════════════════════════════════════
  // Task aliases
  // ═══════════════════════════════════════════════════════════════════════
  agent: ToolNames.TASK,
  subagent: ToolNames.TASK,
  task: ToolNames.TASK,
  delegate: ToolNames.TASK,

  // ═══════════════════════════════════════════════════════════════════════
  // Skill aliases
  // ═══════════════════════════════════════════════════════════════════════
  skills: ToolNames.SKILL,
  skill: ToolNames.SKILL,

  // ═══════════════════════════════════════════════════════════════════════
  // Exit plan mode aliases
  // ═══════════════════════════════════════════════════════════════════════
  exit_plan: ToolNames.EXIT_PLAN_MODE,
  plan_done: ToolNames.EXIT_PLAN_MODE,
  exit_plan_mode: ToolNames.EXIT_PLAN_MODE,

  // ═══════════════════════════════════════════════════════════════════════
  // Python dev aliases
  // ═══════════════════════════════════════════════════════════════════════
  python: ToolNames.PYTHON,
  py: ToolNames.PYTHON,
  pip: ToolNames.PYTHON,
  pytest: ToolNames.PYTHON,
  python_dev: ToolNames.PYTHON,
  python3: ToolNames.PYTHON,
  py3: ToolNames.PYTHON,
  pip3: ToolNames.PYTHON,
  python3_dev: ToolNames.PYTHON,
  venv: ToolNames.PYTHON,
  poetry: ToolNames.PYTHON,
  conda: ToolNames.PYTHON,
  black: ToolNames.PYTHON,
  flake8: ToolNames.PYTHON,
  mypy: ToolNames.PYTHON,
  pylint: ToolNames.PYTHON,

  // ═══════════════════════════════════════════════════════════════════════
  // Node.js / JavaScript dev aliases
  // ═══════════════════════════════════════════════════════════════════════
  node: ToolNames.NODEJS,
  npm: ToolNames.NODEJS,
  yarn: ToolNames.NODEJS,
  pnpm: ToolNames.NODEJS,
  bun: ToolNames.NODEJS,
  nodejs: ToolNames.NODEJS,
  nodejs_dev: ToolNames.NODEJS,
  node_dev: ToolNames.NODEJS,
  javascript: ToolNames.NODEJS,
  javascript_dev: ToolNames.NODEJS,
  js: ToolNames.NODEJS,
  js_dev: ToolNames.NODEJS,
  npx: ToolNames.NODEJS,
  vite: ToolNames.NODEJS,
  webpack: ToolNames.NODEJS,
  rollup: ToolNames.NODEJS,
  esbuild: ToolNames.NODEJS,
  eslint: ToolNames.NODEJS,
  prettier: ToolNames.NODEJS,
  jest: ToolNames.NODEJS,
  mocha: ToolNames.NODEJS,

  // ═══════════════════════════════════════════════════════════════════════
  // Golang dev aliases
  // ═══════════════════════════════════════════════════════════════════════
  go: ToolNames.GOLANG,
  golang: ToolNames.GOLANG,
  golang_dev: ToolNames.GOLANG,
  go_dev: ToolNames.GOLANG,
  gofmt: ToolNames.GOLANG,
  goimports: ToolNames.GOLANG,
  golint: ToolNames.GOLANG,
  go_vet: ToolNames.GOLANG,
  'go-vet': ToolNames.GOLANG,

  // ═══════════════════════════════════════════════════════════════════════
  // PHP dev aliases
  // ═══════════════════════════════════════════════════════════════════════
  php: ToolNames.PHP,
  composer: ToolNames.PHP,
  phpunit: ToolNames.PHP,
  artisan: ToolNames.PHP,
  php_dev: ToolNames.PHP,
  laravel: ToolNames.PHP,
  phpcs: ToolNames.PHP,
  phpstan: ToolNames.PHP,
  psalm: ToolNames.PHP,

  // ═══════════════════════════════════════════════════════════════════════
  // Java dev aliases
  // ═══════════════════════════════════════════════════════════════════════
  java: ToolNames.JAVA,
  javac: ToolNames.JAVA,
  maven: ToolNames.JAVA,
  gradle: ToolNames.JAVA,
  java_dev: ToolNames.JAVA,
  mvn: ToolNames.JAVA,
  gradlew: ToolNames.JAVA,
  junit: ToolNames.JAVA,
  spring: ToolNames.JAVA,

  // ═══════════════════════════════════════════════════════════════════════
  // C/C++ dev aliases
  // ═══════════════════════════════════════════════════════════════════════
  cpp: ToolNames.CPP,
  'c++': ToolNames.CPP,
  gcc: ToolNames.CPP,
  'g++': ToolNames.CPP,
  cmake: ToolNames.CPP,
  make: ToolNames.CPP,
  cpp_dev: ToolNames.CPP,
  c_dev: ToolNames.CPP,
  clang: ToolNames.CPP,
  'clang++': ToolNames.CPP,
  cc: ToolNames.CPP,
  c: ToolNames.CPP,
  clang_format: ToolNames.CPP,
  cppcheck: ToolNames.CPP,

  // ═══════════════════════════════════════════════════════════════════════
  // Rust dev aliases
  // ═══════════════════════════════════════════════════════════════════════
  rust: ToolNames.RUST,
  cargo: ToolNames.RUST,
  rustc: ToolNames.RUST,
  rust_dev: ToolNames.RUST,
  rustup: ToolNames.RUST,
  rustfmt: ToolNames.RUST,
  clippy: ToolNames.RUST,

  // ═══════════════════════════════════════════════════════════════════════
  // Swift dev aliases
  // ═══════════════════════════════════════════════════════════════════════
  swift: ToolNames.SWIFT,
  swiftc: ToolNames.SWIFT,
  spm: ToolNames.SWIFT,
  swift_dev: ToolNames.SWIFT,
  swift_package: ToolNames.SWIFT,
  xcodebuild: ToolNames.SWIFT,

  // ═══════════════════════════════════════════════════════════════════════
  // TypeScript dev aliases
  // ═══════════════════════════════════════════════════════════════════════
  ts: ToolNames.TYPESCRIPT,
  tsc: ToolNames.TYPESCRIPT,
  typescript: ToolNames.TYPESCRIPT,
  typescript_dev: ToolNames.TYPESCRIPT,
  ts_dev: ToolNames.TYPESCRIPT,
  tsx: ToolNames.TYPESCRIPT,

  // ═══════════════════════════════════════════════════════════════════════
  // LSP aliases
  // ═══════════════════════════════════════════════════════════════════════
  lsp: ToolNames.LSP,
  language_server: ToolNames.LSP,
  intellisense: ToolNames.LSP,

  // ═══════════════════════════════════════════════════════════════════════
  // Git workflow aliases (git_workflow tool)
  // Models often hallucinate git_dev, git_tool, etc.
  // ═══════════════════════════════════════════════════════════════════════
  git_commit: ToolNames.GIT_WORKFLOW,
  commit: ToolNames.GIT_WORKFLOW,
  git_push: ToolNames.GIT_WORKFLOW,
  push: ToolNames.GIT_WORKFLOW,
  git_pull: ToolNames.GIT_WORKFLOW,
  pull: ToolNames.GIT_WORKFLOW,
  git_status: ToolNames.GIT_WORKFLOW,
  mr: ToolNames.GIT_WORKFLOW,
  pr: ToolNames.GIT_WORKFLOW,
  merge_request: ToolNames.GIT_WORKFLOW,
  pull_request: ToolNames.GIT_WORKFLOW,
  create_mr: ToolNames.GIT_WORKFLOW,
  create_pr: ToolNames.GIT_WORKFLOW,
  create_merge: ToolNames.GIT_WORKFLOW,
  git_mr: ToolNames.GIT_WORKFLOW,
  git_pr: ToolNames.GIT_WORKFLOW,
  git_clone: ToolNames.GIT_WORKFLOW,
  clone: ToolNames.GIT_WORKFLOW,
  git_fetch: ToolNames.GIT_WORKFLOW,
  git_log: ToolNames.GIT_WORKFLOW,
  git_diff: ToolNames.GIT_WORKFLOW,
  git_switch: ToolNames.GIT_WORKFLOW,
  git_checkout: ToolNames.GIT_WORKFLOW,

  // ═══════════════════════════════════════════════════════════════════════
  // Git advanced aliases (git_advanced tool)
  // ═══════════════════════════════════════════════════════════════════════
  git_stash: ToolNames.GIT_ADVANCED,
  stash: ToolNames.GIT_ADVANCED,
  git_cherry_pick: ToolNames.GIT_ADVANCED,
  cherry_pick: ToolNames.GIT_ADVANCED,
  git_rebase: ToolNames.GIT_ADVANCED,
  rebase: ToolNames.GIT_ADVANCED,
  git_bisect: ToolNames.GIT_ADVANCED,
  bisect: ToolNames.GIT_ADVANCED,
  git_blame: ToolNames.GIT_ADVANCED,
  blame: ToolNames.GIT_ADVANCED,
  git_branch: ToolNames.GIT_ADVANCED,
  git_remote: ToolNames.GIT_ADVANCED,

  // ═══════════════════════════════════════════════════════════════════════
  // Generic git aliases (redirects to git_workflow for basic operations)
  // ═══════════════════════════════════════════════════════════════════════
  git: ToolNames.GIT_WORKFLOW,
  git_dev: ToolNames.GIT_WORKFLOW,
  git_tool: ToolNames.GIT_WORKFLOW,
  git_cmd: ToolNames.GIT_WORKFLOW,
  version_control: ToolNames.GIT_WORKFLOW,
  vcs: ToolNames.GIT_WORKFLOW,
  scm: ToolNames.GIT_WORKFLOW,

  // ═══════════════════════════════════════════════════════════════════════
  // Docker / Container aliases (redirects to run_shell_command)
  // Models often hallucinate docker_dev, container_dev, etc.
  // ═══════════════════════════════════════════════════════════════════════
  docker: ToolNames.SHELL,
  docker_dev: ToolNames.SHELL,
  container: ToolNames.SHELL,
  container_dev: ToolNames.SHELL,
  docker_compose: ToolNames.SHELL,
  compose: ToolNames.SHELL,
  podman: ToolNames.SHELL,

  // ═══════════════════════════════════════════════════════════════════════
  // Database aliases (redirects to run_shell_command)
  // Models often hallucinate db_dev, database_dev, sql_dev, etc.
  // ═══════════════════════════════════════════════════════════════════════
  database: ToolNames.SHELL,
  db: ToolNames.SHELL,
  database_dev: ToolNames.SHELL,
  db_dev: ToolNames.SHELL,
  sql: ToolNames.SHELL,
  sql_dev: ToolNames.SHELL,
  mysql: ToolNames.SHELL,
  postgresql: ToolNames.SHELL,
  postgres: ToolNames.SHELL,
  psql: ToolNames.SHELL,
  sqlite: ToolNames.SHELL,
  mongodb: ToolNames.SHELL,
  mongo: ToolNames.SHELL,
  redis: ToolNames.SHELL,
  redis_dev: ToolNames.SHELL,
  redis_cli: ToolNames.SHELL,

  // ═══════════════════════════════════════════════════════════════════════
  // Kubernetes / Cloud aliases (redirects to run_shell_command)
  // ═══════════════════════════════════════════════════════════════════════
  kubernetes: ToolNames.SHELL,
  k8s: ToolNames.SHELL,
  kubectl: ToolNames.SHELL,
  helm: ToolNames.SHELL,
  k8s_dev: ToolNames.SHELL,

  // ═══════════════════════════════════════════════════════════════════════
  // CI/CD aliases (redirects to run_shell_command)
  // ═══════════════════════════════════════════════════════════════════════
  ci: ToolNames.SHELL,
  cd: ToolNames.SHELL,
  github_actions: ToolNames.SHELL,
  gitlab_ci: ToolNames.SHELL,
  jenkins: ToolNames.SHELL,
  circleci: ToolNames.SHELL,

  // ═══════════════════════════════════════════════════════════════════════
  // Infrastructure aliases (redirects to run_shell_command)
  // ═══════════════════════════════════════════════════════════════════════
  terraform: ToolNames.SHELL,
  tf: ToolNames.SHELL,
  ansible: ToolNames.SHELL,
  aws: ToolNames.SHELL,
  azure: ToolNames.SHELL,
  gcp: ToolNames.SHELL,

  // ═══════════════════════════════════════════════════════════════════════
  // SSH tool aliases (ssh_connect)
  // Dedicated SSH tool for remote server connections
  // ═══════════════════════════════════════════════════════════════════════
  ssh: ToolNames.SSH,
  ssh_connect: ToolNames.SSH,
  ssh_dev: ToolNames.SSH,
  remote: ToolNames.SSH,
  remote_shell: ToolNames.SSH,
  remote_exec: ToolNames.SSH,
  connect: ToolNames.SSH,
  telnet: ToolNames.SSH,

  // ═══════════════════════════════════════════════════════════════════════
  // SSH Add Host aliases (ssh_add_host)
  // ═══════════════════════════════════════════════════════════════════════
  ssh_add_host: ToolNames.SSH_ADD_HOST,
  add_host: ToolNames.SSH_ADD_HOST,
  add_ssh_host: ToolNames.SSH_ADD_HOST,
  save_ssh: ToolNames.SSH_ADD_HOST,
  ssh_save: ToolNames.SSH_ADD_HOST,
  ssh_profile_add: ToolNames.SSH_ADD_HOST,
  ssh_config_add: ToolNames.SSH_ADD_HOST,

  // ═══════════════════════════════════════════════════════════════════════
  // SSH List Hosts aliases (ssh_list_hosts)
  // ═══════════════════════════════════════════════════════════════════════
  ssh_list_hosts: ToolNames.SSH_LIST_HOSTS,
  list_hosts: ToolNames.SSH_LIST_HOSTS,
  list_ssh: ToolNames.SSH_LIST_HOSTS,
  ssh_hosts: ToolNames.SSH_LIST_HOSTS,
  ssh_profiles: ToolNames.SSH_LIST_HOSTS,
  ssh_config_list: ToolNames.SSH_LIST_HOSTS,

  // ═══════════════════════════════════════════════════════════════════════
  // SSH Remove Host aliases (ssh_remove_host)
  // ═══════════════════════════════════════════════════════════════════════
  ssh_remove_host: ToolNames.SSH_REMOVE_HOST,
  remove_host: ToolNames.SSH_REMOVE_HOST,
  remove_ssh: ToolNames.SSH_REMOVE_HOST,
  delete_ssh: ToolNames.SSH_REMOVE_HOST,
  ssh_delete: ToolNames.SSH_REMOVE_HOST,
  ssh_profile_remove: ToolNames.SSH_REMOVE_HOST,
  ssh_config_remove: ToolNames.SSH_REMOVE_HOST,

  // ═══════════════════════════════════════════════════════════════════════
  // Additional shell aliases for common tools
  // ═══════════════════════════════════════════════════════════════════════
  scp: ToolNames.SHELL,
  rsync: ToolNames.SHELL,
  tar: ToolNames.SHELL,
  zip: ToolNames.SHELL,
  unzip: ToolNames.SHELL,
  curl_dev: ToolNames.SHELL,
  wget_dev: ToolNames.SHELL,
};

export const DynamicAliases: Record<string, ToolName> = {};

/**
 * Resolves a tool name or alias to its canonical tool name.
 * If the name is not found in aliases, returns the original name.
 *
 * @param name - The tool name or alias to resolve
 * @returns The canonical tool name
 */
export function resolveToolAlias(name: string): string {
  const normalizedName = name.trim().toLowerCase();

  // Check dynamic aliases first (higher priority)
  if (normalizedName in DynamicAliases) {
    return DynamicAliases[normalizedName];
  }

  // Check if it's a direct alias
  if (normalizedName in ToolAliases) {
    return ToolAliases[normalizedName];
  }

  // Check if it matches any canonical name directly
  const canonicalNames = Object.values(ToolNames);
  const matchingName = canonicalNames.find(
    (name) => name.toLowerCase() === normalizedName,
  );
  if (matchingName) {
    return matchingName;
  }

  // Return original name if no alias found
  return name;
}
