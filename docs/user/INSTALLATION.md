# Установка, обновление и удаление

Runet Censorship Bypass поддерживает Chromium MV3 и Firefox MV3.

Для готовящегося `0.0.4.0` проверены Google Chrome, Microsoft Edge, Brave и
Firefox 154+. Яндекс Браузер, Opera, Vivaldi и другие современные Chromium-
браузеры с необходимыми MV3 API ожидаются совместимыми, но отдельно для этого
выпуска не тестировались.

Сейчас опубликован только Chromium-выпуск `v0.0.3.0`. Совместный `0.0.4.0` ещё
не опубликован; обычная установка Firefox появится после Mozilla signing.

## Chromium: установить стабильный ZIP

### 1. Скачать и проверить

Откройте
[`v0.0.3.0`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/tag/v0.0.3.0)
и скачайте именно
[`runet-censorship-bypass-mv3-0.0.3.0-cd59e14.zip`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.3.0/runet-censorship-bypass-mv3-0.0.3.0-cd59e14.zip),
а не автоматически созданный **Source code**.

Ожидаемый SHA-256:

```text
68a32aa9162d5ba8b2cd9070c2eba6e5eb055434b899c284107c55d3e5a55635
```

Файл проверки:
[`runet-censorship-bypass-mv3-0.0.3.0-cd59e14.sha256.txt`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.3.0/runet-censorship-bypass-mv3-0.0.3.0-cd59e14.sha256.txt).

В PowerShell:

```powershell
Get-FileHash .\runet-censorship-bypass-mv3-0.0.3.0-cd59e14.zip -Algorithm SHA256
```

Не устанавливайте архив, если хэш отличается.

### 2. Распаковать и загрузить

1. Полностью распакуйте ZIP в постоянную папку.
2. Откройте страницу расширений браузера.
3. Включите **Developer mode / Режим разработчика**.
4. Нажмите **Load unpacked / Загрузить распакованное расширение**.
5. Выберите папку, где `manifest.json` находится непосредственно в корне.
6. Закрепите значок расширения на панели.

| Браузер | Страница расширений | Статус для `0.0.4.0` |
| --- | --- | --- |
| Google Chrome | `chrome://extensions` | Проверен |
| Microsoft Edge | `edge://extensions` | Проверен |
| Brave | `brave://extensions` | Проверен |
| Яндекс Браузер | `browser://extensions` | Ожидается совместимым |
| Opera | `opera:extensions` | Ожидается совместимым |
| Vivaldi | `vivaldi://extensions` | Ожидается совместимым |

Если специальный адрес отличается, откройте меню браузера и найдите раздел
**Extensions / Расширения**. Папку установленного unpacked-расширения нельзя
перемещать или удалять: браузер продолжает читать файлы из неё.

Яндекс Браузер может отключать расширения из непроверенного источника после
перезапуска. Это
[ограничение браузера](https://yandex.com/support/browser/en/security/check-extensions?lang=ru),
а не состояние Active внутри расширения.

## Firefox: только подписанная пользовательская установка

Обычный пользователь должен устанавливать Firefox-версию только:

1. со страницы Mozilla Add-ons (AMO); или
2. из Mozilla-подписанного XPI опубликованного выпуска.

Таких публичных ссылок пока нет. Не обходите проверку подписи и не используйте
unsigned reviewer XPI как обычную пользовательскую версию. После публикации
ссылки появятся в README и release notes.

Firefox попросит подтвердить разрешения. Для **Apply** требуется разрешить
работу расширения в приватных окнах: без него включение завершается безопасной
ошибкой и не меняет proxy settings.

### Временная установка для разработчиков

Unsigned XPI можно временно установить через `about:debugging` только для
review/development QA. После перезапуска такая установка может исчезнуть. Этот
путь описан отдельно в
[Firefox release build](../development/FIREFOX_RELEASE_BUILD.md) и не является
пользовательской инструкцией.

## Первый запуск

1. Откройте значок Runet Censorship Bypass.
2. Нажмите **Apply / Enable** и дождитесь состояния **Active**.
3. При необходимости выберите для текущего сайта **Auto**, **Proxy** или
   **Direct** и область правила.

Advanced-настройки собственных прокси, Tor, Tor Browser и WARP находятся в
[руководстве пользователя](USER_GUIDE.md), а не нужны для обычного старта.

## Обновление

### Chromium Load unpacked

1. Скачайте новый ZIP только со страницы
   [Releases](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases).
2. Проверьте опубликованный SHA-256.
3. Распакуйте выпуск в отдельную постоянную папку.
4. Загрузите новую папку либо полностью замените содержимое старой и нажмите
   **Reload**. Не смешивайте файлы разных версий.

### Firefox

AMO или подписанный XPI использует механизм обновлений Firefox. Не заменяйте
подписанную установку временным unsigned add-on.

## Удаление

1. Если расширение активно, нажмите **Turn off / Clear**, чтобы вернуть
   предыдущую конфигурацию прокси.
2. Удалите расширение на странице расширений браузера.
3. После удаления Chromium-карточки можно удалить её постоянную unpacked-папку.

Расширение не очищает настройку, принадлежащую другому расширению или политике.
Если установка, Apply или восстановление proxy settings не работают, используйте
[решение проблем](TROUBLESHOOTING.md).

## English summary

Release-tested for the upcoming `0.0.4.0`: Google Chrome, Microsoft Edge,
Brave, and Firefox 154+. Yandex Browser, Opera, Vivaldi, and other modern
Chromium browsers with the required MV3 APIs are expected to be compatible but
were not separately release-tested.

The published stable release is still Chromium-only `v0.0.3.0`: download its
ZIP, verify SHA-256, extract it, enable **Developer mode**, and choose
**Load unpacked**. Normal Firefox installation will require an AMO listing or a
Mozilla-signed XPI; no public Firefox download exists yet. Unsigned XPI loading
is for temporary developer/reviewer testing only.
