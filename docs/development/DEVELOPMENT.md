# Разработка Chromium MV3 и Firefox MV3

Поддерживаемые цели текущего `main` —
`extensions/chromium/runet-censorship-bypass/src/extension-chromium-mv3` и
`src/extension-firefox-mv3` в том же tooling root.
Корневого npm-пакета нет. Старый Open Collective donation package удалён как
не связанный со сборкой и содержавший устаревший lifecycle hook. Это не меняет
[GPL-3.0](../../LICENSE), upstream-атрибуцию или историю спонсоров в
[архивном README](../legacy/UPSTREAM_README.md).

## Требования

- Git.
- Node.js 22 и совместимый npm. Node 22 используется в GitHub Actions.
- Brave или другой Chromium-браузер с поддержкой требуемых MV3 API.
- Windows PowerShell для команд в этом руководстве; сами npm-скрипты также
  выполняются в CI на Ubuntu.

## Клонирование и установка

```powershell
git clone https://github.com/aVitomin/runet-censorship-bypass-mv3.git
Set-Location .\runet-censorship-bypass-mv3
npm ci --prefix .\extensions\chromium\runet-censorship-bypass
```

Не запускайте `npm install`, `npm ci` или npm-скрипты в корне репозитория.
Используйте только extension-scoped команды: канонический пакет и его lockfile
находятся в `extensions/chromium/runet-censorship-bypass`.

## Основные команды

```powershell
$Project = '.\extensions\chromium\runet-censorship-bypass'
```

| Этап | Команда | Когда нужна |
| --- | --- | --- |
| Документация | `node .\scripts\verify-docs.mjs` | Любое изменение документации или инструкций |
| Фокусная обратная связь | `npm --prefix $Project run test:pac` | Во время изменения PAC-семантики |
| Финальная Chromium-проверка | `npm --prefix $Project run verify:mv3` | Только Chromium runtime/UI |
| Финальная Firefox-проверка | `npm --prefix $Project run verify:firefox` | Только Firefox runtime/UI |
| Финальная общая проверка | `npm --prefix $Project run verify` | Shared runtime, templates, Gulp или общий packaged input |

`verify:mv3` и `verify:firefox` запускают target lint, deterministic tests и
проверенную сборку. `test:pac` входит в `test:mv3`, а тот — в `verify:mv3`.
`verify` выполняет все maintained deterministic suites и обе сборки один раз.
Фокусную команду можно использовать во время разработки, но после неизменённого
финального gate повторять её не нужно.
`scripts/required-checks.mjs` выдаёт advisory-план по
изменённым путям; CI и правила `AGENTS.md` остаются авторитетными.
Dependency-free docs verifier запускается из корня и не требует корневого
`package.json` или `npm install`.

## Опциональный Chrome DevTools MCP

Project-конфигурация в `.codex/config.toml` объявляет
`chrome-devtools-mcp@1.9.0`, установленный отдельно в игнорируемом каталоге
`.local/agent-tools`, и по умолчанию держит сервер выключенным. Это не
зависимость расширения: конфигурация не использует `npx`, не скачивает браузер и
не меняет tooling package или его lockfile.

Если локального пакета ещё нет, установите только проверенную версию в
игнорируемый tool cache:

```powershell
npm install --prefix .\.local\agent-tools\chrome-devtools-mcp\1.9.0 --cache .\.local\agent-tools\npm-cache --registry=https://registry.npmjs.org/ --ignore-scripts --save-exact --package-lock=true --audit=false --fund=false chrome-devtools-mcp@1.9.0
```

Включайте сервер только для отдельной локальной сессии из корня репозитория:

```powershell
codex -C . -c 'mcp_servers.chrome_devtools.enabled=true'
```

Закройте эту Codex CLI-сессию, чтобы остановить сервер; следующая обычная
сессия снова использует `enabled = false`. Opt-in проверен в CLI, но перезапуск
VS Code/IDE с этой конфигурацией отдельно не проверялся.

Сессия запускает установленный stable Chrome с временным изолированным профилем
и pipe transport. Телеметрия, CrUX, проверка обновлений и JavaScript-evaluation
tools выключены; доступны только навигация/осмотр страницы, screenshot, console
и network inspection. Если локальный пакет удалён, opt-in завершится ошибкой и
не должен заменяться глобальной установкой или запуском `@latest`.

## Опциональный Context7

Remote MCP `https://mcp.context7.com/mcp` объявлен в `.codex/config.toml`, по
умолчанию выключен и проверен с anonymous access. Для одной CLI-сессии:

```powershell
codex -C . -c 'mcp_servers.context7.enabled=true'
```

Разрешены только `resolve-library-id` и `query-docs`. Отправляйте сервису лишь
публичное имя библиотеки и общий несекретный вопрос: сформированный query
обрабатывается удалённо и может сохраняться для оценки поиска. Версия считается
точной только при явно возвращённом versioned library ID; иначе результат —
общая документация. Выход из сессии снова оставляет MCP выключенным. Для полного
удаления удалите таблицу `mcp_servers.context7` и этот раздел; API key не нужен
для проверенного базового доступа.

## Опциональное локальное QA-окружение

Необязательные machine-specific пути и наблюдения хранятся только в
игнорируемом `.local/qa/environment.json`. Агент может свериться с ним перед
явно запрошенной проверкой реального сервиса, но должен заново проверить время,
process и listener: эти данные быстро устаревают, а `null` означает неизвестное.
Ни один существующий test script не загружает файл автоматически. Синтетические
тесты от этих приложений не зависят; real-service проверки всегда включаются
явно. Tor Browser не является обычным Firefox executable для browser QA.

## Пути исходников и сборки

| Назначение | Путь |
| --- | --- |
| Chromium MV3 runtime | `extensions/chromium/runet-censorship-bypass/src/extension-chromium-mv3` |
| Service worker | `…/background/service-worker.js` |
| Popup и settings | `…/pages/popup` и `…/pages/options` |
| Manifest template | `…/manifest.tmpl.json` |
| Firefox MV3 runtime | `extensions/chromium/runet-censorship-bypass/src/extension-firefox-mv3` |
| Shared MV3 contracts | `extensions/chromium/runet-censorship-bypass/src/extension-mv3-common` |
| Версия Chromium и template values | `extensions/chromium/runet-censorship-bypass/src/templates-data.js` |
| Gulp orchestration | `extensions/chromium/runet-censorship-bypass/gulpfile.js` |
| Chromium unpacked-сборка | `extensions/chromium/runet-censorship-bypass/build/extension-chromium-mv3` |
| Firefox unpacked-сборка | `extensions/chromium/runet-censorship-bypass/build/extension-firefox-mv3` |

MV2 удалён из maintained `main`; его исходники и сборочные инструкции доступны
через Git history и frozen development branch. Chromium рекурсивно включает в
пакет всё содержимое `extension-common/pages/lib`, поэтому новый файл там меняет
packaged bytes. Nested legacy Options package отсутствует. Chromium и Firefox
build очищают только собственные output-каталоги и не зависят от порядка запуска.

## Загрузка локальной сборки

1. Выполните `build:mv3`.
2. Откройте `brave://extensions` или `chrome://extensions`.
3. Включите Developer mode.
4. Нажмите Load unpacked и выберите каталог
   `build/extension-chromium-mv3` внутри tooling root.
5. После изменений исходников снова соберите пакет и нажмите Reload.

Используйте отдельный тестовый профиль без личной истории, bookmarks и других
proxy-расширений. Не добавляйте профиль, NetLog, `build/`, `dist/` или `.tmp/` в
Git.

## Локализация

Пользовательская строка должна появиться в `en` и `ru` затронутой цели:

- `src/extension-chromium-mv3/_locales/en/messages.json`;
- `src/extension-chromium-mv3/_locales/ru/messages.json`;
- `src/extension-firefox-mv3/_locales/en/messages.json`;
- `src/extension-firefox-mv3/_locales/ru/messages.json`.

Сохраняйте одинаковые ключи и формы placeholders. После изменения проверьте обе
локали в затронутом интерфейсе и выполните `verify:mv3` для Chromium либо
`verify:firefox` для Firefox; если затронуты оба, нужны оба соответствующих gate.
Интерфейс создаёт DOM через безопасные текстовые API; не добавляйте HTML injection
sinks для сохранённых значений.

## Значки

Состояния action генерируются детерминированным скриптом. Из tooling root:

```powershell
Set-Location .\extensions\chromium\runet-censorship-bypass
node .\src\extension-chromium-mv3\test\generate-action-icons.js
npm run build:mv3
```

`build:mv3` автоматически проверяет наличие и точное имя каждого runtime icon.
Не меняйте сгенерированные PNG вручную без обновления генератора и тестов.

## GitHub Actions

Workflow [`.github/workflows/mv3.yml`](../../.github/workflows/mv3.yml) работает
на Node 22 для push и pull request в `main`. Независимые policy/supply-chain,
Chromium и Firefox jobs исполняют каждую deterministic suite и build один раз;
итоговый `Verify MV3` сохраняет стабильный required-check contract. Chrome smoke
остаётся Chromium gate. Двойная воспроизводимая упаковка и загрузка artifacts
выполняются только для trusted push или explicit dispatch exact `main`; pull
request artifacts не создаются.

## Ветки и pull request

- Создавайте узкую тематическую ветку от актуального `main`.
- Не смешивайте документацию, поведение маршрутизации и обновление зависимостей
  без необходимости.
- Не коммитьте generated output, браузерные профили, секреты или локальные
  отчёты.
- Выполните docs integrity, `git diff --check` и один финальный gate для
  затронутой области; не повторяйте уже включённые фокусные тесты. Если
  изменение затрагивает
  установку, поведение, browser support, privacy/security, команды, архитектуру
  или выпуск, обновите соответствующий текущий документ.
- Опишите влияние на безопасность, маршрутизацию и требуемую браузерную QA.
- Дождитесь успешного workflow и ответьте на review до слияния.

Подробнее: [тестирование](TESTING.md), [архитектура](ARCHITECTURE.md) и
[CONTRIBUTING.md](../../CONTRIBUTING.md).
