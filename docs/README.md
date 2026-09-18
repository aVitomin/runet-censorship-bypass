# Документация Runet Censorship Bypass

Начните с [установки](user/INSTALLATION.md), затем откройте popup расширения и
нажмите **Apply / Enable**. Для текущего сайта можно выбрать **Auto**, **Proxy**
или **Direct**; подробности есть в [руководстве](user/USER_GUIDE.md).

Текущий опубликованный стабильный выпуск —
[`v0.0.3.0`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/tag/v0.0.3.0),
только для Chromium. `0.0.4.0` готовится как совместный Chromium/Firefox выпуск,
но ещё не опубликован. Обычная установка Firefox появится только после Mozilla
signing; unsigned XPI остаётся reviewer/development-артефактом.

## Пользователям

- [Установка, обновление и удаление](user/INSTALLATION.md) — Chromium ZIP,
  Firefox signed-XPI/AMO boundary и первый запуск.
- [Руководство пользователя](user/USER_GUIDE.md) — Auto / Proxy / Direct,
  правила сайтов, прокси, Tor, Tor Browser, WARP, health и диагностика.
- [Решение проблем](user/TROUBLESHOOTING.md) — действия по наблюдаемому симптому.
- [Приватность и безопасность](user/PRIVACY_AND_SECURITY.md) — локальные данные,
  сетевые стороны, разрешения и границы защиты.

Для готовящегося выпуска проверены Google Chrome, Microsoft Edge, Brave и
Firefox 154+. Яндекс Браузер, Opera, Vivaldi и другие современные Chromium-
браузеры с необходимыми MV3 API ожидаются совместимыми, но отдельно не
тестировались.

## Разработчикам и участникам

- [Подготовка среды](development/DEVELOPMENT.md)
- [Архитектура Chromium/общих компонентов](development/ARCHITECTURE.md)
- [Архитектура Firefox](development/FIREFOX_MV3_ARCHITECTURE.md)
- [Тестирование и браузерная QA](development/TESTING.md)
- [Процесс выпуска](development/RELEASE_PROCESS.md)
- [Firefox release build](development/FIREFOX_RELEASE_BUILD.md)
- [Firefox AMO reviewer notes](development/FIREFOX_AMO_REVIEW.md)
- [Черновик release notes 0.0.4.0](development/release-drafts/0.0.4.0.md) —
  ещё не опубликованный выпуск.
- [Совместимость старых настроек](development/LEGACY_MIGRATION.md)
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
