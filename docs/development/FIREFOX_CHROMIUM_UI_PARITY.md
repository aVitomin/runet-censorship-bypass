# Chromium / Firefox MV3: матрица пользовательского интерфейса

Эта матрица фиксирует состояние milestone `0.0.4.0`. Она сравнивает только
пользовательские функции поддерживаемых Chromium MV3 и Firefox MV3 targets.
`PARITY` означает одинаковый workflow, `EQUIVALENT` — одинаковый результат при
разной browser-specific реализации, `INTENTIONAL_PLATFORM_DIFFERENCE` — явно
принятое безопасное отличие, а `MISSING` — оставшаяся работа. Последняя
категория не считается parity.

Это исторический baseline, а не доказательство текущей parity. В текущей рабочей
версии Unified Apply уже заменяет OFF-only редактирование: Draft → Save → exact
Apply. Firefox Site rules теперь представлены единым структурированным списком,
без переноса настроек между профилями. Проверенный dataset можно устанавливать
при Active из Effective settings, не применяя pending Saved. Production update
trust по-прежнему не настроен. Текущие контракты и recovery описаны в
[Firefox architecture](FIREFOX_MV3_ARCHITECTURE.md); приведённый ниже старый visual
gate не проверяет эти новые изменения.

## Popup и управление

| Функция Chromium | Firefox | Статус | Примечание |
| --- | --- | --- | --- |
| Состояния Off / Active / busy / error | Off / Active / Recovered / Initializing / blocked | PARITY | Active показывается только после `READY`; recovery виден отдельно. |
| Текущий hostname | Нормализованный hostname текущей HTTP(S)-вкладки | PARITY | Полный URL, path и query не возвращаются из background RPC. |
| Auto / Proxy / Direct | Auto / Proxy / Direct | PARITY | Используется существующий browser-neutral settings/routing contract. |
| Exact host | Exact host | PARITY | Plain hostname. |
| Domain + subdomains | Domain + subdomains | PARITY | Оба target используют `tldts` с private suffixes; правило имеет вид `*.example.com`. |
| Pending / not applied | Локальный draft и `Not applied` до Apply | PARITY | Apply сначала сохраняет правило по exact revision, затем включает routing. |
| Apply | Production `firefox.activation.apply` | EQUIVALENT | Firefox приобретает fail-closed floor и публикует READY session. |
| Clear / Turn off | Production exact-ownership Clear | EQUIVALENT | Firefox восстанавливает предыдущий proxy layer. |
| Settings | Options page и deep link к Proxy connections | PARITY | Только локальные extension pages. |
| Browser/extension pages unavailable | Явное uncontrollable state без route controls | PARITY | Поддерживаются только HTTP(S) tabs. |
| Proxy candidate unavailable | Apply заблокирован, ссылка на Proxy connections | PARITY | Background также отклоняет Proxy rule без кандидата. |
| External proxy control | Отдельное external/control-loss state | EQUIVALENT | Firefox синхронно withdraw-ит session и не перезаписывает внешний setting. |
| PAC freshness / last download | Signed dataset version, check и staged-update status | EQUIVALENT | Firefox не исполняет PAC: он проверяет Ed25519 manifest и declarative dataset, затем отдельно устанавливает staged update. Release trust URL/key ещё должны быть предоставлены до включения. |
| Proxy health summary/check | Ручная проверка текущего explicit Proxy origin | EQUIVALENT | Как Chromium, не меняет routing; Firefox не запускает automatic health и не использует отдельный telemetry endpoint. |
| Toolbar A/P/D/OFF/EXT badge и state icons | A/P/D/OFF/EXT, busy/loading/error icons и title | PARITY | Значение строится из authoritative activation, proxy-control и current-site state и восстанавливается после event-page recreation. |

## Options

| Функция Chromium | Firefox | Статус | Примечание |
| --- | --- | --- | --- |
| Overview | Overview с protection/dataset/private-access state | PARITY | Та же card/status-pill визуальная модель. |
| Routing sources | Automatic routing | EQUIVALENT | Anticensority представлен как проверенный packaged declarative dataset. |
| Provider selector и custom PAC URL | Нет | INTENTIONAL_PLATFORM_DIFFERENCE | Firefox не выполняет arbitrary PAC; источник фиксирован продуктом. |
| Site rules | Direct / Proxy / whitelist editors | PARITY | Background остаётся авторитетным validator. |
| Own proxy candidates и порядок | Own proxy candidates и порядок | PARITY | HTTP/HTTPS/SOCKS4/SOCKS5, timeout и proxy DNS. |
| Proxy credentials | KEEP / SET / NONE | PARITY | Password никогда не читается обратно в page state. |
| Local Tor / Tor Browser / WARP | Явные scoped controls | EQUIVALENT | Firefox показывает lossless runtime fields без Chromium-only master toggle. |
| Safe routing defaults | Те же четыре browser-neutral defaults | PARITY | Provider=true, own-sites-only=true, replace-Direct=false, noDirect=false. |
| Maintenance section | Packaged/current dataset, signed check, staged install | EQUIVALENT | Check не меняет active routing; install доступен только в полном OFF. |
| Manual/periodic provider refresh | No-input manual check и 12-hour alarm | EQUIVALENT | Оба stage-ят проверенные данные. Firefox никогда не promote-ит автоматически и требует release-pinned URL/key; эти внешние значения пока отсутствуют. |
| Proxy health и diagnostics | Maintenance check и redacted report/export | EQUIVALENT | Отчёт содержит только версии, состояния, public dataset version и proxy type/count; URL, endpoints, authRef, hashes, floor и credentials исключены. |
| Advanced Direct policy | replaceDirectWithProxy / noDirect | PARITY | Общий routing contract остаётся авторитетным. |
| Notifications | Критические control-loss/recovery/health alerts | EQUIVALENT | Фиксированный локализованный текст, cooldown и переход в Maintenance; обычные background events не создают уведомления. |
| About/version | About с package version и local-code statement | PARITY | Никаких remote assets. |
| EN/RU | Firefox browser i18n EN/RU | PARITY | Firefox следует выбранной locale браузера. |
| Встроенный language selector | Нет | INTENTIONAL_PLATFORM_DIFFERENCE | Отдельная language preference не хранится. |

## Routing differences, видимые пользователю

- Успешный provider proxy и proxy failover совпадают. Chromium terminal
  `PROXY + DIRECT` fallback в Firefox намеренно удаляется: если все proxy
  кандидаты исчерпаны, Firefox закрывает запрос. Это
  `INTENTIONAL_PLATFORM_DIFFERENCE`, а не скрытая parity.
- Firefox settings меняются только при полном `OFF`; во время Active/Initializing
  Options и current-site controls read-only. Это
  `INTENTIONAL_PLATFORM_DIFFERENCE`, сохраняющее exact durable config binding.
- Firefox требует private-window access до Apply, чтобы отзыв разрешения не
  создавал обход protected routing. Chromium не имеет эквивалентного условия.

## Оставшаяся работа milestone

В этой матрице больше нет `MISSING` user-visible классов. До release остаётся
внешний blocker включения update flow: fixed HTTPS manifest endpoint и pinned
raw Ed25519 public key/stable keyId. Произвольный PAC, browser-driven locale, OFF-only mutation и
fail-closed terminal proxy exhaustion остаются явно
зафиксированными `INTENTIONAL_PLATFORM_DIFFERENCE`, а не скрытыми parity.

Cross-browser visual gate дополнительно проверил все popup states и семь
Options sections на EN/RU при 100%, 125% и 150%. Структурных расхождений,
clipping, overflow или unusable controls не найдено; Firefox намеренно выше и
менее плотный, но сохраняет ту же информационную иерархию. Фактическая
browser/version matrix и остающиеся release-environment gaps записаны в
[0.0.4.0 cross-browser UX gate](qa/CROSS_BROWSER_0.0.4_UX.md).
