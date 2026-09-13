# Приватность и безопасность

Этот документ описывает Chromium MV3 и Firefox MV3. Опубликованный `v0.0.3.0`
содержит только Chromium-пакет; Firefox станет пользовательским продуктом после
Mozilla signing совместного выпуска. Расширение не является VPN-сервисом и не
гарантирует анонимность или отсутствие DNS-утечек.

## Разрешения

### Chromium

| Разрешение | Назначение |
| --- | --- |
| `proxy` | Читать владельца proxy settings, применять и снимать PAC расширения. |
| `alarms` | Восстанавливаемое периодическое обновление источника маршрутизации. |
| `storage` | Локальные настройки, статусы и ссылки на PAC-артефакты. |
| `notifications` | Ограниченные уведомления об ошибках источника, управления и прокси. |
| `offscreen` | Явный аудит исторического `localStorage` при миграции. |
| `webRequest`, `webRequestAuthProvider` | Ошибки прокси и proxy-auth для точно настроенного endpoint. |
| `activeTab` | Определить текущий сайт для Auto/Proxy/Direct. |

Chromium host permissions включают встроенные PAC-источники и `<all_urls>`.
Широкий доступ нужен для proxy-auth, наблюдения ошибок и явной проверки маршрута;
расширение не внедряет content script на каждую страницу.

### Firefox

| Разрешение | Назначение |
| --- | --- |
| `proxy` | Получать маршрут запроса, владеть fail-closed proxy floor и безопасно выполнять Clear. |
| `webRequest`, `webRequestBlocking` | Синхронно разрешать только ожидаемые proxy callbacks и обрабатывать request-scoped proxy-auth. |
| `storage` | Хранить OFF/ON intent, пользовательскую конфигурацию и отделённые credential records. |
| `alarms` | Запускать редкую аутентифицированную проверку обновления набора данных; alarm может только stage-ить данные. |
| `notifications` | Сообщать только о потере контроля, блокировке recovery и запрошенной проверке, требующей внимания. |

Firefox использует `<all_urls>` для полной маршрутизации и fail-closed guard.
Mozilla manifest отдельно декларирует `authenticationInfo` и
`browsingActivity`, потому что расширение видит proxy-auth challenge и принимает
решение о маршруте. Это disclosure разрешений, а не сбор телеметрии: данные не
отправляются разработчикам.

## Что хранится локально

- Общие пользовательские правила, флаги и прокси-подключения.
- Chromium хранит PAC-артефакты в IndexedDB, а в `mv3State` — ссылки, хэши и
  очищенные статусы.
- Firefox хранит проверенный декларативный `HOST_BUCKETS_V1` dataset в
  IndexedDB, exact identity активного набора и crash-recovery metadata.
- Сохранённый пароль собственного прокси находится только в отдельной локальной
  credential record соответствующего браузера.
- Краткоживущие request IDs, callback budgets и auth attempts существуют только
  в памяти background context и исчезают при его пересоздании.

Пароли не входят в PAC/dataset, durable ON descriptor, popup, options response,
diagnostics, notifications, ошибки или логи. Интерфейс получает только
`KEEP / SET / NONE`: сохранённое значение никогда не читается обратно в DOM.
Удаление расширения обычно удаляет его browser storage; облачного резервного
копирования продукт не предоставляет.

## Сетевые обращения

- Chromium проверяет начальный и final URL источника, запрещает URL credentials,
  ограничивает размер/время/UTF-8 и не выполняет скачанный PAC через
  `eval`/`Function` в extension runtime.
- Firefox поставляет локальный декларативный dataset. Authenticated updater
  умеет вручную и раз в 12 часов получать только fixed release manifest,
  signature и dataset с одного HTTPS origin. В текущем исходном состоянии
  release URL/public key ещё не заданы, поэтому fetch и alarm отключены.
  Проверенные данные сначала только stage-ятся; active routing не меняется без
  отдельной OFF-only установки.
- Запущенная пользователем проверка подключения обращается к текущему целевому
  origin без cookies/credentials и не меняет правила, dataset или proxy
  ownership.
- Исходный код не содержит телеметрии, аналитики или отдельного сервера сбора
  событий.

Провайдер данных и выбранный прокси видят сетевые данные в пределах своей роли.
Добавляйте только доверенные пользовательские прокси и источники.

## Платформенные границы

### Chromium PAC

Chromium исполняет приготовленный PAC браузерным механизмом. Он применяется с
`mandatory: false`; ошибка инициализации/исполнения может привести к browser-level
Direct fallback. Поэтому Chromium нельзя называть полностью fail-closed, даже
если явная Proxy-ветка создаётся только с пригодными кандидатами.

### Firefox fail-closed model

Firefox сначала приобретает точный extension-owned SOCKS5 floor, затем
публикует READY session. Synchronous guard выдаёт callback budget только после
валидации маршрута. Потеря контроля, private-window permission или recovery
немедленно убирает session; чужая настройка не перезаписывается. После
исчерпания provider proxy chain Firefox намеренно fail-closed вместо Chromium
terminal Direct fallback.

Floor использует криптографически случайный высокий loopback port. Browser API
не умеет зарезервировать или доказать, что порт свободен. Случайное совпадение
возможно; подход не является границей против вредоносного локального процесса,
который может поднять SOCKS-сервис на выбранном endpoint. Native helper в
продукт не входит.

Firefox Apply требует private-window access. После отзыва разрешения глобальный
floor остаётся fail-closed, а Clear по точному совпадению остаётся доступен.

## Обновления и владение

Обновление данных не должно само включать прокси. Chromium reapply разрешён
только при совпадении активной metadata и живого ownership. Firefox сначала
stages аутентифицированный dataset, а promotion возможен только в OFF и не
подменяет exact dataset активной ON session.

Apply/Recovery требуют точного совпадения dataset, routing descriptor,
credential descriptor и ownership. Clear сначала делает intent OFF и session
недоступной, затем снимает только собственную точно совпавшую настройку. Настройка
другого расширения или политики не очищается.

Проверка подключения не доказывает анонимность, отсутствие DNS-утечек или
успешную аутентификацию всех будущих запросов.

## Сообщить о проблеме безопасности

Не публикуйте пароль, приватный endpoint, полный URL с query string, dataset/PAC
или историю посещений в обычном issue. Отправляйте уязвимости через
[приватную форму GitHub](https://github.com/aVitomin/runet-censorship-bypass-mv3/security/advisories/new)
согласно [политике безопасности](../../SECURITY.md). Пользовательские инструкции
есть в [руководстве по установке](INSTALLATION.md) и
[разделе решения проблем](TROUBLESHOOTING.md).
