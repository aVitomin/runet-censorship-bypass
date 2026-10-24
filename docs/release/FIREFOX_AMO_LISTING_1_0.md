# Firefox Add-ons listing — 1.0

Reference material for version `1.0.0`. The canonical package and reviewer
source archive were submitted to Mozilla on 2026-10-24 with English and Russian
listing descriptions, current screenshots, a privacy notice and build notes.
The version is awaiting review. Submission does not establish approval,
signature availability or a public installation link. The shorter descriptions
below are repository drafts for a future listing edit; they have not replaced
the descriptions already submitted to Mozilla.

## Listing fields

- **Title:** Runet Censorship Bypass
- **Summary:** Choose Auto, Proxy or Direct for websites. Manage site rules and proxy connections, with separate Save and Apply controls.
- **Category:** Other. One category is sufficient; no security-benefit category
  or keyword is needed to describe routing control.
- **Keywords/tags:** no tags were selected: the live form's fixed choices did
  not include suitable routing/proxy terms. Do not substitute misleading tags.
- **Homepage:** [repository](https://github.com/aVitomin/runet-censorship-bypass).
- **Support URL:** [issue forms](https://github.com/aVitomin/runet-censorship-bypass/issues/new/choose).
- **Privacy URL:** the [1.0 privacy notice](PRIVACY_1_0.md) is published on main.
  The submitted notice uses its public project/support/security links.
- **Russian title:** Обход блокировок Рунета.
- **Russian summary:** Выбирайте «Авто», «Прокси» или «Напрямую» для сайтов.
  Настраивайте правила и подключения, сохраняйте изменения и применяйте их отдельно.
- **Screenshots:** [current 1.0 gallery](../assets/releases/1.0/README.md),
  including a genuine Firefox toolbar popup.

The summary is deliberately below Mozilla's 250-character limit. The
[AMO listing guidance](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)
also recommends natural keywords and choosing only relevant categories.
Confirm the [Other category](https://addons.mozilla.org/en-US/firefox/extensions/category/other/)
in the live submission form.

## Description — English

Choose Auto, Proxy or Direct for websites in Firefox. Runet Censorship Bypass
controls browser routing and provides no VPN or proxy service.

- Set rules for one host or a domain and its subdomains.
- Use Anticensority routing data or Only my rules and connections.
- Configure your own proxies and separately running local services.
- Save settings, review changes, then Apply. Existing settings stay active until Apply.
- Preview imported settings, export settings for transfer, or create a separate sanitized support report.
- Refresh Anticensority data manually or automatically every 12 hours.

Automatic proxy routes need a suitable local service running separately.
Own proxies can be used for explicit Proxy rules. Auto follows the selected
source and rules; it can use a proxy. Explicit Direct takes priority over Proxy.
Updates do not turn routing on, apply pending settings or switch a manual source.
The popup asks before including other saved changes; unsaved Options edits are
not included. Enable private-window access before applying: Firefox requires it
for the browser-wide proxy setting.

Settings and optional proxy credentials stay in your browser profile. There is
no developer telemetry or cloud synchronization. Routing-data downloads and
connection checks make network requests. Proxies receive destination information
and traffic visible to their protocol, plus matching credentials when needed.
Settings exports omit credentials but retain site rules and proxy addresses;
keep them private. Review support reports before sharing.

Firefox parses fixed Anticensority HTTPS downloads as static data without
executing downloaded PAC JavaScript. The data is validated but has no author's
cryptographic signature. Arbitrary/custom PAC sources are not supported here.
The extension does not guarantee bypass, connectivity, anonymity or encryption
and does not route other applications. SOCKS authentication depends on Firefox.

[Guide](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/user/USER_GUIDE_1_0.md) ·
[Help](https://github.com/aVitomin/runet-censorship-bypass/blob/main/SUPPORT.md) ·
[Privacy](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/release/PRIVACY_1_0.md)

## Полное описание — русский

Выбирайте «Авто», «Прокси» или «Напрямую» для сайтов в Firefox. Расширение
управляет маршрутами браузера; VPN или прокси-сервер в комплект не входят.

- Правила для одного хоста или домена с поддоменами.
- База Anticensority или режим «Только мои правила и подключения».
- Собственные прокси и подключение к отдельно запущенным локальным службам.
- Сохранение, просмотр изменений и отдельное применение. До «Применить» действуют прежние настройки.
- Перенос настроек с предварительным просмотром и отдельный очищенный отчёт для поддержки.
- Обновление базы вручную или автоматически каждые 12 часов.

Автоматическим прокси-маршрутам нужна подходящая отдельно запущенная локальная
служба. Собственные прокси можно использовать для явных правил «Прокси».
«Авто» следует источнику и правилам, поэтому может использовать прокси.
Явное «Напрямую» приоритетнее «Прокси». Обновления не включают маршрутизацию,
не применяют отложенные настройки и не переключают ручной источник. Панель
спрашивает перед применением других сохранённых изменений; несохранённые правки
в применение не входят. Перед включением разрешите работу в приватных окнах:
это требование Firefox к общей настройке прокси.

Настройки и учётные данные прокси хранятся в профиле браузера. Телеметрии
разработчика и облачной синхронизации нет. Загрузка базы и проверки подключений
выполняют сетевые запросы. Прокси получают адреса назначения, видимую им часть
трафика и при необходимости подходящие учётные данные. Экспорт исключает
учётные данные, но сохраняет правила сайтов и адреса прокси: храните его
приватно. Отчёт для поддержки нужно просмотреть перед отправкой.

Firefox обрабатывает данные с закреплённых HTTPS-источников Anticensority
без исполнения скачанного PAC-кода. Данные проходят проверки, но не имеют
криптографической подписи автора. Произвольные PAC-источники не поддерживаются.
Расширение не гарантирует обход, доступность, анонимность или шифрование
и не маршрутизирует другие приложения. Авторизация SOCKS зависит от Firefox.

[Руководство](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/user/USER_GUIDE_1_0.md) ·
[Помощь](https://github.com/aVitomin/runet-censorship-bypass/blob/main/SUPPORT.md) ·
[Приватность](https://github.com/aVitomin/runet-censorship-bypass/blob/main/docs/release/PRIVACY_1_0.md)

## Maintainer attachments — not part of description

Use the [current AMO reviewer notes](../development/FIREFOX_AMO_REVIEW.md),
[permission/privacy audit](PERMISSIONS_AND_PRIVACY_1_0.md), and the five
[Firefox screenshots](../assets/releases/1.0/README.md).
The current gallery includes a genuine Firefox native popup. The English
import screenshot has a Russian
native file-input label; review whether to recapture for listing consistency.
Do not claim Android support or expand tested desktop platforms from the
manifest minimum alone.
