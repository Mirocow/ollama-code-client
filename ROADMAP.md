# Ollama Code — Roadmap развития

> Профессиональный анализ архитектуры и план развития проекта

## Текущее состояние (v0.16.7)

### ✅ Завершено: Миграция инструментов в plugins

**Статус:** ✅ 100% завершено

Все инструменты перенесены из `tools/` в `plugins/builtin/`:

| Категория | Инструменты | Статус |
|----------|-------------|--------|
| **file-tools** | read-file, write-file, edit, ls, glob, read-many-files | ✅ Перенесено |
| **search-tools** | grep, ripGrep, web-fetch, web-search | ✅ Перенесено |
| **shell-tools** | shell | ✅ Перенесено |
| **dev-tools** | python, nodejs, golang, rust, typescript, java, cpp, swift, php | ✅ Перенесено |
| **agent-tools** | skill, task | ✅ Перенесено |
| **productivity-tools** | todoWrite, exitPlanMode | ✅ Перенесено |
| **memory-tools** | save-memory | ✅ Перенесено |
| **lsp-tools** | lsp | ✅ Перенесено |
| **mcp-tools** | mcp-client, mcp-tool, mcp-client-manager, sdk-control-client-transport | ✅ Перенесено |
| **database-tools** | database, redis, docker | ✅ Перенесено |
| **git-tools** | git-advanced | ✅ Перенесено |
| **api-tools** | api-tester | ✅ Перенесено |
| **utility-tools** | code-analyzer, diagram-generator | ✅ Перенесено |

**Выполненные задачи:**

1. ✅ Исправить импорты в перенесенных файлах
2. ✅ Добавить `default` exports в plugin index files
3. ✅ Обновить `pluginRegistry.ts` для работы с `DeclarativeTool` классами
4. ✅ Исправить web-search provider imports
5. ✅ Протестировать сборку
6. ✅ Добавить explicit type annotations для TypeScript strict mode

**Базовые классы остаются в tools/:**
- tools.ts (BaseDeclarativeTool, BaseToolInvocation)
- tool-error.ts
- tool-registry.ts
- tool-names.ts
- modifiable-tool.ts
- diffOptions.ts
- *.test.ts (тесты остаются в tools/, тестируют plugins/builtin/)

### ⚠️ Откаченные изменения (v0.16.2)

**Статус:** ⚠️ Откачено

Попытка миграции всех инструментов в систему плагинов вызвала критические ошибки:

| Проблема | Описание |
|----------|----------|
| Удаление файлов | Инструменты были удалены из `tools/` без правильного переноса |
| Неправильные импорты | Плагины использовали относительные пути `../` вместо `../../../` |
| MCP инструменты | MCP файлы были перемещены некорректно |
| Сборка сломана | 330+ ошибок компиляции TypeScript |

**Решение:** Откат к стабильной версии c7441536 (v0.16.2)

**Уроки:**
1. Инструменты в `tools/` должны оставаться там, плагины только реэкспортируют их
2. MCP инструменты должны оставаться в `tools/` - это special case
3. Любая миграция требует полного прохождения тестов

#### 1. Plugin System v3 — Полная интеграция инструментов

**Статус:** ✅ Реализовано

Все основные инструменты перенесены в систему плагинов:

| Плагин | Инструменты | Статус |
|--------|-------------|--------|
| **core-tools** | echo, timestamp, get_env | ✅ |
| **dev-tools** | python_dev, nodejs_dev, golang_dev, rust_dev, typescript_dev, java_dev, cpp_dev, swift_dev, php_dev | ✅ |
| **file-tools** | read_file, write_file, edit, list_directory, glob, read_many_files | ✅ |
| **search-tools** | grep, web_search, web_fetch | ✅ |
| **shell-tools** | run_shell_command, bash | ✅ |
| **database-tools** | redis, database | ✅ |
| **docker-tools** | docker (build, run, logs, stop, etc.) | ✅ |
| **code-analysis-tools** | code_analyzer, diagram_generator, api_tester | ✅ |
| **git-tools** | git_advanced (stash, cherry-pick, rebase, bisect) | ✅ |
| **mcp-tools** | mcp_client, mcp_tool, mcp_client_manager | ✅ |
| **memory-tools** | save_memory, recall_memory | ✅ |
| **skill-tools** | skill (load, execute, manage) | ✅ |
| **task-tools** | task (subagents, parallel execution) | ✅ |
| **lsp-tools** | lsp, lsp_diagnostics | ✅ NEW |
| **plan-tools** | exit_plan_mode, todo_write, workflow_status | ✅ NEW |

**Всего плагинов:** 15
**Всего инструментов:** 45+

#### 1.1. Bug Fixes & Improvements

**Статус:** ✅ Исправлено

| Проблема | Решение | Файл |
|----------|---------|------|
| `{{root}}` template not resolved | Добавлена поддержка шаблона `{{root}}` в `resolvePath()` | `packages/core/src/utils/paths.ts` |
| Plugin imports broken | Исправлены импорты в search-tools, file-tools, dev-tools | `packages/core/src/plugins/builtin/*/` |

```typescript
// До: {{root}} передавался буквально
Grep {"pattern":"class Model","path":"{{root}}/src"}
// → Path does not exist: .../{{root}}/src

// После: {{root}} резолвится в рабочую директорию
// → /home/user/project/src
```

#### 1.2. Plugin Restructuring (In Progress)

**Статус:** 🔄 В процессе

Реструктуризация плагинов - каждый инструмент в своей папке:

| Плагин | Статус импортов |
|--------|-----------------|
| **search-tools** | ✅ Исправлено (grep, ripGrep, web-fetch) |
| **file-tools** | ✅ Исправлено (read-file, write-file, edit, ls, glob, read-many-files) |
| **dev-tools** | ✅ Исправлено (python, nodejs, golang, rust, typescript, java, cpp, swift, php) |
| **shell-tools** | ⏳ Ожидает |
| **database-tools** | ⏳ Ожидает |
| **mcp-tools** | ⏳ Ожидает |
| **memory-tools** | ⏳ Ожидает |
| **skill-tools** | ⏳ Ожидает |
| **task-tools** | ⏳ Ожидает |
| **lsp-tools** | ⏳ Ожидает |
| **plan-tools** | ⏳ Ожидает |

**Проблема:** Инструменты в `/plugins/builtin/*/` имеют неправильные относительные импорты.

**Решение:** Обновить все импорты с `../utils/` на `../../../../utils/` и т.д.

**Пример исправления:**
```typescript
// Было (неправильно):
import { BaseDeclarativeTool } from './tools.js';
import { Config } from '../config/config.js';

// Стало (правильно):
import { BaseDeclarativeTool } from '../../../../tools/tools.js';
import { Config } from '../../../../config/config.js';
```

#### 2. Context Caching — KV-cache Reuse

**Статус:** ✅ Реализовано

```typescript
// До: каждый запрос отправлял ВСЮ историю
// После: используется кэшированный context от Ollama

const client = new OllamaContextClient();

// Первое сообщение - полный процессинг
await client.generate({
  model: 'llama3.2',
  sessionId: 'chat-1',
  prompt: 'Привет!',
  system: 'Ты помощник.',
});
// → context: [1, 45, 789, ...] сохраняется

// Второе сообщение - ИСПОЛЬЗУЕТ КЭШ (быстро!)
await client.generate({
  model: 'llama3.2',
  sessionId: 'chat-1',
  prompt: 'Сколько будет 2+2?',
});
// → только новые токены обрабатываются!
```

**Производительность:**

- 1-е сообщение: 100% (baseline)
- 2-е сообщение: ~10-20% токенов
- 10-е сообщение: ~5-10% токенов

**Файлы:**

- `packages/core/src/cache/contextCacheManager.ts`
- `packages/core/src/core/ollamaContextClient.ts`
- `packages/core/src/core/hybridContentGenerator.ts`

#### 3. Zustand Migration

**Статус:** ✅ Реализовано

Заменен Context API на Zustand для оптимизации re-render'ов:

```typescript
// До: Context API - все компоненты re-render'ятся
const state = useContext(UIStateContext);

// После: Zustand - только нужные подписки
const tokenCount = useSessionStore((state) => state.lastPromptTokenCount);
```

**Stores:**

- `sessionStore` — сессия и метрики
- `streamingStore` — состояние стриминга + AbortController
- `uiStore` — UI настройки с persistence
- `commandStore` — Command Pattern для Undo/Redo
- `eventBus` — Event Bus для слабой связности

#### 4. Event Bus

**Статус:** ✅ Реализовано

Типизированный Event Bus для слабой связности:

```typescript
// Подписка на события
eventBus.subscribe('stream:finished', (data) => {
  console.log('Tokens used:', data.tokenCount);
});

// Эмиссия событий
eventBus.emit('stream:finished', { promptId: '123', tokenCount: 1500 });
```

**Поддерживаемые события:**

- `stream:started/chunk/finished/error/cancelled`
- `tool:started/progress/completed/error`
- `session:started/ended/cleared`
- `command:executed/undone/redone`
- `plugin:loaded/unloaded/error`

#### 5. Command Pattern (Undo/Redo)

**Статус:** ✅ Реализовано

```typescript
// Выполнение команды с возможностью отмены
await commandStore.execute({
  description: 'Change theme',
  type: 'theme',
  execute: async () => {
    /* ... */
  },
  undo: async () => {
    /* reverse action */
  },
  canUndo: true,
});

// Отмена последней команды
await commandStore.undo();

// Повтор отмененной команды
await commandStore.redo();
```

#### 6. Axios HTTP Client

**Статус:** ✅ Реализовано

Миграция с fetch на axios для улучшенной обработки HTTP:

```typescript
// Axios instance с interceptors
const httpClient = axios.create({
  timeout: 30000,
  baseURL: ollamaBaseUrl,
});

// Retry logic
axios -
  retry(httpClient, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
  });

// Interceptors для логирования и аутентификации
httpClient.interceptors.request.use(loggingInterceptor);
httpClient.interceptors.response.use(responseInterceptor, errorInterceptor);
```

#### 7. React Performance Optimization

**Статус:** ✅ Реализовано

**Специализированные контексты:**

- `DialogStateContext` — управление состоянием диалогов
- `TerminalContext` — размеры терминала и layout
- `InputStateContext` — состояние ввода
- `HistoryContext` — история сообщений
- `LoadingContext` — состояние загрузки
- `ConfirmationContext` — запросы подтверждений

**Мемоизированные компоненты:**

- `Footer` — статус бар
- `AppHeader` — заголовок приложения
- `MainContent` — основная область контента
- `HistoryItemDisplay` — рендеринг элементов истории
- `Composer` — область ввода
- `LoadingIndicator` — индикатор загрузки
- `ToolGroupMessage` — группа инструментов

---

## Архитектурный обзор

```
┌─────────────────────────────────────────────────────────────┐
│                    Ollama Code Architecture                  │
├─────────────────────────────────────────────────────────────┤
│  packages/cli         │ Ink (React) + Terminal UI           │
│  packages/core        │ Business Logic + Tools + Ollama API │
│  packages/webui       │ React Components (Storybook)        │
│  packages/web-app     │ Next.js Web UI                      │
│  packages/sdk-typescript │ TypeScript SDK for integrations  │
└─────────────────────────────────────────────────────────────┘
```

### Технологический стек

| Слой             | Технологии                           | Оценка                |
| ---------------- | ------------------------------------ | --------------------- |
| UI Layer         | Ink (React 18), React Hooks          | ✅ Современно         |
| State Management | Zustand + Event Bus                  | ✅ Оптимизировано     |
| API Client       | Axios (interceptors, retry, timeout) | ✅ Миграция завершена |
| Tools System     | Plugin System v3 + DeclarativeTool   | ✅ Полная интеграция  |
| Testing          | Vitest, MSW                          | ✅ Покрытие 80%+      |
| Build            | esbuild, TypeScript 5.x              | ✅ Быстро             |

### Структура плагинов

```
packages/core/src/plugins/builtin/
├── code-analysis-tools/         # Анализ кода
│   ├── code-analyzer/index.ts
│   └── diagram-generator/index.ts
├── core-tools/                  # Базовые инструменты
├── database-tools/              # Работа с БД
│   ├── database/index.ts
│   └── redis/index.ts
├── dev-tools/                   # Языковые инструменты
│   ├── python/index.ts
│   ├── nodejs/index.ts
│   ├── golang/index.ts
│   ├── rust/index.ts
│   ├── java/index.ts
│   ├── cpp/index.ts
│   ├── swift/index.ts
│   ├── typescript/index.ts
│   └── php/index.ts
├── docker-tools/               # Docker
│   └── docker/index.ts
├── file-tools/                 # Работа с файлами
│   ├── read-file/index.ts
│   ├── write-file/index.ts
│   ├── edit/index.ts
│   ├── ls/index.ts
│   ├── glob/index.ts
│   └── read-many-files/index.ts
├── git-tools/                  # Git операции
│   └── git-advanced/index.ts
├── lsp-tools/                  # LSP интеграция
│   └── lsp/index.ts
├── mcp-tools/                  # MCP протокол
│   ├── mcp-client/index.ts
│   ├── mcp-tool/index.ts
│   ├── mcp-client-manager/index.ts
│   └── sdk-control-client-transport/index.ts
├── memory-tools/               # Память
│   └── memory/index.ts
├── plan-tools/                 # Планирование
│   ├── exitPlanMode/index.ts
│   └── todoWrite/index.ts
├── search-tools/               # Поиск
│   ├── grep/index.ts
│   ├── ripGrep/index.ts
│   └── web-fetch/index.ts
├── shell-tools/                # Shell команды
│   └── shell/index.ts
├── skill-tools/                # Навыки
│   └── skill/index.ts
└── task-tools/                 # Задачи
    ├── task/index.ts
    └── todoWrite/index.ts
```

---

## Roadmap по версиям

### v0.11.0 — Performance & Developer Experience ✅

**Цель:** Улучшение производительности и DX

| Задача                      | Приоритет | Оценка | Статус       |
| --------------------------- | --------- | ------ | ------------ |
| Миграция на Zustand         | P0        | 5d     | ✅ Завершено |
| Event Bus                   | P0        | 3d     | ✅ Завершено |
| Command Pattern (Undo/Redo) | P0        | 4d     | ✅ Завершено |
| Plugin System               | P0        | 5d     | ✅ Завершено |
| Context Caching             | P0        | 4d     | ✅ Завершено |
| Prompt System Docs          | P1        | 2d     | ✅ Завершено |

---

### v0.12.0 — HTTP Client & API Improvements ✅

**Цель:** Замена fetch на axios, улучшение API

| Задача                        | Приоритет | Оценка | Статус       |
| ----------------------------- | --------- | ------ | ------------ |
| Замена fetch на axios         | P0        | 3d     | ✅ Завершено |
| Request/Response interceptors | P1        | 2d     | ✅ Завершено |
| Retry logic                   | P1        | 1d     | ✅ Завершено |
| Request timeout handling      | P2        | 1d     | ✅ Завершено |

---

### v0.13.0 — Plugin System v2 ✅

**Цель:** Динамическая загрузка плагинов

| Задача                       | Приоритет | Оценка | Статус       |
| ---------------------------- | --------- | ------ | ------------ |
| PluginLoader для обнаружения | P0        | 3d     | ✅ Завершено |
| Dynamic plugin loading       | P0        | 4d     | ✅ Завершено |
| Plugin CLI команды           | P1        | 2d     | ✅ Завершено |
| Security sandbox             | P1        | 3d     | ✅ Завершено |
| Plugin marketplace           | P2        | 5d     | ✅ Завершено |

---

### v0.14.0 — Memory & Performance ✅

**Цель:** Исправление memory leaks, оптимизация

| Задача                   | Приоритет | Оценка | Статус       |
| ------------------------ | --------- | ------ | ------------ |
| Memory leaks в streaming | P0        | 3d     | ✅ Завершено |
| AbortController cleanup  | P0        | 2d     | ✅ Завершено |
| React мемоизация         | P1        | 3d     | ✅ Завершено |
| Virtual scrolling        | P2        | 3d     | 🔴 Не начато |
| Token counting fallback  | P1        | 1d     | ✅ Завершено |

---

### v0.15.0 — Web UI ✅

**Цель:** Полноценный веб-интерфейс

| Задача                       | Приоритет | Оценка | Статус       |
| ---------------------------- | --------- | ------ | ------------ |
| Next.js App Router setup     | P0        | 3d     | ✅ Завершено |
| Chat interface component     | P0        | 4d     | ✅ Завершено |
| File explorer integration    | P1        | 3d     | ✅ Завершено |
| Terminal emulator (xterm.js) | P1        | 4d     | ✅ Завершено |
| WebSocket streaming          | P0        | 3d     | ✅ Завершено |

---

### v0.16.0 — Plugin System v3 ✅

**Цель:** Полная интеграция всех инструментов в плагины

| Задача                          | Приоритет | Оценка | Статус       |
| ------------------------------- | --------- | ------ | ------------ |
| Интеграция dev-tools            | P0        | 3d     | ✅ Завершено |
| Интеграция file-tools           | P0        | 2d     | ✅ Завершено |
| Интеграция search-tools         | P0        | 2d     | ✅ Завершено |
| Создание lsp-tools плагина      | P1        | 2d     | ✅ Завершено |
| Создание plan-tools плагина     | P1        | 2d     | ✅ Завершено |
| Документация плагинов           | P1        | 3d     | ✅ Завершено |

---

### v0.16.2 — Bug Fixes & UX Improvements ✅

**Цель:** Исправление ошибок и улучшение UX

| Задача                                    | Приоритет | Оценка | Статус       |
| ----------------------------------------- | --------- | ------ | ------------ |
| PCRE2 поддержка для look-around regex     | P0        | 2h     | ✅ Завершено |
| Языковое правило в CRITICAL секцию        | P0        | 1h     | ✅ Завершено |
| Алиас init для dev-tools                  | P0        | 2h     | ✅ Завершено |
| Общие алиасы для dev-tools (r, b, t, ...) | P1        | 2h     | ✅ Завершено |
| Тесты для новых функционалов              | P1        | 3h     | ✅ Завершено |
| Обновление CHANGELOG                      | P2        | 1h     | ✅ Завершено |

**Детали задач:**

#### 1. PCRE2 поддержка для look-around regex
**Проблема:** ripgrep не поддерживает look-ahead/look-behind без флага `--pcre2`
```
rg: regex parse error:
    (?=.*\bfactory\b)(?=.*\bmodel\b)
       ^^^
error: look-around is not supported
```
**Решение:** Автоматически добавлять `--pcre2` при обнаружении look-around паттернов

**Файлы:**
- `packages/core/src/plugins/builtin/search-tools/ripGrep/index.ts`
- `packages/core/src/utils/ripgrepUtils.ts`

#### 2. Языковое правило в CRITICAL секцию
**Проблема:** Модель переключается на английский после tool error
**Решение:** Добавить правило языка в секцию `[CRITICAL]`

**Файлы:**
- `packages/core/src/prompts/templates/system-8b.md`
- `packages/core/src/prompts/templates/system-14b.md`
- `packages/core/src/prompts/templates/system-32b.md`
- `packages/core/src/prompts/templates/system-70b.md`

#### 3. Алиас init для dev-tools
**Проблема:** Модель использует интуитивное `init` вместо `mod_init`, `venv_create`, etc.
```
GolangDev {"action":"init"} → Error: action must be one of allowed values
```
**Решение:** Добавить алиасы:

| Инструмент | init → | new → |
|------------|--------|-------|
| golang_dev | mod_init | - |
| python_dev | venv_create | - |
| rust_dev | cargo_init | cargo_new |
| swift_dev | package_init | - |

**Файлы:**
- `packages/core/src/plugins/builtin/dev-tools/*/index.ts`

#### 4. Общие алиасы для dev-tools
**Решение:** Добавить короткие алиасы для частых действий:

| Алиас | Действие | Описание |
|-------|----------|----------|
| r | run | Запуск |
| b | build | Сборка |
| t | test | Тесты |
| l | lint | Линтер |
| fmt | format | Форматирование |
| v | version | Версия |
| i | install | Установка |
| c | clean | Очистка |

---

### v0.17.0 — Enterprise Features

**Цель:** Enterprise-ready функции

| Задача                      | Приоритет | Оценка | Статус       |
| --------------------------- | --------- | ------ | ------------ |
| Authentication system       | P0        | 5d     | 🔴 Не начато |
| Role-based access control   | P0        | 4d     | 🔴 Не начато |
| Audit logging               | P1        | 3d     | 🔴 Не начато |
| Multi-tenant support        | P1        | 5d     | 🔴 Не начато |
| SSO integration             | P2        | 4d     | 🔴 Не начато |

---

### v1.0.0 — Production Ready

**Цель:** Готовность к продакшену

| Задача                     | Приоритет | Оценка | Статус       |
| -------------------------- | --------- | ------ | ------------ |
| Security audit             | P0        | 5d     | 🔴 Не начато |
| Performance benchmarks     | P0        | 3d     | 🔴 Не начато |
| Documentation v2           | P0        | 5d     | 🔴 Не начато |
| CI/CD pipeline             | P0        | 3d     | 🔴 Не начато |
| Monitoring (OpenTelemetry) | P1        | 4d     | 🔴 Не начато |

---

## Сравнение с конкурентами

| Функция          | Ollama Code    | Claude Code | Aider       | Cursor      |
| ---------------- | -------------- | ----------- | ----------- | ----------- |
| Локальные модели | ✅             | ❌          | ✅          | ❌          |
| Open Source      | ✅             | ❌          | ✅          | ❌          |
| CLI интерфейс    | ✅             | ✅          | ✅          | ❌          |
| Web UI           | ✅             | ✅          | ❌          | ✅          |
| Plugin System    | ✅ v3 (15 плагинов) | ✅          | ✅          | ✅          |
| IDE Integration  | ✅ VSCode      | ✅ VSCode   | ✅ Multi    | ✅ Built-in |
| MCP Support      | ✅             | ✅          | ❌          | ❌          |
| Context Caching  | ✅             | ✅          | ⚠️ Частично | ✅          |
| Undo/Redo        | ✅             | ✅          | ❌          | ✅          |
| LSP Integration  | ✅             | ✅          | ⚠️ Частично | ✅          |

---

## Приоритеты развития

### Q1 2025 ✅

1. **Performance** — Zustand миграция ✅
2. **Plugin System** — Динамические инструменты ✅
3. **Context Caching** — KV-cache reuse ✅

### Q2 2025 ✅

1. **HTTP Client** — Axios migration ✅
2. **Plugin Loader** — Динамическая загрузка ✅
3. **Memory** — Исправление leaks ✅

### Q3 2025 (Текущий)

1. **Plugin System v3** — Полная интеграция инструментов ✅
2. **Web UI** — Next.js приложение ✅
3. **LSP Tools** — Интеграция с языковыми серверами ✅

### Q4 2025

1. **v1.0.0** — Production release
2. **Enterprise** — Authentication, RBAC
3. **Documentation** — Полная документация

---

## Технический долг

### Высокий приоритет

| Область        | Проблема                | Решение           | Статус |
| -------------- | ----------------------- | ----------------- | ------ |
| Memory leaks   | AbortController cleanup | Cleanup handlers  | ✅     |
| Token counting | Fallback для прогресса  | Estimate fallback | ✅     |
| Plugin docs    | Не все плагины задокументированы | TSDoc | ✅ |

### Средний приоритет

| Область       | Проблема                     | Решение            | Оценка |
| ------------- | ---------------------------- | ------------------ | ------ |
| Logging       | Несогласованный формат       | Structured logging | 2d     |
| Config        | Много источников             | Единый schema      | 3d     |
| Tests         | Покрытие плагинов            | Unit tests         | 3d     |

---

## Метрики успеха

| Метрика           | Текущее | Цель v1.0 |
| ----------------- | ------- | --------- |
| Test Coverage     | 80%     | 90%       |
| Bundle Size (CLI) | ~5MB    | <3MB      |
| Startup Time      | ~2s     | <1s       |
| Memory Usage      | ~200MB  | <100MB    |
| Response Latency  | ~100ms  | <50ms     |
| Plugins          | 15      | 20+       |
| Tools            | 45+     | 60+       |
| GitHub Stars      | 500+    | 5000+     |
| Contributors      | 10+     | 100+      |

---

## Заключение

Ollama Code v0.16.0 включает ключевые архитектурные улучшения:

1. **Zustand** — Оптимизация React-рендеринга ✅
2. **Event Bus** — Слабая связность компонентов ✅
3. **Command Pattern** — Undo/Redo для операций ✅
4. **Plugin System v3** — 15 плагинов, 45+ инструментов ✅
5. **Context Caching** — KV-cache reuse для производительности ✅
6. **Axios HTTP Client** — Interceptors, retry, timeout ✅
7. **React Мемоизация** — Специализированные контексты + memo ✅
8. **Security Sandbox** — Изоляция плагинов с уровнями доверия ✅
9. **Plugin Marketplace** — Поиск, установка, обновление плагинов ✅
10. **Web UI** — Next.js приложение с чатом, файлами, терминалом ✅
11. **LSP Integration** — Поддержка языковых серверов ✅

Следующие шаги — Enterprise Features (v0.17.0) и Production Ready (v1.0.0).

---

*Document version: 4.0.0*
*Last updated: 2025-03*
*Author: Architecture Team*
*Created with GLM-5 from Z.AI*
