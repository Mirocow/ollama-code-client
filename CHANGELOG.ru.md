# Журнал изменений

## 0.17.0

_Плагин SSH Tools — Подключение к удалённым серверам_

### Новые возможности

#### Плагин SSH Tools

Новый специализированный плагин SSH для управления удалёнными серверами:

| Инструмент           | Имя               | Описание                                       |
| -------------------- | ----------------- | ----------------------------------------------- |
| **SSH Connect**      | `ssh_connect`     | Подключение к удалённым серверам и выполнение команд |
| **SSH Add Host**     | `ssh_add_host`    | Сохранение профилей SSH с учётными данными     |
| **SSH List Hosts**   | `ssh_list_hosts`  | Список сохранённых профилей SSH                |
| **SSH Remove Host**  | `ssh_remove_host` | Удаление сохранённых профилей SSH              |

**Возможности SSH Connect:**

- Аутентификация по хосту и пользователю (обязательно)
- Настройка порта (по умолчанию: 22)
- Аутентификация по SSH-ключу (`identity_file`)
- Аутентификация по паролю (не рекомендуется)
- Настройка таймаута (максимум 10 минут)
- Подключение по профилю

**Управление профилями SSH:**

```bash
# Сохранить профиль SSH
ssh_add_host(name="prod", host="192.168.1.100", user="admin", identity_file="~/.ssh/id_rsa")

# Список профилей
ssh_list_hosts()

# Подключение по профилю
ssh_connect(profile="prod", command="docker ps")

# Удалить профиль
ssh_remove_host(name="prod")
```

**Алиасы инструментов:**

| Алиас                  | Инструмент       |
| ---------------------- | ---------------- |
| `ssh`                  | `ssh_connect`    |
| `ssh_connect`          | `ssh_connect`    |
| `ssh_dev`              | `ssh_connect`    |
| `remote`               | `ssh_connect`    |
| `remote_shell`         | `ssh_connect`    |
| `remote_exec`          | `ssh_connect`    |
| `connect`              | `ssh_connect`    |
| `telnet`               | `ssh_connect`    |
| `ssh_add_host`         | `ssh_add_host`   |
| `add_host`             | `ssh_add_host`   |
| `add_ssh_host`         | `ssh_add_host`   |
| `save_ssh`             | `ssh_add_host`   |
| `ssh_save`             | `ssh_add_host`   |
| `ssh_profile_add`      | `ssh_add_host`   |
| `ssh_config_add`       | `ssh_add_host`   |
| `ssh_list_hosts`       | `ssh_list_hosts` |
| `list_hosts`           | `ssh_list_hosts` |
| `list_ssh`             | `ssh_list_hosts` |
| `ssh_hosts`            | `ssh_list_hosts` |
| `ssh_profiles`         | `ssh_list_hosts` |
| `ssh_config_list`      | `ssh_list_hosts` |
| `ssh_remove_host`      | `ssh_remove_host`|
| `remove_host`          | `ssh_remove_host`|
| `remove_ssh`           | `ssh_remove_host`|
| `delete_ssh`           | `ssh_remove_host`|
| `ssh_delete`           | `ssh_remove_host`|
| `ssh_profile_remove`   | `ssh_remove_host`|
| `ssh_config_remove`    | `ssh_remove_host`|

**Примечания по безопасности:**

- SSH-подключения всегда требуют подтверждения пользователя
- Учётные данные хранятся в `~/.ollama-code/ssh_credentials.json`
- Используйте аутентификацию по ключу когда возможно
- Пароли хранятся в открытом виде (используйте ключи для продакшена)

### Добавленные файлы

| Файл                                                   | Описание                  |
| ------------------------------------------------------ | ------------------------- |
| `plugins/builtin/ssh-tools/index.ts`                   | Определение плагина SSH   |
| `plugins/builtin/ssh-tools/ssh.ts`                     | Инструмент SSH connect    |
| `plugins/builtin/ssh-tools/ssh-hosts.ts`               | Управление профилями SSH  |
| `plugins/builtin/ssh-tools/index.test.ts`              | Тесты SSH                 |

### Изменённые файлы

| Файл                                                   | Изменения                             |
| ------------------------------------------------------ | ------------------------------------ |
| `packages/core/src/tools/tool-names.ts`                | Добавлены имена и алиасы SSH         |
| `packages/core/src/config/storage.ts`                  | Добавлено хранилище учётных данных   |
| `packages/core/src/plugins/pluginRegistry.ts`          | Зарегистрирован плагин SSH           |
| `packages/core/src/index.ts`                           | Экспортирован плагин SSH             |
| `README.md`                                            | Добавлена функция SSH Tools          |
| `README.ru.md`                                         | Добавлена функция SSH Tools (русский)|

### Коммиты

```
b2707127 feat: Add SSH Tools plugin for remote server connectivity
```

---

## 0.16.9

_Расширение алиасов инструментов и улучшения поддержки IDE_

### Новые возможности

#### Расширенные алиасы инструментов для галлюцинаций моделей

Добавлено 70+ новых алиасов инструментов для корректной обработки галлюцинаций моделей:

| Категория        | Новые алиасы                                                                      |
| ---------------- | --------------------------------------------------------------------------------- |
| **Docker**       | `docker`, `docker_dev`, `container`, `container_dev`, `docker_compose`, `compose`, `podman` |
| **База данных**  | `database`, `db`, `db_dev`, `sql`, `sql_dev`, `mysql`, `postgresql`, `postgres`, `psql`, `sqlite`, `mongodb`, `mongo`, `redis`, `redis_cli` |
| **Kubernetes**   | `kubernetes`, `k8s`, `kubectl`, `helm`, `k8s_dev`                                |
| **CI/CD**        | `ci`, `cd`, `github_actions`, `gitlab_ci`, `jenkins`, `circleci`                  |
| **Инфраструктура** | `terraform`, `tf`, `ansible`, `aws`, `azure`, `gcp`                            |
| **Частые утилиты** | `ssh`, `scp`, `rsync`, `tar`, `zip`, `unzip`                                   |

Все эти алиасы перенаправляются на `run_shell_command` для бесшовного выполнения команд.

#### Улучшения поддержки IDE

Добавлен TypeScript в workspace root для лучшей поддержки IDE:

| Исправление            | Описание                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `lib.es2023.d.ts`      | Исправлена ошибка "Cannot find lib.es2023.d.ts"             |
| `vitest/globals`       | Исправлена ошибка "Cannot find type definition file"        |
| Глобальные типы        | Исправлены ошибки "Cannot find global type 'Promise/Boolean'" |

### Обновления документации

#### Таблица совместимости Node.js

Добавлена комплексная таблица совместимости Node.js для `node-pty`:

| Версия Node.js | Статус               | Совместимость с node-pty |
| -------------- | -------------------- | ------------------------ |
| 18.x           | LTS (Maintenance)    | ✅ Работает              |
| 20.x           | LTS (Current)        | ✅ Работает              |
| 22.x           | LTS (Latest)         | ✅ Работает              |
| 23.x           | Current              | ⚠️ Может работать        |
| 24.x           | Nightly              | ❌ Не работает           |
| 25.x           | Experimental         | ❌ **Не работает**       |

### Исправления ошибок

#### Удалена зависимость от bun

- Заменили `bun` на `pnpm` для сборки assets
- `pnpm` уже требуется для поддержки monorepo workspace
- Оба поддерживают протокол `workspace:*` для внутренних пакетов

### Рефакторинг

#### Миграция snapshot-файлов тестов

Перемещены snapshot-файлы shell в правильную директорию плагина:
- `tools/__snapshots__/` → `plugins/builtin/shell-tools/__snapshots__/`

### Изменённые файлы

| Файл                                                   | Изменения                             |
| ------------------------------------------------------ | ------------------------------------- |
| `packages/core/src/tools/tool-names.ts`                | Добавлено 70+ алиасов инструментов    |
| `README.md`                                            | Добавлена таблица совместимости Node.js |
| `README.ru.md`                                         | Добавлена русская таблица совместимости |
| `package.json`                                         | Добавлен TypeScript в devDependencies |
| `packages/cli/assets/parallel-build.mjs`               | Заменён bun на pnpm                   |

### Коммиты

```
8935f1dc feat: add more tool aliases for common model hallucinations
68b7be0f refactor: move shell test snapshots to plugins directory
86ecdf90 fix: add TypeScript to workspace root for IDE support
38a95657 docs: add Node.js compatibility table for node-pty
6c561de1 refactor: replace bun with pnpm for assets build
```

---

## 0.16.8

_Обновление зависимостей и миграция на Zod v4_

### Обновление зависимостей

Все зависимости обновлены до актуальных версий для совместимости и безопасности:

| Пакет                       | Старая версия            | Новая версия | Причина                                 |
| --------------------------- | ------------------------ | ------------ | --------------------------------------- |
| `zod`                       | 3.23.8 / 3.24.0 / 3.25.0 | **4.3.6**    | Требуется для @modelcontextprotocol/sdk |
| `@modelcontextprotocol/sdk` | 1.25.1                   | **1.27.1**   | Новые возможности MCP SDK               |
| `ajv-formats`               | 3.0.0                    | **3.0.1**    | Объявления типов TypeScript             |
| `msw`                       | 2.3.4                    | **2.12.10**  | Исправление peer dependency             |

### Критические изменения

#### Изменения API Zod v4

Zod v4 вводит критические изменения API, потребовавшие обновления кода:

| Изменение              | Старый API                               | Новый API                           |
| ---------------------- | ---------------------------------------- | ----------------------------------- |
| `z.record()`           | `z.record(z.unknown())`                  | `z.record(z.string(), z.unknown())` |
| Параметры `z.string()` | `{ required_error, invalid_type_error }` | `{ message }`                       |
| Generic `ZodObject`    | `ZodObject<Shape, 'strip', ZodTypeAny>`  | `ZodObject<Shape>`                  |
| Ошибки валидации       | `error.errors`                           | `error.issues`                      |

### Изменённые файлы

| Файл                                                   | Изменения                                             |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `package.json`                                         | Обновлён zod до 4.3.6                                 |
| `packages/cli/package.json`                            | Обновлены zod, @modelcontextprotocol/sdk              |
| `packages/core/package.json`                           | Обновлены @modelcontextprotocol/sdk, ajv-formats, msw |
| `packages/sdk-typescript/package.json`                 | Обновлены zod, @modelcontextprotocol/sdk              |
| `packages/cli/src/acp-integration/schema.ts`           | Исправлены вызовы `z.record()`                        |
| `packages/cli/src/services/FileCommandLoader.ts`       | Исправлены параметры `z.string()`                     |
| `packages/cli/src/services/markdown-command-parser.ts` | Исправлены параметры `z.string()`                     |
| `packages/sdk-typescript/src/mcp/tool.ts`              | Исправлен generic `ZodObject`                         |
| `packages/sdk-typescript/src/query/createQuery.ts`     | Исправлен доступ к свойствам ошибки                   |
| `packages/*/vitest.config.ts`                          | Отключён PostCSS для тестов                           |
| `packages/*/postcss.config.js`                         | Добавлены пустые конфиги                              |

### Технические детали

#### Исправления совместимости Zod v4

1. **Аргументы типа record**: `z.record()` теперь требует явные аргументы типа ключа и значения
2. **Сообщения об ошибках**: Унифицированный параметр `message` для ошибок валидации
3. **Вывод типов**: Упрощённые generic-параметры `ZodObject`
4. **Структура ошибок**: Ошибки валидации теперь используют `.issues` вместо `.errors`

#### Конфигурация Vitest

Исправлены конфликты конфигурации PostCSS путём:

- Добавления `css: { postcss: false }` во все конфиги vitest
- Создания пустых файлов `postcss.config.js` в каждом пакете

### Проверка

- ✅ Компиляция TypeScript проходит успешно
- ✅ Сборка выполняется без ошибок
- ✅ Бандл создан успешно

---

## 0.16.7

_Улучшения UX, исправления TypeScript и миграция тестов_

### Улучшения UX

#### Форматирование сообщения Tips

Добавлен отступ после сообщения Tips в CLI для лучшей читаемости:

| Компонент  | Изменение                                                   |
| ---------- | ----------------------------------------------------------- |
| `Tips.tsx` | Добавлен `marginBottom={1}` для визуального отступа         |
| `Tips.tsx` | Добавлен `flexDirection="column"` для правильной компоновки |

### Исправления ошибок

#### Совместимость со строгим режимом TypeScript

Исправлены ошибки TS7006/TS7053 добавлением явных аннотаций типов:

| Файл                 | Изменения                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `ide-client.ts`      | Добавлены типы для параметров `part`, `tool`                                                |
| `McpPromptLoader.ts` | Добавлены типы `PromptArgument`                                                             |
| `acpAgent.ts`        | Добавлены типы для параметров `mode`, `item`, `model`, исправлено приведение APPROVAL_MODES |
| `ToolCallEmitter.ts` | Добавлен тип для параметра `loc`                                                            |
| `consent.ts`         | Добавлен тип `ClaudeMarketplacePluginConfig`                                                |

### Рефакторинг

#### Миграция тестов — 100% завершено

Все тесты перенесены из `tools/` в `plugins/builtin/`:

| Категория          | Перенесённые тесты                                                     |
| ------------------ | ---------------------------------------------------------------------- |
| dev-tools          | python, nodejs, golang, rust, java, cpp, swift, php, typescript        |
| file-tools         | edit, glob, ls, read-file, read-many-files, write-file                 |
| search-tools       | grep, ripGrep, web-fetch                                               |
| database-tools     | database, docker, redis                                                |
| mcp-tools          | mcp-client, mcp-tool, mcp-client-manager, sdk-control-client-transport |
| agent-tools        | skill, task                                                            |
| productivity-tools | todoWrite, exitPlanMode                                                |
| utility-tools      | code-analyzer, diagram-generator                                       |
| Прочие             | git-advanced, lsp, shell, api-tester, save-memory                      |

**Тесты, оставшиеся в `tools/` (тесты базовых классов):**

- diffOptions.test.ts
- modifiable-tool.test.ts
- tool-error.test.ts
- tool-names.test.ts
- tool-registry.test.ts
- tools.test.ts

### Обновления зависимостей

| Пакет         | Изменение       | Причина                                               |
| ------------- | --------------- | ----------------------------------------------------- |
| `zod`         | 3.24.0 → 3.25.0 | MCP SDK 1.25.1+ требует zod ^3.25 для экспортов v3/v4 |
| `ajv-formats` | 3.0.0 → 2.1.1   | Исправление совместимости ESM                         |

### Изменённые файлы

| Файл                                                                   | Изменения                        |
| ---------------------------------------------------------------------- | -------------------------------- |
| `packages/cli/src/ui/components/Tips.tsx`                              | Отступ после сообщения Tips      |
| `packages/core/src/ide/ide-client.ts`                                  | Аннотации типов                  |
| `packages/cli/src/services/McpPromptLoader.ts`                         | Аннотации типов                  |
| `packages/cli/src/acp-integration/acpAgent.ts`                         | Аннотации типов                  |
| `packages/cli/src/acp-integration/session/emitters/ToolCallEmitter.ts` | Аннотации типов                  |
| `packages/cli/src/commands/extensions/consent.ts`                      | Аннотации типов                  |
| `packages/core/package.json`                                           | понижение версии ajv-formats     |
| `package.json`                                                         | обновление zod                   |
| `ROADMAP.md`                                                           | Обновлён статус миграции на 100% |
| `CHANGELOG.md`                                                         | Добавлен v0.16.7                 |
| `CHANGELOG.ru.md`                                                      | Добавлен v0.16.7 (русский)       |

---

## 0.16.6

_Исправление совместимости с Node.js_

### Исправления ошибок

#### Уточнение требований к версии Node.js

Обновлена документация с чётким указанием поддерживаемых версий Node.js:

| Версия Node.js | Статус               | Примечания                   |
| -------------- | -------------------- | ---------------------------- |
| 18.x           | ✅ Поддерживается    | LTS Maintenance              |
| 20.x           | ✅ Поддерживается    | LTS Current (Рекомендуется)  |
| 22.x           | ✅ Поддерживается    | LTS Latest                   |
| 23.x           | ❌ Не поддерживается | Проблемы компиляции node-pty |
| 24.x           | ❌ Не поддерживается | Экспериментальная, проблемы  |
| 25.x           | ❌ Не поддерживается | Экспериментальная, проблемы  |

**Проблема:** Node.js 25.x вызывал ошибку компиляции `node-pty`:

```
error: expected expression
I::ReadExternalPointerField<{internal::kFirstEmbedderDataTag,
```

**Решение:** Обновлён README с указанием Node.js 20.x или 22.x LTS как необходимых версий.

### Обновления документации

| Файл           | Изменения                                          |
| -------------- | -------------------------------------------------- |
| `README.md`    | Добавлено предупреждение о совместимости с Node.js |
| `README.ru.md` | Добавлено предупреждение на русском                |
| `package.json` | Обновлено требование engines (>=20.0.0 <23.0.0)    |

### Исправление установки

Если возникла ошибка компиляции `node-pty`, переключитесь на Node.js 22 LTS:

```bash
# Используя asdf
asdf install nodejs 22.14.0
asdf local nodejs 22.14.0

# Очистить и переустановить
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## 0.16.0

_Документация создана с помощью GLM-5 от Z.AI_

### Новые возможности

#### Документация: Требования к GPU и тестирование производительности

Добавлена комплексная документация по требованиям к GPU с тестами производительности:

| Секция                                   | Описание                                                    |
| ---------------------------------------- | ----------------------------------------------------------- |
| **Таблица требований к GPU**             | Минимальная VRAM для каждого размера модели (от 3B до 70B+) |
| **Результаты тестов производительности** | Бенчмарки для RTX 3060 до RTX 4090                          |
| **Руководство по квантизации**           | Рекомендации Q4_K_M, Q5_K_M, Q6_K, Q8_0                     |

**Таблица тестов производительности включает:**

- 17 комбинаций GPU/Модель протестировано
- Начиная с RTX 3060 (12 ГБ) как базовой
- Измерения скорости в токенах/секунду
- Оценки качества для каждой конфигурации

**Обновлённые файлы:**

- `README.md` — Добавлена секция GPU Requirements
- `README.ru.md` — Добавлена русская секция требований к GPU

#### Plugin System v3 — Реорганизация инструментов в плагины

Полная реорганизация инструментов в категории плагинов для лучшей модульности и расширяемости:

| Компонент                   | Описание                                                 |
| --------------------------- | -------------------------------------------------------- |
| **12 категорий плагинов**   | Инструменты организованы по функциональности             |
| **Ре-экспорт инструментов** | Существующие инструменты обёрнуты в архитектуру плагинов |
| **Улучшенная документация** | Каждый плагин имеет свой README и метаданные             |

**Новые категории плагинов (7 новых):**

| ID плагина            | Инструменты                                  | Описание                            |
| --------------------- | -------------------------------------------- | ----------------------------------- |
| `memory-tools`        | save_memory                                  | Управление памятью и контекстом     |
| `task-tools`          | task, todo_write                             | Делегирование и отслеживание задач  |
| `database-tools`      | redis, database                              | Операции с БД (Redis, SQL, MongoDB) |
| `docker-tools`        | docker                                       | Управление контейнерами             |
| `git-tools`           | git_advanced                                 | Продвинутые операции Git            |
| `mcp-tools`           | mcp_server                                   | Интеграция Model Context Protocol   |
| `code-analysis-tools` | code_analyzer, diagram_generator, api_tester | Качество и анализ кода              |

---

## 0.11.3

### Исправления ошибок

#### Исправление нарушения правил React Hooks

Исправлена критическая ошибка в `LoadingIndicator.tsx`, где хуки `useMemo` вызывались после раннего оператора `return`, нарушая правила React Hooks:

```
Error: Rendered more hooks than during the previous render.
```

**Изменения:**

- Все вызовы `useMemo` перемещены перед ранним оператором `return null;`
- Все хуки теперь вызываются в согласованном порядке при каждом рендере

**Изменённый файл:**

- `packages/cli/src/ui/components/LoadingIndicator.tsx`

### Обновления документации

- Обновлён `ROADMAP.md` с полным статусом всех задач
- Все основные функции отмечены как завершённые
- **НОВОЕ**: Добавлена комплексная документация Plugin Marketplace (`docs/PLUGIN_MARKETPLACE.md`)
  - CLI команды: search, install, update, uninstall, list
  - Programmatic API с типами TypeScript
  - Уровни доверия: verified, community, unverified
  - Создание плагинов для marketplace
  - Интеграция с Claude extensions
- Обновлён `README.md` со ссылками на документацию Plugin System
- Добавлена секция Plugin Marketplace в `docs/PLUGIN_SYSTEM.md`

---

## 0.11.2

### Оптимизация производительности React

Крупные улучшения производительности React через разделение контекстов и мемоизацию:

#### Новые специализированные контексты

Разделение монолитного `UIStateContext` (70+ полей) на меньшие, сфокусированные контексты:

| Контекст              | Назначение                             |
| --------------------- | -------------------------------------- |
| `DialogStateContext`  | Состояния видимости диалогов           |
| `TerminalContext`     | Размеры и компоновка терминала         |
| `InputStateContext`   | Буфер ввода и состояния клавиш         |
| `HistoryContext`      | Элементы истории и ожидающие сообщения |
| `LoadingContext`      | Состояния стриминга и загрузки         |
| `ConfirmationContext` | Запросы подтверждения                  |

#### Мемоизированные компоненты

Добавлены `React.memo` и `useMemo` к часто перерисовывающимся компонентам:

- `Footer` — Строка состояния (уже мемоизирован, улучшен)
- `AppHeader` — Заголовок приложения с мемоизированными селекторами
- `MainContent` — Основная область контента с оптимизированным рендерингом
- `HistoryItemDisplay` — Отображение отдельных элементов истории с мемоизированными размерами
- `Composer` — Область ввода с мемоизированными селекторами состояния

#### Преимущества производительности

- **Снижение перерисовок**: Компоненты перерисовываются только при изменении их специфического контекста
- **Мемоизированные элементы истории**: Каждый элемент истории независимо мемоизирован
- **Мемоизированные размеры**: Вычисления компоновки кэшируются для предотвращения пересчёта
- **Избирательные подписки**: Компоненты могут подписываться на специфические слои состояния

### Обновления документации

- Обновлён `ROADMAP.md` с прогрессом оптимизации React
- Добавлены детали о стратегии разделения контекстов

### Добавленные файлы

| Файл                                                   | Описание                       |
| ------------------------------------------------------ | ------------------------------ |
| `packages/cli/src/ui/contexts/DialogStateContext.tsx`  | Управление состоянием диалогов |
| `packages/cli/src/ui/contexts/TerminalContext.tsx`     | Размеры терминала              |
| `packages/cli/src/ui/contexts/InputStateContext.tsx`   | Управление состоянием ввода    |
| `packages/cli/src/ui/contexts/HistoryContext.tsx`      | Управление состоянием истории  |
| `packages/cli/src/ui/contexts/LoadingContext.tsx`      | Управление состоянием загрузки |
| `packages/cli/src/ui/contexts/ConfirmationContext.tsx` | Запросы подтверждения          |

### Изменённые файлы

| Файл                                                    | Изменения                               |
| ------------------------------------------------------- | --------------------------------------- |
| `packages/cli/src/ui/components/AppHeader.tsx`          | Добавлены memo и useMemo                |
| `packages/cli/src/ui/components/MainContent.tsx`        | Добавлены memo, упрощён рендеринг       |
| `packages/cli/src/ui/components/HistoryItemDisplay.tsx` | Добавлены memo, мемоизированы размеры   |
| `packages/cli/src/ui/components/Composer.tsx`           | Добавлены memo, мемоизированы селекторы |

---

## 0.11.1

### Обновления документации

- Добавлены Qwen2.5-Coder и Qwen3-Coder к рекомендуемым моделям
  - `qwen2.5-coder:7b` — отлично для задач программирования (7B параметров)
  - `qwen2.5-coder:14b` — сбалансированная производительность и качество (14B параметров)
  - `qwen3-coder:30b` — первоклассная модель для кода (30B параметров)

### Обновления дорожной карты

- Добавлен детальный план миграции fetch → axios
- Задокументированы файлы, этапы и требования к тестированию

---

## 0.11.0

### Новые возможности

#### Архитектурные улучшения

Крупные архитектурные улучшения для лучшей производительности и расширяемости:

| Функция                   | Описание                                               |
| ------------------------- | ------------------------------------------------------ |
| **Миграция на Zustand**   | Заменил Context API для атомарных обновлений состояния |
| **Event Bus**             | Типизированная система pub/sub для слабой связности    |
| **Command Pattern**       | Полная поддержка Undo/Redo для обратимых операций      |
| **Plugin System v1**      | Динамическая загрузка инструментов с lifecycle hooks   |
| **Context Caching**       | KV-cache reuse для 80-90% более быстрых диалогов       |
| **Документация промптов** | Комплексная документация системы промптов              |

#### Stores Zustand

Пять новых stores, заменяющих Context API:

| Store            | Назначение                            |
| ---------------- | ------------------------------------- |
| `sessionStore`   | Состояние сессии и метрики            |
| `streamingStore` | Состояние стриминга + AbortController |
| `uiStore`        | UI настройки с персистентностью       |
| `commandStore`   | Command pattern для undo/redo         |
| `eventBus`       | Система событий pub/sub               |

#### Event Bus

Типизированные события для межкомпонентного взаимодействия:

```typescript
// Подписка на события
eventBus.subscribe('stream:finished', (data) => {
  console.log('Использовано токенов:', data.tokenCount);
});

// Эмиссия событий
eventBus.emit('command:executed', { commandId: '123', commandType: 'edit' });
```

**Поддерживаемые события:**

- `stream:started/chunk/finished/error/cancelled`
- `tool:started/progress/completed/error`
- `session:started/ended/cleared`
- `command:executed/undone/redone`
- `plugin:loaded/unloaded/error`

#### Command Pattern (Undo/Redo)

Полная реализация паттерна Command:

```typescript
// Выполнение с поддержкой отмены
await commandStore.execute({
  description: 'Изменить тему',
  type: 'theme',
  execute: async () => {
    /* действие */
  },
  undo: async () => {
    /* обратное действие */
  },
  canUndo: true,
});

// Отмена последней команды
await commandStore.undo();

// Повтор отменённой команды
await commandStore.redo();
```

#### Plugin System v1

Динамическая архитектура плагинов с lifecycle hooks:

```typescript
const plugin: PluginDefinition = {
  metadata: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'Мои пользовательские инструменты',
  },
  tools: [
    {
      id: 'hello',
      name: 'hello',
      description: 'Сказать привет',
      parameters: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      execute: async (params, context) => ({
        success: true,
        data: `Привет, ${params['message']}!`,
      }),
    },
  ],
  hooks: {
    onLoad: async (context) => context.logger.info('Плагин загружен'),
    onEnable: async (context) => context.logger.info('Плагин включён'),
    onBeforeToolExecute: async (toolId, params) => true,
    onAfterToolExecute: async (toolId, params, result) => {},
  },
};
```

**Встроенные плагины:**

| Плагин         | Инструменты                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `core-tools`   | echo, timestamp, get_env                                                                            |
| `dev-tools`    | python_dev, nodejs_dev, golang_dev, rust_dev, typescript_dev, java_dev, cpp_dev, swift_dev, php_dev |
| `file-tools`   | read_file, write_file, edit_file                                                                    |
| `search-tools` | grep, glob, web_fetch                                                                               |
| `shell-tools`  | run_shell_command                                                                                   |

#### Документация системы промптов

Новая комплексная документация в `docs/PROMPT_SYSTEM.md`:

| Функция                           | Назначение                               |
| --------------------------------- | ---------------------------------------- |
| `getCoreSystemPrompt()`           | Построение основного системного промпта  |
| `getCompressionPrompt()`          | Сжатие истории в XML формат              |
| `getProjectSummaryPrompt()`       | Sumмаризация проекта в Markdown          |
| `getToolCallFormatInstructions()` | Для моделей без нативной поддержки tools |
| `getToolLearningContext()`        | Обучение на прошлых ошибках              |
| `getEnvironmentInfo()`            | Контекст runtime окружения               |
| `getCustomSystemPrompt()`         | Обработка пользовательских инструкций    |

### Технические улучшения

#### Строгий режим TypeScript

- Исправлены все ошибки строгого режима TypeScript
- Правильная скобочная нотация для индексных сигнатур
- Корректное приведение типов для context clients
- Удалены неиспользуемые переменные и параметры

### Добавленные/изменённые файлы

| Файл                                           | Описание                      |
| ---------------------------------------------- | ----------------------------- |
| `packages/cli/src/ui/stores/commandStore.ts`   | Реализация Command pattern    |
| `packages/cli/src/ui/stores/eventBus.ts`       | Реализация Event bus          |
| `packages/core/src/plugins/types.ts`           | Типы системы плагинов         |
| `packages/core/src/plugins/pluginManager.ts`   | Управление lifecycle плагинов |
| `packages/core/src/plugins/pluginLoader.ts`    | Обнаружение плагинов          |
| `packages/core/src/plugins/pluginRegistry.ts`  | Регистрация плагинов          |
| `packages/core/src/plugins/builtin/*/index.ts` | Встроенные плагины            |
| `docs/PROMPT_SYSTEM.md`                        | Документация системы промптов |

### Обновления документации

| Документ       | Изменения                        |
| -------------- | -------------------------------- |
| `README.md`    | Обновлён для v0.11.0             |
| `README.ru.md` | Русская версия обновлена         |
| `ROADMAP.md`   | Обновлён с завершёнными задачами |
| `CHANGELOG.md` | Этот журнал изменений            |

### Критические изменения

- Context API заменён на Zustand (внутреннее изменение API)
- Система событий теперь использует `eventBus.subscribe()` вместо прямых callbacks

### Руководство по миграции

Если вы использовали Context API напрямую (внутреннее):

```typescript
// До (Context API)
const state = useContext(UIStateContext);

// После (Zustand)
const value = useUIStore((state) => state.value);
```

---

## 0.10.9

### Новые возможности

#### Context Caching с KV-cache Reuse

- **Кэширование токенов контекста Ollama**: Значительное улучшение производительности для многоходовых диалогов
  - Автоматическое кэширование токенов контекста между сообщениями
  - Повторное использование KV-cache Ollama для более быстрых последующих ответов
  - ~80-90% сокращение токенов на последующих сообщениях
  - Автоматический выбор эндпоинта: `/api/generate` для простого чата, `/api/chat` для tools

```typescript
// Включить кэширование контекста в конфигурации
const config: ContentGeneratorConfig = {
  model: 'llama3.2',
  enableContextCaching: true, // Включает KV-cache reuse
};

// Первое сообщение: полная обработка
// Второе сообщение: обрабатываются только новые токены (кэшированный контекст переиспользуется)
```

#### Hybrid Content Generator

- **Интеллектуальный выбор эндпоинта**: Автоматически выбирает оптимальный эндпоинт Ollama API
  - `/api/generate` с кэшированием контекста для простых диалогов
  - `/api/chat` для запросов с tools и function calls
  - Бесшовное переключение на основе требований запроса

#### Управление состоянием Zustand

- **Миграция с Context API на Zustand**: Улучшена производительность React
  - Атомарные обновления состояния предотвращают лишние перерисовки
  - Три новых store: `sessionStore`, `streamingStore`, `uiStore`
  - Встроенная поддержка персистентности

#### Архитектура Event Bus

- **Слабая связность между компонентами**: Типизированная система publish/subscribe
  - `eventBus.subscribe('stream:finished', callback)`
  - `eventBus.emit('stream:finished', data)`
  - Безопасная обработка событий

#### Command Pattern (Undo/Redo)

- **Обратимые операции**: Реализация паттерна Command
  - `commandStore.execute(command)` с поддержкой отмены
  - `commandStore.undo()` / `commandStore.redo()`
  - История операций для обратимых действий

#### Plugin System

- **Динамическая загрузка инструментов**: Расширяемая архитектура плагинов
  - `pluginManager.registerPlugin(plugin)`
  - Регистрация инструментов во время выполнения
  - Управление lifecycle плагинов (enable/disable)

### Архитектурные улучшения

#### Исправления утечек памяти

- **Очистка AbortController**: Правильная очистка в операциях стриминга
  - Очистка readers и таймаутов при abort
  - Предотвращение накопления памяти в длительных сессиях

#### Fallback подсчёта токенов

- **Надёжные метрики токенов**: Fallback когда Ollama не возвращает `prompt_eval_count`
  - Метод `recordTokenUsageWithFallback()`
  - Корректные обновления прогресс-бара

### Добавленные файлы

| Файл                                               | Описание                      |
| -------------------------------------------------- | ----------------------------- |
| `packages/core/src/cache/contextCacheManager.ts`   | Кэширование токенов контекста |
| `packages/core/src/core/ollamaContextClient.ts`    | Клиент /api/generate          |
| `packages/core/src/core/hybridContentGenerator.ts` | Выбор эндпоинта               |
| `packages/cli/src/ui/stores/sessionStore.ts`       | Состояние сессии (Zustand)    |
| `packages/cli/src/ui/stores/streamingStore.ts`     | Состояние стриминга           |
| `packages/cli/src/ui/stores/uiStore.ts`            | UI настройки                  |
| `packages/cli/src/ui/stores/eventBus.ts`           | Event bus                     |
| `packages/cli/src/ui/stores/commandStore.ts`       | Undo/Redo                     |
| `packages/core/src/plugins/index.ts`               | Система плагинов              |

### Опции конфигурации

Новые опции в `ContentGeneratorConfig`:

```typescript
interface ContentGeneratorConfig {
  // ... существующие опции

  /** Включить кэширование контекста для более быстрых многоходовых диалогов */
  enableContextCaching?: boolean;

  /** ID сессии для отслеживания контекста */
  sessionId?: string;
}
```

### Покрытие тестами

- **ContextCacheManager**: 50 тестов (TTL, eviction, конкурентный доступ, edge cases)
- **OllamaContextClient**: 32 теста (streaming, обработка ошибок, управление сессиями)
- **HybridContentGenerator**: 36 тестов (выбор эндпоинта, подсчёт токенов, embeddings)
- **Всего тестов Context Caching**: 118 тестов ✅

### Документация

| Документ                   | Описание                             |
| -------------------------- | ------------------------------------ |
| `docs/CONTEXT_CACHING.md`  | Справочник API кэширования контекста |
| `docs/STATE_MANAGEMENT.md` | Документация stores Zustand          |
| `docs/EVENT_BUS.md`        | Архитектура Event bus                |
| `docs/PLUGIN_SYSTEM.md`    | Справочник системы плагинов          |

### Метрики производительности

| Метрика        | Без кэширования | С кэшированием |
| -------------- | --------------- | -------------- |
| 1-е сообщение  | 100%            | 100%           |
| 2-е сообщение  | 100%            | ~15%           |
| 10-е сообщение | 100%            | ~7%            |

---

## 0.10.8

### Новые возможности

#### Прогресс-бар контекста в заголовке

- **Визуальное отображение использования токенов**: Заголовок теперь показывает прогресс-бар с указанием использования токенов контекста относительно контекстного окна модели
- **Индикатор размера модели**: Отображает размер контекстного окна модели (напр., "128K", "32K"), извлечённый из метаданных модели
- **Прогресс-бар во всю ширину**: Прогресс-бар теперь охватывает всю ширину информационной панели для лучшей видимости
- **Кумулятивное отслеживание токенов**: Прогресс-бар корректно показывает кумулятивные токены контекста на протяжении сессии

#### Отображение возможностей модели

- **Иконки возможностей**: Визуальные индикаторы возможностей модели (vision, tools, streaming support)
- **Информация о контексте**: Показывает контекстное окно модели и текущий процент использования
- **Улучшенные метаданные модели**: Лучшее извлечение размеров контекста для различных форматов (128K, 32K, 8K, и др.)

#### Системный промпт и оптимизация инструментов

- **Оптимизированные системные промпты**: Оптимизированы системные промпты для лучшей производительности модели
- **Инструкции формата вызова инструментов**: Добавлены автоматические инструкции формата вызова инструментов для моделей без нативной поддержки tools
- **Приоритет 3 функций**: Реализованы улучшения streaming, caching и observability

### Улучшения

#### Очистка команд

Удалены неиспользуемые команды для упрощения CLI:

| Удалённая команда | Альтернатива      |
| ----------------- | ----------------- |
| `/bug`            | Прямое сообщение  |
| `/docs`           | См. папку `docs/` |
| `/help`           | См. документацию  |
| `/setup-github`   | Настроить вручную |

Объединённые команды для лучшей организации:

| Объединённые команды | Новая команда |
| -------------------- | ------------- |
| `/stats` + `/about`  | `/info`       |

#### Технические улучшения

- Исправлен прогресс-бар не обновлялся: использование токенов теперь корректно записывается в telemetry service
- Исправлено размещение компонента AppHeader для динамических обновлений
- Заменён `require()` на ES module imports в development tools
- Удалено debug логирование для более чистого вывода

### Исправления ошибок

- Прогресс-бар теперь корректно показывает кумулятивные токены контекста
- Извлечение размера модели работает с большим количеством форматов имён моделей
- Компонент header динамически обновляется во время стриминга

---

_См. [CHANGELOG.md](../CHANGELOG.md) для более ранних версий._
