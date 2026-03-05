# Ollama Code Tools Reference

Complete reference documentation for all available tools in Ollama Code.

## Table of Contents

- [File Operations](#file-operations)
  - [read_file](#read_file)
  - [read_many_files](#read_many_files)
  - [write_file](#write_file)
  - [edit](#edit)
- [Search & Navigation](#search--navigation)
  - [glob](#glob)
  - [grep_search](#grep_search)
  - [list_directory](#list_directory)
- [Development Tools](#development-tools)
  - [python_dev](#python_dev)
  - [nodejs_dev](#nodejs_dev)
  - [golang_dev](#golang_dev)
  - [run_shell_command](#run_shell_command)
- [Web & Network](#web--network)
  - [web_search](#web_search)
  - [web_fetch](#web_fetch)
  - [ssh_connect](#ssh_connect)
  - [ssh_add_host](#ssh_add_host)
  - [ssh_list_hosts](#ssh_list_hosts)
  - [ssh_remove_host](#ssh_remove_host)
- [Task Management](#task-management)
  - [todo_write](#todo_write)
  - [task](#task)
- [Memory & Knowledge](#memory--knowledge)
  - [save_memory](#save_memory)
  - [skill](#skill)
- [Other Tools](#other-tools)
  - [lsp](#lsp)
  - [exit_plan_mode](#exit_plan_mode)

---

## Tool Aliases

Ollama Code supports short aliases for common tools. You can use these instead of the full tool names:

| Alias | Canonical Tool |
|-------|---------------|
| `run`, `shell`, `exec`, `cmd` | `run_shell_command` |
| `read` | `read_file` |
| `readmany`, `read_all`, `cat` | `read_many_files` |
| `write`, `create` | `write_file` |
| `edit`, `replace` | `edit` |
| `grep`, `search`, `find` | `grep_search` |
| `glob`, `files` | `glob` |
| `ls`, `list`, `dir` | `list_directory` |
| `todo`, `todos` | `todo_write` |
| `memory`, `save` | `save_memory` |
| `agent`, `subagent` | `task` |
| `websearch`, `web` | `web_search` |
| `webfetch`, `fetch`, `url` | `web_fetch` |
| `py`, `python`, `pip`, `pytest` | `python_dev` |
| `node`, `npm`, `yarn`, `pnpm`, `bun` | `nodejs_dev` |
| `go`, `golang` | `golang_dev` |
| `ssh`, `remote`, `connect` | `ssh_connect` |
| `add_host`, `save_ssh` | `ssh_add_host` |
| `list_hosts`, `ssh_profiles` | `ssh_list_hosts` |
| `remove_host`, `delete_ssh` | `ssh_remove_host` |

---

## File Operations

### read_file

Reads and returns the content of a specified file. Supports text files, images (PNG, JPG, GIF, WEBP, SVG, BMP), and PDF files.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `absolute_path` | string | Yes | The absolute path to the file to read |
| `offset` | number | No | 0-based line number to start reading from (for pagination) |
| `limit` | number | No | Maximum number of lines to read |

**Example:**
```json
{
  "absolute_path": "/home/user/project/src/index.ts"
}
```

**For large files:**
```json
{
  "absolute_path": "/home/user/project/large-file.log",
  "offset": 100,
  "limit": 50
}
```

---

### read_many_files

Reads multiple files in a single operation. More efficient than multiple `read_file` calls for batch operations.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `paths` | string[] | Yes | Array of absolute file paths to read |
| `offset` | number | No | Line offset to start from |
| `limit` | number | No | Maximum lines per file |

---

### write_file

Writes content to a file, creating it if it doesn't exist or overwriting if it does. Automatically creates parent directories.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `file_path` | string | Yes | Absolute path to the file to write |
| `content` | string | Yes | Content to write to the file |

**Example:**
```json
{
  "file_path": "/home/user/project/src/utils.ts",
  "content": "export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}"
}
```

---

### edit

Performs find-and-replace edits on existing files. Requires exact string matching including whitespace and indentation.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `file_path` | string | Yes | Absolute path to the file to edit |
| `old_string` | string | Yes | Exact text to replace (must match exactly) |
| `new_string` | string | Yes | Text to replace with |
| `replace_all` | boolean | No | Replace all occurrences (default: false) |

**Important Notes:**
- Include at least 3 lines of context before and after the target text
- Match whitespace and indentation precisely
- Use `replace_all: true` when you want to replace every occurrence

**Example:**
```json
{
  "file_path": "/home/user/project/src/app.ts",
  "old_string": "function oldName() {\n  return 'old';\n}",
  "new_string": "function newName() {\n  return 'new';\n}"
}
```

---

## Search & Navigation

### glob

Fast file pattern matching tool that works with any codebase size. Returns matching file paths sorted by modification time.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pattern` | string | Yes | Glob pattern to match (e.g., `**/*.ts`, `src/**/*.js`) |
| `path` | string | No | Directory to search in (defaults to workspace root) |

**Examples:**
```json
// Find all TypeScript files
{ "pattern": "**/*.ts" }

// Find JavaScript files in src directory
{ "pattern": "src/**/*.js" }

// Find all JSON files
{ "pattern": "*.json", "path": "/home/user/project/config" }
```

---

### grep_search

Searches for patterns in file contents using regular expressions. Case-insensitive by default.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pattern` | string | Yes | Regular expression pattern to search for |
| `path` | string | No | Directory or file to search in |
| `glob` | string | No | Glob pattern to filter files (e.g., `*.js`, `*.{ts,tsx}`) |
| `limit` | number | No | Maximum number of matching lines to return |

**Examples:**
```json
// Find all function declarations
{ "pattern": "function\\s+\\w+" }

// Find TODOs in TypeScript files
{ "pattern": "TODO|FIXME", "glob": "*.ts" }

// Find imports in specific directory
{ "pattern": "import.*from", "path": "src/components" }
```

---

### list_directory

Lists files and subdirectories in a specified directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Absolute path to the directory to list |
| `ignore` | string[] | No | Glob patterns to ignore |
| `file_filtering_options` | object | No | Options for gitignore/ollama-codeignore |

**Example:**
```json
{
  "path": "/home/user/project/src",
  "ignore": ["node_modules", "*.test.ts"]
}
```

---

## Development Tools

### python_dev

Comprehensive Python development tool for managing Python projects, virtual environments, and running Python commands.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | Action to perform (see below) |
| `script` | string | No | Python script path for run action |
| `args` | string[] | No | Additional arguments |
| `packages` | string[] | No | Packages for pip operations |
| `directory` | string | No | Working directory |
| `venv` | string | No | Virtual environment path |
| `python_path` | string | No | Custom Python interpreter path |
| `timeout` | number | No | Timeout in milliseconds (max 600000) |
| `test_pattern` | string | No | Test pattern for pytest |
| `lint_config` | string | No | Linter config file path |
| `requirements_file` | string | No | Requirements file path |
| `command` | string | No | Custom command for custom action |

**Available Actions:**

| Action | Description |
|--------|-------------|
| `run` | Execute a Python script |
| `test` | Run pytest tests |
| `lint` | Run pylint code analysis |
| `format` | Run black code formatter |
| `venv_create` | Create a virtual environment |
| `venv_activate` | Get activation command for venv |
| `pip_install` | Install packages with pip |
| `pip_list` | List installed packages |
| `pip_freeze` | Generate requirements.txt |
| `mypy` | Run mypy type checker |
| `custom` | Run custom Python command |

**Examples:**

```json
// Run a Python script
{
  "action": "run",
  "script": "main.py",
  "args": ["--verbose", "input.txt"]
}

// Run pytest with pattern
{
  "action": "test",
  "test_pattern": "tests/unit/",
  "args": ["-k", "test_auth"]
}

// Create virtual environment
{
  "action": "venv_create",
  "venv": ".venv"
}

// Install packages
{
  "action": "pip_install",
  "packages": ["requests", "numpy"],
  "venv": ".venv"
}

// Run mypy type checker
{
  "action": "mypy",
  "script": "src/"
}
```

---

### nodejs_dev

Node.js/JavaScript development tool supporting npm, yarn, pnpm, and bun. Auto-detects package manager from lock files.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | Action to perform (see below) |
| `package_manager` | string | No | Package manager (`npm`, `yarn`, `pnpm`, `bun`) |
| `script` | string | No | Script path for run action |
| `args` | string[] | No | Additional arguments |
| `packages` | string[] | No | Packages for add/remove |
| `directory` | string | No | Working directory |
| `dev` | boolean | No | Add as dev dependency |
| `global` | boolean | No | Install globally |
| `timeout` | number | No | Timeout in milliseconds |
| `script_name` | string | No | Package.json script name |
| `command` | string | No | Custom command |
| `background` | boolean | No | Run in background (for dev servers) |

**Available Actions:**

| Action | Description |
|--------|-------------|
| `run` | Execute a Node.js script |
| `install` | Install dependencies |
| `add` | Add packages |
| `remove` | Remove packages |
| `update` | Update packages |
| `run_script` | Run package.json script |
| `test` | Run tests |
| `build` | Run build |
| `dev` | Run dev server |
| `lint` | Run linter |
| `exec` | Run npx/yarn dlx command |
| `info` | Show package info |
| `list` | List installed packages |
| `outdated` | Check outdated packages |
| `audit` | Security audit |
| `clean` | Remove node_modules and lock files |
| `init` | Initialize new project |
| `custom` | Run custom command |

**Examples:**

```json
// Install dependencies
{ "action": "install" }

// Add packages
{
  "action": "add",
  "packages": ["express", "lodash"],
  "dev": false
}

// Run dev server in background
{
  "action": "dev",
  "background": true,
  "package_manager": "bun"
}

// Run custom npx command
{
  "action": "exec",
  "command": "create-next-app",
  "args": ["my-app", "--typescript"]
}

// Run tests
{
  "action": "test",
  "args": ["--coverage"]
}
```

---

### golang_dev

Golang development tool for managing Go projects, modules, and running Go commands.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | Action to perform (see below) |
| `file` | string | No | Go file path |
| `args` | string[] | No | Additional arguments |
| `package` | string | No | Package path |
| `packages` | string[] | No | Packages for get/install |
| `directory` | string | No | Working directory |
| `output` | string | No | Output binary name for build |
| `timeout` | number | No | Timeout in milliseconds |
| `test_pattern` | string | No | Test name pattern |
| `bench_pattern` | string | No | Benchmark pattern |
| `cover_profile` | string | No | Coverage output file |
| `race` | boolean | No | Enable race detector |
| `verbose` | boolean | No | Enable verbose output |
| `background` | boolean | No | Run in background |
| `module_name` | string | No | Module name for go mod init |
| `command` | string | No | Custom command |

**Available Actions:**

| Action | Description |
|--------|-------------|
| `run` | Run a Go file or package |
| `build` | Build a Go program |
| `test` | Run tests |
| `test_cover` | Run tests with coverage |
| `test_bench` | Run benchmarks |
| `fmt` | Format Go code |
| `vet` | Run go vet |
| `lint` | Run golangci-lint |
| `mod_init` | Initialize go.mod |
| `mod_tidy` | Tidy dependencies |
| `mod_download` | Download dependencies |
| `mod_verify` | Verify dependencies |
| `mod_graph` | Show dependency graph |
| `get` | Add a dependency |
| `install` | Install a Go tool |
| `list` | List packages |
| `doc` | Show documentation |
| `env` | Show Go environment |
| `version` | Show Go version |
| `clean` | Clean build cache |
| `generate` | Run go generate |
| `custom` | Run custom command |

**Examples:**

```json
// Run a Go file
{
  "action": "run",
  "file": "main.go",
  "args": ["--config", "config.yaml"]
}

// Run tests with race detector
{
  "action": "test",
  "race": true,
  "verbose": true,
  "test_pattern": "TestUser"
}

// Build with output name
{
  "action": "build",
  "output": "myapp",
  "package": "./cmd/server"
}

// Initialize module
{
  "action": "mod_init",
  "module_name": "github.com/user/myproject"
}

// Add dependency
{
  "action": "get",
  "packages": ["github.com/gin-gonic/gin@latest"]
}

// Run golangci-lint
{
  "action": "lint",
  "args": ["--config", ".golangci.yml"]
}
```

---

### run_shell_command

Executes shell commands in the terminal. Supports both foreground and background execution.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | string | Yes | The shell command to execute |
| `description` | string | No | Brief description of the command |
| `directory` | string | No | Working directory |
| `timeout` | number | No | Timeout in milliseconds (max 600000, default 120000) |
| `is_background` | boolean | No | Run in background for long-running processes |

**Examples:**

```json
// Run git commands
{
  "command": "git status && git diff",
  "description": "Check git status and changes"
}

// Run dev server in background
{
  "command": "npm run dev",
  "description": "Start development server",
  "is_background": true
}

// Run with custom timeout
{
  "command": "docker build -t myapp .",
  "description": "Build Docker image",
  "timeout": 300000
}
```

---

## Web & Network

### web_search

Searches the web for current information. Requires configuration of a search provider (Tavily or Google).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `provider` | string | No | Provider to use (`tavily`, `google`) |

**Example:**
```json
{
  "query": "Next.js 15 app router best practices 2024"
}
```

---

### web_fetch

Fetches content from a URL and processes it with AI to extract relevant information.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string | Yes | URL to fetch content from |
| `prompt` | string | Yes | What to extract or process from the content |

**Example:**
```json
{
  "url": "https://react.dev/learn",
  "prompt": "Extract the main concepts and key takeaways from this React documentation page"
}
```

---

### ssh_connect

Connects to remote servers via SSH and executes commands. Supports both direct connection and profile-based connections.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `profile` | string | No | Name of saved SSH profile (use instead of host/user) |
| `host` | string | No* | Hostname or IP address (*required if no profile) |
| `user` | string | No* | Username for SSH (*required if no profile) |
| `command` | string | No | Command to execute on remote server |
| `port` | number | No | SSH port number (default: 22) |
| `identity_file` | string | No | Path to SSH private key file |
| `password` | string | No | Password for authentication (not recommended) |
| `timeout` | number | No | Timeout in milliseconds (max 600000, default 60000) |

**Examples:**
```json
// Using a saved profile
{
  "profile": "production",
  "command": "docker ps"
}

// Direct connection with SSH key
{
  "host": "192.168.1.100",
  "user": "admin",
  "port": 2222,
  "identity_file": "~/.ssh/deploy_key",
  "command": "systemctl status nginx"
}

// Interactive shell (no command)
{
  "profile": "dev-server"
}
```

**Security Notes:**
- SSH connections always require user confirmation
- Use `ssh_add_host` to save profiles with credentials
- Prefer SSH key authentication over passwords

---

### ssh_add_host

Saves an SSH host configuration for later use with `ssh_connect`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Unique name for this SSH profile |
| `host` | string | Yes | Hostname or IP address |
| `user` | string | Yes | Username for SSH |
| `port` | number | No | SSH port (default: 22) |
| `identity_file` | string | No | Path to SSH private key file |
| `password` | string | No | Password (not recommended, use identity_file) |
| `description` | string | No | Description of this host |
| `tags` | string[] | No | Tags for organization |

**Example:**
```json
{
  "name": "prod",
  "host": "192.168.1.100",
  "user": "admin",
  "identity_file": "~/.ssh/id_rsa",
  "description": "Production server",
  "tags": ["production", "aws"]
}
```

---

### ssh_list_hosts

Lists all saved SSH host profiles.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tag` | string | No | Filter profiles by tag |

**Example:**
```json
// List all profiles
{}

// List profiles with specific tag
{ "tag": "production" }
```

---

### ssh_remove_host

Removes a saved SSH host profile.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Name of the profile to remove |

**Example:**
```json
{
  "name": "old-server"
}
```

---

## Task Management

### todo_write

Creates and manages a structured task list for tracking progress on complex tasks.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `todos` | array | Yes | Array of todo items |

**Todo Item Structure:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `content` | string | Task description |
| `status` | string | One of: `pending`, `in_progress`, `completed` |

**Example:**
```json
{
  "todos": [
    { "id": "1", "content": "Create API endpoints", "status": "completed" },
    { "id": "2", "content": "Add authentication", "status": "in_progress" },
    { "id": "3", "content": "Write tests", "status": "pending" }
  ]
}
```

---

### task

Delegates complex, multi-step tasks to specialized subagents.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `subagent_type` | string | Yes | Type of subagent to use |
| `description` | string | Yes | Short description (3-5 words) |
| `prompt` | string | Yes | Detailed task instructions |

**Example:**
```json
{
  "subagent_type": "general-purpose",
  "description": "Research API design",
  "prompt": "Research best practices for REST API design and provide a summary of key principles"
}
```

---

## Memory & Knowledge

### save_memory

Saves information to long-term memory for use in future sessions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fact` | string | Yes | The fact or information to remember |
| `scope` | string | No | `global` (all projects) or `project` (current project) |

**Example:**
```json
{
  "fact": "User prefers TypeScript over JavaScript for new projects",
  "scope": "global"
}
```

---

### skill

Executes specialized skills for specific tasks.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | string | Yes | Skill command to execute |

**Example:**
```json
{
  "command": "pdf"
}
```

---

## Other Tools

### lsp

Language Server Protocol integration for code intelligence features like go-to-definition, find references, and completions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | LSP action to perform |
| `file_path` | string | Yes | File path |
| `line` | number | No | Line number |
| `character` | number | No | Character position |

---

### exit_plan_mode

Exits planning mode and presents the plan to the user for approval.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `plan` | string | Yes | The plan to present for approval |

**Example:**
```json
{
  "plan": "1. Create database schema\n2. Implement API endpoints\n3. Add frontend components\n4. Write tests"
}
```

---

## Error Handling

All tools return a consistent error structure when something goes wrong:

```typescript
{
  "llmContent": "Detailed error message for the LLM",
  "returnDisplay": "User-friendly error message",
  "error": {
    "message": "Error details",
    "type": "error_type_code"
  }
}
```

**Common Error Types:**

| Error Type | Description |
|------------|-------------|
| `file_not_found` | Requested file does not exist |
| `permission_denied` | Insufficient permissions |
| `invalid_tool_params` | Invalid or missing parameters |
| `execution_failed` | Tool execution failed |
| `timeout` | Operation timed out |

---

## Best Practices

### File Operations

1. Always use absolute paths
2. Read files before editing to understand context
3. Include sufficient context in `old_string` for edits
4. Use `glob` or `grep_search` before reading to locate files

### Search & Navigation

1. Use `glob` for finding files by name pattern
2. Use `grep_search` for searching file contents
3. Combine tools for efficient exploration
4. Use glob filters to narrow search scope

### Development Tools

1. Use specialized dev tools (`python_dev`, `nodejs_dev`, `golang_dev`) instead of raw shell commands
2. Set `background: true` for long-running processes
3. Configure appropriate timeouts for build operations

### Task Management

1. Create todo lists for multi-step tasks
2. Update status in real-time
3. Mark tasks complete immediately after finishing
4. Only have one task `in_progress` at a time

---

## Configuration

Tools can be enabled/disabled in `settings.json`:

```json
{
  "coreTools": ["read_file", "edit", "run_shell_command"],
  "excludeTools": ["web_search"]
}
```
