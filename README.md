<p align="center">
  <img src="extension/src/assets/brand/icon-512.png" alt="Знак Runet Censorship Bypass" width="88">
</p>

# Runet Censorship Bypass

Расширение для Chromium и Firefox: выбирайте для сайта **Авто**, **Прокси**
или **Напрямую**, настраивайте свои подключения и правила.
Расширение не предоставляет VPN или прокси-сервер — оно использует выбранный
источник, ваш прокси либо отдельно запущенное локальное приложение.

[Установка](docs/user/INSTALLATION.md) ·
[Руководство 1.0](docs/user/USER_GUIDE_1_0.md) ·
[Помощь](https://github.com/aVitomin/runet-censorship-bypass/issues/new/choose) ·
[English](#english)

## Скачать для своего браузера

| Браузер и версия | Статус | Установка |
| --- | --- | --- |
| **Chromium 1.0.0** — Chrome, Edge, Brave и совместимые браузеры | [GitHub Release v1.0.0](https://github.com/aVitomin/runet-censorship-bypass/releases/tag/v1.0.0) | [Скачать ZIP](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.0/runet-censorship-bypass-mv3-1.0.0-9de66de.zip), распаковать и загрузить в режиме разработчика |
| **Firefox 1.0** | Отправлен в Mozilla Add-ons, ожидает проверки | Подписанного пользовательского пакета пока нет |
| **Firefox 0.0.4.0** | Доступная подписанная версия | [Скачать Mozilla-подписанный XPI](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v0.0.4.0/runet-censorship-bypass-firefox-0.0.4.0-signed.xpi) из [v0.0.4.0](https://github.com/aVitomin/runet-censorship-bypass/releases/tag/v0.0.4.0) |

Публикация в Chrome Web Store готовится отдельно; ссылки на установку из
магазина пока нет. Firefox 1.0 появится для обычной установки после проверки
и подписания Mozilla. Не используйте unsigned XPI вместо подписанного пакета.

Firefox требует **154.0 или новее**. Для Chromium нужен современный браузер
с поддержкой используемых MV3 API; совместимость со всеми Chromium-форками
не гарантируется. Автоматические архивы **Source code** не являются готовым
расширением.

## Установить и начать работу

**Chromium:** распакуйте ZIP в постоянную папку → откройте
`chrome://extensions` (в Edge — `edge://extensions`) → включите
**Режим разработчика** → **Загрузить распакованное расширение** → выберите
папку с `manifest.json`. Сохраняйте эту папку на месте.

**Firefox 0.0.4.0:** откройте подписанный XPI в Firefox и подтвердите установку.
В **Дополнения и темы → Расширения** разрешите расширению работу в приватных
окнах: это требуется используемой общей настройкой прокси.

Откройте настройки, выберите источник и при необходимости настройте подключение.
Для версии 1.0 нажмите **Сохранить настройки**, затем отдельно **Применить**.
Для старого Firefox используйте [руководство 0.0.4.0](docs/user/USER_GUIDE.md):
часть действий и названий кнопок отличается.

[Подробная установка, проверка SHA-256 и обновление](docs/user/INSTALLATION.md)

## Основные действия версии 1.0

| Действие | Что происходит |
| --- | --- |
| **Авто** | Действуют выбранный источник и общие правила; это не обязательно Direct |
| **Прокси** | Сайт использует выбранные подключения; подходящий прокси нужно настроить |
| **Напрямую** | Сайт обходит прокси расширения |
| **Сохранить** | Новые настройки записаны, прежние продолжают действовать |
| **Применить** | Проверенные сохранённые настройки начинают действовать |

Правила можно ограничить одним хостом или доменом с поддоменами.
Режим **Только мои правила и подключения** работает без автоматической базы.
Tor, Tor Browser и WARP подключаются отдельно; расширение не устанавливает
и не запускает эти службы.

В 1.0 доступны перенос настроек с предварительным просмотром и отдельный
очищенный отчёт для поддержки. Импорт сохраняет настройки, но не включает
маршрутизацию. Обновление данных не применяет другие ожидающие изменения.

[Как настроить источники, подключения и обновления](docs/user/USER_GUIDE_1_0.md)

## Интерфейс 1.0

Снимки относятся к версии 1.0. Интерфейс Firefox показан для версии, ожидающей
проверки Mozilla; он отличается от доступного подписанного Firefox 0.0.4.0.

<p align="center">
  <img src="docs/assets/releases/1.0/chromium/06-native-popup.png" alt="Панель расширения Chromium 1.0" width="392">
  <img src="docs/assets/releases/1.0/firefox/05-native-popup-direct.png" alt="Панель Firefox 1.0, версия ожидает проверки Mozilla" width="380">
</p>

Слева — настоящая панель Chromium, справа — Firefox. На тестовом сайте
`news.example` выбрано явное прямое соединение.

<details>
<summary>Настройки Chromium и Firefox</summary>

![Настройки Chromium 1.0](docs/assets/releases/1.0/chromium/01-overview-active.png)

![Настройки Firefox 1.0 — версия ожидает проверки Mozilla](docs/assets/releases/1.0/firefox/01-overview-manual-active.png)

</details>

[Галерея и сведения о снимках](docs/assets/releases/1.0/README.md)

## Приватность и помощь

**Защита включена** означает управление маршрутизацией, а не гарантию
анонимности, доступности всех сайтов или защиты от утечек.
Прокси может видеть адрес назначения и доступную ему часть трафика.
Используйте доверенные источники и подключения.

- [Приватность версии 1.0](docs/release/PRIVACY_1_0.md)
- [Приватность опубликованной 0.0.4.0](docs/user/PRIVACY_AND_SECURITY.md)
- [Диагностика в 1.0](docs/user/USER_GUIDE_1_0.md#если-возникла-проблема)
- [Решение проблем в 0.0.4.0](docs/user/TROUBLESHOOTING.md)
- [Сообщить о проблеме](https://github.com/aVitomin/runet-censorship-bypass/issues/new/choose)
- [Сообщить об уязвимости приватно](SECURITY.md)

Не прикладывайте к публичным обращениям пароли, профиль браузера или файлы
настроек с частными адресами. [Вся документация](docs/README.md).

<details>
<summary>Файлы и контрольные суммы</summary>

**Chromium 1.0.0**

`runet-censorship-bypass-mv3-1.0.0-9de66de.zip`

SHA-256: `0faa3e0208c9d8295d2216066184930ece89eddeae20d1d37e9ede0c2a1a48bb`

[Файл контрольной суммы Chromium](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v1.0.0/runet-censorship-bypass-mv3-1.0.0-9de66de.zip.sha256.txt)

**Firefox 0.0.4.0 — подписанная версия**

`runet-censorship-bypass-firefox-0.0.4.0-signed.xpi`

SHA-256: `c7e3042e48819644673db92b9150a9d54a551281046212d896a7f7202bc9c34c`

[Файл контрольной суммы Firefox](https://github.com/aVitomin/runet-censorship-bypass/releases/download/v0.0.4.0/runet-censorship-bypass-firefox-0.0.4.0-signed.sha256.txt)

</details>

## English

Runet Censorship Bypass controls browser routing with **Auto**, **Proxy**, and
**Direct** rules. It provides no VPN or proxy service.

Chromium **1.0.0** is available as a ZIP for unpacked installation.
Firefox **1.0** is awaiting Mozilla review; the available signed fallback is
**0.0.4.0**. Chrome Web Store publication is being prepared separately.
Never use an unsigned XPI as a normal Firefox installation.

See [Installation](docs/user/INSTALLATION.md#english-summary),
[the 1.0 guide](docs/user/USER_GUIDE_1_0.md#english-summary), and
[version 1.0 privacy](docs/release/PRIVACY_1_0.md).
Save and Import record settings; Apply activates them.
The active indicator is not a connectivity or anonymity guarantee.

<details>
<summary>Разработка и история</summary>

[Среда разработки](docs/development/DEVELOPMENT.md) ·
[Архитектура](docs/development/ARCHITECTURE.md) ·
[Тестирование](docs/development/TESTING.md) ·
[Процесс выпуска](docs/development/RELEASE_PROCESS.md) ·
[Участие в проекте](CONTRIBUTING.md) ·
[Исторический README](docs/legacy/UPSTREAM_README.md)

</details>

Проект продолжает работу
[Anticensority](https://github.com/anticensority/runet-censorship-bypass)
с сохранением истории и авторства. Лицензия: [GNU GPL v3](LICENSE).
