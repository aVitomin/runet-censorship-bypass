# Совместимость браузеров

## Расчётные минимумы для 1.0.1

Ожидается работа в **настольных браузерах на Chromium 108+ и Firefox 140+**,
включая Firefox ESR на этой или более новой базе, при наличии необходимых
API расширений. Это вывод по коду и документации платформ, а не результат
проверки каждой версии, ОС или форка.

| Семейство | Минимум в манифесте 1.0.1 | Главное ограничение |
| --- | --- | --- |
| Chromium | `minimum_chrome_version: "108"` | Авторизация прокси через `webRequestAuthProvider` в Manifest V3 |
| Firefox | `strict_min_version: "140.0"` | Встроенное согласие на обработку/передачу данных `data_collection_permissions` |

Для Brave, Edge, Opera и других Chromium-форков учитывается **версия Chromium**,
а не собственная версия продукта. Нужны MV3, `proxy`, `webRequest` с обработкой
авторизации, `storage.session` и остальные используемые API. Форк может отключить
их или ограничить установку расширений. Для Firefox-форков также нужны
совместимые WebExtensions API и встроенная схема согласия на передачу данных.
Фраза «работает во всех браузерах на этом движке» без этих условий некорректна.
Android, iOS, WebView и оболочки без полноценной поддержки расширений не входят
в заявленную оценку. Рекомендуется актуальная версия выбранного браузера.

## Основания

Проверены maintained manifest, вызовы API, JavaScript и CSS обоих targets,
общие модули и подключённые browser compatibility helpers. Требований именно
к Firefox 154 или современному Chromium 156 в них не найдено.

- Chromium: асинхронный ответ на `onAuthRequired` с `webRequestAuthProvider`
  доступен с **108** ([Chrome documentation](https://developer.chrome.com/docs/extensions/mv2/reference/webRequest)).
  Код использует `chrome.*`, поэтому появление отдельного `browser.*` namespace
  в новых версиях Chrome минимум не повышает.
- `storage.session` доступен с **102**
  ([Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage)),
  используемый в интерфейсе CSS `:has()` — с **105**
  ([Chrome 105](https://developer.chrome.com/blog/new-in-chrome-105)).
- Код не ожидает Promise от `alarms.create` (он появился в 111) и не требует
  точного 30-секундного запуска alarm. В старых версиях диагностическая проверка
  может запускаться позже; она не переключает маршрутизацию
  ([Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms)).
  Улучшения жизненного цикла service worker после 108 полезны, но не являются
  отдельным требованием используемого API; гарантии поведения старых сборок
  по одному статическому обзору не заявляются.
- Firefox: MV3 включён по умолчанию с **109**
  ([Firefox 109](https://www.firefox.com/en-US/firefox/109.0/releasenotes/)).
  Используемый подписанным каналом Web Crypto Ed25519 доступен с **129**
  ([Firefox 129](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/129));
  этот канал остаётся не настроен, действующий HTTPS-канал не выдаётся за подписанный.
- Текущий Firefox manifest запрашивает `authenticationInfo` и `browsingActivity`.
  Встроенное согласие поддерживается на desktop с **140**. Отдельного интерфейса
  согласия для более старых версий в проекте нет, поэтому опускать минимум до
  109 или 129 нельзя без дополнительной реализации
  ([Mozilla Extension Workshop](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)).

## Что действительно проверялось

Для исходников 1.0.1 на Windows выполнены проверки интерфейса в
**Chrome 156.0.8078.48** и **Firefox 159.0**. На **Firefox 153.5.1 ESR** прошли
автоматические сценарии авторизации прокси, Save/Apply, восстановления фоновой
страницы, private access и владения настройками прокси. Это были временные
установки; повторный запуск подписанного постоянно установленного пакета и
полная Linux-проверка здесь не подтверждены.

Chromium 108 и Firefox 140 отдельно не запускались. Для дополнительной проверки
ESR на Debian/Linux есть [воспроизводимый сценарий](qa/FIREFOX_ESR_153.md);
он не является доказательством уже выполненной проверки.

## Доступные пакеты

Опубликованный Chromium ZIP **1.0.1** требует **Chromium 108+**.
В магазинах и подписанном Firefox XPI пока доступна **1.0.0**.
У этого Firefox XPI минимум **154.0**; минимум 140.0 станет доступен после
подписания Firefox 1.0.1. У Chromium 1.0.0 `minimum_chrome_version` не задан.
Старые пакеты не изменяются задним числом. Матрица выполненных проверок 1.0.0
сохранена в [записи выпуска](releases/1.0.0.md).

## English

Version 1.0.1 is expected to work in desktop **Chromium 108+** and
**Firefox 140+**, including ESR on a compatible base, provided the required
extension APIs are available. These are source/API-based minimums; every
version, platform and derivative has not been tested. Mobile browsers and
WebView are outside this scope. The published Firefox 1.0.0 package still
requires Firefox 154+.
