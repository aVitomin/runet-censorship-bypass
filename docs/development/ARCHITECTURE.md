# Архитектура Chromium MV3

Поддерживаемый `main` содержит отдельные Chromium MV3 и Firefox MV3 runtime и
browser-neutral `extension-mv3-common`. Исторический MV2 runtime удалён из
maintained source tree и доступен через Git history/frozen development branch.
Gulp переносит в Chromium только пять явно перечисленных общих статических
ресурсов и собственный каталог `src/extension-chromium-mv3`.

## Общая схема

1. Popup и options запрашивают очищенную модель через внутренний RPC.
2. `background/service-worker.js` координирует состояние, PAC lifecycle,
   Chromium proxy API, health, auth и action status.
3. Нормализованное управление хранится в `chrome.storage.local` как `mv3State`.
4. Сырые и приготовленные PAC-тела хранятся отдельно в IndexedDB
   `mv3PacArtifacts`; в состоянии остаются ссылки, хэши и метаданные.
5. Chromium исполняет применённый PAC. Код расширения не выполняет загруженный
   текст как JavaScript.

## Service worker

Service worker синхронно импортирует фоновые модули и регистрирует listeners до
асинхронного восстановления. При пробуждении он восстанавливает поведение из
локального состояния, IndexedDB, alarms и живого `chrome.proxy.settings`, а не
из прежних переменных процесса.

Очереди операций, debounce-карты и action cache живут только в памяти worker.
Request-generation bindings и bounded auth attempts хранятся в
`chrome.storage.session`: переживают остановку worker, но не browser restart.
Effective configuration остаётся в `chrome.storage.local`.

## Состояние и атомарные обновления

`background/state.js` владеет schema defaults, нормализацией и очередью
операций. Каждая queued mutation перечитывает актуальный storage snapshot,
вычисляет изменение и записывает нормализованный результат в одной операции.
Это предотвращает потерю параллельных изменений одного поля внутри активного
worker.

Сама очередь не переживает restart. Поэтому долгие workflow используют durable
generation/fingerprint и проверяют свежесть на асинхронных границах.

## Жизненный цикл PAC

### Download

Источник проверяется до `fetch`; после redirect проверяется конечный URL.
Допустимы HTTPS и loopback HTTP, credential-bearing URL запрещён. Deadline
охватывает чтение body, размер ограничен 16 MiB, UTF-8 декодируется в строгом
режиме. URL источника перебираются последовательно в заданном порядке.

### Store

Валидный текст хэшируется и сохраняется content-addressed артефактом IndexedDB.
Основное состояние получает только метаданные и `artifactRef`. Старое inline
PAC-тело удаляется только после успешной недеструктивной миграции в артефакт.

### Cook

PAC cooker нормализует правила и методы, формирует wrapper и сохраняет cooked
артефакт. Учётные данные собственного прокси исключаются. Явная Proxy-ветка
требует хотя бы одного пригодного кандидата и не содержит provider fallback или
преднамеренного `DIRECT`.

### Apply

Перед `chrome.proxy.settings.set` проверяются provider, хэши raw/cooked,
ревизия modifiers, workflow generation, живой владелец настройки и финальный
fingerprint. Применение использует `mandatory: false`; строгая сгенерированная
ветка не равна browser-level fail-closed гарантии.

## Свежесть workflow

Долгое обновление может пересекаться со сменой provider, правила, повторным
apply или clear. `pacWorkflowGeneration` инвалидирует старые download/cook
цепочки, а in-memory apply token не позволяет устаревшему callback записать
успех поверх нового действия. Перед финальной записью повторяются durable и
live-control проверки.

## Saved и Effective generations

`mv3State.savedRevision` — ревизия Saved provider/source, modifiers и auth-enabled
configuration. Она изменяется при сохранении, включая замену только пароля.
`pacModsRevision` сохраняет прежний контракт redacted credential placeholders;
`pacWorkflowGeneration` по-прежнему инвалидирует операции, но не определяет
Effective.

### Unified Apply в Options и popup

Options сохраняет Draft локально; Save пишет только Saved. Apply отключён при
несохранённых правках и вызывает `applySavedConfiguration` с показанными
`expectedRevision` и `expectedEffectiveId`. Discard edits загружает Saved,
не меняя Effective. В Chromium существующие формы сохраняются по разделам;
панель действий предлагает сохранить текущий раздел. Чужая Saved revision
помечает несохранённую форму конфликтной, не перезаписывая её поля.

Popup показывает Effective site mode. Выбор Auto/Proxy/Direct и scope остаётся
локальным до Apply; закрытие popup отбрасывает Draft. `applySiteConfiguration`
в одной backend-операции проверяет Saved/Effective, пишет только site patch,
затем применяет точную полученную revision. Если Saved уже отличается от
Effective, требуется отдельное явное Apply all saved changes; Review in Options
ничего не применяет. Устаревшее подтверждение отклоняется. Успешный Save при
неуспешном Apply остаётся Saved; автоматического rollback нет.

UI mutations сериализованы с promotion через RPC configuration queue.
Долговечные revision/workflow и live ownership проверки остаются
авторитетными. `getConfigurationStatus`/поле `configuration` возвращают только
control flags, opaque identities и allowlisted категории изменений
(`siteRules`, `proxyConnections`, `routingSettings`). Draft dirty/stale хранится
только в UI. Ни endpoints, ни credential hashes, ни PAC bodies в эту проекцию
не входят. Сообщение о сохранении старой защиты допускается только при повторно
подтверждённом прежнем Effective. Provider refresh не сбрасывает pending/Draft.

Apply не требует обновления страницы. Уже установленные TCP/QUIC соединения и
браузерный auth cache могут продолжить работать по прежним параметрам.

`background/effective-config.js` хранит приватный `mv3EffectiveConfigurations`:
immutable records с отдельным UUID, Saved revision, необходимыми settings и
credential bindings, provider/source metadata и raw/cooked artifact references.
Обычный Save не изменяет эти записи. PAC body остаётся в IndexedDB; credential
records не входят в RPC, diagnostics или журналы. PAC hash не является generation
ID: два поколения с одинаковыми PAC bytes могут иметь разные пароли.

Apply фиксирует точную Saved revision в начале workflow (RPC также принимает
`expectedRevision`). Кандидат проверяется до native write. Durable journal
`prepared` удерживает предыдущую и новую записи; `switching` записывается после
повторной проверки Saved и proxy ownership непосредственно перед `settings.set`.
После callback проверяются фактические PAC bytes/hash и ownership, затем durable
Effective pointer переключается на кандидата. Clear/Direct/OFF между поколениями
не используется. Ошибка подготовки оставляет прежний Effective; неоднозначная
native/durable запись не подтверждается как успешная. Явный Apply может разрешить
неоднозначность новой проверенной транзакцией.

`webRequest.onBeforeRequest` ставит binding request ID → generation в общую
очередь с promotion. Redirect сохраняет первый binding; `onAuthRequired` читает
его, а не latest Saved. Challenge допускает только matching host/port из этой
generation; retry budget также связан с generation. Запросы, начавшиеся внутри
`switching`, получают запрещающий binding. Неизвестный request/endpoint не
получает сохранённые credentials. `onCompleted`/`onErrorOccurred` удаляют binding
и попытки; потерянный terminal event не приводит к привязке к более новой
generation. Лимиты: 2048 request bindings и 32 retained generations. При заполнении
request map новые bindings запрещаются до browser restart; старые продолжают
обслуживаться. При лимите generations новый Apply отклоняется до освобождения
записей. GC сохраняет только Effective, journal references и поколения живых
bindings. Очистка PAC cache не удаляет используемые ими артефакты.

Chrome не передаёт PAC-generation token и не объединяет proxy.settings и auth в
native transaction. Request-start binding плюс проверка challenger — доступная
граница согласованности; неоднозначным запросам credentials не выдаются.
Установленные соединения и браузерный auth cache могут пережить Apply; код не
обещает мгновенное переключение существующих TCP/QUIC connections и не требует
page refresh. `mandatory:false` и прежние control-loss правила сохраняются.

Periodic/manual provider-refresh pipeline готовит PAC из Effective user
configuration, если она подтверждена. Pending Saved modifiers, credentials и
provider selection не подставляются в refresh. Его cache metadata остаются
отдельными до promotion; Saved cache pointers обновляются лишь при совпадении
Saved с применённой configuration. Download/cook-only действия не включают proxy.

## Владение proxy settings

Сохранённый статус не считается достаточным: worker перечитывает живой
`levelOfControl`. При управлении другим расширением или policy UI показывает
`EXT`, а apply/clear не должны перехватывать настройку.

Chromium не даёт атомарный compare-and-set между последним чтением владельца и
обработкой `settings.set`. Эта узкая native timing boundary остаётся известным
ограничением.

### Восстановление после полного browser restart

На старте worker строит план восстановления только для последнего успешно
применённого поколения. Effective record сверяется с actual browser PAC/control;
при разрешённом восстановлении из system mode используется retained Effective,
даже когда Saved новее. PAC заново не скачивается и не готовится.

Interrupted `prepared` восстанавливает прежний matching Effective. Для
`switching` разные PAC hashes позволяют выбрать только однозначно совпадающую
запись. При одинаковом PAC и разных credential generations выбор невозможен:
auth остаётся заблокированным до явного Apply. Последующая Saved revision не
используется как доказательство. Legacy 0.0.4.0 без Effective binding допускает
миграцию лишь с подтверждённым PAC provenance и без credential ambiguity. Если
настроены credentials, старый PAC не доказывает, какие из них применялись:
сохранённые секреты не отправляются до явного Apply; proxy settings не очищаются.

Persisted Clear/Turn off запрещает восстановление. Новый manual Apply/Clear или
изменение конфигурации инвалидирует старый startup plan; external controller или
policy всегда приводит к пропуску без `settings.set`.

## Supervisor здоровья proxy

Health state привязан к точному кандидату, revision, target origin и browser
session. После startup reconstruction проверка планируется с 30-секундной
задержкой. Успех имеет TTL один час; proxy-specific failures используют
ограниченный backoff 1/5/15/30/60 минут, затем максимум один повтор в час.
Ошибка прошлой browser session становится нейтральной и stale до новой
проверки. Alarm и durable metadata позволяют восстановить расписание после
остановки worker.

Supervisor наблюдает browser proxy errors и выполняет credential-free fetch,
но не меняет PAC, A/P/D, provider или ownership. Неоднозначная destination,
DNS или TLS ошибка не классифицируется как доказанный отказ proxy.

## Маршрутизация

`background/site-scope.js` использует bundled `tldts` для доменной области.
Порядок важных решений: явный Direct, явный Proxy, whitelist miss, `.onion`,
затем provider policy. Порядок кандидатов Proxy: собственные прокси, локальный
Tor, Tor Browser, WARP.

Безопасные defaults сохраняют provider proxy, ограничивают собственные методы
собственными сайтами и не включают Direct replacement или `noDirect` без
явного opt-in.

## Поверхности интерфейса

- Popup — глобальное включение/выключение, текущий сайт, краткий status и
  переход в настройки.
- Options — семь секций, draft handling, применение конфигурации, diagnostics,
  maintenance и ручной импорт/экспорт конфигурации.
- Action icon — вычисляемая модель A/P/D, OFF, EXT, busy и warning для активной
  вкладки.

Страницы используют `textContent`/DOM APIs и получают только redacted RPC
модели. Они не читают фоновые globals и не загружают удалённые скрипты.

## Границы безопасности

- Недоверенный PAC остаётся данными до передачи Chromium.
- Пароли остаются в локальном state для proxy-auth и не попадают в PAC/UI/logs.
- Диагностика скрывает PAC body, приватные source URL и reusable credentials.
- Auth применяется только к proxy challenge точного host/port и имеет retry
  limit.
Исторический аудит, предшествующий исправлениям beta 1, сохранён в
[`docs/legacy/audits/`](../legacy/audits/). Актуальный performance audit находится
в [`audits/PERFORMANCE_AUDIT.md`](audits/PERFORMANCE_AUDIT.md).
