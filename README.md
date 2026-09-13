# Runet Censorship Bypass

[![Stable release](https://img.shields.io/github/v/release/aVitomin/runet-censorship-bypass-mv3?label=stable)](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases)
[![Verify MV3](https://github.com/aVitomin/runet-censorship-bypass-mv3/actions/workflows/mv3.yml/badge.svg?branch=main)](https://github.com/aVitomin/runet-censorship-bypass-mv3/actions/workflows/mv3.yml)

Расширение выборочно направляет заблокированные и выбранные сайты через
автоматические либо пользовательские прокси, не превращая весь браузерный
трафик в VPN. Одинаковый рабочий процесс **Auto / Proxy / Direct** поддерживается
в современных Chromium-браузерах и Firefox.

[Скачать](#скачивание-и-установка) ·
[Установить](docs/user/INSTALLATION.md) ·
[Начать работу](#быстрый-старт) ·
[Получить помощь](docs/user/TROUBLESHOOTING.md)

## Поддерживаемые браузеры

- **Chromium MV3:** Google Chrome, Microsoft Edge и Brave проверены для
  готовящегося `0.0.4.0`; Яндекс Браузер, Opera, Vivaldi и другие современные
  Chromium-браузеры с необходимыми MV3 API ожидаются совместимыми, но не
  считаются release-tested для этого выпуска.
- **Firefox MV3:** Firefox 154 и новее.

Это список поддерживаемых и совместимых семейств, а не обещание совместимости с
каждым Chromium-форком. Для каждого выпуска отдельно указываются браузеры и
точные версии, на которых пройден release QA.

Опубликованный стабильный `v0.0.3.0` пока содержит только Chromium-пакет.
Firefox войдёт в следующий совместный выпуск после Mozilla signing; неподписанный
XPI не предлагается как обычная пользовательская установка.

## Скачивание и установка

### Chromium

Последний опубликованный выпуск —
[`v0.0.3.0`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/tag/v0.0.3.0):

- [`runet-censorship-bypass-mv3-0.0.3.0-cd59e14.zip`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.3.0/runet-censorship-bypass-mv3-0.0.3.0-cd59e14.zip)
  (361 977 байт);
- SHA-256:
  `68a32aa9162d5ba8b2cd9070c2eba6e5eb055434b899c284107c55d3e5a55635`;
- [`runet-censorship-bypass-mv3-0.0.3.0-cd59e14.sha256.txt`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.3.0/runet-censorship-bypass-mv3-0.0.3.0-cd59e14.sha256.txt).

Скачайте ZIP, распакуйте его в постоянную папку, откройте страницу расширений,
включите **Режим разработчика / Developer mode** и выберите **Загрузить
распакованное расширение / Load unpacked**. Выбирать нужно папку, где
`manifest.json` лежит непосредственно в корне.

### Firefox

Нормальным пользовательским путём будет Mozilla-подписанный XPI или страница
AMO, опубликованная вместе с совместным выпуском. Пока такого файла нет, не
устанавливайте unsigned development XPI как обычный релиз. Подробности и
актуальный статус есть в [инструкции по установке](docs/user/INSTALLATION.md).

## Быстрый старт

1. Установите расширение и нажмите его значок на панели браузера.
2. Откройте **Settings**, проверьте автоматическую маршрутизацию и при
   необходимости настройте собственный прокси, Tor, Tor Browser или WARP.
3. Нажмите **Apply** и дождитесь состояния **Active**.
4. Для текущего сайта выбирайте **Auto**, **Proxy** или **Direct**; кнопка
   **Turn off** безопасно возвращает прежние настройки прокси браузера.

## Что умеет расширение

- Автоматически выбирает маршруты по локальным доверенным данным провайдера.
- Создаёт правила для точного хоста либо домена вместе с поддоменами.
- Поддерживает HTTP, HTTPS, SOCKS4, SOCKS5, локальный Tor, Tor Browser и WARP.
- Не показывает сохранённые пароли прокси и не передаёт их в диагностику.
- Показывает состояние защиты, внешний контроль, проверку подключения и
  очищенную диагностику.
- Имеет английский и русский интерфейс.

Расширение не является VPN-сервисом и не обещает анонимность или отсутствие
DNS-утечек. Firefox намеренно завершает запрос без Direct, если исчерпаны все
proxy-кандидаты автоматического маршрута; Chromium может иметь иной последний
fallback из-за платформенной модели PAC.

## Интерфейс

<p align="center">
  <a href="docs/assets/readme/popup-daily-auto.png"><img src="docs/assets/readme/popup-daily-auto.png" alt="Auto для текущего сайта в popup" width="300"></a>
  &nbsp;
  <a href="docs/assets/readme/options-overview.png"><img src="docs/assets/readme/options-overview.png" alt="Overview на странице настроек" width="600"></a>
</p>

Кадры используют синтетический адрес `example.test` и не содержат личных данных
или реальных учётных данных. Внешний вид между движками может не совпадать по
пикселям, но структура и пользовательский workflow одинаковы.

## Помощь, приватность и разработка

- [Установка, обновление и удаление](docs/user/INSTALLATION.md)
- [Руководство пользователя](docs/user/USER_GUIDE.md)
- [Решение проблем](docs/user/TROUBLESHOOTING.md)
- [Приватность и безопасность](docs/user/PRIVACY_AND_SECURITY.md)
- [Обзор документации](docs/README.md)
- [Разработка](docs/development/DEVELOPMENT.md) и
  [архитектура](docs/development/ARCHITECTURE.md)
- [Тестирование](docs/development/TESTING.md) и
  [процесс выпуска](docs/development/RELEASE_PROCESS.md)
- [Участие в проекте](CONTRIBUTING.md), [политика безопасности](SECURITY.md) и
  [исторический README](docs/legacy/UPSTREAM_README.md)

Проект продолжает работу
[`anticensority/runet-censorship-bypass`](https://github.com/anticensority/runet-censorship-bypass)
с сохранением истории и атрибуции. Код распространяется по [GNU GPL v3](LICENSE).

<details>
<summary>English</summary>

Runet Censorship Bypass selectively routes blocked or chosen sites through an
automatic source or configured proxies. It supports modern Chromium-based
browsers and Firefox 154+. The currently published `v0.0.3.0` download is
Chromium-only; the normal Firefox installation path will be a Mozilla-signed XPI
or AMO listing in the next dual-browser release. See the
[installation guide](docs/user/INSTALLATION.md),
[user guide](docs/user/USER_GUIDE.md), and
[privacy and security notes](docs/user/PRIVACY_AND_SECURITY.md).
Release QA for `0.0.4.0` covers Google Chrome, Microsoft Edge, Brave and
Firefox. Yandex Browser, Opera, Vivaldi and other modern Chromium-based browsers
with the required MV3 APIs are expected-compatible targets, but are not claimed
as separately release-tested or universally guaranteed.

</details>
