# Установка, обновление и удаление

**Версия 1.0.1 доступна в обоих магазинах.** Для ручной установки также
доступны Chromium ZIP и подписанный Mozilla Firefox XPI.

## Установить из магазина

| Браузер | Версия | Где установить |
| --- | --- | --- |
| Chrome, Brave и совместимые Chromium-браузеры | **1.0.1** | [Chrome Web Store](https://chromewebstore.google.com/detail/poohkdbmgajmcifcaijdjgiihghlgbph) |
| Firefox **140+** | **1.0.1** | [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/runet-censorship-bypass-mv3/) |

1. Откройте магазин в нужном браузере, нажмите кнопку установки и подтвердите разрешения.
2. Закрепите значок расширения на панели.
3. В Firefox откройте **Дополнения и темы → Расширения → Обход блокировок Рунета — Revived**
   и разрешите работу в приватных окнах. Это требуется для общей настройки
   прокси, в том числе в обычных окнах.
4. Настройте расширение по разделу [«Первый запуск»](#первый-запуск).

Магазин — основной способ установки и получения следующих одобренных обновлений.
Если установка ограничена политикой организации, обратитесь к администратору.

## Требования

В манифестах **1.0.1** установлены расчётные минимумы:
**Chromium 108+** и **Firefox 140+**, включая ESR на подходящей базе.
Ожидается работа в совместимых настольных браузерах с Manifest V3 и API прокси.
Версия движка Chromium важнее собственного номера Brave, Opera или другого
форка. Android, iOS, WebView и браузеры без нужных API в эту оценку не входят.
Каждая версия и каждый форк отдельно не проверялись;
[основания и фактические проверки](../development/BROWSER_COMPATIBILITY.md) указаны отдельно.

Проверенные браузеры и границы QA: [технические сведения о выпуске 1.0.1](../development/releases/1.0.1.md).

## Ручная установка Chromium: ZIP

1. Скачайте [готовый ZIP 1.0.1](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.1/runet-censorship-bypass-mv3-1.0.1-4b9a9b3.zip)
   и [его контрольную сумму](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.1/runet-censorship-bypass-mv3-1.0.1-4b9a9b3.zip.sha256.txt).
2. Проверьте SHA-256 и полностью распакуйте ZIP в постоянную папку.
3. Откройте `chrome://extensions`, `brave://extensions` или `edge://extensions`.
4. Включите **Режим разработчика → Загрузить распакованное расширение**.
5. Выберите папку, в корне которой находится `manifest.json`, и закрепите значок.

Не перемещайте и не удаляйте эту папку: браузер продолжает читать её файлы.
Архивы **Source code** содержат исходники, а не готовое расширение.

SHA-256 ZIP:

```text
8bd77fab8e414d2bc092801153fcf731b43bf1581f3588a5ec6cffab9daffdd8
```

Пример проверки в Windows:

```powershell
Get-FileHash .\runet-censorship-bypass-mv3-1.0.1-4b9a9b3.zip -Algorithm SHA256
```

Если сумма отличается, не устанавливайте файл.

## Ручная установка Firefox: подписанный XPI

1. Скачайте [подписанный Firefox XPI 1.0.1](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.1/runet-censorship-bypass-firefox-1.0.1-signed.xpi)
   и [его контрольную сумму](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.1/runet-censorship-bypass-firefox-1.0.1-signed.sha256.txt).
2. Проверьте SHA-256. В Firefox откройте **Дополнения и темы → шестерёнка →
   Установить дополнение из файла**, выберите XPI и подтвердите установку.
3. Разрешите расширению работу в приватных окнах и закрепите значок.

Это тот же файл, который распространяет Mozilla; зеркало GitHub не меняет его содержимое.

SHA-256 XPI:

```text
15e49ac406b0788bb35b002df1e81107012ede6093d411000db3565f980b75cb
```

Для проверки используйте `Get-FileHash` с именем XPI. Unsigned-кандидаты и временная
загрузка через `about:debugging` предназначены для разработки, не для обычной установки.

## Первый запуск

Расширение начинает работу с выключенной маршрутизацией. Откройте настройки,
выберите источник, при необходимости настройте подключения, нажмите
**Сохранить настройки**, затем отдельно **Применить**.

Режим **Только мои правила и подключения** не требует автоматической базы.
Для режима **Прокси** нужно подходящее настроенное подключение.
Расширение не предоставляет VPN или прокси-сервер и не запускает локальные службы.

[Настройка и повседневное использование](USER_GUIDE_1_0.md).

## Обновить расширение

### Установка из магазина

Браузер получает новые одобренные версии через обновление расширений, если
автообновления разрешены. После обновления проверьте версию, настройки и состояние
маршрутизации. Подписанный Firefox XPI с тем же идентификатором также можно обновить вручную.

### Chromium: сохранить ту же установку

Для расширения, загруженного из распакованного ZIP:

1. Выключите маршрутизацию перед заменой файлов.
2. Скачайте новый ZIP из [Releases](https://github.com/aVitomin/runet-censorship-bypass/releases)
   и проверьте SHA-256.
3. Полностью замените файлы в **той же постоянной папке**. Не смешивайте разные версии.
4. На странице расширений нажмите **Перезагрузить / Reload** у существующей карточки.
5. Проверьте настройки и явно примените их.

ZIP не обновляется через магазин. Другая папка или переход с распакованной
Chromium-версии на магазинную могут создать отдельную установку с собственным
хранилищем. Для переноса используйте экспорт и импорт настроек 1.0; пароли и
адрес пользовательского источника нужно ввести заново. Выключите прежнюю
установку перед применением новой, чтобы они не конкурировали за управление прокси.
Не рассчитывайте на автоматический перенос данных между установками.

## Обновить данные или удалить расширение

Обновление данных маршрутизации в **Обслуживании** не устанавливает новую версию
расширения. Оно сохраняет применённые настройки и не включает выключенную
маршрутизацию: [подробнее](USER_GUIDE_1_0.md#обновить-данные-маршрутизации).

Для удаления сначала выключите маршрутизацию, затем удалите расширение на
странице расширений браузера. После удаления распакованной Chromium-установки
можно удалить её постоянную папку.

Для старого **Firefox 0.0.4.0** сохранено [отдельное руководство](USER_GUIDE.md).
В нём другой интерфейс и отключено удалённое обновление базы.

## English summary

Install **Chrome 1.0.0** from [Chrome Web Store](https://chromewebstore.google.com/detail/poohkdbmgajmcifcaijdjgiihghlgbph) or **Firefox 1.0.1** from
[Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/runet-censorship-bypass-mv3/). Firefox requires **140+** and private-window
permission for browser-wide proxy control. Store installations receive approved
updates through the browser when automatic updates are enabled.

**Chromium 1.0.1** is available as a manual ZIP and its store update is under
review. **Firefox 1.0.1** is also available as a Mozilla-signed XPI. Version **1.0.1** targets desktop **Chromium 108+** and **Firefox 140+**,
including ESR releases on a compatible base. These are API-based compatibility
estimates, not test results for every version or fork. Required MV3 and proxy
extension APIs must be available; mobile browsers and WebView are outside this scope.

For manual installation, verify the ZIP/XPI checksum. Load the extracted Chromium
folder in Developer mode, or install the Mozilla-signed XPI through Firefox's
Add-ons Manager. An unpacked Chromium installation needs manual file updates.
Switching it to a store installation may require settings transfer; exported
settings omit credentials and custom-source URLs. Disable the old installation
before applying the new one.

Save records settings; Apply activates them. See the [1.0 guide](USER_GUIDE_1_0.md#english-summary).
