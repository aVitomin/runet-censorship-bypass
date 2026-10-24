# Chromium / Firefox: матрица пользовательского интерфейса

Матрица описывает реализованные пользовательские контракты development `1.0.0`.
`PARITY` означает одинаковый workflow, `EQUIVALENT` — сопоставимый результат
при разной реализации, `IMPLEMENTATION_DIFFERENCE` — текущий выбор UI или
реализации, а не ограничение browser API, `INTENTIONAL_ROUTING_DIFFERENCE` —
явно выбранная routing policy,
а `MISSING` — функция, пока отсутствующая в production target.
Эти обозначения не заменяют browser QA выбранной release-сборки.

Draft → Save → exact Apply сохраняет pending Saved отдельно от Effective.
Firefox поддерживает Anticensority и ручной источник; сетевое обновление
фиксированных HTTPS данных работает отдельно от ещё не настроенного signed
канала. Текущие transaction/recovery контракты описаны в
[Firefox architecture](FIREFOX_ARCHITECTURE.md).
Исторический visual gate `0.0.4.0` в конце страницы не проверяет новые изменения.

## Popup и управление

| Функция Chromium | Firefox | Статус | Примечание |
| --- | --- | --- | --- |
| Состояния Off / Active / busy / error | Off / Active / Recovered / Initializing / blocked | PARITY | Active показывается только после `READY`; recovery виден отдельно. |
| Текущий hostname | Нормализованный hostname текущей HTTP(S)-вкладки | PARITY | Полный URL, path и query не возвращаются из background RPC. |
| Auto / Proxy / Direct | Auto / Proxy / Direct | PARITY | Auto снимает применимые overrides; дальнейший маршрут зависит от источника и общих правил. |
| Exact host | Exact host | PARITY | Plain hostname. |
| Domain + subdomains | Domain + subdomains | PARITY | Оба target используют `tldts` с private suffixes; правило имеет вид `*.example.com`. |
| Pending / not applied | Отдельные Draft, Saved и Effective | PARITY | Options Save не применяет настройки; popup предупреждает перед включением других pending Saved изменений. |
| Apply | Production `firefox.activation.apply` | EQUIVALENT | Firefox приобретает floor при включении; active replacement сохраняет его и заменяет exact generation без OFF. |
| Clear / Turn off | Production exact-ownership Clear | EQUIVALENT | Firefox освобождает только принадлежащий расширению proxy layer. |
| Settings | Options page и deep link к Proxy connections | PARITY | Только локальные extension pages. |
| Browser/extension pages unavailable | Явное uncontrollable state без route controls | PARITY | Поддерживаются только HTTP(S) tabs. |
| Proxy candidate unavailable | Apply заблокирован, ссылка на Proxy connections | PARITY | Background также отклоняет Proxy rule без кандидата. |
| External proxy control | Отдельное external/control-loss state | EQUIVALENT | Firefox синхронно withdraw-ит session и не перезаписывает внешний setting. |
| PAC freshness / last download | Source-data date, check time, channel и staged-update status | EQUIVALENT | Firefox проверяет статические HTTPS данные без исполнения PAC и без author signature; источник может остаться неизменным. Signed channel отдельный и unconfigured. |
| Proxy health summary/check | Ручная проверка текущего explicit Proxy origin | EQUIVALENT | Не меняет routing; Firefox не запускает automatic health и не использует telemetry endpoint. |
| Toolbar A/P/D/OFF/EXT badge и state icons | A/P/D/OFF/EXT, busy/loading/error icons и title | PARITY | Строятся из authoritative activation, proxy-control и current-site state после event-page recreation. |

## Options

| Функция Chromium | Firefox | Статус | Примечание |
| --- | --- | --- | --- |
| Overview | Protection/source/private-access state | PARITY | Состояние маршрутизации и доступность данных показаны отдельно. |
| Routing sources | Anticensority или Only my rules and connections | EQUIVALENT | Ручной режим не требует provider dataset; Save source не меняет Effective до Apply. |
| Дополнительные PAC providers и custom PAC URL | Не представлены в production Firefox UI | MISSING | Firefox имеет native PAC API, но текущий runtime использует фиксированные declarative data. Это граница реализации, не утверждение невозможности browser API. |
| Site rules | Единый список Direct / Proxy / whitelist | PARITY | Background остаётся авторитетным validator; порядок и пересечения сохраняются. |
| Own proxy candidates и порядок | Own proxy candidates и порядок | EQUIVALENT | HTTP/HTTPS/SOCKS4/SOCKS5 и общий порядок; отдельные Firefox DNS/timeout options дают предупреждение при переносе в Chromium. |
| Proxy credentials | KEEP / SET / NONE | PARITY | Stored password не читается обратно в page state; request auth остаётся связан с Effective. |
| Local Tor / Tor Browser / WARP | Явные scoped controls | EQUIVALENT | Три Tor scope и два WARP scope переносятся независимо, включая использование только для замены Direct; Chromium сохраняет master enabled. Для WARP scope общие на весь список: mixed per-entry scopes остаются ограничением переноса. |
| Safe routing defaults | Те же browser-neutral defaults | PARITY | Provider=true, own-sites-only=true, replace-Direct=false, noDirect=false. В новой configuration Tor использует только onion: localhost:9050 → localhost:9150; старые сохранённые значения не заменяются. |
| Import / Export | Portable Saved + отдельный support export | EQUIVALENT | Anticensority/manual source переносится; неподдерживаемые custom/Antizapret source и browser-specific options показываются до импорта. Import не применяет и не включает routing. |
| Maintenance section | Current/source date, HTTPS refresh, deferred install | EQUIVALENT | Проверенные данные устанавливаются при допустимом OFF/READY; Effective user settings сохраняются, pending Saved не применяются. |
| Manual/periodic provider refresh | No-input refresh и 12-hour alarm | EQUIVALENT | Check и допустимый promotion выполняются одной serialized операцией. OFF остаётся OFF; blocked/manual Saved или Effective оставляет candidate staged. Source checks продолжаются и в manual mode. |
| Proxy health и diagnostics | Maintenance check и redacted report/export | EQUIVALENT | URL, endpoints, authRef, hashes, floor и credentials исключены из публичной status проекции. |
| Advanced Direct policy | replaceDirectWithProxy / noDirect | PARITY | Общий routing contract применяется и в manual mode. |
| Notifications | Control-loss/recovery/health alerts | EQUIVALENT | Фиксированный локализованный текст, cooldown и переход в Maintenance; обычные background events не создают уведомления. |
| About/version | About с package version и local-code statement | PARITY | Никаких remote executable assets. |
| EN/RU | Firefox browser i18n EN/RU | PARITY | Firefox следует выбранной locale браузера. |
| Встроенный language selector | Нет | IMPLEMENTATION_DIFFERENCE | Текущий UI следует browser locale и не хранит отдельную preference. Собственный выбор языка технически возможен, но пока не реализован. |

## Routing differences, видимые пользователю

- Общий порядок собственных кандидатов — own proxies → local Tor → Tor Browser
  → WARP. Участие Tor в Proxy, onion и Direct replacement независимо; WARP
  разделяет Proxy и Direct replacement. Быстрые Chromium Proxy switches
  сохраняют действующие другие scope и не включают
  скрытые неактивные presets.
- В текущем Firefox runtime terminal `PROXY + DIRECT` fallback намеренно
  удаляется: при исчерпании provider proxy chain запрос завершается отказом.
  Это `INTENTIONAL_ROUTING_DIFFERENCE` текущей реализации, а не доказательство,
  что Firefox native PAC не может вернуть Direct.
- Исчерпание proxy-auth retry budget в Firefox завершает запрос вместо перехода
  к следующему proxy candidate. Успешный обычный failover не доказывает полную
  auth/fallback parity. Website 401 остаётся browser-owned в обоих targets и
  никогда не получает сохранённые proxy credentials как website credentials.
- Save не применяет изменения, Apply не требует выключать защиту. Firefox
  требует private-window access и сохраняет exact owned floor при замене
  generation; Chromium имеет другую browser PAC/ownership модель.
- Firefox blocking floor допускает столкновение с локальной службой и не является
  защитой от hostile local software. Chromium `mandatory:false` также не обещает
  browser-level fail-closed.

## Границы реализации и evidence

Дополнительные PAC/custom sources остаются отсутствующей пользовательской
функцией Firefox. Browser-driven locale, private-window prerequisite и текущие
fallback/auth различия описаны выше без заявления полной parity.
Ненастроенный signed-manifest URL/key не блокирует работающий фиксированный
HTTPS source channel и не превращает его проверки в author authentication.

Исторический cross-browser visual gate проверял popup states и семь Options
sections на EN/RU при 100%, 125% и 150% для `0.0.4.0`. Его browser/version matrix
и gaps записаны в [0.0.4.0 cross-browser UX gate](qa/CROSS_BROWSER_0.0.4_UX.md).
Для `1.0.0` эта запись не подтверждает новые source controls, Tor scopes,
origin authentication или update/recovery behavior; release QA относится к
точному выбранному пакету.
