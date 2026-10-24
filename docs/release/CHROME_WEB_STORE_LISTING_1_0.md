# Chrome Web Store listing — 1.0

Version `1.0.0` was submitted for review, as confirmed by the publisher.
No approval or public installation link has been verified. The PAC policy
determination remains open in the [reviewer notes](CHROME_REVIEWER_NOTES_1_0.md).
The shorter descriptions below are repository drafts for a future listing
edit; they have not replaced the submitted store copy or package metadata.

## Short description

Control website routing with Auto, Proxy and Direct rules, configurable PAC sources, and separate Save and Apply.

This proposed copy is below the
[132-character manifest description limit](https://developer.chrome.com/docs/extensions/reference/manifest/description).
Chrome takes the short description from packaged/localized manifest metadata;
this document does not change it. The canonical package currently uses
`Bypass Runet censorship with configurable routing rules.` (English) and
`Обход блокировок Рунета с помощью настраиваемых правил маршрутизации.` (Russian).
Use those package-derived descriptions for this unchanged package; a future
description change requires a new validated artifact.

## Long description — English

Choose how Chrome opens websites: follow automatic rules, use a configured
proxy, or connect directly. Runet Censorship Bypass controls browser routing;
it provides no VPN or proxy service.

- Choose Auto, Proxy or Direct for a site, an exact host or a domain with subdomains.
- Use built-in PAC sources, a custom source, or Only my rules and connections.
- Configure your own proxies or connect to separately running Tor, Tor Browser or WARP.
- Save settings for review, then Apply them. Existing settings stay active until Apply.
- Transfer settings with import preview and create a separate sanitized support report.
- Check routing-data updates and connection status.

Auto follows the selected source and rules; it can use a proxy. Explicit Direct
takes priority over Proxy. Proxy needs a suitable enabled connection. Updates
do not turn routing on or activate pending settings. The popup asks before
including other saved changes; unsaved Options edits are not included.

Settings and optional proxy credentials stay in your browser profile. There is
no developer telemetry or cloud synchronization. Sources, proxies and connection
checks make network requests; proxies receive destinations and traffic visible
to their protocol. Settings exports omit credentials and custom-source URLs,
but still contain site rules and proxy addresses: keep them private.

The active indicator confirms routing control, not connectivity or anonymity.
The extension does not guarantee bypass or encryption, and does not route other
applications. Some Chromium/PAC errors can lead to a direct connection.
SOCKS authentication depends on the browser.

[Guide](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/user/USER_GUIDE_1_0.md) ·
[Help](https://github.com/aVitomin/runet-censorship-bypass/blob/main/SUPPORT.md) ·
[Privacy](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/release/PRIVACY_1_0.md)

## Полное описание — русский

Выбирайте, как Chrome открывает сайты: по автоматическим правилам, через
настроенный прокси или напрямую. Расширение управляет маршрутами браузера;
VPN или прокси-сервер в комплект не входят.

- Режимы «Авто», «Прокси» и «Напрямую» для одного хоста или домена с поддоменами.
- Встроенные PAC-источники, свой источник или режим «Только мои правила и подключения».
- Собственные прокси и подключение к отдельно запущенным Tor, Tor Browser или WARP.
- Сохранение настроек отдельно от применения: прежние продолжают действовать до «Применить».
- Перенос настроек с предварительным просмотром и отдельный очищенный отчёт для поддержки.
- Обновление данных маршрутизации и проверка подключений.

«Авто» следует выбранному источнику и правилам, поэтому может использовать
прокси. Явное «Напрямую» приоритетнее «Прокси». Для «Прокси» нужно подходящее
включённое подключение. Обновление базы не включает маршрутизацию и не применяет
отложенные настройки. Панель спрашивает перед применением других сохранённых
изменений; несохранённые правки настроек в применение не входят.

Настройки и учётные данные прокси хранятся в профиле браузера. Телеметрии
разработчика и облачной синхронизации нет. Источники, прокси и проверки подключений
выполняют сетевые запросы; прокси получают адреса назначения и видимую им часть
трафика. Экспорт исключает учётные данные и адреса своих источников, но сохраняет
правила сайтов и адреса прокси. Храните его приватно.

Активный статус подтверждает управление маршрутами, а не доступность сайтов
или анонимность. Гарантий обхода и шифрования нет; другие приложения не
маршрутизируются. При некоторых ошибках Chromium/PAC возможен прямой выход.
Поддержка авторизации SOCKS зависит от браузера.

[Руководство](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/user/USER_GUIDE_1_0.md) ·
[Помощь](https://github.com/aVitomin/runet-censorship-bypass/blob/main/SUPPORT.md) ·
[Приватность](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/release/PRIVACY_1_0.md)

## Permission justifications for the dashboard

Use the exact Chromium rows in the
[complete permission audit](PERMISSIONS_AND_PRIVACY_1_0.md#api-permissions--complete-manifest-inventory)
for `proxy`, `alarms`, `storage`, `notifications`, `webRequest`,
`webRequestAuthProvider` and `activeTab`. The host-permission table covers every
literal host grant, including `<all_urls>` and the overlapping built-in source
hosts. Do not add Firefox's `webRequestBlocking` justification to Chrome.

Single-purpose field draft:

> Let users control browser website routing through automatic PAC rules,
> configured proxies or direct connections, with explicit application of saved
> routing settings.

Privacy-practices preparation:

- Declare **Authentication information** for configured proxy credentials and
  **Web history** for destination/request information handled for routing, even
  though there is no developer browsing-history upload. Also declare **User
  activity** for request lifecycle/error handling and connection checks: the
  current form includes network monitoring in this category. This is a mapping
  of the observed form to the package's network processing, not a claim of
  mouse/keyboard tracking. Review any other live dashboard category against the
  exact package and routed-data disclosures.
- Explain local storage, source retrieval, proxy transmission, and limited
  connection checks using the [privacy notice](PRIVACY_1_0.md). Do not certify
  “no user data handled” on the basis of local processing alone.
- Explain PAC download/browser evaluation explicitly in the remote-code field;
  the reviewer notes identify the unresolved policy determination. Do not
  automatically choose “No” or assert an exemption/approval.
- Complete Limited Use/no-sale/purpose-restriction certifications only after
  the publisher has reviewed the exact submission. This draft is not consent
  to certify on the publisher's behalf.
- Publish and verify the approved privacy notice on main before entering its
  public URL. Use the repository homepage and issue forms above; no legacy store
  listing or upstream publisher URL is a substitute.

The [privacy dashboard guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/)
and [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/)
require accurate permission/data disclosures, including locally handled data.
Checked on 2026-10-24; reconfirm the live form before submission. The FAQ
separately discusses user-specified protocol servers and same-computer native
programs; those distinctions do not establish approval of this exact package.

## Images and submission scope

Use the five [current Chromium store screenshots](../assets/releases/1.0/README.md),
the 440x280 promotional PNG and the verified packaged icon. Native popup images
are genuine documentation workflow captures, not padded 1280x800 store shots.
Follow the [current listing guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/)
and [image requirements](https://developer.chrome.com/docs/webstore/images).
There is no verified public Chrome store URL to announce yet.
