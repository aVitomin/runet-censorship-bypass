<p align="center">
  <img src="extension/src/assets/brand/icon-512.png" alt="Runet Censorship Bypass" width="88">
</p>

# Runet Censorship Bypass

Выбирайте, как браузер открывает сайты: по автоматическим правилам, через
настроенный прокси или напрямую. Расширение для Chromium и Firefox с интерфейсом
на русском и английском языках.

Расширение не предоставляет VPN или прокси-сервер. Оно использует выбранный
источник маршрутов, ваши прокси и отдельно запущенные Tor, Tor Browser или WARP.

[Установка](docs/user/INSTALLATION.md) ·
[Руководство 1.0](docs/user/USER_GUIDE_1_0.md) ·
[Помощь и сообщения об ошибках](SUPPORT.md) ·
[English](#english)

## Скачать

| Браузер | Версия | Установка из магазина |
| --- | --- | --- |
| **Chrome, Brave и совместимые Chromium-браузеры** | **1.0.0** | [Chrome Web Store](https://chromewebstore.google.com/detail/poohkdbmgajmcifcaijdjgiihghlgbph) |
| **Firefox 154+** | **1.0.0** | [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/runet-censorship-bypass-mv3/) |

Обе версии опубликованы. Установка из магазина — основной способ: следующие
одобренные версии браузер получает через механизм обновления расширений.

**Ручная установка:** [Chromium ZIP](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.0/runet-censorship-bypass-mv3-1.0.0-9de66de.zip) ·
[подписанный Firefox XPI](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.0/runet-censorship-bypass-firefox-1.0.0-signed.xpi) ·
[все файлы выпуска v1.0.0](https://github.com/aVitomin/runet-censorship-bypass/releases/tag/v1.0.0).

### Быстрый старт

1. Установите расширение из магазина своего браузера и закрепите его значок.
2. В Firefox разрешите работу в приватных окнах: это нужно для общей настройки прокси.
3. Откройте настройки, выберите источник и нужные подключения.
4. Нажмите **Сохранить настройки**, затем **Применить**.

[Подробная установка, обновление и проверка файлов](docs/user/INSTALLATION.md).
Архивы **Source code** предназначены для разработки.

## Как пользоваться версией 1.0

Откройте сайт и нажмите значок расширения:

| Режим | Что делает |
| --- | --- |
| **Авто** | Следует выбранному источнику и общим правилам |
| **Прокси** | Использует подходящее настроенное подключение |
| **Напрямую** | Обходит прокси расширения для этого сайта |

Правило можно задать для одного хоста или домена с поддоменами. **Напрямую**
имеет приоритет над **Прокси**. В режиме **Только мои правила и подключения**
автоматическая база не нужна.

**Сохранить** записывает настройки, **Применить** включает сохранённые изменения.
До применения продолжают действовать прежние настройки. Обновление базы
не включает выключенную маршрутизацию и не применяет отложенные правки.

[Подключения, источники, перенос настроек и обновления](docs/user/USER_GUIDE_1_0.md)

## Интерфейс

Chromium 1.0 слева, Firefox 1.0 справа. Интерфейс доступен на русском и английском.

<p align="center">
  <img src="docs/assets/releases/1.0/chromium/06-native-popup.png" alt="Панель Chromium 1.0" width="392">
  <img src="docs/assets/releases/1.0/firefox/05-native-popup-direct.png" alt="Панель Firefox 1.0" width="380">
</p>

<details>
<summary>Посмотреть настройки</summary>

![Настройки Chromium 1.0](docs/assets/releases/1.0/chromium/01-overview-active.png)

![Настройки Firefox 1.0](docs/assets/releases/1.0/firefox/01-overview-manual-active.png)

[Все снимки интерфейса](docs/assets/releases/1.0/README.md)

</details>

## Помощь и приватность

Начните с [проверок и формы сообщения об ошибке](SUPPORT.md).
Состояние **Защита включена** означает управление маршрутизацией; оно не
гарантирует доступность сайтов, анонимность или шифрование. Используйте
доверенные источники и прокси.

[Приватность 1.0](docs/release/PRIVACY_1_0.md) ·
[Сообщить об уязвимости приватно](SECURITY.md) ·
[Вся документация](docs/README.md)

<details>
<summary>Проверить скачанные файлы</summary>

**Chromium 1.0.0** — `runet-censorship-bypass-mv3-1.0.0-9de66de.zip`

SHA-256: `0faa3e0208c9d8295d2216066184930ece89eddeae20d1d37e9ede0c2a1a48bb`

[Контрольная сумма ZIP](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.0/runet-censorship-bypass-mv3-1.0.0-9de66de.zip.sha256.txt)

**Firefox 1.0.0** — `runet-censorship-bypass-firefox-1.0.0-signed.xpi`

SHA-256: `74ff7eca8eb8f50e5bca57b1642894db473e99f990e1dfbb936faf5d66162b6c`

[Контрольная сумма XPI](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.0/runet-censorship-bypass-firefox-1.0.0-signed.sha256.txt)

</details>

## English

Choose **Auto**, **Proxy**, or **Direct** for websites in Chromium and Firefox.
The extension controls browser routing and provides no VPN or proxy service.
Save records settings; Apply activates them.

Install **1.0.0** from [Chrome Web Store](https://chromewebstore.google.com/detail/poohkdbmgajmcifcaijdjgiihghlgbph) or
[Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/runet-censorship-bypass-mv3/). Firefox requires version **154+**.
Manual ZIP and signed XPI downloads are also available. See [installation](docs/user/INSTALLATION.md#english-summary),
[the 1.0 guide](docs/user/USER_GUIDE_1_0.md#english-summary), and [help](SUPPORT.md#english).

<details>
<summary>Разработчикам и пользователям старых версий</summary>

[Разработка](docs/development/DEVELOPMENT.md) ·
[Архитектура](docs/development/ARCHITECTURE.md) ·
[Тестирование](docs/development/TESTING.md) ·
[Процесс выпуска](docs/development/RELEASE_PROCESS.md) ·
[Участие в проекте](CONTRIBUTING.md)

Firefox 0.0.4.0: [руководство](docs/user/USER_GUIDE.md),
[решение проблем](docs/user/TROUBLESHOOTING.md),
[приватность](docs/user/PRIVACY_AND_SECURITY.md).
[Исторический README](docs/legacy/UPSTREAM_README.md).

</details>

Проект основан на [Anticensority](https://github.com/anticensority/runet-censorship-bypass)
с сохранением авторства и истории. Лицензия: [GNU GPL v3](LICENSE).
