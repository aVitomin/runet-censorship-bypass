# Документация Runet Censorship Bypass

Это вход в актуальную документацию. Для обычной работы не нужно читать разделы
для разработчиков: выберите свою задачу ниже.

Текущий опубликованный стабильный выпуск —
[`v0.0.4.0`](https://github.com/aVitomin/runet-censorship-bypass/releases/tag/v0.0.4.0) —
первый общий выпуск Chromium и Firefox. Для Chromium опубликован ZIP, для
Firefox 154.0+ — Mozilla-подписанный XPI. Публичной страницы расширения в
каталоге Mozilla Add-ons (AMO) пока нет.

Руководства ниже описывают именно этот выпуск. Для работы с ещё не выпущенной
сборкой используйте отдельную
[подготовку пользовательского руководства 1.0](development/UPCOMING_1_0_USER_GUIDE.md),
а не переносите её инструкции на установленный `0.0.4.0`.

## Пользователям

- **Хочу установить или обновить:**
  [установка, обновление и удаление](user/INSTALLATION.md).
- **Хочу включить маршрутизацию или выбрать Авто / Прокси / Напрямую:**
  [руководство пользователя](user/USER_GUIDE.md).
- **Что-то не работает:**
  [решение проблем по симптомам](user/TROUBLESHOOTING.md).
- **Какие данные видит и хранит расширение:**
  [приватность и безопасность](user/PRIVACY_AND_SECURITY.md).

Расширение не предоставляет собственный VPN или прокси. Оно применяет правила
и использует подключения выбранного источника, настроенный вами прокси либо
запущенное локальное приложение. Требования различаются между источниками и
браузерами; они перечислены в руководстве.

Выпуск проверен в Chrome 153.0.8010.37, Edge 153.0.4234.32, Brave 1.95.101 и
Firefox 154.0.1. Другие современные Chromium-браузеры могут работать, но для
этого выпуска отдельно не проверялись.

## English summary

Start with [Installation](user/INSTALLATION.md), then use the
[User guide](user/USER_GUIDE.md) to enable routing and understand Auto, Proxy,
and Direct. The extension does not provide a VPN or proxy service; connection
requirements depend on the selected browser and routing source. See
[Troubleshooting](user/TROUBLESHOOTING.md) and
[Privacy and security](user/PRIVACY_AND_SECURITY.md) when needed.
These guides cover published `0.0.4.0`; unreleased workflows are kept in the
[1.0 preparation guide](development/UPCOMING_1_0_USER_GUIDE.md).

## Разработчикам и участникам

- [Подготовка среды](development/DEVELOPMENT.md)
- [Пользовательские сценарии к 1.0 — ещё не опубликованы](development/UPCOMING_1_0_USER_GUIDE.md)
- [Архитектура Chromium/общих компонентов](development/ARCHITECTURE.md)
- [Архитектура Firefox](development/FIREFOX_ARCHITECTURE.md)
- [Тестирование и браузерная QA](development/TESTING.md)
- [Процесс выпуска](development/RELEASE_PROCESS.md)
- [Firefox release build](development/FIREFOX_RELEASE_BUILD.md)
- [Firefox AMO reviewer notes](development/FIREFOX_AMO_REVIEW.md)
- [Опубликованный release 0.0.4.0](development/release-drafts/0.0.4.0.md) —
  архивная ссылка и границы выпуска.
- [Правила участия](../CONTRIBUTING.md) и
  [политика безопасности](../SECURITY.md)

Точечные браузерные чек-листы находятся в [`development/qa/`](development/qa/).
Они описывают инженерную проверку, а не обычную установку.

## История

- [README исходного проекта](legacy/UPSTREAM_README.md)
- [Архив upstream-документации](legacy/)

`docs/legacy/**` сохраняет старые MV2/Firefox-магазинные инструкции как историю;
они не являются руководством для текущего продукта. Репозиторий продолжает
работу [`anticensority/runet-censorship-bypass`](https://github.com/anticensority/runet-censorship-bypass)
с сохранением истории, авторства и GPL-3.0 атрибуции.
