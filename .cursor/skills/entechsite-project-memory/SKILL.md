---
name: entechsite-project-memory
description: Maintains a live technical memory for the EnTechSite repository: project purpose, architecture, stack, dependencies, work log, and issue-resolution history. Use when the user asks to document project context, record progress, update stack/dependencies, or capture problems and solutions.
---

# EnTechSite Project Memory

## Назначение

Этот скилл ведет живую техническую память проекта в файле:

- `.cursor/skills/entechsite-project-memory/project-memory.md`

Скилл фиксирует:

1. О чем проект и какие у него ключевые модули.
2. Текущий стек и зависимости по сервисам.
3. Что именно было сделано по задаче.
4. Какие проблемы были пойманы и как их решили.
5. Архитектурные и продуктовые решения.

## Когда применять

Применяй скилл, когда:

- пользователь просит "зафиксировать", "обновить контекст", "добавить в журнал";
- после существенных изменений в коде нужно оставить запись;
- во время дебага выявлена проблема и есть решение;
- нужно быстро восстановить контекст по проекту без повторного ресерча.

## Обязательный workflow

1. Прочитай `.cursor/skills/entechsite-project-memory/project-memory.md`.
2. Обнови только затронутые секции (без лишнего шума).
3. Добавь запись в `## Task Journal`.
4. Если был инцидент/дебаг, добавь запись в `## Problems and Resolutions`.
5. Если принято решение с компромиссом, добавь запись в `## Decisions`.
6. В ответе пользователю кратко укажи, какие секции памяти обновлены.

## Правила ведения памяти

- Не выдумывай факты. Записывай только то, что подтверждено кодом, командами или словами пользователя.
- Пиши кратко и конкретно, без воды.
- Для изменений и проблем указывай пути к файлам в формате `backend/src/...`.
- В секции зависимостей фиксируй только реально присутствующие пакеты из `package.json`.
- Если вопрос не закрыт, помечай как `TODO:`.

## Шаблоны записей

### Task Journal

```markdown
### YYYY-MM-DD — Короткий заголовок задачи
- Goal:
- Changes:
- Files:
- Result:
```

### Problems and Resolutions

```markdown
### YYYY-MM-DD — Короткий заголовок проблемы
- Symptom:
- Root cause:
- Resolution:
- Validation:
- Related files:
```

### Decisions

```markdown
### YYYY-MM-DD — Короткий заголовок решения
- Context:
- Decision:
- Trade-off:
- Related files:
```

## Ограничение области

- Скилл документирует контекст, а не заменяет тесты, ревью и валидацию.
- Если факт устарел, обнови существующий пункт, а не дублируй его.
