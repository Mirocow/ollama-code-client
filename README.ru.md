<p align="center">
  <img src="./assets/logo.svg" alt="Ollama Code Logo" width="256" height="256">
</p>

<h1 align="center">Ollama Code</h1>

<p align="center">
  <strong>AI-ассистент для программирования с локальными моделями</strong>
</p>

<p align="center">
  <img src="./assets/interface-context-bar.png" alt="Interface Preview" width="800">
</p>

<p align="center">
  <a href="./README.md">English Version</a> •
  <a href="./docs/FEATURES.ru.md">Функции</a> •
  <a href="./docs/instruments.ru.md">Инструменты</a> •
  <a href="./docs/TOOLS.ru.md">Справочник</a>
</p>

---

**Ollama Code** — это CLI-инструмент для работы с AI-ассистентом по программированию, использующий локальные модели Ollama. Проект предоставляет полный контроль над кодом и данными, работая полностью офлайн.

## Возможности

- 🚀 **Полностью локальная работа** — все модели запускаются локально через Ollama
- 💾 **Context Caching** — KV-cache reuse для 80-90% более быстрых диалогов
- 💻 **CLI-интерфейс** — удобный терминальный интерфейс на базе Ink (React for CLI)
- 🌐 **Web UI** — полнофункциональный Next.js веб-интерфейс с чатом, файловым менеджером, терминалом
- 🔧 **Инструменты для кода** — чтение, редактирование, поиск файлов, выполнение команд
- 🔌 **MCP поддержка** — интеграция с Model Context Protocol серверами
- 🌐 **Веб-поиск** — интеграция с Tavily и Google Custom Search
- 📦 **Расширения** — система расширений для добавления новых возможностей
- 🐛 **Отладка** — встроенная поддержка отладки через VSCode
- 🧠 **Thinking Models** — поддержка моделей с рассуждениями (DeepSeek R1)
- 📊 **Code Analysis** — анализ качества кода с оценкой A-F
- 🎨 **Diagram Generator** — создание Mermaid и PlantUML диаграмм
- 🔀 **Git Workflow** — полный git workflow (commit, push, pull, создание MR/PR)
- 🔀 **Git Advanced** — продвинутые git операции (stash, cherry-pick, rebase, bisect)
- 🌐 **API Tester** — тестирование REST API endpoints
- 🔐 **SSH Tools** — подключение к удалённым серверам с управлением профилями
- 🏷️ **Алиасы инструментов** — короткие имена для инструментов (`run` → `run_shell_command`)
- 🧠 **Самообучение** — автоматическое обучение правильным именам инструментов
- 🔄 **Undo/Redo** — обратимые операции с command pattern
- 🔌 **Plugin System** — динамическая загрузка инструментов

## Требования

- **Node.js** 20.x или 22.x LTS (Node.js 23+ / 24+ / 25+ НЕ поддерживается из-за проблем компиляции node-pty)
- **pnpm** >= 10.0.0
- **Ollama** установленный и запущенный (https://ollama.ai)

### Совместимость Node.js с node-pty

| Версия Node.js | Статус            | Совместимость с node-pty |
| -------------- | ----------------- | ------------------------ |
| 18.x           | LTS (Maintenance) | ✅ Работает              |
| 20.x           | LTS (Current)     | ✅ Работает              |
| 22.x           | LTS (Latest)      | ✅ Работает              |
| 23.x           | Current           | ⚠️ Может работать        |
| 24.x           | Nightly           | ❌ Не работает           |
| 25.x           | Experimental      | ❌ **Не работает**       |

> ⚠️ **Важно**: Node.js 23+ не поддерживается. Нативный модуль `node-pty` требует Node.js 20.x или 22.x LTS. Если у вас Node.js 23+, переключитесь:
>
> ```bash
> # Используя asdf
> asdf install nodejs 22.14.0
> asdf local nodejs 22.14.0
> ```

## Требования к GPU для моделей

Различные модели требуют разное количество видеопамяти. Ниже приведено руководство для NVIDIA GPU:

### Минимальные требования к GPU по размеру модели

| Размер модели | Мин. VRAM | Рекомендуемый GPU               | Примечания                                |
| ------------- | --------- | ------------------------------- | ----------------------------------------- |
| 3B            | 4 ГБ      | RTX 3050, GTX 1660, RTX 5060    | Базовые модели, рекомендуется квантизация |
| 7B            | 6 ГБ      | RTX 3060, RTX 4060, RTX 5060    | Хорошее соотношение скорости и качества   |
| 8B            | 8 ГБ      | RTX 3070, RTX 4060 Ti, RTX 5070 | DeepSeek R1, Llama 3.1                    |
| 14B           | 12 ГБ     | RTX 3080, RTX 4070, RTX 5070 Ti | Qwen2.5-Coder 14B                         |
| 30B           | 20 ГБ     | RTX 3090, RTX 4090, RTX 5080    | Qwen3-Coder 30B                           |
| 70B           | 32 ГБ     | RTX 5090, 2x RTX 3090           | DeepSeek R1 70B, Llama 3.1 70B            |
| 120B+         | 48+ ГБ    | 2x RTX 5090, A100               | Требует несколько GPU или облако          |

### Результаты тестирования производительности моделей

Тесты производительности проведены со стандартными задачами (генерация кода, рефакторинг, отладка):

| GPU         | VRAM  | Модель            | Квантизация | Скорость (tok/s) | Оценка качества |
| ----------- | ----- | ----------------- | ----------- | ---------------- | --------------- |
| RTX 3060    | 12 ГБ | llama3.2:3b       | Q4_K_M      | 45-55            | Хорошо          |
| RTX 3060    | 12 ГБ | qwen2.5-coder:7b  | Q4_K_M      | 28-35            | Очень хорошо    |
| RTX 3060    | 12 ГБ | deepseek-r1:8b    | Q4_K_M      | 22-28            | Отлично         |
| RTX 3060    | 12 ГБ | qwen2.5-coder:14b | Q3_K_M      | 12-18            | Отлично         |
| RTX 3070    | 8 ГБ  | llama3.2:3b       | Q4_K_M      | 55-65            | Хорошо          |
| RTX 3070    | 8 ГБ  | qwen2.5-coder:7b  | Q4_K_M      | 35-42            | Очень хорошо    |
| RTX 3070    | 8 ГБ  | deepseek-r1:8b    | Q4_K_M      | 28-35            | Отлично         |
| RTX 3080    | 10 ГБ | qwen2.5-coder:7b  | Q8_0        | 40-48            | Отлично         |
| RTX 3080    | 10 ГБ | qwen2.5-coder:14b | Q4_K_M      | 25-32            | Отлично         |
| RTX 3080    | 10 ГБ | deepseek-r1:8b    | Q8_0        | 32-40            | Отлично         |
| RTX 3090    | 24 ГБ | qwen2.5-coder:14b | Q8_0        | 38-45            | Отлично         |
| RTX 3090    | 24 ГБ | qwen3-coder:30b   | Q4_K_M      | 18-25            | Превосходно     |
| RTX 3090    | 24 ГБ | deepseek-r1:32b   | Q4_K_M      | 12-18            | Превосходно     |
| RTX 4070    | 12 ГБ | qwen2.5-coder:14b | Q5_K_M      | 35-42            | Отлично         |
| RTX 4070 Ti | 16 ГБ | qwen3-coder:30b   | Q4_K_M      | 22-28            | Превосходно     |
| RTX 4080    | 16 ГБ | qwen3-coder:30b   | Q5_K_M      | 28-35            | Превосходно     |
| RTX 4080    | 16 ГБ | deepseek-r1:32b   | Q4_K_M      | 20-28            | Превосходно     |
| RTX 4090    | 24 ГБ | qwen3-coder:30b   | Q8_0        | 45-55            | Превосходно     |
| RTX 4090    | 24 ГБ | deepseek-r1:32b   | Q5_K_M      | 35-45            | Превосходно     |
| RTX 4090    | 24 ГБ | deepseek-r1:70b   | Q3_K_M      | 8-12             | Исключительно   |
| RTX 5070    | 12 ГБ | qwen2.5-coder:14b | Q6_K        | 45-55            | Отлично         |
| RTX 5070 Ti | 16 ГБ | qwen3-coder:30b   | Q5_K_M      | 35-45            | Превосходно     |
| RTX 5080    | 16 ГБ | qwen3-coder:30b   | Q6_K        | 45-55            | Превосходно     |
| RTX 5080    | 16 ГБ | deepseek-r1:32b   | Q5_K_M      | 38-48            | Превосходно     |
| RTX 5090    | 32 ГБ | qwen3-coder:30b   | FP16        | 80-100           | Исключительно   |
| RTX 5090    | 32 ГБ | deepseek-r1:70b   | Q4_K_M      | 25-35            | Исключительно   |
| RTX 5090    | 32 ГБ | llama3.1:70b      | Q5_K_M      | 30-40            | Исключительно   |

> **Примечание**: Скорость зависит от длины контекста, сложности промпта и конфигурации системы. Оценка качества субъективна и основана на точности генерации кода и связности. Серия RTX 50 показывает значительное улучшение производительности благодаря архитектуре Blackwell и памяти GDDR7.

### Руководство по квантизации

| Квантизация | Уменьшение размера | Потеря качества | Рекомендуется для             |
| ----------- | ------------------ | --------------- | ----------------------------- |
| Q4_K_M      | ~70%               | Минимальная     | Большинство задач             |
| Q5_K_M      | ~65%               | Очень низкая    | Лучшее качество               |
| Q6_K        | ~60%               | Незначительная  | Высокие требования к качеству |
| Q8_0        | ~50%               | Нет             | Максимальное качество         |
| FP16        | 0%                 | Нет             | RTX 5090 с 32 ГБ+ VRAM        |

## Быстрый старт

### Установка зависимостей

```bash
# Клонировать репозиторий
git clone <repository-url>
cd ollama-code

# Установить зависимости
npm install

# Собрать проект
npm run build
```

### Запуск

```bash
# Интерактивный режим
npm run start

# С указанием модели
npm run start -- --model llama3.2

# Одноразовый запрос
npm run start -- "Объясни, как работает async/await в JavaScript"

# Режим отладки
npm run debug
```

### Web UI

Ollama Code теперь включает полнофункциональный веб-интерфейс:

```bash
# Запуск Web UI (разработка)
cd packages/web-app
npm run dev

# Запуск с поддержкой терминала
npm run dev:server
```

**Возможности Web UI:**

| Вкладка      | Функции                                                |
| ------------ | ------------------------------------------------------ |
| **Chat**     | Streaming ответы, выбор модели, управление сессиями    |
| **Files**    | Файловый менеджер, Monaco editor, подсветка синтаксиса |
| **Terminal** | Полноценный PTY терминал на xterm.js                   |

**API Endpoints:**

| Endpoint        | Описание                        |
| --------------- | ------------------------------- |
| `/api/models`   | Список доступных моделей Ollama |
| `/api/chat`     | Чат со streaming                |
| `/api/generate` | Генерация со streaming          |
| `/api/fs`       | Операции с файловой системой    |
| `/terminal`     | WebSocket терминал              |

---

## Новые возможности v0.16.9

### Расширенные алиасы инструментов для галлюцинаций моделей

Добавлено 70+ новых алиасов инструментов для корректной обработки галлюцинаций моделей:

| Категория          | Новые алиасы                                                                      |
| ------------------ | --------------------------------------------------------------------------------- |
| **Docker**         | `docker`, `docker_dev`, `container`, `container_dev`, `docker_compose`, `compose` |
| **База данных**    | `database`, `db`, `sql`, `mysql`, `postgres`, `mongodb`, `redis`                  |
| **Kubernetes**     | `kubernetes`, `k8s`, `kubectl`, `helm`                                            |
| **CI/CD**          | `ci`, `cd`, `github_actions`, `gitlab_ci`, `jenkins`                              |
| **Инфраструктура** | `terraform`, `ansible`, `aws`, `azure`, `gcp`                                     |

### Улучшения поддержки IDE

- Добавлен TypeScript в workspace root для лучшей поддержки IDE
- Исправлена ошибка "Cannot find lib.es2023.d.ts" и связанные ошибки TypeScript
- Исправлены ошибки глобальных типов (Promise, Boolean и др.)

### Удалена зависимость от bun

- Заменили `bun` на `pnpm` для сборки assets
- `pnpm` уже требуется для поддержки monorepo workspace

---

## Новые возможности v0.16.8

### Обновление зависимостей до актуальных версий

Все основные зависимости обновлены до последних стабильных версий:

| Пакет                       | Новая версия |
| --------------------------- | ------------ |
| `zod`                       | 4.3.6        |
| `@modelcontextprotocol/sdk` | 1.27.1       |
| `ajv-formats`               | 3.0.1        |
| `msw`                       | 2.12.10      |

### Миграция на Zod v4

Выполнена миграция на Zod v4 для совместимости с последним MCP SDK:

| Изменение        | Описание                                           |
| ---------------- | -------------------------------------------------- |
| `z.record()`     | Теперь требует явные аргументы типа ключа/значения |
| `z.string()`     | Упрощённый параметр сообщения об ошибке            |
| `ZodObject`      | Упрощённые generic-параметры                       |
| Структура ошибок | Использует `.issues` вместо `.errors`              |

### Проверка сборки

- ✅ Компиляция TypeScript проходит успешно
- ✅ Сборка выполняется без ошибок
- ✅ Бандл создан успешно

---

## Новые возможности v0.16.7

### Миграция тестов — 100% завершено

Все тесты перенесены из `tools/` в `plugins/builtin/`:

| Категория      | Тесты                                                                |
| -------------- | -------------------------------------------------------------------- |
| dev-tools      | python, nodejs, golang, rust, java, cpp, swift, php, typescript      |
| file-tools     | edit, glob, ls, read-file, read-many-files, write-file               |
| search-tools   | grep, ripGrep, web-fetch                                             |
| database-tools | database, docker, redis                                              |
| mcp-tools      | mcp-client, mcp-tool, mcp-client-manager                             |
| Прочие         | skill, task, todoWrite, exitPlanMode, lsp, shell, git-advanced и др. |

### Строгий режим TypeScript

Исправлены все ошибки строгого режима TypeScript с явными аннотациями типов.

### Обновления зависимостей

- `zod` обновлён до 3.25.0 для совместимости с MCP SDK
- `ajv-formats` понижен до 2.1.1 для совместимости ESM

---

## Новые возможности v0.13.0

### Web UI — Полноценный Next.js интерфейс

Полнофункциональное веб-приложение с тремя основными компонентами:

| Компонент            | Технология          | Возможности                                           |
| -------------------- | ------------------- | ----------------------------------------------------- |
| **ChatInterface**    | React + Zustand     | Streaming, выбор модели, сохранение сессий            |
| **FileExplorer**     | Monaco Editor       | Подсветка синтаксиса, мультиязычность, автосохранение |
| **TerminalEmulator** | xterm.js + node-pty | Полная PTY поддержка, resize, 256 цветов              |

### TSDoc документация API

Комплексная документация API для всех пакетов:

```typescript
// Использование SDK
import { query, createSdkMcpServer, tool } from '@ollama-code/sdk';

const result = await query({
  prompt: 'Объясни async/await',
  model: 'llama3.2',
});

// MCP сервер
const myTool = tool({
  name: 'echo',
  description: 'Вернуть сообщение',
  parameters: { message: { type: 'string' } },
  execute: async (params) => ({ echo: params.message }),
});
```

### Технические улучшения

- **TypeScript конфигурация**: Исправлены project references для monorepo
- **HTTP клиент**: Завершена миграция fetch → axios
- **Terminal Server**: WebSocket-based PTY с управлением сессиями

---

## Новые возможности v0.11.0

### Архитектурные улучшения

Крупные улучшения архитектуры для лучшей производительности и расширяемости:

| Функция                   | Описание                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| **Миграция на Zustand**   | Заменил Context API, устраняет лишние ре-рендеры                     |
| **Event Bus**             | Типизированная система pub/sub для слабой связности                  |
| **Command Pattern**       | Полная поддержка Undo/Redo для обратимых операций                    |
| **Plugin System v1**      | Динамическая загрузка инструментов, builtin плагины, lifecycle hooks |
| **Context Caching**       | KV-cache reuse для 80-90% более быстрых диалогов                     |
| **Документация промптов** | Полная документация системы формирования промптов                    |

### Новые Stores

| Store            | Назначение                            |
| ---------------- | ------------------------------------- |
| `sessionStore`   | Состояние сессии и метрики            |
| `streamingStore` | Состояние стриминга + AbortController |
| `uiStore`        | UI настройки с персистентностью       |
| `commandStore`   | Command pattern для undo/redo         |
| `eventBus`       | Система событий pub/sub               |

### Plugin System

Динамическая архитектура плагинов с lifecycle hooks:

```typescript
const plugin: PluginDefinition = {
  metadata: { id: 'my-plugin', name: 'My Plugin', version: '1.0.0' },
  tools: [
    { id: 'hello', name: 'hello', execute: async () => ({ success: true }) },
  ],
  hooks: {
    onLoad: async (ctx) => ctx.logger.info('Загружен'),
    onBeforeToolExecute: async (id, params) => true,
  },
};
```

**Builtin Плагины:**

- `core-tools` — echo, timestamp, get_env
- `dev-tools` — python_dev, nodejs_dev, golang_dev, rust_dev, typescript_dev
- `file-tools` — read_file, write_file, edit_file
- `search-tools` — grep, glob, web_fetch
- `shell-tools` — run_shell_command

### Event Bus

Типизированные события для коммуникации между компонентами:

```typescript
// Подписка на события
eventBus.subscribe('stream:finished', (data) => {
  console.log('Токены:', data.tokenCount);
});

// Эмиссия событий
eventBus.emit('command:executed', { commandId: '123', type: 'edit' });
```

### Документация системы промптов

Новая комплексная документация в `docs/PROMPT_SYSTEM.md`:

- `getCoreSystemPrompt()` — построение основного системного промпта
- `getCompressionPrompt()` — сжатие истории в XML
- `getToolCallFormatInstructions()` — для моделей без нативных tools
- `getToolLearningContext()` — обучение на прошлых ошибках
- `getEnvironmentInfo()` — контекст runtime окружения

---

## Новые возможности v0.10.7

### Система самообучения для вызова инструментов

Система теперь автоматически обучается на ошибках вызова инструментов и создаёт динамические алиасы:

| Функция                     | Описание                                                             |
| --------------------------- | -------------------------------------------------------------------- |
| **Автоматическое обучение** | Записывает ошибки вызова инструментов и создаёт алиасы автоматически |
| **Нечёткое сопоставление**  | Использует расстояние Левенштейна для предложения правильных имён    |
| **Сохранение данных**       | Данные обучения сохраняются в `~/.ollama-code/learning/`             |
| **Динамические алиасы**     | Создание алиасов во время выполнения без изменения кода              |

**Как это работает:**

1. Модель вызывает несуществующий инструмент → Система записывает ошибку
2. Система использует нечёткое сопоставление для поиска похожего инструмента
3. После достижения порога → Создаётся динамический алиас
4. Будущие вызовы с неправильным именем → Перенаправляются на правильный инструмент

---

## Новые возможности v0.10.6

### Инструменты разработки

Добавлены три комплексных инструмента для разработки:

| Инструмент   | Алиасы                                  | Описание                                                     |
| ------------ | --------------------------------------- | ------------------------------------------------------------ |
| `python_dev` | `py`, `python`, `pip`, `pytest`         | Разработка на Python (run, test, lint, venv, pip)            |
| `nodejs_dev` | `node`, `npm`, `yarn`, `pnpm`, `bun`    | Разработка на Node.js с автоопределением пакетного менеджера |
| `golang_dev` | `go`, `golang`                          | Разработка на Go (run, build, test, mod)                     |
| `php_dev`    | `php`, `composer`, `phpunit`, `artisan` | Разработка на PHP с поддержкой Composer и Laravel            |

### Оповещение об окружении

Модель теперь получает детальную информацию об окружении в начале сессии:

- Конфигурация Ollama (base URL, модель, статус API ключа)
- Системная информация (версия Node.js, платформа, рабочая директория)
- Настройки отладки

### Расширенная документация

Новая комплексная документация:

- [FEATURES.ru.md](./docs/FEATURES.ru.md) - Полный справочник функций
- [TOOLS.ru.md](./docs/TOOLS.ru.md) - Справочник инструментов
- [FEATURES.md](./docs/FEATURES.md) - English feature reference
- [TOOLS.md](./docs/TOOLS.md) - English tools reference

---

## Новые возможности v0.10.5

### Система алиасов инструментов

Модели теперь могут использовать короткие имена инструментов:

| Алиас                         | Каноническое имя    |
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

### Отображение Session ID

ID текущей сессии теперь отображается в заголовке для удобства отладки и логирования.

### Проверка UTF-8 локали

Добавлено предупреждение при старте, если терминал не настроен на UTF-8 кодировку.

---

## Возможности v0.12.0

### UI/UX Улучшения

```typescript
// Прогресс-бар для загрузки моделей
<ProgressBar
  progress={45}
  label="Downloading model"
  speed="5.2 MB/s"
  eta="2m 30s"
/>

// Thinking indicator для thinking моделей
<ThinkingIndicator
  message="Analyzing code..."
  elapsedTime={45}
  showContent
/>

// Token usage display
<TokenUsageDisplay
  totalTokens={1500}
  promptTokens={500}
  completionTokens={1000}
  tokensPerSecond={45}
/>

// GPU/Memory indicator
<GPUUsage
  name="NVIDIA RTX 4090"
  utilization={85}
  memoryUsed={20 * 1024 * 1024 * 1024}
  memoryTotal={24 * 1024 * 1024 * 1024}
/>
```

### Database Tool

```bash
> Выполни SELECT * FROM users LIMIT 10 в SQLite базе data.db
> Сохрани backup базы в /backup/db.sql
> Покажи схему таблицы users
```

### Docker Tool

```bash
> Запусти контейнер nginx на порту 8080
> Покажи логи контейнера my-app
> Останови все контейнеры
> Собери Docker образ из текущей директории
```

### Redis Tool

```bash
> Получи значение ключа session:user:123
> Установи cache:data со сроком 1 час
> Опубликуй сообщение в канал notifications
> Покажи все ключи с префиксом user:
```

### Performance

- **Response Caching**: Кэширование ответов LLM с LRU eviction
- **Embedding Caching**: Кэширование эмбеддингов для быстрого поиска

---

## Возможности v0.11.0

### Thinking Models (DeepSeek R1)

```typescript
// Модели с рассуждениями показывают процесс мышления
const response = await client.chat({
  model: 'deepseek-r1:8b',
  messages: [{ role: 'user', content: 'Реши задачу...' }],
  think: true,
});
```

### Structured Outputs (JSON Schema)

```typescript
// Структурированный вывод по схеме
const response = await client.generate({
  model: 'llama3.2',
  prompt: 'Извлеки данные...',
  format: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    required: ['name'],
  },
});
```

### Code Analyzer Tool

```bash
> Проанализируй файл src/index.ts на качество кода

# Результат:
# Score: 85/100 (Grade: B)
# Issues: 2 warnings, 1 error
# Recommendations: Добавить обработку ошибок
```

### Git Advanced Tool

```bash
> Сохрани изменения в stash с сообщением "WIP"
> Перенеси коммит abc123 в текущую ветку
> Найди баг с помощью bisect между v1.0 и HEAD
```

### API Tester Tool

```bash
> Протестируй GET https://api.example.com/users
> Отправь POST на /api/users с данными {"name": "Test"}
```

### Diagram Generator

```bash
> Создай блок-схему процесса авторизации
> Нарисуй sequence diagram для API запроса
```

## Структура проекта

```
ollama-code/
├── packages/
│   ├── core/           # Ядро: Ollama клиент, инструменты, типы
│   ├── cli/            # CLI интерфейс на базе Ink
│   ├── web-app/        # Web UI: Next.js приложение (NEW)
│   ├── webui/          # Веб-компоненты для UI
│   └── sdk-typescript/ # SDK для программного использования
├── scripts/            # Скрипты сборки и запуска
├── integration-tests/  # Интеграционные тесты
└── docs/              # Документация
```

## Документация

### Краткий справочник

| Документ                                | Описание                      |
| --------------------------------------- | ----------------------------- |
| [WEB_UI.md](./docs/WEB_UI.md)           | **Документация Web UI (NEW)** |
| [FEATURES.ru.md](./docs/FEATURES.ru.md) | **Полный справочник функций** |
| [TOOLS.ru.md](./docs/TOOLS.ru.md)       | **Справочник инструментов**   |
| [USAGE_GUIDE.md](./docs/USAGE_GUIDE.md) | Руководство по использованию  |
| [EXAMPLES.md](./docs/EXAMPLES.md)       | Примеры использования         |
| [OLLAMA_API.md](./docs/OLLAMA_API.md)   | Документация API              |

### Английская документация (English Documentation)

| Document                          | Description                    |
| --------------------------------- | ------------------------------ |
| [FEATURES.md](./docs/FEATURES.md) | **Complete feature reference** |
| [TOOLS.md](./docs/TOOLS.md)       | **Tools reference**            |
| [README.md](./README.md)          | README in English              |

### Ресурсы проекта

| Документ                                       | Описание               |
| ---------------------------------------------- | ---------------------- |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Структура проекта      |
| [ROADMAP.md](./ROADMAP.md)                     | План развития          |
| [CONTRIBUTING.md](./CONTRIBUTING.md)           | Руководство по участию |

### Plugin System

| Документ                                              | Описание                   |
| ----------------------------------------------------- | -------------------------- |
| [PLUGIN_SYSTEM.md](./docs/PLUGIN_SYSTEM.md)           | Архитектура и API плагинов |
| [PLUGIN_MARKETPLACE.md](./docs/PLUGIN_MARKETPLACE.md) | Руководство по Marketplace |
| [PLUGIN_SANDBOX.md](./docs/PLUGIN_SANDBOX.md)         | Безопасность и sandboxing  |

## Основные команды

| Команда             | Описание                   |
| ------------------- | -------------------------- |
| `npm run build`     | Собрать все пакеты         |
| `npm run start`     | Запустить CLI              |
| `npm run dev`       | Запуск в режиме разработки |
| `npm run debug`     | Запуск с отладчиком        |
| `npm run test`      | Запустить тесты            |
| `npm run lint`      | Проверить код линтером     |
| `npm run typecheck` | Проверка типов TypeScript  |

## Параметры CLI

```
Options:
  -d, --debug                     Режим отладки
  -m, --model                     Указать модель
  -s, --sandbox                   Запуск в песочнице
  -y, --yolo                      Автоматическое подтверждение всех действий
      --approval-mode             Режим подтверждения: plan, default, auto-edit, yolo
      --experimental-lsp          Включить экспериментальную поддержку LSP
      --ollama-base-url           URL Ollama сервера (по умолчанию: http://localhost:11434)
      --ollama-api-key            API ключ для удалённых инстансов
```

## Переменные окружения

| Переменная                   | Описание                                      |
| ---------------------------- | --------------------------------------------- |
| `OLLAMA_BASE_URL`            | URL Ollama сервера                            |
| `OLLAMA_API_KEY`             | API ключ (опционально)                        |
| `OLLAMA_MODEL`               | Модель по умолчанию                           |
| `OLLAMA_KEEP_ALIVE`          | Время удержания модели в памяти (default: 5m) |
| `DEBUG`                      | Включить режим отладки (1 или true)           |
| `OLLAMA_CODE_DEBUG_LOG_FILE` | Логирование в файл                            |

## Отладка в VSCode

Проект включает готовые конфигурации VSCode для отладки:

1. Откройте проект в VSCode
2. Нажмите F5 или выберите "Run and Debug"
3. Выберите конфигурацию:
   - **Debug Ollama Code CLI** — базовая отладка
   - **Debug Ollama Code CLI (with args)** — с аргументами
   - **Debug Current Test File** — отладка текущего теста

## API Ollama

Проект использует нативные API Ollama:

### Основные endpoints

| Endpoint        | Метод | Описание                 |
| --------------- | ----- | ------------------------ |
| `/api/tags`     | GET   | Список локальных моделей |
| `/api/show`     | POST  | Информация о модели      |
| `/api/generate` | POST  | Генерация текста         |
| `/api/chat`     | POST  | Чат с моделью            |
| `/api/embed`    | POST  | Эмбеддинги               |
| `/api/create`   | POST  | Создание модели          |
| `/api/pull`     | POST  | Загрузка модели          |
| `/api/ps`       | GET   | Запущенные модели        |
| `/api/version`  | GET   | Версия Ollama            |

Документация API: [OLLAMA_API.md](./docs/OLLAMA_API.md)

## Рекомендуемые модели

| Модель              | Назначение             | Размер |
| ------------------- | ---------------------- | ------ |
| `llama3.2`          | Общего назначения      | 3B     |
| `qwen2.5-coder:7b`  | Программирование       | 7B     |
| `qwen2.5-coder:14b` | Программирование       | 14B    |
| `qwen3-coder:30b`   | Программирование       | 30B    |
| `deepseek-r1:8b`    | Рассуждения (thinking) | 8B     |
| `codellama`         | Программирование       | 7B+    |
| `mistral`           | Общего назначения      | 7B     |
| `nomic-embed-text`  | Эмбеддинги             | 274M   |

## Разработка

### Сборка отдельного пакета

```bash
# Сборка core
npm run build --workspace=packages/core

# Сборка cli
npm run build --workspace=packages/cli
```

### Запуск тестов

```bash
# Все тесты
npm run test

# Тесты core пакета
npm run test --workspace=packages/core

# Интеграционные тесты
npm run test:integration:sandbox:none
```

### Добавление нового инструмента

1. Создайте файл в `packages/core/src/tools/`
2. Реализуйте класс, наследующий `BaseDeclarativeTool`
3. Экспортируйте из `index.ts`

## Лицензия

Apache License 2.0

---

_Документация создана с помощью GLM-5 от Z.AI_

## Содействие

См. [CONTRIBUTING.md](./CONTRIBUTING.md) для руководства по участию в разработке.
