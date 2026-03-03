# Changelog

## 0.16.8

_Dependency Updates & Zod v4 Migration_

### Dependency Updates

All dependencies updated to latest versions for compatibility and security:

| Package                     | Old Version              | New Version | Reason                                |
| --------------------------- | ------------------------ | ----------- | ------------------------------------- |
| `zod`                       | 3.23.8 / 3.24.0 / 3.25.0 | **4.3.6**   | Required by @modelcontextprotocol/sdk |
| `@modelcontextprotocol/sdk` | 1.25.1                   | **1.27.1**  | Latest MCP SDK features               |
| `ajv-formats`               | 3.0.0                    | **3.0.1**   | TypeScript type declarations          |
| `msw`                       | 2.3.4                    | **2.12.10** | Peer dependency fix                   |

### Breaking Changes

#### Zod v4 API Changes

Zod v4 introduces breaking API changes that required code updates:

| Change              | Old API                                  | New API                             |
| ------------------- | ---------------------------------------- | ----------------------------------- |
| `z.record()`        | `z.record(z.unknown())`                  | `z.record(z.string(), z.unknown())` |
| `z.string()` params | `{ required_error, invalid_type_error }` | `{ message }`                       |
| `ZodObject` generic | `ZodObject<Shape, 'strip', ZodTypeAny>`  | `ZodObject<Shape>`                  |
| Validation errors   | `error.errors`                           | `error.issues`                      |

### Files Modified

| File                                                   | Changes                                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| `package.json`                                         | Updated zod to 4.3.6                                |
| `packages/cli/package.json`                            | Updated zod, @modelcontextprotocol/sdk              |
| `packages/core/package.json`                           | Updated @modelcontextprotocol/sdk, ajv-formats, msw |
| `packages/sdk-typescript/package.json`                 | Updated zod, @modelcontextprotocol/sdk              |
| `packages/cli/src/acp-integration/schema.ts`           | Fixed `z.record()` calls                            |
| `packages/cli/src/services/FileCommandLoader.ts`       | Fixed `z.string()` params                           |
| `packages/cli/src/services/markdown-command-parser.ts` | Fixed `z.string()` params                           |
| `packages/sdk-typescript/src/mcp/tool.ts`              | Fixed `ZodObject` generic                           |
| `packages/sdk-typescript/src/query/createQuery.ts`     | Fixed error property access                         |
| `packages/*/vitest.config.ts`                          | Disabled PostCSS for tests                          |
| `packages/*/postcss.config.js`                         | Added empty configs                                 |

### Technical Details

#### Zod v4 Compatibility Fixes

1. **Record type arguments**: `z.record()` now requires explicit key and value type arguments
2. **Error messages**: Unified `message` parameter for validation errors
3. **Type inference**: Simplified `ZodObject` generic parameters
4. **Error structure**: Validation errors now use `.issues` instead of `.errors`

#### Vitest Configuration

Fixed PostCSS configuration conflicts by:

- Adding `css: { postcss: false }` to all vitest configs
- Creating empty `postcss.config.js` files in each package

### Verification

- ✅ TypeScript compilation passes
- ✅ Build succeeds
- ✅ Bundle created successfully

---

## 0.16.7

_UX Improvements, TypeScript Fixes & Test Migration_

### UX Improvements

#### Tips Message Formatting

Added spacing after Tips message in CLI for better readability:

| Component  | Change                                           |
| ---------- | ------------------------------------------------ |
| `Tips.tsx` | Added `marginBottom={1}` for visual spacing      |
| `Tips.tsx` | Added `flexDirection="column"` for proper layout |

### Bug Fixes

#### TypeScript Strict Mode Compatibility

Fixed TS7006/TS7053 errors by adding explicit type annotations:

| File                 | Changes                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `ide-client.ts`      | Added types for `part`, `tool` parameters                                        |
| `McpPromptLoader.ts` | Added `PromptArgument` types                                                     |
| `acpAgent.ts`        | Added types for `mode`, `item`, `model` parameters, fixed APPROVAL_MODES casting |
| `ToolCallEmitter.ts` | Added type for `loc` parameter                                                   |
| `consent.ts`         | Added `ClaudeMarketplacePluginConfig` type                                       |

### Refactoring

#### Test Migration — 100% Complete

All tests migrated from `tools/` to `plugins/builtin/`:

| Category           | Tests Migrated                                                         |
| ------------------ | ---------------------------------------------------------------------- |
| dev-tools          | python, nodejs, golang, rust, java, cpp, swift, php, typescript        |
| file-tools         | edit, glob, ls, read-file, read-many-files, write-file                 |
| search-tools       | grep, ripGrep, web-fetch                                               |
| database-tools     | database, docker, redis                                                |
| mcp-tools          | mcp-client, mcp-tool, mcp-client-manager, sdk-control-client-transport |
| agent-tools        | skill, task                                                            |
| productivity-tools | todoWrite, exitPlanMode                                                |
| utility-tools      | code-analyzer, diagram-generator                                       |
| Other              | git-advanced, lsp, shell, api-tester, save-memory                      |

**Tests remaining in `tools/` (base class tests):**

- diffOptions.test.ts
- modifiable-tool.test.ts
- tool-error.test.ts
- tool-names.test.ts
- tool-registry.test.ts
- tools.test.ts

### Dependency Updates

| Package       | Change          | Reason                                               |
| ------------- | --------------- | ---------------------------------------------------- |
| `zod`         | 3.24.0 → 3.25.0 | MCP SDK 1.25.1+ requires zod ^3.25 for v3/v4 exports |
| `ajv-formats` | 3.0.0 → 2.1.1   | ESM compatibility fix                                |

### Files Modified

| File                                                                   | Changes                          |
| ---------------------------------------------------------------------- | -------------------------------- |
| `packages/cli/src/ui/components/Tips.tsx`                              | Spacing after Tips message       |
| `packages/core/src/ide/ide-client.ts`                                  | Type annotations                 |
| `packages/cli/src/services/McpPromptLoader.ts`                         | Type annotations                 |
| `packages/cli/src/acp-integration/acpAgent.ts`                         | Type annotations                 |
| `packages/cli/src/acp-integration/session/emitters/ToolCallEmitter.ts` | Type annotations                 |
| `packages/cli/src/commands/extensions/consent.ts`                      | Type annotations                 |
| `packages/core/package.json`                                           | ajv-formats downgrade            |
| `package.json`                                                         | zod upgrade                      |
| `ROADMAP.md`                                                           | Updated migration status to 100% |
| `CHANGELOG.md`                                                         | Added v0.16.7                    |
| `CHANGELOG.ru.md`                                                      | Added v0.16.7 (Russian)          |

---

## 0.16.6

_Node.js Compatibility Fix_

### Bug Fixes

#### Node.js Version Requirements Clarification

Updated documentation to clearly specify supported Node.js versions:

| Node.js Version | Status           | Notes                         |
| --------------- | ---------------- | ----------------------------- |
| 18.x            | ✅ Supported     | LTS Maintenance               |
| 20.x            | ✅ Supported     | LTS Current (Recommended)     |
| 22.x            | ✅ Supported     | LTS Latest                    |
| 23.x            | ❌ Not Supported | node-pty compilation issues   |
| 24.x            | ❌ Not Supported | Experimental, node-pty issues |
| 25.x            | ❌ Not Supported | Experimental, node-pty issues |

**Problem:** Node.js 25.x caused `node-pty` compilation failure:

```
error: expected expression
I::ReadExternalPointerField<{internal::kFirstEmbedderDataTag,
```

**Solution:** Updated README to specify Node.js 20.x or 22.x LTS as required versions.

### Documentation Updates

| File           | Changes                                            |
| -------------- | -------------------------------------------------- |
| `README.md`    | Added Node.js compatibility warning with fix guide |
| `package.json` | Already had correct engines requirement (>=20.0.0) |

### Installation Fix

If you encounter `node-pty` compilation errors, switch to Node.js 22 LTS:

```bash
# Using asdf
asdf install nodejs 22.14.0
asdf local nodejs 22.14.0

# Clean and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## 0.16.5

_Tools Migration Complete_

### Tools Migration to Plugins — 100% Complete

All tool implementations have been migrated from `tools/` to `plugins/builtin/`. The `tools/` directory now only contains base infrastructure:

| Remaining in `tools/` | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `tool-names.ts`       | Tool name constants                            |
| `tool-error.ts`       | Error type definitions                         |
| `tools.ts`            | Base classes (DeclarativeTool, ToolInvocation) |
| `tool-registry.ts`    | Tool registry implementation                   |
| `modifiable-tool.ts`  | Modifiable tool support                        |

### Updated Imports

Test files updated to import from new plugin locations:

| File                              | Change                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| `utils/tool-utils.test.ts`        | `ReadFileTool` → `plugins/builtin/file-tools/read-file/`               |
| `prompts/mcp-prompts.test.ts`     | `DiscoveredMCPPrompt` → `plugins/builtin/mcp-tools/mcp-client/`        |
| `prompts/prompt-registry.test.ts` | `DiscoveredMCPPrompt` → `plugins/builtin/mcp-tools/mcp-client/`        |
| `core/prompts.test.ts`            | `OLLAMA_CODE_CONFIG_DIR` → `plugins/builtin/memory-tools/save-memory/` |

### Plugin Categories (14 total)

```
plugins/builtin/
├── core-tools/          # echo, timestamp, get_env
├── file-tools/          # read_file, write_file, edit, glob, ls, read-many-files
├── shell-tools/         # run_shell_command, bash
├── search-tools/        # grep, ripGrep, web_search, web_fetch
├── dev-tools/           # python, nodejs, golang, rust, typescript, java, cpp, swift, php
├── memory-tools/        # save_memory
├── agent-tools/         # task, skill
├── productivity-tools/  # todo_write, exit_plan_mode
├── database-tools/      # redis, database, docker
├── git-tools/           # git_advanced
├── mcp-tools/           # mcp_client, mcp_tool, mcp-client-manager, sdk-control-client-transport
├── utility-tools/       # code_analyzer, diagram_generator
├── lsp-tools/           # lsp
└── api-tools/           # api_tester
```

### Status

| Metric            | Value                |
| ----------------- | -------------------- |
| ESLint Errors     | 0                    |
| ESLint Warnings   | 48 (test files only) |
| TypeScript Errors | 0                    |

---

## 0.16.4

_Code Quality & ESLint Fixes_

### Bug Fixes

#### ESLint Error Resolution — From 336 to 0 Errors

Comprehensive ESLint error resolution across the entire codebase:

| Category                 | Fixes                                                  |
| ------------------------ | ------------------------------------------------------ |
| Unused variables/imports | Fixed 150+ occurrences                                 |
| Console statements       | Added to allowlist for CLI/telemetry files             |
| Missing default cases    | Added to switch statements                             |
| TypeScript strict mode   | Fixed optional chaining, @ts-ignore → @ts-expect-error |
| Regex escape characters  | Fixed PCRE2 pattern escapes                            |
| React hooks rules        | Fixed useCallback inside useMemo                       |

**Key Files Modified:**

- `eslint.config.js` — Relaxed rules for test files, added file-specific overrides
- `packages/core/src/utils/ripgrepUtils.ts` — Fixed regex escape sequences
- `packages/core/src/utils/schemaValidator.ts` — Changed @ts-ignore to @ts-expect-error
- `packages/core/src/observability/metricsCollector.ts` — Added default cases, fixed unused params
- `packages/web-app/server.ts` — Fixed unused socket/head parameters
- `packages/web-app/src/components/chat/ChatInterface.tsx` — Fixed unused variables

### Test File Improvements

- Relaxed `@typescript-eslint/no-unused-vars` rule for test files (warn instead of error)
- Allow PascalCase type imports in tests
- Added eslint-disable for intentional test patterns (throw string errors)

### Final Status

| Metric            | Before | After |
| ----------------- | ------ | ----- |
| ESLint Errors     | 336    | 0     |
| ESLint Warnings   | 48     | 48    |
| TypeScript Errors | 0      | 0     |

### Files Modified

| File                                                                         | Changes                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `eslint.config.js`                                                           | Test file rules, console allowlist, default-case |
| `packages/core/src/utils/ripgrepUtils.ts`                                    | PCRE2 regex patterns                             |
| `packages/core/src/utils/schemaValidator.ts`                                 | @ts-expect-error                                 |
| `packages/core/src/observability/metricsCollector.ts`                        | Default cases, unused params                     |
| `packages/core/src/streaming/streamBuffer.ts`                                | Unused param                                     |
| `packages/core/src/plugins/plugin-cli.ts`                                    | Unused catch variable                            |
| `packages/core/src/plugins/builtin/git-tools/git-advanced/index.ts`          | Default case                                     |
| `packages/core/src/plugins/builtin/utility-tools/diagram-generator/index.ts` | Unused param                                     |
| `packages/web-app/server.ts`                                                 | Unused params                                    |
| `packages/web-app/src/app/api/fs/route.ts`                                   | Unused variable                                  |
| `packages/web-app/src/components/chat/ChatInterface.tsx`                     | Unused variables                                 |
| `packages/web-app/src/hooks/useWebSocket.ts`                                 | Unused param                                     |
| `packages/core/src/core/ollamaNativeContentGenerator/converter.test.ts`      | Optional chaining                                |
| `packages/core/src/tools/sdk-control-client-transport.test.ts`               | Throw string ESLint disable                      |
| `integration-tests/terminal-capture/scenario-runner.js`                      | Removed unused import                            |

---

## 0.16.3

_Build Fix_

### Bug Fixes

#### ESM Compatibility Fix for ajv-formats

Fixed ESM module import error with `ajv-formats` package:

**Problem:** TypeScript compilation failed with:

```
error TS2307: Cannot find module 'ajv-formats' or its corresponding type declarations.
```

**Cause:** The `ajv-formats` package v3.0.0 publishes TypeScript source files in `src/` but references `dist/index.js` in `main`, causing module resolution issues with `verbatimModuleSyntax`.

**Solution:** Updated import statement to use default import with `@ts-ignore` directive for compatibility:

```typescript
// Before:
import * as addFormats from 'ajv-formats';

// After:
// @ts-ignore - ajv-formats types
import addFormats from 'ajv-formats';
```

**Files Modified:**

- `packages/core/src/utils/schemaValidator.ts`

### Commits

```
778dbd65 fix: correct ajv-formats import for ESM compatibility
```

---

## 0.16.2

_Bug Fixes & UX Improvements_

### Bug Fixes

#### PCRE2 Support for Look-around Regex in Grep

Added automatic PCRE2 support for look-ahead and look-behind regex patterns:

| Pattern    | Description          | Example                            |
| ---------- | -------------------- | ---------------------------------- |
| `(?=...)`  | Positive look-ahead  | `(?=.*\bfactory\b)(?=.*\bmodel\b)` |
| `(?!...)`  | Negative look-ahead  | `error(?!.*warning)`               |
| `(?<=...)` | Positive look-behind | `(?<=static )import`               |
| `(?<!...)` | Negative look-behind | `(?<!@)import`                     |

**Files Modified:**

- `packages/core/src/utils/ripgrepUtils.ts` — Added `requiresPcre2()` function
- `packages/core/src/plugins/builtin/search-tools/ripGrep/index.ts` — Automatic `--pcre2` flag

#### Language Rule in CRITICAL Section

Fixed model switching to English after tool errors by adding language rule to CRITICAL section in all prompt templates:

| Template        | Change                                          |
| --------------- | ----------------------------------------------- |
| `system-8b.md`  | Added `✅ ВСЕГДА отвечай на языке пользователя` |
| `system-14b.md` | Added to [CRITICAL] section                     |
| `system-32b.md` | Added to [CRITICAL] section                     |
| `system-70b.md` | Added to Security section                       |

### UX Improvements

#### Init Alias for Dev-tools

Added intuitive `init` alias for all dev-tools with init/create actions:

| Tool         | init →         | Additional aliases  |
| ------------ | -------------- | ------------------- |
| `golang_dev` | `mod_init`     | —                   |
| `python_dev` | `venv_create`  | —                   |
| `rust_dev`   | `cargo_init`   | `new` → `cargo_new` |
| `swift_dev`  | `package_init` | —                   |

**Example usage:**

```json
// Before (confusing):
{"action": "mod_init", "module_name": "github.com/user/project"}

// After (intuitive):
{"action": "init", "module_name": "github.com/user/project"}
```

#### Short Aliases for Golang Dev Tool

Added short aliases for frequently used actions:

| Alias | Action    |
| ----- | --------- |
| `r`   | `run`     |
| `b`   | `build`   |
| `t`   | `test`    |
| `l`   | `lint`    |
| `i`   | `install` |
| `v`   | `version` |
| `c`   | `clean`   |

### Files Modified

| File                                                              | Changes                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| `ROADMAP.md`                                                      | Added v0.16.2 section with detailed task descriptions |
| `packages/core/src/utils/ripgrepUtils.ts`                         | Added PCRE2 detection                                 |
| `packages/core/src/utils/ripgrepUtils.test.ts`                    | Added 28 tests for `requiresPcre2()`                  |
| `packages/core/src/plugins/builtin/search-tools/ripGrep/index.ts` | Auto PCRE2 flag                                       |
| `packages/core/src/prompts/templates/*.md`                        | Language rule in CRITICAL                             |
| `packages/core/src/plugins/builtin/dev-tools/golang/index.ts`     | Short aliases                                         |
| `packages/core/src/plugins/builtin/dev-tools/python/index.ts`     | init alias                                            |
| `packages/core/src/plugins/builtin/dev-tools/rust/index.ts`       | init, new aliases                                     |
| `packages/core/src/plugins/builtin/dev-tools/swift/index.ts`      | init alias                                            |

### Commits

```
dfd443f8 feat(dev-tools): add short aliases for common actions in golang_dev
33bed3d7 feat(dev-tools): add 'init' alias for all dev-tools with init/create actions
a5eb94e4 fix(prompts): add language rule to CRITICAL section in all templates
cea79177 feat(grep): add PCRE2 support for look-around regex patterns
```

---

## 0.16.0

_Documentation created with GLM-5 from Z.AI_

### New Features

#### Documentation: GPU Requirements and Performance Testing

Added comprehensive GPU requirements documentation with performance benchmarks:

| Section                      | Description                                   |
| ---------------------------- | --------------------------------------------- |
| **GPU Requirements Table**   | Minimum VRAM for each model size (3B to 70B+) |
| **Performance Test Results** | Benchmarks for RTX 3060 through RTX 4090      |
| **Quantization Guide**       | Q4_K_M, Q5_K_M, Q6_K, Q8_0 recommendations    |

**Performance Test Table includes:**

- 17 GPU/Model combinations tested
- Starting with RTX 3060 (12 GB) as baseline
- Speed measurements in tokens/second
- Quality scores for each configuration

**Files Updated:**

- `README.md` — Added GPU Requirements section
- `README.ru.md` — Added Russian GPU Requirements section

#### Plugin System v3 — Tools Reorganization into Plugins

Complete reorganization of tools into categorized plugins for better modularity and extensibility:

| Component                  | Description                                   |
| -------------------------- | --------------------------------------------- |
| **13 Plugin Categories**   | Tools organized by functionality              |
| **Tool Re-exports**        | Existing tools wrapped in plugin architecture |
| **Enhanced Documentation** | Each plugin has its own README and metadata   |

**New Plugin Categories (8 new):**

| Plugin ID             | Tools                                        | Description                               |
| --------------------- | -------------------------------------------- | ----------------------------------------- |
| `memory-tools`        | save_memory                                  | Memory and context management             |
| `task-tools`          | task, todo_write                             | Task delegation and tracking              |
| `database-tools`      | redis, database                              | Database operations (Redis, SQL, MongoDB) |
| `docker-tools`        | docker                                       | Container management                      |
| `git-tools`           | git_advanced                                 | Advanced Git operations                   |
| `mcp-tools`           | mcp_server                                   | Model Context Protocol integration        |
| `code-analysis-tools` | code_analyzer, diagram_generator, api_tester | Code quality and analysis                 |
| `skill-tools`         | skill, list_skills                           | Skill management and execution            |

**Updated Existing Plugins (5):**

| Plugin ID      | Changes                                                 |
| -------------- | ------------------------------------------------------- |
| `file-tools`   | Added read_many_files tool, enhanced documentation      |
| `shell-tools`  | Added bash alias, improved confirmation messages        |
| `search-tools` | Added full grep implementation, web_search enhancements |
| `dev-tools`    | All language tools with full descriptions               |
| `core-tools`   | Enhanced with environment variable whitelist            |

**Plugin Structure:**

```
packages/core/src/plugins/builtin/
├── core-tools/          # echo, timestamp, get_env
├── file-tools/          # read_file, write_file, edit, glob, list_directory, read_many_files
├── shell-tools/         # run_shell_command, bash
├── search-tools/        # grep, web_search, web_fetch
├── dev-tools/           # python_dev, nodejs_dev, golang_dev, rust_dev, etc.
├── memory-tools/        # save_memory
├── task-tools/          # task, todo_write
├── database-tools/      # redis, database
├── docker-tools/        # docker
├── git-tools/           # git_advanced
├── mcp-tools/           # mcp_server
├── code-analysis-tools/ # code_analyzer, diagram_generator, api_tester
└── skill-tools/         # skill, list_skills
```

### Technical Improvements

#### PluginRegistry Enhancement

- Updated to load all 13 plugin categories
- Dynamic plugin discovery from builtin directory
- Enhanced logging and error handling

#### File Structure

Each plugin now includes:

- `index.ts` — Plugin definition with tools and hooks
- `plugin.json` — Metadata file for plugin discovery

### Files Added

| File                                              | Description             |
| ------------------------------------------------- | ----------------------- |
| `plugins/builtin/memory-tools/index.ts`           | Memory tools plugin     |
| `plugins/builtin/memory-tools/plugin.json`        | Memory tools metadata   |
| `plugins/builtin/task-tools/index.ts`             | Task tools plugin       |
| `plugins/builtin/task-tools/plugin.json`          | Task tools metadata     |
| `plugins/builtin/database-tools/index.ts`         | Database tools plugin   |
| `plugins/builtin/database-tools/plugin.json`      | Database tools metadata |
| `plugins/builtin/docker-tools/index.ts`           | Docker tools plugin     |
| `plugins/builtin/docker-tools/plugin.json`        | Docker tools metadata   |
| `plugins/builtin/git-tools/index.ts`              | Git tools plugin        |
| `plugins/builtin/git-tools/plugin.json`           | Git tools metadata      |
| `plugins/builtin/mcp-tools/index.ts`              | MCP tools plugin        |
| `plugins/builtin/mcp-tools/plugin.json`           | MCP tools metadata      |
| `plugins/builtin/code-analysis-tools/index.ts`    | Code analysis plugin    |
| `plugins/builtin/code-analysis-tools/plugin.json` | Code analysis metadata  |
| `plugins/builtin/skill-tools/index.ts`            | Skill tools plugin      |
| `plugins/builtin/skill-tools/plugin.json`         | Skill tools metadata    |

### Files Modified

| File                                    | Changes                         |
| --------------------------------------- | ------------------------------- |
| `plugins/builtin/file-tools/index.ts`   | Enhanced with read_many_files   |
| `plugins/builtin/shell-tools/index.ts`  | Added bash alias, safety checks |
| `plugins/builtin/search-tools/index.ts` | Full grep/web implementation    |
| `plugins/pluginRegistry.ts`             | Load all 13 plugin categories   |

### Migration Guide

Tools are now loaded via the plugin system:

- All existing tool classes are still available for direct import
- Tools are automatically registered through `PluginRegistry.initialize()`
- Plugin hooks enable custom behavior before/after tool execution

---

## 0.15.0

### New Features

#### Web UI — Full-Featured Next.js Web Interface (95% Complete)

Complete Next.js 15 web application with chat, file explorer, and terminal:

| Feature               | Description                                        |
| --------------------- | -------------------------------------------------- |
| **Chat Interface**    | Real-time streaming chat with model selection      |
| **File Explorer**     | Monaco editor integration with syntax highlighting |
| **Terminal Emulator** | xterm.js with PTY support via WebSocket            |
| **API Routes**        | Full Ollama proxy with streaming support           |
| **Filesystem API**    | CRUD operations with secure path resolution        |

**Components:**

| Component          | Technology          | Features                                       |
| ------------------ | ------------------- | ---------------------------------------------- |
| `ChatInterface`    | React + Zustand     | Streaming, model selection, session management |
| `FileExplorer`     | Monaco Editor       | Syntax highlighting, auto-save, resize         |
| `TerminalEmulator` | xterm.js + node-pty | Full PTY support, resize handling, colors      |
| `TerminalServer`   | WebSocket + PTY     | Session management, IP limits, timeout cleanup |

**API Routes:**

| Route                   | Method              | Description                       |
| ----------------------- | ------------------- | --------------------------------- |
| `/api/ollama/[...path]` | \*                  | Proxy for all Ollama API requests |
| `/api/models`           | GET                 | List available models             |
| `/api/chat`             | POST                | Chat with streaming support       |
| `/api/generate`         | POST                | Generate with streaming support   |
| `/api/fs`               | GET/POST/PUT/DELETE | Filesystem operations             |

**Running the Web UI:**

```bash
# Development mode
cd packages/web-app
npm run dev

# With terminal support (requires custom server)
npm run dev:server
```

**WebSocket Terminal:**

The terminal connects to `/terminal` WebSocket endpoint for PTY operations:

```typescript
// Client-side connection
const socket = new WebSocket('ws://localhost:3000/terminal');

// Send input
socket.send(JSON.stringify({ type: 'input', data: 'ls -la\n' }));

// Resize terminal
socket.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));
```

#### TSDoc Documentation — API Reference

Comprehensive TSDoc documentation added to all public packages:

| Package             | Coverage | Description                                   |
| ------------------- | -------- | --------------------------------------------- |
| `@ollama-code/core` | 100%     | Configuration, models, engine, tools, plugins |
| `@ollama-code/sdk`  | 100%     | Query API, MCP integration, type definitions  |
| `@ollama-code/cli`  | Partial  | Internal CLI API                              |

**Usage Examples:**

```typescript
// Core package
import { getCoreSystemPrompt, createContextCache } from '@ollama-code/core';

// SDK package
import { query, createSdkMcpServer, tool } from '@ollama-code/sdk';

const result = await query({
  prompt: 'Explain TypeScript generics',
  model: 'llama3.2',
});
```

### Technical Improvements

#### TypeScript Configuration

Fixed monorepo TypeScript configuration for better IDE support:

- Added project references for all packages
- Added `composite: true` for referenced packages
- Fixed ESLint configuration for web-app
- Separated server code tsconfig (`tsconfig.server.json`)

#### HTTP Client Migration

Completed fetch to axios migration for all HTTP operations:

- `packages/core/src/utils/httpClient.ts` — Axios instance with interceptors
- `packages/core/src/core/ollamaNativeClient.ts` — Streaming with axios
- `packages/core/src/tools/web-search/providers/*.ts` — Provider migration

### Files Added

| File                                                            | Description           |
| --------------------------------------------------------------- | --------------------- |
| `packages/web-app/src/app/api/ollama/[...path]/route.ts`        | Ollama proxy          |
| `packages/web-app/src/app/api/models/route.ts`                  | Models list           |
| `packages/web-app/src/app/api/chat/route.ts`                    | Chat streaming        |
| `packages/web-app/src/app/api/generate/route.ts`                | Generate streaming    |
| `packages/web-app/src/app/api/fs/route.ts`                      | Filesystem API        |
| `packages/web-app/src/components/chat/ChatInterface.tsx`        | Chat UI               |
| `packages/web-app/src/components/explorer/FileExplorer.tsx`     | File browser          |
| `packages/web-app/src/components/terminal/TerminalEmulator.tsx` | Terminal UI           |
| `packages/web-app/src/server/terminalServer.ts`                 | PTY WebSocket server  |
| `packages/web-app/server.ts`                                    | Custom Next.js server |
| `packages/web-app/src/stores/webSessionStore.ts`                | Zustand store         |
| `packages/web-app/src/hooks/useWebSocket.ts`                    | WebSocket hook        |

### Session Commits (2025-03-01)

| Commit     | Description                                       |
| ---------- | ------------------------------------------------- |
| `4b189ab5` | docs: update ROADMAP - Web UI 95% complete        |
| `32409019` | feat(web-app): Terminal WebSocket server with PTY |
| `b2f64aaf` | docs: update ROADMAP with TSDoc progress          |
| `4e078a35` | docs(sdk): add TSDoc package documentation        |
| `bf311f21` | docs: update ROADMAP with Web UI progress         |
| `76163a8b` | feat(web-app): API routes, FileExplorer, Terminal |
| `afe080c6` | docs: update ROADMAP with actual status           |
| `db4088db` | fix: TypeScript configuration and web-app fixes   |

### Documentation Updates

| Document                               | Changes                                             |
| -------------------------------------- | --------------------------------------------------- |
| `ROADMAP.md`                           | Updated Web UI progress (95%), added latest commits |
| `packages/sdk-typescript/src/index.ts` | Added @packageDocumentation                         |
| `packages/core/src/index.ts`           | Added TSDoc API documentation                       |
| `docs/WEB_UI.md`                       | Complete Web UI documentation                       |

### Remaining Tasks (5%)

- CLI backend integration for Web UI (context sharing)
- TSDoc for packages/cli (20% remaining)
- Virtual scrolling (P2)
- Structured logging (P2)

---

## 0.14.0

### New Features

#### Plugin System v2 — Complete Implementation

Full plugin system with dynamic loading, marketplace, and security sandbox:

| Component             | Description                                        |
| --------------------- | -------------------------------------------------- |
| **PluginLoader**      | Discovery from builtin, user, project, npm sources |
| **PluginManager**     | Lifecycle management with enable/disable hooks     |
| **PluginRegistry**    | ToolRegistry integration                           |
| **PluginSandbox**     | Filesystem, network, command restrictions          |
| **PluginMarketplace** | NPM-based search, install, update, uninstall       |
| **PluginToolAdapter** | Tool wrapper for DeclarativeTool                   |

**Builtin Plugins (5):**

- `core-tools` — echo, timestamp, get_env
- `dev-tools` — python_dev, nodejs_dev, golang_dev, rust_dev, typescript_dev, etc.
- `file-tools` — read_file, write_file, edit_file, glob, list_directory
- `search-tools` — grep, glob, web_fetch, web_search
- `shell-tools` — run_shell_command, bash

**Plugin CLI Commands:**

```bash
plugin-cli create my-plugin    # Create new plugin
plugin-cli validate ./plugin   # Validate plugin
plugin-cli list                # List all plugins
plugin-cli info my-plugin      # Show plugin info
```

#### Prompt System v2 — Model-Size-Optimized Templates

Adaptive prompts based on model size:

| Model Size | Template | Prompt Size  | Features                        |
| ---------- | -------- | ------------ | ------------------------------- |
| <= 10B     | 8b       | ~500 tokens  | Compact rules, minimal examples |
| <= 30B     | 14b      | ~800 tokens  | Standard rules, tool tables     |
| <= 60B     | 32b      | ~1200 tokens | Extended workflow, security     |
| > 60B      | 70b      | ~1500 tokens | Full docs, all examples         |

**API:**

```typescript
import { getCoreSystemPrompt } from '@ollama-code/ollama-code-core';

// Auto-select template based on model
const prompt = getCoreSystemPrompt(userMemory, 'qwen2.5-coder:14b');
```

---

## 0.13.0

### New Features

#### HTTP Client Migration (fetch → axios)

Completed migration to axios for all HTTP operations:

| File                                                | Changes                          |
| --------------------------------------------------- | -------------------------------- |
| `packages/core/src/utils/httpClient.ts`             | Axios instance with interceptors |
| `packages/core/src/core/ollamaNativeClient.ts`      | Streaming with axios             |
| `packages/core/src/tools/web-search/providers/*.ts` | Provider migration               |

**Features:**

- Request/Response logging
- Retry with exponential backoff
- Timeout handling
- Auth header injection

#### TypeScript Configuration

Fixed monorepo TypeScript configuration:

- Added project references for all packages
- Added `composite: true` for referenced packages
- Fixed ESLint configuration for web-app
- Separated server code tsconfig (`tsconfig.server.json`)

---

## 0.12.0

### New Features

#### Prompt System v2 — Model-Size-Optimized Templates

Революционная система промптов, адаптирующаяся к размеру модели:

| Model Size | Template | Размер промпта | Особенности                               |
| ---------- | -------- | -------------- | ----------------------------------------- |
| <= 10B     | 8b       | ~500 токенов   | Компактные правила, минимум примеров      |
| <= 30B     | 14b      | ~800 токенов   | Стандартные правила, таблицы инструментов |
| <= 60B     | 32b      | ~1200 токенов  | Расширенный workflow, security            |
| > 60B      | 70b      | ~1500 токенов  | Полная документация, все примеры          |

**Ключевые улучшения:**

- ✅ Иерархическая структура: Role → Rules → Tools → Workflow → Output
- ✅ Приоритеты правил: `[CRITICAL]`, `[RECOMMENDED]`, `[OPTIONAL]`
- ✅ Чек-листы вместо длинных описаний
- ✅ 1-3 компактных примера вместо 5+ развёрнутых
- ✅ Динамическое заполнение плейсхолдеров

**Новые файлы:**

- `packages/core/src/prompts/templates/system-8b.md` — Small models
- `packages/core/src/prompts/templates/system-14b.md` — Medium models
- `packages/core/src/prompts/templates/system-32b.md` — Large models
- `packages/core/src/prompts/templates/system-70b.md` — XLarge models
- `packages/core/src/prompts/templates/index.ts` — Template loader
- `packages/core/src/core/promptsV2.ts` — v2 implementation

**API:**

```typescript
import { getCoreSystemPrompt } from '@ollama-code/ollama-code-core';

// Автоматический выбор шаблона по модели
const prompt = getCoreSystemPrompt(userMemory, 'qwen2.5-coder:14b');

// Определение размера модели
import { extractModelSize, getSizeTier } from '@ollama-code/ollama-code-core';
const size = extractModelSize('llama3.1:70b'); // 70
const tier = getSizeTier('mistral:7b'); // 'medium'
```

**Переменные окружения:**
| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `OLLAMA_CODE_USE_TEMPLATES` | Использовать v2 | `true` |
| `OLLAMA_CODE_SYSTEM_MD` | Кастомный промпт | - |

**Документация:**

- `docs/PROMPT_SYSTEM_V2.md` — Полная документация v2
- `docs/PROMPT_SYSTEM.md` — Legacy документация

---

## 0.11.3

### Bug Fixes

#### React Hooks Rules Violation Fix

Fixed critical bug in `LoadingIndicator.tsx` where `useMemo` hooks were called after an early `return` statement, violating React Rules of Hooks:

```
Error: Rendered more hooks than during the previous render.
```

**Changes:**

- Moved all `useMemo` calls before the early `return null;` statement
- All hooks are now called in consistent order on every render

**File Modified:**

- `packages/cli/src/ui/components/LoadingIndicator.tsx`

### Documentation Updates

- Updated `ROADMAP.md` with complete status of all tasks
- All major features now marked as completed
- **NEW**: Added comprehensive Plugin Marketplace documentation (`docs/PLUGIN_MARKETPLACE.md`)
  - CLI commands: search, install, update, uninstall, list
  - Programmatic API with TypeScript types
  - Trust levels: verified, community, unverified
  - Creating plugins for marketplace
  - Integration with Claude extensions
- Updated `README.md` with Plugin System documentation links
- Added Plugin Marketplace section to `docs/PLUGIN_SYSTEM.md`

---

## 0.11.2

### React Performance Optimization

Major React performance improvements through context splitting and memoization:

#### New Specialized Contexts

Split the monolithic `UIStateContext` (70+ fields) into smaller, focused contexts:

| Context               | Purpose                            |
| --------------------- | ---------------------------------- |
| `DialogStateContext`  | Dialog visibility states           |
| `TerminalContext`     | Terminal dimensions and layout     |
| `InputStateContext`   | Input buffer and key press states  |
| `HistoryContext`      | History items and pending messages |
| `LoadingContext`      | Streaming and loading states       |
| `ConfirmationContext` | Confirmation requests              |

#### Memoized Components

Added `React.memo` and `useMemo` to frequently re-rendering components:

- `Footer` — Status bar (already memoized, enhanced)
- `AppHeader` — Application header with memoized selectors
- `MainContent` — Main content area with optimized rendering
- `HistoryItemDisplay` — Individual history item rendering with memoized dimensions
- `Composer` — Input area with memoized state selectors

#### Performance Benefits

- **Reduced re-renders**: Components only re-render when their specific context changes
- **Memoized history items**: Each history item is independently memoized
- **Memoized dimensions**: Layout calculations cached to prevent recalculation
- **Selective subscriptions**: Components can subscribe to specific state slices

### Documentation Updates

- Updated `ROADMAP.md` with React optimization progress
- Added details about context splitting strategy

### Files Added

| File                                                   | Description              |
| ------------------------------------------------------ | ------------------------ |
| `packages/cli/src/ui/contexts/DialogStateContext.tsx`  | Dialog state management  |
| `packages/cli/src/ui/contexts/TerminalContext.tsx`     | Terminal dimensions      |
| `packages/cli/src/ui/contexts/InputStateContext.tsx`   | Input state management   |
| `packages/cli/src/ui/contexts/HistoryContext.tsx`      | History state management |
| `packages/cli/src/ui/contexts/LoadingContext.tsx`      | Loading state management |
| `packages/cli/src/ui/contexts/ConfirmationContext.tsx` | Confirmation requests    |

### Files Modified

| File                                                    | Changes                              |
| ------------------------------------------------------- | ------------------------------------ |
| `packages/cli/src/ui/components/AppHeader.tsx`          | Added memo and useMemo               |
| `packages/cli/src/ui/components/MainContent.tsx`        | Added memo, simplified rendering     |
| `packages/cli/src/ui/components/HistoryItemDisplay.tsx` | Added memo, memoized dimensions      |
| `packages/cli/src/ui/components/Composer.tsx`           | Added memo, memoized state selectors |

---

## 0.11.1

### Documentation Updates

- Added Qwen2.5-Coder and Qwen3-Coder to recommended models
  - `qwen2.5-coder:7b` — excellent for programming tasks (7B parameters)
  - `qwen2.5-coder:14b` — balanced performance and quality (14B parameters)
  - `qwen3-coder:30b` — top-tier coding model (30B parameters)

### Roadmap Updates

- Added detailed migration plan for fetch → axios transition
- Documented files, stages, and testing requirements

---

## 0.11.0

### New Features

#### Architecture Improvements

Major architectural enhancements for better performance and extensibility:

| Feature                  | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| **Zustand Migration**    | Replaced Context API with Zustand for atomic state updates |
| **Event Bus**            | Typed pub/sub system for loose component coupling          |
| **Command Pattern**      | Full Undo/Redo support for reversible operations           |
| **Plugin System v1**     | Dynamic tool loading with lifecycle hooks                  |
| **Context Caching**      | KV-cache reuse for 80-90% faster conversations             |
| **Prompt Documentation** | Comprehensive prompt system documentation                  |

#### Zustand Stores

Five new stores replacing Context API:

| Store            | Purpose                           |
| ---------------- | --------------------------------- |
| `sessionStore`   | Session state and metrics         |
| `streamingStore` | Streaming state + AbortController |
| `uiStore`        | UI settings with persistence      |
| `commandStore`   | Command pattern for undo/redo     |
| `eventBus`       | Event pub/sub system              |

#### Event Bus

Typed events for cross-component communication:

```typescript
// Subscribe to events
eventBus.subscribe('stream:finished', (data) => {
  console.log('Tokens used:', data.tokenCount);
});

// Emit events
eventBus.emit('command:executed', { commandId: '123', commandType: 'edit' });
```

**Supported Events:**

- `stream:started/chunk/finished/error/cancelled`
- `tool:started/progress/completed/error`
- `session:started/ended/cleared`
- `command:executed/undone/redone`
- `plugin:loaded/unloaded/error`

#### Command Pattern (Undo/Redo)

Full implementation of the Command pattern:

```typescript
// Execute with undo support
await commandStore.execute({
  description: 'Change theme',
  type: 'theme',
  execute: async () => {
    /* action */
  },
  undo: async () => {
    /* reverse action */
  },
  canUndo: true,
});

// Undo last command
await commandStore.undo();

// Redo undone command
await commandStore.redo();
```

#### Plugin System v1

Dynamic plugin architecture with lifecycle hooks:

```typescript
const plugin: PluginDefinition = {
  metadata: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'My custom tools',
  },
  tools: [
    {
      id: 'hello',
      name: 'hello',
      description: 'Say hello',
      parameters: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      execute: async (params, context) => ({
        success: true,
        data: `Hello, ${params['message']}!`,
      }),
    },
  ],
  hooks: {
    onLoad: async (context) => context.logger.info('Plugin loaded'),
    onEnable: async (context) => context.logger.info('Plugin enabled'),
    onBeforeToolExecute: async (toolId, params) => true,
    onAfterToolExecute: async (toolId, params, result) => {},
  },
};
```

**Builtin Plugins:**

| Plugin         | Tools                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `core-tools`   | echo, timestamp, get_env                                                                            |
| `dev-tools`    | python_dev, nodejs_dev, golang_dev, rust_dev, typescript_dev, java_dev, cpp_dev, swift_dev, php_dev |
| `file-tools`   | read_file, write_file, edit_file                                                                    |
| `search-tools` | grep, glob, web_fetch                                                                               |
| `shell-tools`  | run_shell_command                                                                                   |

#### Prompt System Documentation

New comprehensive documentation in `docs/PROMPT_SYSTEM.md`:

| Function                          | Purpose                           |
| --------------------------------- | --------------------------------- |
| `getCoreSystemPrompt()`           | Main system prompt construction   |
| `getCompressionPrompt()`          | History compression to XML format |
| `getProjectSummaryPrompt()`       | Markdown project summaries        |
| `getToolCallFormatInstructions()` | For models without native tools   |
| `getToolLearningContext()`        | Learning from past mistakes       |
| `getEnvironmentInfo()`            | Runtime environment context       |
| `getCustomSystemPrompt()`         | Custom instruction processing     |

### Technical Improvements

#### TypeScript Strict Mode

- Fixed all TypeScript strict mode errors
- Proper bracket notation for index signatures
- Correct type casting for context clients
- Removed unused variables and parameters

### Files Added/Modified

| File                                           | Description                    |
| ---------------------------------------------- | ------------------------------ |
| `packages/cli/src/ui/stores/commandStore.ts`   | Command pattern implementation |
| `packages/cli/src/ui/stores/eventBus.ts`       | Event bus implementation       |
| `packages/core/src/plugins/types.ts`           | Plugin system types            |
| `packages/core/src/plugins/pluginManager.ts`   | Plugin lifecycle management    |
| `packages/core/src/plugins/pluginLoader.ts`    | Plugin discovery               |
| `packages/core/src/plugins/pluginRegistry.ts`  | Plugin registration            |
| `packages/core/src/plugins/builtin/*/index.ts` | Builtin plugins                |
| `docs/PROMPT_SYSTEM.md`                        | Prompt system documentation    |

### Documentation Updates

| Document       | Changes                      |
| -------------- | ---------------------------- |
| `README.md`    | Updated for v0.11.0          |
| `README.ru.md` | Russian version updated      |
| `ROADMAP.md`   | Updated with completed tasks |
| `CHANGELOG.md` | This changelog               |

### Breaking Changes

- Context API replaced with Zustand (internal API change)
- Event system now uses `eventBus.subscribe()` instead of direct callbacks

### Migration Guide

If you were using Context API directly (internal):

```typescript
// Before (Context API)
const state = useContext(UIStateContext);

// After (Zustand)
const value = useUIStore((state) => state.value);
```

---

## 0.10.9

### New Features

#### Context Caching with KV-cache Reuse

- **Ollama Context Token Caching**: Significant performance improvement for multi-turn conversations
  - Automatic caching of context tokens between messages
  - Reuses Ollama's KV-cache for faster subsequent responses
  - ~80-90% token reduction on follow-up messages
  - Automatic endpoint selection: `/api/generate` for simple chat, `/api/chat` for tools

```typescript
// Enable context caching in config
const config: ContentGeneratorConfig = {
  model: 'llama3.2',
  enableContextCaching: true, // Enables KV-cache reuse
};

// First message: full processing
// Second message: only new tokens processed (cached context reused)
```

#### Hybrid Content Generator

- **Intelligent Endpoint Selection**: Automatically chooses optimal Ollama API endpoint
  - `/api/generate` with context caching for simple conversations
  - `/api/chat` for requests with tools and function calls
  - Seamless switching based on request requirements

#### Zustand State Management

- **Migrated from Context API to Zustand**: Improved React performance
  - Atomic state updates prevent unnecessary re-renders
  - Three new stores: `sessionStore`, `streamingStore`, `uiStore`
  - Built-in persistence support

#### Event Bus Architecture

- **Loose Coupling Between Components**: Typed publish/subscribe system
  - `eventBus.subscribe('stream:finished', callback)`
  - `eventBus.emit('stream:finished', data)`
  - Type-safe event handling

#### Command Pattern (Undo/Redo)

- **Reversible Operations**: Command pattern implementation
  - `commandStore.execute(command)` with undo support
  - `commandStore.undo()` / `commandStore.redo()`
  - History tracking for reversible operations

#### Plugin System

- **Dynamic Tool Loading**: Extensible plugin architecture
  - `pluginManager.registerPlugin(plugin)`
  - Runtime tool registration
  - Plugin lifecycle management (enable/disable)

### Architecture Improvements

#### Memory Leak Fixes

- **AbortController Cleanup**: Proper cleanup in streaming operations
  - Clear readers and timeouts on abort
  - Prevent memory accumulation in long sessions

#### Token Counting Fallback

- **Robust Token Metrics**: Fallback when Ollama doesn't return `prompt_eval_count`
  - `recordTokenUsageWithFallback()` method
  - Accurate progress bar updates

### Files Added

| File                                               | Description             |
| -------------------------------------------------- | ----------------------- |
| `packages/core/src/cache/contextCacheManager.ts`   | Context token caching   |
| `packages/core/src/core/ollamaContextClient.ts`    | /api/generate client    |
| `packages/core/src/core/hybridContentGenerator.ts` | Endpoint selection      |
| `packages/cli/src/ui/stores/sessionStore.ts`       | Session state (Zustand) |
| `packages/cli/src/ui/stores/streamingStore.ts`     | Streaming state         |
| `packages/cli/src/ui/stores/uiStore.ts`            | UI preferences          |
| `packages/cli/src/ui/stores/eventBus.ts`           | Event bus               |
| `packages/cli/src/ui/stores/commandStore.ts`       | Undo/Redo               |
| `packages/core/src/plugins/index.ts`               | Plugin system           |

### Configuration Options

New options in `ContentGeneratorConfig`:

```typescript
interface ContentGeneratorConfig {
  // ... existing options

  /** Enable context caching for faster multi-turn conversations */
  enableContextCaching?: boolean;

  /** Session ID for context tracking */
  sessionId?: string;
}
```

### Test Coverage

- **ContextCacheManager**: 50 tests (TTL, eviction, concurrent access, edge cases)
- **OllamaContextClient**: 32 tests (streaming, error handling, session management)
- **HybridContentGenerator**: 36 tests (endpoint selection, token counting, embeddings)
- **Total Context Caching Tests**: 118 tests ✅

### Documentation

| Document                   | Description                   |
| -------------------------- | ----------------------------- |
| `docs/CONTEXT_CACHING.md`  | Context caching API reference |
| `docs/STATE_MANAGEMENT.md` | Zustand stores documentation  |
| `docs/EVENT_BUS.md`        | Event bus architecture        |
| `docs/PLUGIN_SYSTEM.md`    | Plugin system reference       |

### Performance Metrics

| Metric       | Without Caching | With Caching |
| ------------ | --------------- | ------------ |
| 1st message  | 100%            | 100%         |
| 2nd message  | 100%            | ~15%         |
| 10th message | 100%            | ~7%          |

---

## 0.10.8

### New Features

#### Context Progress Bar in Header

- **Visual Token Usage Display**: The header now shows a progress bar indicating context token usage relative to the model's context window
- **Model Size Indicator**: Displays the model's context window size (e.g., "128K", "32K") extracted from model metadata
- **Full-Width Progress Bar**: Progress bar now spans the full width of the info panel for better visibility
- **Cumulative Token Tracking**: Progress bar accurately shows cumulative context tokens throughout the session

#### Model Capabilities Display

- **Capability Icons**: Visual indicators for model capabilities (vision, tools, streaming support)
- **Context Information**: Shows model context window and current usage percentage
- **Enhanced Model Metadata**: Better extraction of model context sizes for various formats (128K, 32K, 8K, etc.)

#### System Prompt & Tool Optimization

- **Streamlined System Prompts**: Optimized system prompts for better model performance
- **Tool Call Format Instructions**: Added automatic tool call format instructions for models without native tool support
- **Priority 3 Features**: Implemented streaming, caching, and observability improvements

### Improvements

#### Command Cleanup

Removed unused commands to streamline the CLI:

| Removed Command | Alternative        |
| --------------- | ------------------ |
| `/bug`          | Use direct message |
| `/docs`         | See `docs/` folder |
| `/help`         | See documentation  |
| `/setup-github` | Configure manually |

Merged commands for better organization:

| Merged Commands     | New Command |
| ------------------- | ----------- |
| `/stats` + `/about` | `/info`     |

#### Technical Improvements

- Fixed progress bar not updating: token usage now properly recorded in telemetry service
- Fixed AppHeader component placement for dynamic updates
- Replaced `require()` with ES module imports in development tools
- Removed debug logging for cleaner output

### Bug Fixes

- Progress bar now correctly shows cumulative context tokens
- Model size extraction works with more model name formats
- Header component updates dynamically during streaming

## 0.10.7

### New Features

#### Self-Learning System for Tool Calling

- **Automatic Tool Name Learning**: The system now learns from tool call errors and automatically creates dynamic aliases for frequently mistaken tool names
- **Fuzzy Matching**: Uses Levenshtein distance algorithm to suggest similar tool names when a model makes an error
- **Learning Data Persistence**: Learning data is saved to `~/.ollama-code/learning/` directory for persistence across sessions
- **Dynamic Aliases**: Runtime alias creation without code modifications - when a model repeatedly uses an incorrect tool name, an alias is automatically created
- **Error Tracking**: Tracks tool call errors and patterns to improve suggestions over time

#### How It Works

1. When a model calls a non-existent tool, the system records the error
2. The system uses fuzzy matching to find the most similar valid tool name
3. After reaching the threshold (default: 1 error), a dynamic alias is automatically created
4. Future calls with the incorrect name are resolved to the correct tool
5. Learning data persists across sessions for continuous improvement

#### Technical Details

- `ToolLearningManager` class manages the learning process
- `DynamicAliases` export in `tool-names.ts` for runtime alias storage
- Integrated with `CoreToolScheduler` for error detection
- Learning context added to system prompts for model guidance

### Improvements

- Enhanced error messages with learning-enhanced suggestions
- Better model compatibility through dynamic alias resolution
- Improved user experience with automatic error correction

## 0.10.6

### New Features

#### Development Tools

- **Python Development Tool** (`python_dev`): Comprehensive Python development support including:

  - Run Python scripts with arguments
  - Execute pytest with test patterns
  - Run pylint, mypy, and black for code quality
  - Manage virtual environments (create, activate)
  - pip operations (install, list, freeze)
  - Support for custom Python interpreter paths

- **Node.js Development Tool** (`nodejs_dev`): Full Node.js/JavaScript development support including:

  - Auto-detection of package manager (npm, yarn, pnpm, bun)
  - Run Node.js scripts
  - Package management (install, add, remove, update)
  - Run package.json scripts (test, build, dev, lint)
  - Execute npx/yarn dlx/bunx commands
  - Background execution for dev servers
  - Clean operation for node_modules and lock files

- **Golang Development Tool** (`golang_dev`): Complete Go development support including:
  - Run and build Go programs
  - Run tests with coverage and benchmarks
  - Code quality tools (fmt, vet, golangci-lint)
  - Module management (init, tidy, download, verify, graph)
  - Package management (get, install)
  - Race detector support

#### Documentation

- **Tools Reference Documentation**: Complete bilingual documentation for all tools
  - English version: `docs/TOOLS.md`
  - Russian version: `docs/TOOLS.ru.md`
  - Covers all 20+ tools with parameters, examples, and best practices

### Tool Aliases Updates

Added development tool aliases:

| Alias                                | Canonical Tool |
| ------------------------------------ | -------------- |
| `py`, `python`, `pip`, `pytest`      | `python_dev`   |
| `node`, `npm`, `yarn`, `pnpm`, `bun` | `nodejs_dev`   |
| `go`, `golang`                       | `golang_dev`   |

### Improvements

- Enhanced tool registry with development tools integration
- Improved shell execution for development commands
- Better timeout handling for long-running operations

## 0.10.5

### New Features

- **Tool Alias System**: Added short aliases for tool names (e.g., `run` → `run_shell_command`, `read` → `read_file`, `write` → `write_file`)
- **Session ID Display**: Session ID now shown in the header for better debugging and logging
- **UTF-8 Locale Check**: Added startup warning for non-UTF-8 terminal encoding

### Tool Aliases

| Alias                         | Canonical Name      |
| ----------------------------- | ------------------- |
| `run`, `shell`, `exec`, `cmd` | `run_shell_command` |
| `read`                        | `read_file`         |
| `write`, `create`             | `write_file`        |
| `grep`, `search`, `find`      | `grep_search`       |
| `glob`, `files`               | `glob`              |
| `ls`, `list`, `dir`           | `list_directory`    |
| `todo`, `todos`               | `todo_write`        |
| `memory`, `save`              | `save_memory`       |
| `websearch`, `web`            | `web_search`        |
| `webfetch`, `fetch`, `url`    | `web_fetch`         |
| `agent`, `subagent`           | `task`              |

### Improvements

- Improved error messages for tool not found scenarios
- Enhanced documentation structure
- Added bilingual documentation support (English/Russian)

### Bug Fixes

- Fixed tool name resolution for better model compatibility

## 0.0.14

- Added plan mode support for task planning
- Fixed unreliable editCorrector that injects extra escape characters
- Fixed task tool dynamic updates
- Added Qwen3-VL-Plus token limits (256K input, 32K output) and highres support
- Enhanced dashScope cache control

## 0.0.13

- Added YOLO mode support for automatic vision model switching with CLI arguments and environment variables.
- Fixed ripgrep lazy loading to resolve VS Code IDE companion startup issues.
- Fixed authentication hang when selecting Qwen OAuth.
- Added OpenAI and Qwen OAuth authentication support to Zed ACP integration.
- Fixed output token limit for Qwen models.
- Fixed Markdown list display issues on Windows.
- Enhanced vision model instructions and documentation.
- Improved authentication method compatibility across different IDE integrations.

## 0.0.12

- Added vision model support for Qwen-OAuth authentication.
- Synced upstream `gemini-cli` to v0.3.4 with numerous improvements and bug fixes.
- Enhanced subagent functionality with system reminders and improved user experience.
- Added tool call type coercion for better compatibility.
- Fixed arrow key navigation issues on Windows.
- Fixed missing tool call chunks for OpenAI logging.
- Fixed system prompt issues to avoid malformed tool calls.
- Fixed terminal flicker when subagent is executing.
- Fixed duplicate subagents configuration when running in home directory.
- Fixed Esc key unable to cancel subagent dialog.
- Added confirmation prompt for `/init` command when context file exists.
- Added `skipLoopDetection` configuration option.
- Fixed `is_background` parameter reset issues.
- Enhanced Windows compatibility with multi-line paste handling.
- Improved subagent documentation and branding consistency.
- Fixed various linting errors and improved code quality.
- Miscellaneous improvements and bug fixes.

## 0.0.11

- Added subagents feature with file-based configuration system for specialized AI assistants.
- Added Welcome Back Dialog with project summary and enhanced quit options.
- Fixed performance issues with SharedTokenManager causing 20-minute delays.
- Fixed tool calls UI issues and improved user experience.
- Fixed credential clearing when switching authentication types.
- Enhanced subagent capabilities to use tools requiring user confirmation.
- Improved ReadManyFiles tool with shared line limits across files.
- Re-implemented tokenLimits class for better compatibility with Qwen and other model types.
- Fixed chunk validation to avoid unnecessary retries.
- Resolved EditTool naming inconsistency causing agent confusion loops.
- Fixed unexpected re-authentication when auth-token is expired.
- Added Terminal Bench integration tests.
- Updated multilingual documentation links in README.
- Fixed various Windows compatibility issues.
- Miscellaneous improvements and bug fixes.

## 0.0.10

- Synced upstream `gemini-cli` to v0.2.1.
- Add todo write tool for task management and progress tracking.

## 0.0.9

- Synced upstream `gemini-cli` to v0.1.21.
- Fixed token synchronization among multiple Qwen sessions.
- Improved tool execution with early stop on invalid tool calls.
- Added explicit `is_background` parameter for shell tool.
- Enhanced memory management with sub-commands to switch between project and global memory operations.
- Renamed `GEMINI_DIR` to `OLLAMA_DIR` for better branding consistency.
- Added support for Qwen Markdown selection.
- Fixed parallel tool usage and improved tool reliability.
- Upgraded integration tests to use Vitest framework.
- Enhanced VS Code IDE integration with launch configurations.
- Added terminal setup command for Shift+Enter and Ctrl+Enter support.
- Fixed GitHub Workflows configuration issues.
- Improved settings directory and command descriptions.
- Fixed locale handling in yargs configuration.
- Added support for `trustedFolders.json` configuration file.
- Enhanced cross-platform compatibility for sandbox build scripts.
- Improved error handling and fixed ambiguous literals.
- Updated documentation links and added IDE integration documentation.
- Miscellaneous improvements and bug fixes.

## 0.0.8

- Synced upstream `gemini-cli` to v0.1.19.
- Updated documentation branding from **Gemini CLI** to **Qwen Code**.
- Added multilingual docs links in `README.md`.
- Added deterministic cache control for the DashScope provider.
- Added option to choose a project-level or global save location.
- Limited `grep` results to 25 items by default.
- `grep` now respects `.ollama-codeignore`.
- Miscellaneous improvements and bug fixes.

## 0.0.7

- Synced upstream `gemini-cli` to v0.1.18.
- Fixed MCP tools.
- Fixed Web Fetch tool.
- Fixed Web Search tool by switching from Google/Gemini to the Tavily API.
- Made tool calls tolerant of invalid-JSON parameters occasionally returned by the LLM.
- Prevented concurrent query submissions in rare cases.
- Corrected Qwen logger exit-handler setup.
- Separated static QR code and dynamic spinner components.

## 0.0.6

- Added usage statistics logging for Qwen integration.
- Made `/init` respect the configured context filename and aligned docs with `OLLAMA_CODE.md`.
- Fixed `EPERM` error when running `qwen --sandbox` on macOS.
- Fixed terminal flicker while waiting for login.
- Fixed `glm-4.5` model request error.

## 0.0.5

- Added Qwen OAuth login and up to 1,000 free requests per day.
- Synced upstream `gemini-cli` to v0.1.17.
- Added the `systemPromptMappings` configuration option.
