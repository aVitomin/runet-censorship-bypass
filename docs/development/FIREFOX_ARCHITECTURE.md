# Архитектура Firefox

Firefox production source находится в отдельной границе
`src/firefox`. Пакет готовится как воспроизводимый release
candidate; Mozilla-подписанный пакет `0.0.4.0` опубликован и входит в
пользовательские инструкции установки.

Это равноправная поддерживаемая MV3-цель в общем tooling root, а не Chromium
runtime с заменённым manifest. Общие пользовательские контракты и различия
упаковки перечислены в [общей архитектуре](ARCHITECTURE.md#общие-контракты-и-упаковка).
Единые Save / Apply и формат переноса не требуют одинаковых browser APIs,
хранилищ или recovery-механизмов и не означают синхронизацию профилей.

Чистая установка намеренно остаётся в состоянии `OFF`. Пакет содержит Firefox
MV3 manifest, непостоянную background event page, durable activation state,
production Apply/Clear RPC, routing adapter и declarative dataset runtime.
Packaged Anticensority baseline, его воспроизводимость и trust boundary описаны
в [Firefox production provider dataset](FIREFOX_PROVIDER_DATASET.md).
Adapter заранее регистрирует `proxy.onRequest` и блокирующий
`webRequest.onBeforeRequest`, поэтому manifest уже запрашивает `proxy`,
`webRequest`, `webRequestBlocking` и `<all_urls>`. `alarms` запускает 12-hour
проверку и безопасное обновление данных; при OFF оно не включает routing.
Пока durable intent равен
`OFF`, proxy listener не задаёт маршрут, а guard разрешает обычный трафик.

Firefox routing adapter фиксирует проверенную в Firefox 154.0.1 семантику
результатов `proxy.onRequest`:

- browser-neutral `DIRECT` преобразуется в top-level `null`; это явный Direct,
  отличный от `OFF`, при котором listener возвращает `undefined` и не задаёт
  маршрут;
- `{type: 'direct'}` не является эквивалентом true Direct при наличии browser
  или global `proxy.settings`, потому что Firefox продолжает применять эти
  настройки;
- `PROXY + FAIL_CLOSED` преобразуется в `[...proxyInfos, null]`, где последний
  `null` завершает proxy fallback и не создаёт дополнительный
  `webRequest.onBeforeRequest` callback;
- Chromium provider chain может заканчиваться `DIRECT`. Firefox намеренно
  удаляет только этот terminal Direct fallback: browser-neutral
  `PROXY + DIRECT` преобразуется в тот же упорядоченный
  `[...proxyInfos, null]`, с budget только для proxy-кандидатов и diagnostic
  `PROXY_DIRECT_FALLBACK_STRIPPED`;
- успешный выбор proxy и failover между proxy-кандидатами остаются
  эквивалентными. Если все кандидаты недоступны, Chromium может перейти к
  Direct, а Firefox завершает запрос fail-closed. Это намеренное различие
  safety/availability, которое не создаёт Direct route.

Обычный provider Direct остаётся поддержанным, если shared routing core уже
свёл решение к `{kind: 'DIRECT'}`. Default provider Auto больше не блокируется
до первой proxy-попытки, но полная routing parity с Chromium не заявляется.
Firefox-specific control plane содержит production Apply/Clear/recovery вокруг
global fail-closed floor, но чистая установка остаётся `OFF` до явного Apply.
Canonical floor — manual SOCKS5 `127.0.0.1:<persisted-high-port>` с `proxyDNS: true`,
пустыми HTTP/SSL/auto-config/passthrough и `httpProxyAll: false`. Port `0`,
well-known и другие low ports невалидны. Кандидат high port создаётся только
внутри proxy-control через `crypto.getRandomValues`; activation caller не
выбирает floor и не подтверждает состояние порта. Assurance identifier
`RANDOM_LOOPBACK_UNVERIFIED_V1` прямо означает, что WebExtension API не может
доказать отсутствие listener на выбранном endpoint. Port не probe-ится и не
retry-ится по network behavior.

Принятый threat model защищает от Firefox/WebExtension lifecycle и listener
failures, control loss и private-access revocation, но не от hostile local
software. Случайный занятый port возможен. Обычный non-SOCKS listener обычно
остаётся fail-closed, но это не security guarantee; доступный SOCKS service на
точном endpoint может обойти floor. WebExtension не может предотвратить
bind-after-selection. Product сознательно не требует native helper/reservation.

Durable state имеет schema v3; канонический `OFF` имеет форму:

```json
{"schemaVersion":3,"intent":"OFF","floorIdentity":null}
```

`floorIdentity` может содержать только точный canonical floor, нужный для
cleanup после interruption. Schema v1/v2 OFF мигрирует в v3 OFF; malformed и
future state нормализуются в OFF и могут сохранить только отдельно валидную
floor identity для безопасного cleanup. Ownership признаётся
только при одновременных exact identity match и
`levelOfControl === "controlled_by_this_extension"`. Clear сначала сохраняет
OFF, очищает ephemeral requestId budgets, затем освобождает только точный
owned floor и удаляет identity лишь после подтверждения release. Mismatch не
перезаписывается и не очищается.

Firefox 154 добавляет к live `proxy.settings.get()` нормализованное
`autoLogin: false`. Оно не хранится в durable identity, но exact live comparison
явно требует `false`, если поле присутствует; другие дополнительные поля и
`autoLogin: true` считаются mismatch.

На каждом event-page boot OFF reconciliation никогда не приобретает floor. Если
Firefox после disable/re-enable восстановил точный extension-owned floor,
reconciliation очищает его даже при denied private access и оставляет runtime
OFF. RPC `firefox.activation.clear` предоставляет только этот безопасный Clear;
он не вызывает `proxy.settings.set`.

Firefox-specific proxy authentication регистрируется синхронно через
блокирующий `webRequest.onAuthRequired`. Пока runtime `OFF`, resolver недоступен;
Apply/recovery публикует только синхронный resolver из exact validated storage
snapshot. `authRef` остаётся непрозрачной
routing metadata: он хранится только в bounded request-scoped map и никогда не
попадает в Firefox `ProxyInfo`. Username/password не являются полями routing
decision и request-bound routing metadata; они не логируются и не выдаются
через обычные UI reads, RPC status или diagnostics.

Auth handler возвращает credentials только при одновременном совпадении
активного `requestId`, выбранного в `onBeforeRequest.details.proxyInfo` proxy и
challenger host/port с одним validated route candidate и его `authRef`.
Website challenge с `isProxy:false` во всех runtime states остаётся browser-owned:
handler возвращает no override, не читает proxy credentials и не расходует их
retry budget. Routing guard отдельно ограничивает website-auth retries.
При `OFF` proxy handler также не вмешивается в browser auth. Missing credentials,
mismatch, malformed state и внутренний failure активного proxy challenge
отменяют его, не открывая Firefox proxy-auth prompt.

Firefox 154 повторно вызывает `onBeforeRequest` с тем же `requestId` после
каждого credential response. Поэтому routing и auth используют раздельные
budgets: непосредственно перед возвратом credentials auth разрешает ровно один
дополнительный guard callback. На request/challenger допускается максимум два
credential response. Terminal event, Clear и event-page recreation очищают как
route-auth, так и attempt state. Отмена исчерпанного auth challenge завершает
request вместо перехода к следующему proxy candidate; это известное Firefox
availability-отличие, а не Direct fallback или утечка.

Production health-проверки и provider-update control plane с отдельными HTTPS
и signed каналами реализованы. На чистой установке bootstrap проверяет и локально сохраняет
packaged baseline и default product config, но оставляет durable intent `OFF` и
не меняет proxy settings.

Production event page реализует строгий RPC
`{type: "firefox.activation.apply"}` с необязательным числовым `expectedRevision`
для применения показанной в Options Saved revision. Другие поля отклоняются, а caller
не может передать routing, credentials, dataset или floor. Product activation
factory читает одним snapshot те же записи и использует тот же parser, что и
recovery factory. Prepared input имеет строгую
форму и содержит provider key, exact dataset identity, строгий routing
descriptor, dataset store, synchronous routing-input factory и synchronous
in-memory credential resolver. Floor identity не является caller input: её
генерирует и возвращает proxy-control только после exact ownership confirmation.
Prepared functions не сериализуются; credentials сохраняются только в закрытых
credential records и retained generation, как описано ниже.

Первое включение из `OFF` сначала проверяет exact runtime input: artifact и
lookup index для Anticensority либо package-owned manual policy identity.
Затем оно требует `READY`, приобретает и подтверждает exact fail-closed floor,
записывает строгий durable `ON`, очищает старое request/auth ephemeral state и
только последним синхронным присваиванием публикует immutable active session.
До floor acquisition controller остаётся `OFF`; между acquisition и publication
обычный listener не задаёт route, а global floor закрывает сетевой путь. Clear
сначала записывает `OFF` с cleanup identity, затем скрывает session и очищает
request/auth state, и только после этого освобождает exact floor. Ошибка после
acquisition запускает тот же exact-match rollback; если release невозможен,
session остаётся недоступной, floor и durable cleanup identity остаются
fail-closed для следующего startup reconciliation.

Durable state schema v3 различает `OFF` и строгий `ON`. `ON` содержит только
canonical floor identity, provider key, exact dataset identity
(`datasetVersion` + SHA-256) и routing descriptor, который ссылается на
отдельную версионированную конфигурацию по key/version/SHA-256. Functions,
credentials, request IDs, auth attempts и session state в `ON` не сохраняются.
Malformed или future `ON` никогда не активируется; допустимая cleanup floor
identity сохраняется только для безопасного exact-match освобождения.

Новый event page начинает с `INITIALIZING`, поэтому blocking guard отменяет
запросы, пока storage intent неизвестен. `OFF` выполняет cleanup reconciliation
и только затем разрешает обычный browser routing. Для `ON` recovery сначала
требует private access и уже существующий exact extension-owned floor; старый
random port никогда не генерируется заново и floor не переустанавливается.
Затем recovery factory должен восстановить dataset store, routing-input factory,
тот же exact routing descriptor и in-memory credential resolver. Controller
принимает только exact сохранённые dataset hash и routing descriptor, строит
index, очищает ephemeral maps и публикует session последним присваиванием.
Missing/mismatched floor переводит durable intent в `OFF`, не
перезаписывая чужие settings, но сохраняет точную старую floor identity как
cleanup identity на случай, если Firefox позже восстановит слой расширения.
Missing configuration/dataset/credentials или
revoked private access оставляет session недоступной, а exact floor —
fail-closed до Clear.

`proxy.settings.onChange` регистрируется синхронно рядом с network listeners.
Если `READY` session видит что-либо кроме exact persisted floor с
`controlled_by_this_extension`, handler без ожидания скрывает active session,
переводит runtime в `BLOCKED_CONTROL_LOSS` и очищает routing/auth ephemeral
state. Асинхронная часть затем сохраняет `OFF` с retained cleanup identity;
она никогда не вызывает `set()` и не очищает setting другого расширения или
policy. Ошибка записи `OFF` оставляет runtime blocked/fail-closed и не
восстанавливает session.

Если Firefox после освобождения внешнего controller автоматически возвращает
старый exact extension-owned floor, уже `OFF` controller удаляет только этот
точно совпавший слой, восстанавливает нижележащую настройку и удаляет cleanup
identity лишь после подтверждённого release. Resurfacing никогда не означает
восстановление `ON` или `READY`. Безопасность на границе передачи control
по-прежнему зависит от своевременной доставки Firefox события
`proxy.settings.onChange`; до доставки browser может продолжать вызывать
старые routing listeners.

Prepared activation теперь фиксирует `ON` после floor confirmation, но до
session publication. Crash до записи `ON` оставляет `OFF` + cleanup identity;
startup очищает floor. Crash после записи `ON` восстанавливает exact session.
Clear сначала записывает `OFF` с cleanup identity, затем скрывает session,
очищает request/auth state и освобождает exact floor. Ошибка release сохраняет
durable `OFF` и floor identity для следующего reconciliation.

Production event page передаёт controller реальные activation и recovery
factories. Apply сначала дожидается boot initialization, допускает чистый `OFF`
или активную `READY` session, загружает immutable Saved snapshot и передаёт exact
prepared contract в serialized activation controller. Anticensority использует
существующий IndexedDB store; manual activation не читает provider dataset.
Успешный RPC возвращает только `ON`/`ACTIVE`; ошибки —
только allowlisted code без raw exception или secret. Capability
`activationSupported` равен `true`, а `providerDatasetAvailable` становится
`true` после успешной проверки и установки packaged baseline либо для
проверенной manual configuration, независимо от того, активна ли READY session.
Первый clean-start bootstrap открывает
IndexedDB для установки exact packaged bytes, но не активирует routing.

Draft существует только в Options UI и не участвует в request routing.
Save изменяет только Saved config/credentials и revision. Apply сохраняет
immutable generation в `firefoxMv3EffectiveConfigurations`: максимум текущий
Effective и один кандидат. Существующие descriptor key/version/hash и dataset
identity в durable `ON` служат точной ссылкой на Effective; версия descriptor
`settings-N` задаёт Saved revision, включая изменения только пароля.
Apply не fetch-ит и не promote-ит dataset. Подготовка новой session идёт при
работающей старой; перед commit повторно проверяются Saved snapshot, private
access и exact ownership. Запись нового `ON` — durable commit point, затем
одна синхронная замена session переключает routing и credential resolver.
Floor не очищается и не переустанавливается. Ошибка подготовки сохраняет старую
session; неоднозначная запись или утрата prerequisite оставляет blocked/fail-closed
состояние. После записи проверяются prerequisites ещё раз, до публикации `READY`.
Рестарт выбирает только generation из durable `ON`, даже при более новой Saved
revision или незавершённой Saved transaction. Для legacy 0.0.4.0 запись
фиксируется лишь после проверки совпадения всех durable bindings с прежней
config/credentials; несовпадение блокирует recovery и Save вместо угадывания.
Concurrent Apply/Clear сохраняют порядок RPC через control queue, а proxy/durable
мутации дополнительно сериализуются activation-controller queue. Поэтому
подготовка Apply не обгоняет Clear и второй floor/session не создаётся.

Non-secret product config хранится отдельно под
`firefoxMv3ProductRoutingConfig` в schema v1. Он содержит exact provider и
dataset identity, тот же routing descriptor и каноническую структуру всех
browser-neutral inputs: rules, candidate groups, flags, provider candidates и
provider fallback. `configurationSha256` — SHA-256 от детерминированных UTF-8
bytes этой строгой структуры. Поэтому recovery требует одновременного exact
совпадения provider key, dataset hash/version, descriptor key/version/hash и
уже принадлежащего расширению floor; новая active/staged/LKG версия dataset не
подменяет durable identity.

Proxy credentials находятся в отдельной schema v1 записи
`firefoxMv3ProxyCredentials`, привязанной к тому же routing descriptor.
Configuration содержит только `authRef`; credential record содержит только
строгий список `authRef`/username/password. Во время boot credentials читаются
до publication, проверяется наличие всех и только требуемых `authRef`, после
чего READY session получает синхронный in-memory resolver. Passwords не входят
в durable `ON`, routing descriptor, dataset metadata, RPC/status/errors/logs
или diagnostics. Settings RPC может записывать эту запись, но никогда не
возвращает password: ответ использует явные `NONE`/`KEEP`, а новый секрет
принимается только как `SET` внутри полного revision-checked Saved replace.
Retained generations содержат необходимые credential records, но не выходят
через RPC/diagnostics. In-flight auth context держит resolver своей generation
до terminal event; Apply не сбрасывает retry budget и не подменяет её пароли.
Missing/malformed/future config, descriptor/provider/dataset
mismatch, missing credential, hash failure или недоступный dataset store
оставляют session недоступной, а exact floor — fail-closed до Clear.

Production settings control plane предоставляет строгие
`firefox.settings.get` и `firefox.settings.replace`. Get не раскрывает
provider/dataset identity, routing descriptor/hash, `authRef` или floor.
Replace принимает complete schema v1 и разрешён в `OFF` и активном `READY`;
initializing/blocked состояния остаются read-only. Apply, Clear и Saved writes проходят через одну
event-page queue. Optimistic numeric revision отклоняет stale concurrent save.

Options держит Draft локально: Save не вызывает Apply, а Apply отключён до
сохранения/отмены правок и передаёт показанную Saved revision. Внешний Save
оставляет Draft и его прежнюю базу, отмечая конфликт; Discard edits явно
перечитывает Saved. Private-window onboarding и Check again сохраняются.

Popup редактирует Effective site mode и scope при активной защите. Единственная
кнопка Apply вызывает `firefox.site.apply` с `expectedRevision`,
`expectedEffectiveId`, `tabUrl`, `mode`, `scope`, `applyAll`. Одна control-queue
операция проверяет identities, требует явного `applyAll: true` при ранее
ожидающих Saved изменениях, пишет site patch в Saved, затем вызывает существующий
exact-revision active replacement. Успешно сохранённый site patch остаётся Saved
при ошибке подготовки. Старый OFF-only `firefox.site.replace` не используется
этим UX и не расширяет права мутации.

`firefox.configuration.get` — отдельная redacted проекция active/pending/
applying/blocked, Saved revision и opaque Effective identity для конфликтов.
Нормальный UI не показывает эти identities. Категории pending — только
`siteRules`, `proxyConnections`, `routingSettings`; пароли/адреса/descriptor и
dataset bodies не возвращаются. Состояние private access проверяется отдельно;
restricted-site permission не блокирует Apply. Safe-failure сообщение возможно
только при подтверждённой прежней активной generation. Provider checks не
перезаписывают Draft. Apply не требует refresh страницы; уже открытые соединения
могут естественно сохраниться.

Public settings schema v1 дополнена `source: "anticensority" | "manual"`.
Отсутствующее legacy поле означает Anticensority; default не меняется.
`manual` использует fixed package-owned Direct policy identity, не скачанный
artifact. Подготовка, Apply и recovery не открывают dataset store и не строят
provider index; правила сайтов, onion, группы кандидатов, Direct replacement
и noDirect сохраняют общий приоритет. Для обычного unmatched сайта при default
flags получается Direct. Exact manual identity проверяется в тех же durable
config/ON bindings, что и provider identity; произвольный hash не принимается.

Save source change меняет только Saved, Apply — exact revision без очистки floor.
Manual Effective восстанавливается и при pending Anticensority/password changes.
Проверенная Saved configuration остаётся редактируемой при недоступном provider
dataset, чтобы можно было выбрать manual; повреждённая configuration не
принимается. Bootstrap по-прежнему пытается проверить packaged provider cache,
но сначала сохраняет default Saved при его отсутствии. Неудача provider bootstrap
не препятствует manual routing; это не обещание отсутствия фоновых source checks.
IndexedDB backend открывается лениво; недоступность provider storage даёт
sanitized CHECK_FAILED/STORAGE_FAILED в status и не блокирует manual Options,
Apply или recovery. Manual policy не показывается как current provider dataset:
его version/source date в provider status отсутствуют.

Public schema хранит Direct/Proxy/whitelist patterns, own proxies, отдельные
local Tor/Tor Browser/WARP scopes и четыре общих routing flags. Patterns и
proxy hosts нормализуются в lowercase с удалением внешних пробелов и конечной
точки; `*.example` по-прежнему совпадает с base domain и subdomains, а простой
pattern — только с exact host. Firefox задаёт для Tor три независимых scope:
Proxy rules, onion и Direct replacement. Chromium сохраняет общий `enabled` и
добавляет отдельный `useForProxyRules`; доступность для Proxy равна
`enabled && useForProxyRules`. В свежей configuration оба браузера задают
SOCKS5 `localhost:9050` и `localhost:9150`, onion=true, Proxy=false,
Direct replacement=false; Chromium master включён для обоих. Для старых
structured Chromium entries с `enabled`, но без `useForProxyRules`, Proxy scope
сохраняется через default true. Explicit Saved values и отдельная legacy
`useTor` migration сохраняют прежнюю семантику. В portable format Tor `enabled`
означает Proxy scope: Chromium import включает master при любом из трёх scope,
export переносит только действующие scope. Поэтому onion-only и
Direct-replacement-only настройки переносятся без `torScope` warning.
Browser-specific DNS/timeout options остаются отдельным ограничением переноса.
Быстрые Chromium Proxy controls сохраняют действующие другие scope; включение
отключённого master включает только Proxy, не скрытые неактивные presets.
WARP также разделяет Proxy и Direct replacement; Chromium хранит отдельный
`useForProxyRules` рядом с master `enabled`. Единый набор scope для списка
кандидатов переносится в обе стороны, включая Direct-replacement-only.
Разные scope отдельных WARP entries остаются непредставимы в текущем UI и дают
`warpScope` warning. Quick Proxy switch сохраняет действующий Direct replacement;
включение отключённого master не активирует его прежний неактивный preset.

Сохранение использует write-ahead marker, затем один `storage.local.set` для
descriptor-bound product config, credential record и redacted settings commit.
Apply отказывается читать Saved snapshot, пока marker существует; recovery
читает отдельный ранее зафиксированный Effective snapshot. После
crash завершённый exact commit может быть reconciled, а partial/mismatched
config остаётся fail-closed; новая config никогда не принимается вместе со
старыми credentials. Settings RPC разрешает только source choice Anticensority
или manual; caller не передаёт произвольную dataset identity/trust и не может
promote staged data через запись настроек.

Recovery не выполняет network request. Для Anticensority production dataset
store открывается локально через IndexedDB, exact stored artifact проверяется
заново; manual проверяет fixed policy identity без dataset store.
Session публикуется только после полного успеха. Packaged
provider artifact и default product configuration присутствуют; на чистой
установке credentials не заданы. Настроенные credentials восстанавливаются
только из exact Effective generation. Provider refresh отделён от boot/recovery;
он меняет текущий dataset только через проверенный promotion transaction.

Production Gecko ID — неизменяемый UUIDv4
`{adf5f697-1149-42a2-92eb-c163cb9a4146}`. Он создан для этого Firefox
продукта и не переиспользует legacy AMO identity. Firefox следует общей версии
репозитория: development manifests и Chromium `storeVersion` имеют `1.0.0`.
Опубликованный release остаётся `0.0.4.0`; изменение source version не означает
публикацию или отправку пакета в store.

Детерминированные проверки запускаются из корня репозитория:

```powershell
$Project = '.\extension'
npm --prefix $Project run test:firefox
npm --prefix $Project run lint:firefox
npm --prefix $Project run build:firefox
```

Сборка содержит `manifest.json`, Firefox background-скрипты, exact packaged
HOST_BUCKETS_V1 artifact/envelope и точные копии browser-neutral contract в
`build/firefox`. Dataset runtime использует неизменяемые
SHA-256-addressed артефакты, строгую общую верификацию и fallback
active -> previous LKG -> packaged baseline; parsed index хранится только в
памяти event page. Неизменяемые bytes и маленькие provider pointers находятся
в отдельных object stores Firefox-specific IndexedDB; запись артефакта и
переключение pointer выполняются одной транзакцией только после проверки точных
bytes. `REMOTE_UNAUTHENTICATED` не допускается к activation; проверенный
фиксированный HTTPS source использует отдельный `REMOTE_HTTPS_VALIDATED`,
а не signed trust. Пакет
содержит только локальный declarative Anticensority baseline, описанный в
`FIREFOX_PROVIDER_DATASET.md`; PAC/JavaScript провайдера в runtime package не
входит. В `OFF` proxy settings не меняются. Firefox build не меняет Chromium
build output.

Пакет содержит строгие no-input RPC `firefox.provider.update.get`/`check`/`install`.
Production `SOURCE_UPDATE_ENABLED` включает фиксированный HTTPS data channel.
Его два разрешённых URL, parser и bounds описаны в
[контракте источника](FIREFOX_PROVIDER_DATASET.md#fixed-https-source-updates).
Downloader допускает не более трёх manual redirects только между этими двумя
точными HTTPS URL; final URL также проверяется по этому списку и exact request.
URL userinfo/query/fragment запрещены. Downloader опускает credentials/referrer
и ограничивает source/normalized data.
Он извлекает статический JSON, не исполняя скачанный PAC. SHA-256 исходных и
нормализованных bytes вычисляется локально; source timestamp проверяется по
строгому формату, допустимой дате и пределу future skew 24 часа.
`REMOTE_HTTPS_VALIDATED` означает эти проверки и HTTPS provenance, не подпись автора.

Отдельный signed-manifest канал остаётся disabled: release HTTPS manifest
endpoint и raw 32-byte Ed25519 public key со stable keyId не настроены.
Его manifest schema v1 содержит `schemaVersion`, `providerKey`, monotonic
`sequence`, `keyId`, relative `artifactPath` и dataset `envelope`. Native WebCrypto
проверяет отдельную 64-byte Ed25519 signature над точными bytes manifest;
`keyId` выбирает только pinned key. После проверки подписи, identity, byte count,
hash и dataset schema канал присваивает `REMOTE_AUTHENTICATED`.
Manifest ограничен 256 KiB, artifact — 16 MiB. Настроенный signed канал имеет
приоритет; malformed signed configuration не разрешает fallback к HTTPS.

Provider pointer schema v2 сохраняет v1 active/LKG/baseline identities и signed
anti-rollback пару `highestAuthenticatedSequence`/artifact hash. HTTPS schema v3
добавляет typed staged channel, exact source receipt/local sequence и отдельный
timestamp/content floor. Его исходная граница — дата verified packaged baseline.
Более старый source отклоняется; тот же timestamp с другим routing hash —
conflict. Одинаковые данные выбранного dataset дают UNCHANGED без перезаписи
immutable artifact или переименования packaged trust. Вернувшийся старый
artifact, когда выбран другой dataset, не считается unchanged.
Signed high-water и HTTPS receipt не подменяют друг друга.

Stage атомарно сохраняет immutable artifact и channel metadata, не меняя
active/LKG/live session/durable ON. Event page затем может выполнить exact
promotion в той же control queue. Manual `check` и 12-hour alarm используют
одну операцию check-and-promotion, сериализованную с Save/Apply/Clear.
Первый alarm при отсутствии подходящего расписания имеет задержку пять минут.
Автоматическая установка допускается только в полном OFF или активном READY
при допустимом live ownership. Если Saved или Effective выбирает manual,
promotion возвращает DEFERRED: candidate остаётся staged, installed status не
записывается, источник не меняется. Source checks при manual продолжаются.
После явного выбора Anticensority через Save/Apply normal promotion возобновляется.
В blocked/control-loss состоянии candidate также остаётся подготовленным.
Отдельный `install` применяет точный staged candidate после
устранения препятствия. Ни URL, ни trust, ни bytes не являются RPC input.

В OFF journal v1 для signed или v3 для HTTPS связывает IndexedDB
active/LKG/staged pointers с `productConfig.datasetIdentity` для следующего Apply.
Он не получает proxy control и не включает защиту. В READY journal v2 для signed
или v4 для HTTPS добавляет exact Effective routing descriptor; HTTPS journal
также связывает source ID/hash/date. Подготовка читает staged dataset и
неизменяемую **Effective** user configuration/credentials, пока старая session
обслуживает запросы. `replacePrepared` повторно проверяет Effective identity,
staged channel/receipt, private access и ownership; сохраняет новый durable ON,
затем публикует routing и credential resolver одной generation. Clear, OFF и
повторного floor acquisition нет.

После commit journal завершает dataset pointers и меняет только dataset
metadata в Saved config. Если Saved=N+1, а Effective=N, revision N и его credentials
остаются Effective с новым dataset; N+1 остаётся pending. Password/settings records
не переписываются. Старые request-bound auth bindings сохраняются.
При restart active journal v2/v4 использует durable ON как commit decision:
OLD оставляет старый dataset, NEW завершает exact staged promotion. Recovery
никогда не выбирает latest Saved вместо Effective. Несогласуемый journal
блокирует activation/recovery. Ошибка подготовки оставляет старую session и
provider pointers; неоднозначная ошибка после commit сохраняет floor и требует
blocked recovery. Apply и settings mutation запрещены при незавершённом journal.

В `firefoxMv3ProviderUpdateStatus` сохраняются только schema, фиксированный
статус, timestamps и очищенная error category. Публичный status добавляет
current/staged public dataset versions, update availability/configuration,
канал `HTTPS`/`SIGNED`/`NONE` и source-data timestamp отдельно от check timestamp;
URL, key/signature bytes, provider/hash identity, endpoints, authRef,
credentials, floor и browsing data из RPC/UI исключены. Прерванный CHECKING
после event-page recreation становится `UPDATE_INTERRUPTED`; verified staged
artifact при этом остаётся авторитетным в IndexedDB.

Отдельный
локальный smoke с установленным Firefox 154.0.1 и одноразовым профилем можно
запустить командой:

```powershell
npm --prefix $Project run test:browser:firefox-lifecycle
```

Smoke проверяет реальное уничтожение и пересоздание event page после idle,
сохранение `OFF` и отсутствие изменений заранее настроенного localhost proxy.
Он не является обязательным сетевым CI-шагом и не проверяет новый источник
данных. Signed-manifest endpoint/public key остаются unconfigured; release
signing и store submission не следуют автоматически из успешных local gates.

Firefox package содержит собственные toolbar popup и Options page с локальными
EN/RU catalogues. Popup показывает `OFF`, `INITIALIZING`, `ACTIVE`, `RECOVERED`
или blocked state только из sanitized capabilities и вызывает существующие
Apply/Clear без caller-controlled configuration. Private access и dataset
availability показаны отдельно; `ACTIVE` отображается только для runtime
`READY` и не показывается при denied private access.
Загрузка и обновление popup используют один `firefox.popup.get` с единственным
полем `tabUrl` через общую очередь control operations. Тот же helper, что у
Options, заново проверяет Saved и существующий Effective один раз на запрос.
Маршрут сайта, доступность proxy candidates и diagnostics используют Effective
(Saved только при отсутствии Effective); pending summary содержит текущую
Saved revision. Ответ ограничен capabilities, site, operational и configuration:
полный URL, settings и credentials в него не входят. UI проверяет все четыре
проекции до замены состояния. Между запросами проверенные snapshots не хранятся;
standalone site/operational RPC продолжают самостоятельно читать и проверять данные.

Options page отражает schema v1 production settings control plane:
source Anticensority/manual, Direct/Proxy/whitelist rules, own proxies,
local Tor, Tor Browser, WARP и четыре
routing flags. Rules editor — единый список с host, scope, route/type и add/delete.
Загрузка и обновление Options используют один строгий no-input RPC
`firefox.options.get` через общую очередь control operations. Ответ содержит
только существующие публичные проекции capabilities, Saved settings, operational
status, provider update status и configuration summary. В пределах запроса
Saved проверяется один раз, Effective — отдельно, если он существует;
диагностика использует Effective, редактор — Saved. Проверенные snapshots не
сохраняются между запросами: следующее открытие заново читает storage и проверяет
dataset identity. Ownership и private access читаются из browser API; raw
generation records и passwords в bundle не попадают. UI проверяет все пять
проекций до обновления состояния и отбрасывает ответ, если status event уже
потребовал нового чтения; незаписанный Draft остаётся локальным.
UI adapter не мигрирует storage: Direct/Proxy и whitelist сохраняют свои buckets,
порядок и пересечения; старые wildcard patterns показываются отдельно без
нормализации. Auto удаляет только выбранную запись, а whitelist не выдаётся за
принудительный Auto. Правки остаются Draft до revision-checked Save и не
синхронизируются между браузерными профилями. Как и Chromium, plain host означает exact host, wildcard
`*.example.com` — base + subdomains; defaults остаются
`useProviderProxies=true`, `ownProxiesOnlyForOwnSites=true`,
`replaceDirectWithProxy=false`, `noDirect=false`. Firefox-specific Tor scope
показывается напрямую, без Chromium-only master control. Arbitrary provider
source и migration controls намеренно отсутствуют. Maintenance предоставляет
no-input обновление данных с check и допустимым install при OFF/READY,
отдельный install сохранённого candidate, user-triggered connection check для
последнего explicit Proxy origin и sanitized diagnostics.
Firefox CSP разрешает `connect-src http: https:` для этой явной проверки и
фиксированных HTTPS source requests; connection-check запрос
нормализован до origin, не отправляет cookies/referrer, не следует
redirects и не читает response body. Проверка не меняет rules, dataset,
credentials или proxy ownership и не использует отдельный telemetry endpoint.
Options позволяет редактировать и сохранять при `OFF` или активном `READY`.
Save не применяет правки; отдельная кнопка Apply передаёт ожидаемую Saved
revision, отключена при несохранённом Draft и не запускает Clear.
Conflict сохраняет Draft со старой базой; явный Discard edits загружает
последний Saved. Stored password никогда не
загружается в DOM: unchanged value использует `KEEP`, новый password передаётся
только явным `SET`, удаление — явным `NONE`. Pages строят DOM через text nodes и
`textContent`, используют только extension-local scripts/styles и не добавляют
permissions или remote assets.

Popup текущего Firefox target также читает активную HTTP(S)-вкладку и через
строгие `firefox.site.get` / `firefox.site.apply` RPC показывает Auto / Proxy /
Direct с exact-host или public-suffix-aware domain scope. Site mutation проходит
через ту же serialized settings transaction и exact-revision promotion при OFF/READY;
full tab URL не возвращается странице. Сравнение пользовательских поверхностей
и честный список оставшихся отличий зафиксированы в
[Chromium / Firefox UI parity matrix](FIREFOX_CHROMIUM_UI_PARITY.md).

Firefox `browser.action` badge/icon/title строится из текущих authoritative
activation, proxy-control и site snapshots: `OFF`, `A`, `P`, `D`, `EXT`, busy,
loading и warning не имеют отдельного persisted routing state. После recreation
event page повторно вычисляет presentation. Индикаторы OFF, loading, busy,
warning и известной потери control не читают site settings и dataset, поскольку
не используют маршрут сайта. Для A/P/D site snapshot читается заново; общего
кэша проверенных данных между обновлениями нет. Вытесненное новым событием
обновление прекращается после initialization, чтения вкладки или site snapshot,
до следующей дорогой операции. Уже начатое чтение завершается, но его результат
не публикуется. Toolbar держит максимум одно выполняющееся site read:
последующие обновления ждут его завершения и повторно проверяют актуальность
запроса и activation. Только последнее актуальное обновление начинает своё
чтение; snapshot предыдущей вкладки не переиспользуется. Ошибка чтения также
освобождает ожидание. OFF/busy и другие не зависящие от маршрута индикаторы
проходят без ожидания этого чтения. Promise существует только в текущей event
page и не участвует в durable recovery. Перед финальным вычислением presentation
остаётся живое чтение proxy control, после него используется актуальный
activation snapshot.
Permission `notifications` служит
только фиксированным локализованным alerts о control loss, blocked recovery и
ошибке явно запрошенной health-проверки. Уведомления и diagnostics не включают
hostname/URL, proxy endpoints, credentials, `authRef`, dataset hashes или floor
identity; normal startup, `OFF` и успешная recovery не создают уведомлений.
