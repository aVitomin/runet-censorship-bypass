# Установка, обновление и удаление

Runet Censorship Bypass поддерживает Chromium MV3 и Firefox MV3.

Для выпуска `0.0.4.0` проверены Google Chrome, Microsoft Edge, Brave и
Firefox 154+. Яндекс Браузер, Opera, Vivaldi и другие современные Chromium-
браузеры с необходимыми MV3 API ожидаются совместимыми, но отдельно для этого
выпуска не тестировались.

Текущий стабильный [`v0.0.4.0`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/tag/v0.0.4.0) —
первый общий выпуск для Chromium и Firefox.

## Chromium: установить стабильный ZIP

### 1. Скачать и проверить

Откройте
[`v0.0.4.0`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/tag/v0.0.4.0)
и скачайте именно
[`runet-censorship-bypass-mv3-0.0.4.0-7c0c64c.zip`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.4.0/runet-censorship-bypass-mv3-0.0.4.0-7c0c64c.zip),
а не автоматически созданный **Source code**.

Ожидаемый SHA-256:

```text
e702dff6ba3fe9bb3291de413c4e106f95dcd9b83f9cf8fc98f9635f5990f236
```

Файл проверки:
[`runet-censorship-bypass-mv3-0.0.4.0-7c0c64c.sha256.txt`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.4.0/runet-censorship-bypass-mv3-0.0.4.0-7c0c64c.sha256.txt).

В PowerShell:

```powershell
Get-FileHash .\runet-censorship-bypass-mv3-0.0.4.0-7c0c64c.zip -Algorithm SHA256
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

Обычный пользователь должен скачать Mozilla-подписанный
[`runet-censorship-bypass-firefox-0.0.4.0-signed.xpi`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.4.0/runet-censorship-bypass-firefox-0.0.4.0-signed.xpi)
из опубликованного GitHub Release. Ожидаемый SHA-256:

```text
c7e3042e48819644673db92b9150a9d54a551281046212d896a7f7202bc9c34c
```

Файл проверки:
[`runet-censorship-bypass-firefox-0.0.4.0-signed.sha256.txt`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/download/v0.0.4.0/runet-censorship-bypass-firefox-0.0.4.0-signed.sha256.txt).

Публичной AMO-страницы для нового Gecko ID пока нет. Не обходите проверку
подписи и не используйте unsigned reviewer XPI как обычную пользовательскую
версию.

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

До появления публичной AMO-страницы проверяйте новый GitHub Release и
устанавливайте следующий Mozilla-подписанный XPI вручную. Не заменяйте
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

Release-tested for `0.0.4.0`: Google Chrome, Microsoft Edge, Brave, and Firefox
154+. Yandex Browser, Opera, Vivaldi, and other modern
Chromium browsers with the required MV3 APIs are expected to be compatible but
were not separately release-tested.

The current stable release is the dual-browser `v0.0.4.0`. Chromium users
download and verify the published ZIP, extract it, enable **Developer mode**,
and choose **Load unpacked**. Firefox 154+ users install the Mozilla-signed XPI
from the same GitHub Release. No public AMO listing exists for the new Firefox
ID yet; unsigned XPI loading is only for temporary developer/reviewer testing.
