# Runet Censorship Bypass

[![Stable release](https://img.shields.io/github/v/release/aVitomin/runet-censorship-bypass-mv3?label=stable)](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases)
[![Verify MV3](https://github.com/aVitomin/runet-censorship-bypass-mv3/actions/workflows/mv3.yml/badge.svg?branch=main)](https://github.com/aVitomin/runet-censorship-bypass-mv3/actions/workflows/mv3.yml)

Расширение выборочно направляет заблокированные и выбранные сайты через
автоматические или пользовательские прокси. Поддерживает единый рабочий процесс
**Auto / Proxy / Direct** в Chromium и Firefox.

[Скачать / Releases](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases) ·
[Установка](docs/user/INSTALLATION.md) ·
[Быстрый старт](#быстрый-старт) ·
[Помощь](docs/user/TROUBLESHOOTING.md)

## Браузеры

Для выпуска `0.0.4.0` проверены:

- Google Chrome;
- Microsoft Edge;
- Brave;
- Firefox 154 и новее.

Яндекс Браузер, Opera, Vivaldi и другие современные Chromium-браузеры с
необходимыми MV3 API ожидаются совместимыми, но отдельно для этого выпуска не
тестировались. Совместимость со всеми Chromium-форками не гарантируется.

## Скачать и установить

Текущий опубликованный стабильный выпуск —
[`v0.0.4.0`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/tag/v0.0.4.0) —
первый общий выпуск для Chromium и Firefox.

### Chromium

Скачайте
[`runet-censorship-bypass-mv3-0.0.4.0-7c0c64c.zip`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.4.0/runet-censorship-bypass-mv3-0.0.4.0-7c0c64c.zip),
проверьте SHA-256
`e702dff6ba3fe9bb3291de413c4e106f95dcd9b83f9cf8fc98f9635f5990f236`
по файлу
[`runet-censorship-bypass-mv3-0.0.4.0-7c0c64c.sha256.txt`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.4.0/runet-censorship-bypass-mv3-0.0.4.0-7c0c64c.sha256.txt),
распакуйте ZIP, включите **Developer mode** на странице расширений и выберите
**Load unpacked** для папки с `manifest.json`.

### Firefox

Скачайте Mozilla-подписанный
[`runet-censorship-bypass-firefox-0.0.4.0-signed.xpi`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.4.0/runet-censorship-bypass-firefox-0.0.4.0-signed.xpi)
и при необходимости проверьте SHA-256
`c7e3042e48819644673db92b9150a9d54a551281046212d896a7f7202bc9c34c`
по [checksum-файлу](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.4.0/runet-censorship-bypass-firefox-0.0.4.0-signed.sha256.txt).
Публичной AMO-страницы для нового Firefox ID пока нет. Подробнее:
[установка](docs/user/INSTALLATION.md).

## Быстрый старт

1. Установите расширение и откройте его значок на панели браузера.
2. Нажмите **Apply / Enable** и дождитесь состояния **Active**.
3. При необходимости выберите для текущего сайта **Auto**, **Proxy** или
   **Direct** и область: точный хост либо домен с поддоменами.

Собственные прокси, аутентификация, Tor, Tor Browser и WARP описаны в
[руководстве пользователя](docs/user/USER_GUIDE.md).

## Возможности

- Автоматическая маршрутизация по встроенным локальным данным.
- Правила Auto / Proxy / Direct для текущего сайта.
- HTTP, HTTPS, SOCKS4, SOCKS5, Tor, Tor Browser и WARP.
- Локальное хранение настроек и прокси-аутентификации без показа сохранённого
  пароля в интерфейсе или диагностике.
- Проверка подключения, очищенная диагностика и понятные состояния панели.
- Английский и русский интерфейс.

## Интерфейс

<p align="center">
  <a href="docs/assets/readme/chromium-popup-auto.png"><img src="docs/assets/readme/chromium-popup-auto.png" alt="Chromium: Auto для текущего сайта" width="300"></a>
  &nbsp;
  <a href="docs/assets/readme/firefox-popup-auto.png"><img src="docs/assets/readme/firefox-popup-auto.png" alt="Firefox: Auto для текущего сайта" width="300"></a>
</p>

Кадры используют синтетический адрес `sub.example.com`; в них нет реальной
истории, паролей или приватных proxy endpoints.

## Важно знать

- Это не VPN и не гарантия анонимности или отсутствия DNS-утечек.
- Выбранный прокси видит адреса и трафик в пределах своей роли; используйте
  только доверенные подключения.
- Firefox поставляется с локальным набором автоматической маршрутизации.
  Удалённое обновление этого набора пока отключено, но встроенный набор работает.
- При исчерпании автоматической proxy-цепочки Firefox безопасно завершает запрос,
  тогда как Chromium может использовать иной последний fallback браузерного PAC.

## Помощь и документация

- [Установка, обновление и удаление](docs/user/INSTALLATION.md)
- [Руководство пользователя](docs/user/USER_GUIDE.md)
- [Решение проблем](docs/user/TROUBLESHOOTING.md)
- [Приватность и безопасность](docs/user/PRIVACY_AND_SECURITY.md)
- [Вся документация](docs/README.md)
- [Сообщить о проблеме](https://github.com/aVitomin/runet-censorship-bypass-mv3/issues/new/choose)
- [Политика безопасности](SECURITY.md)

<details>
<summary>Разработка и история</summary>

[Разработка](docs/development/DEVELOPMENT.md) ·
[Архитектура](docs/development/ARCHITECTURE.md) ·
[Тестирование](docs/development/TESTING.md) ·
[Процесс выпуска](docs/development/RELEASE_PROCESS.md) ·
[Участие в проекте](CONTRIBUTING.md) ·
[Исторический README](docs/legacy/UPSTREAM_README.md)

</details>

Проект продолжает работу
[`anticensority/runet-censorship-bypass`](https://github.com/anticensority/runet-censorship-bypass)
с сохранением истории и атрибуции. Лицензия: [GNU GPL v3](LICENSE).

## English

Runet Censorship Bypass selectively routes blocked or chosen sites through
automatic or user-configured proxies. It supports the same **Auto / Proxy /
Direct** workflow on Chromium and Firefox.

Release-tested for `0.0.4.0`: Google Chrome, Microsoft Edge, Brave, and Firefox
154+. Yandex Browser, Opera, Vivaldi, and other modern
Chromium browsers with the required MV3 APIs are expected to be compatible but
were not separately release-tested; universal Chromium-fork compatibility is
not claimed.

The current stable release is the first dual-browser release,
[`v0.0.4.0`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/tag/v0.0.4.0).
Chromium uses the published ZIP with **Developer mode → Load unpacked**;
Firefox 154+ uses the Mozilla-signed XPI attached to the same GitHub Release.
There is no public AMO listing for the new Firefox ID yet.

Quick start: install the extension, open its toolbar popup, choose **Apply /
Enable**, then optionally select **Auto**, **Proxy**, or **Direct** for the
current site. See [Installation](docs/user/INSTALLATION.md), the
[User guide](docs/user/USER_GUIDE.md), or
[Troubleshooting](docs/user/TROUBLESHOOTING.md).
